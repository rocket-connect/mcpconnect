import {
  MCPAdapter,
  MCPConfig,
  MCPConnectionResult,
  MCPToolExecutionResult,
  MCPMessage,
  MCPServerInfo,
  MCPCapabilities,
  MCPToolDefinition,
  MCPResourceDefinition,
  MCPSSEEvent,
} from "@mcpconnect/base-adapters";
import { Connection, Tool, Resource, ToolExecution } from "@mcpconnect/schemas";
import {
  postJsonToApi,
  createJsonResponseHandler,
  createJsonErrorResponseHandler,
  createEventSourceResponseHandler,
  type ResponseHandler,
  type FetchFunction,
  combineHeaders,
  withUserAgentSuffix,
  delay,
  isAbortError,
} from "@ai-sdk/provider-utils";
import { APICallError } from "@ai-sdk/provider";
import { z } from "zod";
import { AdapterError, AdapterStatus } from "@mcpconnect/base-adapters";

/**
 * MCP Error Response Schema for AI SDK error handling
 */
const MCPErrorResponseSchema = z.object({
  error: z.object({
    code: z.number(),
    message: z.string(),
    data: z.unknown().optional(),
  }),
});

/**
 * MCP Success Response Schema
 */
const MCPSuccessResponseSchema = z.object({
  result: z.unknown(),
});

/**
 * Concrete implementation of MCP Service with full AI SDK integration
 */
export class MCPService extends MCPAdapter {
  private static instance: MCPService | null = null;
  private static requestId = 1;
  private fetch?: FetchFunction;

  constructor(config?: Partial<MCPConfig>, fetch?: FetchFunction) {
    const defaultConfig: MCPConfig = {
      name: "mcpconnect-mcp-service",
      provider: "mcp",
      protocolVersion: "2024-11-05",
      debug: false,
      timeout: 30000,
      retries: 3,
      clientInfo: {
        name: "MCPConnect",
        version: "0.0.11",
        description: "MCPConnect browser-based MCP client",
      },
    };

    super({ ...defaultConfig, ...config });
    this.fetch = fetch;
  }

  /**
   * Get singleton instance with optional fetch override
   */
  static getInstance(
    config?: Partial<MCPConfig>,
    fetch?: FetchFunction
  ): MCPService {
    // Always create a new instance if fetch is provided to avoid fetch conflicts
    if (fetch || !MCPService.instance) {
      MCPService.instance = new MCPService(config, fetch);
    }
    return MCPService.instance;
  }

  /**
   * Generate a unique request ID
   */
  private getNextRequestId(): string {
    return `req_${MCPService.requestId++}_${this.generateId()}`;
  }

  /**
   * Prepare headers for MCP requests using AI SDK utilities
   */
  private prepareHeaders(connection: Connection): Record<string, string> {
    const baseHeaders: Record<string, string> = {
      "Content-Type": "application/json",
    };

    // Add connection-specific headers
    const connectionHeaders = connection.headers || {};

    // Add SSE specific headers
    const sseHeaders: Record<string, string> = {};
    if (connection.connectionType === "sse") {
      sseHeaders["Accept"] = "text/event-stream";
      sseHeaders["Cache-Control"] = "no-cache";
      sseHeaders["Connection"] = "keep-alive";
    }

    // Add authentication headers
    const authHeaders: Record<string, string> = {};
    if (connection.authType === "bearer" && connection.credentials?.token) {
      authHeaders["Authorization"] = `Bearer ${connection.credentials.token}`;
    } else if (
      connection.authType === "apiKey" &&
      connection.credentials?.apiKey
    ) {
      authHeaders["X-API-Key"] = connection.credentials.apiKey;
    } else if (
      connection.authType === "basic" &&
      connection.credentials?.username &&
      connection.credentials?.password
    ) {
      const auth = btoa(
        `${connection.credentials.username}:${connection.credentials.password}`
      );
      authHeaders["Authorization"] = `Basic ${auth}`;
    }

    // Combine headers using AI SDK utility and add user agent
    return withUserAgentSuffix(
      combineHeaders(baseHeaders, connectionHeaders, sseHeaders, authHeaders),
      "mcpconnect/0.0.11"
    );
  }

  /**
   * Create error response handler using AI SDK utilities
   */
  private createErrorHandler(): ResponseHandler<APICallError> {
    return createJsonErrorResponseHandler({
      errorSchema: MCPErrorResponseSchema,
      errorToMessage: error =>
        `MCP Error ${error.error.code}: ${error.error.message}`,
      isRetryable: (response, error) => {
        // Retry on 5xx server errors, but not on 4xx client errors
        if (response.status >= 500) return true;

        // Don't retry on specific MCP error codes that indicate permanent failures
        if (error?.error.code === -32601) return false; // Method not found
        if (error?.error.code === -32602) return false; // Invalid params

        return false;
      },
    });
  }

  /**
   * Convert API error to Adapter error
   */
  private convertApiError(error: APICallError, context: string): AdapterError {
    return new AdapterError(
      error.message || `API error in ${context}`,
      "API_ERROR",
      {
        context,
        statusCode: error.statusCode,
        url: error.url,
        originalError: error,
      }
    );
  }

  /**
   * Create success response handler
   */
  private createSuccessHandler(): ResponseHandler<any> {
    return createJsonResponseHandler(MCPSuccessResponseSchema);
  }

  /**
   * Create SSE response handler
   */
  private createSSEHandler(): ResponseHandler<ReadableStream<any>> {
    return createEventSourceResponseHandler(
      z.object({
        type: z.string(),
        data: z.unknown().optional(),
        id: z.string().optional(),
      })
    );
  }

  /**
   * Send a JSON-RPC 2.0 request using AI SDK utilities
   */
  private async sendMCPRequest(
    connection: Connection,
    method: string,
    params?: Record<string, any>,
    abortSignal?: AbortSignal
  ): Promise<any> {
    const request: MCPMessage = {
      jsonrpc: "2.0",
      id: this.getNextRequestId(),
      method,
      params: params || {},
    };

    console.log(
      `[MCP] Sending ${method} request to ${connection.url} via ${connection.connectionType}:`,
      request
    );

    try {
      switch (connection.connectionType) {
        case "sse":
          return this.sendSSERequest(connection, request, abortSignal);
        case "http":
          return this.sendHTTPRequest(connection, request, abortSignal);
        case "websocket":
          return this.sendWebSocketRequest(connection, request);
        default: {
          // Auto-detect based on URL protocol
          const url = new URL(connection.url);
          if (url.protocol === "http:" || url.protocol === "https:") {
            return this.sendHTTPRequest(connection, request, abortSignal);
          } else if (url.protocol === "ws:" || url.protocol === "wss:") {
            return this.sendWebSocketRequest(connection, request);
          } else {
            throw new AdapterError(
              `Unsupported protocol: ${url.protocol}`,
              "UNSUPPORTED_PROTOCOL"
            );
          }
        }
      }
    } catch (error) {
      console.error(`[MCP] Request failed for ${method}:`, error);
      throw error;
    }
  }

  /**
   * Send request via SSE using AI SDK utilities
   */
  private async sendSSERequest(
    connection: Connection,
    request: MCPMessage,
    abortSignal?: AbortSignal
  ): Promise<any> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new AdapterError("SSE request timeout", "REQUEST_TIMEOUT"));
      }, connection.timeout || 30000);

      // Use AI SDK's postJsonToApi for better error handling and retries
      postJsonToApi({
        url: connection.url,
        headers: this.prepareHeaders(connection),
        body: request,
        successfulResponseHandler: this.createSSEHandler(),
        failedResponseHandler: this.createErrorHandler(),
        abortSignal,
        fetch: this.fetch,
      })
        .then(async ({ value: stream }) => {
          const reader = stream.getReader();

          try {
            // eslint-disable-next-line no-constant-condition
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;

              if (value.success && value.value) {
                const event = value.value as MCPSSEEvent;
                console.log(`[MCP] SSE event:`, event);

                if (event.type === "complete" && event.data?.result) {
                  clearTimeout(timeout);
                  resolve(event.data.result);
                  return;
                } else if (event.type === "error") {
                  clearTimeout(timeout);
                  reject(
                    new AdapterError(
                      event.data?.message || "SSE error",
                      "SSE_ERROR",
                      event.data
                    )
                  );
                  return;
                }
              }
            }
          } catch (streamError) {
            clearTimeout(timeout);
            reject(streamError);
          }
        })
        .catch(error => {
          clearTimeout(timeout);
          // Convert API error to Adapter error if needed
          if (error.url && error.statusCode) {
            reject(this.convertApiError(error, "SSE request"));
          } else {
            reject(error);
          }
        });
    });
  }

  /**
   * Send request via HTTP using AI SDK utilities
   */
  private async sendHTTPRequest(
    connection: Connection,
    request: MCPMessage,
    abortSignal?: AbortSignal
  ): Promise<any> {
    try {
      const { value } = await postJsonToApi({
        url: connection.url,
        headers: this.prepareHeaders(connection),
        body: request,
        successfulResponseHandler: this.createSuccessHandler(),
        failedResponseHandler: this.createErrorHandler(),
        abortSignal,
        fetch: this.fetch,
      });

      console.log(`[MCP] HTTP response:`, value);
      return value.result;
    } catch (error) {
      // Convert API error to Adapter error if needed
      if (
        error &&
        typeof error === "object" &&
        "url" in error &&
        "statusCode" in error
      ) {
        throw this.convertApiError(error as APICallError, "HTTP request");
      }
      throw error;
    }
  }

  /**
   * Send request via WebSocket (fallback to manual implementation)
   */
  private async sendWebSocketRequest(
    connection: Connection,
    request: MCPMessage
  ): Promise<any> {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(connection.url);
      const timeout = setTimeout(() => {
        ws.close();
        reject(
          new AdapterError("WebSocket request timeout", "REQUEST_TIMEOUT")
        );
      }, connection.timeout || 30000);

      ws.onopen = () => {
        console.log(`[MCP] WebSocket connected to ${connection.url}`);
        ws.send(JSON.stringify(request));
      };

      ws.onmessage = event => {
        try {
          const response = JSON.parse(event.data);
          console.log(`[MCP] WebSocket response:`, response);

          clearTimeout(timeout);
          ws.close();

          if (response.error) {
            reject(
              new AdapterError(
                `MCP Error ${response.error.code}: ${response.error.message}`,
                "MCP_ERROR",
                response.error
              )
            );
          } else {
            resolve(response.result);
          }
        } catch (error) {
          clearTimeout(timeout);
          ws.close();
          reject(error);
        }
      };

      ws.onerror = error => {
        clearTimeout(timeout);
        reject(
          new AdapterError(`WebSocket error: ${error}`, "WEBSOCKET_ERROR")
        );
      };

      ws.onclose = event => {
        clearTimeout(timeout);
        if (event.code !== 1000) {
          reject(
            new AdapterError(
              `WebSocket closed unexpectedly: ${event.code} ${event.reason}`,
              "WEBSOCKET_CLOSED"
            )
          );
        }
      };
    });
  }

  async initialize(): Promise<void> {
    console.log("MCPService initialized with AI SDK integration");
    this.status = AdapterStatus.IDLE;
  }

  async cleanup(): Promise<void> {
    console.log("MCPService cleaned up");
    this.status = AdapterStatus.DISCONNECTED;
  }

  /**
   * Test connection to MCP server with improved error handling
   */
  async testConnection(connection: Connection): Promise<boolean> {
    try {
      console.log(
        `[MCP] Testing connection to ${connection.name} via ${connection.connectionType}`
      );

      // Create abort signal with timeout
      const abortController = new AbortController();
      const timeout = setTimeout(() => {
        abortController.abort();
      }, connection.timeout || 30000);

      try {
        const result = await this.sendMCPRequest(
          connection,
          "initialize",
          {
            protocolVersion: this.config.protocolVersion,
            capabilities: {
              tools: true,
              resources: true,
              prompts: true,
            },
            clientInfo: this.config.clientInfo,
          },
          abortController.signal
        );

        clearTimeout(timeout);
        return Boolean(result.protocolVersion && result.serverInfo);
      } catch (error) {
        clearTimeout(timeout);
        if (isAbortError(error)) {
          console.log(`[MCP] Connection test aborted: timeout`);
        } else {
          console.log(`[MCP] Connection test failed: ${error}`);
        }
        return false;
      }
    } catch (error) {
      console.log(`[MCP] Connection test failed: ${error}`);
      return false;
    }
  }

  /**
   * Connect to MCP server and perform full introspection with retry logic
   */
  async connectAndIntrospect(
    connection: Connection
  ): Promise<MCPConnectionResult> {
    const maxRetries = connection.retryAttempts || 3;
    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        console.log(
          `[MCP] Connecting and introspecting ${connection.name} via ${connection.connectionType} (attempt ${attempt + 1}/${maxRetries + 1})`
        );

        // Create abort signal with timeout
        const abortController = new AbortController();
        const timeout = setTimeout(() => {
          abortController.abort();
        }, connection.timeout || 30000);

        try {
          // Step 1: Initialize connection
          const initResult = await this.sendMCPRequest(
            connection,
            "initialize",
            {
              protocolVersion: this.config.protocolVersion,
              capabilities: {
                tools: {},
                resources: {},
                prompts: {},
              },
              clientInfo: this.config.clientInfo,
            },
            abortController.signal
          );

          const serverInfo: MCPServerInfo = initResult.serverInfo;
          const capabilities: MCPCapabilities = initResult.capabilities;

          console.log(`[MCP] Server initialized:`, serverInfo);

          // Step 2: Get tools if supported
          let mcpTools: MCPToolDefinition[] = [];
          if (capabilities.tools) {
            try {
              const toolsResult = await this.sendMCPRequest(
                connection,
                "tools/list",
                {},
                abortController.signal
              );
              mcpTools = toolsResult.tools || [];
              console.log(`[MCP] Found ${mcpTools.length} tools`);
            } catch (error) {
              console.warn("[MCP] Failed to list tools:", error);
            }
          }

          // Step 3: Get resources if supported
          let mcpResources: MCPResourceDefinition[] = [];
          if (capabilities.resources) {
            try {
              const resourcesResult = await this.sendMCPRequest(
                connection,
                "resources/list",
                {},
                abortController.signal
              );
              mcpResources = resourcesResult.resources || [];
              console.log(`[MCP] Found ${mcpResources.length} resources`);
            } catch (error) {
              console.warn("[MCP] Failed to list resources:", error);
            }
          }

          clearTimeout(timeout);

          // Step 4: Convert to internal format
          const tools: Tool[] = mcpTools.map(mcpTool =>
            this.convertMCPToolToTool(mcpTool)
          );
          const resources: Resource[] = mcpResources.map(mcpResource =>
            this.convertMCPResourceToResource(mcpResource)
          );

          console.log(`[MCP] Introspection complete for ${connection.name}:`);
          console.log(`  - Server: ${serverInfo.name} v${serverInfo.version}`);
          console.log(`  - Connection Type: ${connection.connectionType}`);
          console.log(`  - Tools: ${tools.length}`);
          console.log(`  - Resources: ${resources.length}`);

          return {
            isConnected: true,
            serverInfo,
            capabilities,
            tools,
            resources,
          };
        } catch (error) {
          clearTimeout(timeout);
          throw error;
        }
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        if (attempt < maxRetries) {
          // Exponential backoff with jitter
          const backoffMs =
            Math.min(1000 * Math.pow(2, attempt), 10000) + Math.random() * 1000;
          console.log(
            `[MCP] Attempt ${attempt + 1} failed, retrying in ${Math.round(backoffMs)}ms...`
          );
          await delay(backoffMs);
        }
      }
    }

    console.error(
      `[MCP] All connection attempts failed for ${connection.name}:`,
      lastError
    );
    return {
      isConnected: false,
      tools: [],
      resources: [],
      error: lastError?.message || "Connection failed after all retries",
    };
  }

  /**
   * Execute a tool on the MCP server with improved error handling and retries
   */
  async executeTool(
    connection: Connection,
    toolName: string,
    arguments_: Record<string, any> = {}
  ): Promise<MCPToolExecutionResult> {
    const executionId = this.generateId();
    const startTime = Date.now();

    // Create base execution object
    const baseExecution: ToolExecution = {
      id: executionId,
      tool: toolName,
      status: "pending",
      duration: 0,
      timestamp: new Date().toLocaleTimeString(),
      request: {
        tool: toolName,
        arguments: arguments_,
        timestamp: new Date().toISOString(),
      },
    };

    const maxRetries = connection.retryAttempts || 3;
    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        console.log(
          `[MCP] Executing tool ${toolName} with arguments via ${connection.connectionType} (attempt ${attempt + 1}/${maxRetries + 1}):`,
          arguments_
        );

        // Create abort signal with timeout
        const abortController = new AbortController();
        const timeout = setTimeout(() => {
          abortController.abort();
        }, connection.timeout || 30000);

        try {
          const result = await this.sendMCPRequest(
            connection,
            "tools/call",
            {
              name: toolName,
              arguments: arguments_,
            },
            abortController.signal
          );

          clearTimeout(timeout);
          const endTime = Date.now();
          const duration = endTime - startTime;

          console.log(`[MCP] Tool execution completed:`, result);

          const successExecution: ToolExecution = {
            ...baseExecution,
            status: "success",
            duration,
            response: {
              success: true,
              result,
              timestamp: new Date().toISOString(),
            },
          };

          return {
            success: true,
            result,
            execution: successExecution,
          };
        } catch (error) {
          clearTimeout(timeout);
          throw error;
        }
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        // Don't retry on certain errors
        if (isAbortError(error)) {
          break; // Don't retry on aborts
        }

        if (attempt < maxRetries) {
          // Exponential backoff with jitter
          const backoffMs =
            Math.min(500 * Math.pow(2, attempt), 5000) + Math.random() * 500;
          console.log(
            `[MCP] Tool execution attempt ${attempt + 1} failed, retrying in ${Math.round(backoffMs)}ms...`
          );
          await delay(backoffMs);
        }
      }
    }

    const endTime = Date.now();
    const duration = endTime - startTime;
    const errorMessage =
      lastError?.message || "Tool execution failed after all retries";

    console.error(`[MCP] Tool execution failed:`, lastError);

    const errorExecution: ToolExecution = {
      ...baseExecution,
      status: "error",
      duration,
      error: errorMessage,
    };

    return {
      success: false,
      error: errorMessage,
      execution: errorExecution,
    };
  }

  /**
   * Read a resource from the MCP server with improved error handling
   */
  async readResource(
    connection: Connection,
    resourceUri: string
  ): Promise<any> {
    console.log(
      `[MCP] Reading resource: ${resourceUri} via ${connection.connectionType}`
    );

    // Create abort signal with timeout
    const abortController = new AbortController();
    const timeout = setTimeout(() => {
      abortController.abort();
    }, connection.timeout || 30000);

    try {
      const result = await this.sendMCPRequest(
        connection,
        "resources/read",
        {
          uri: resourceUri,
        },
        abortController.signal
      );

      clearTimeout(timeout);
      console.log(`[MCP] Resource content:`, result);
      return result;
    } catch (error) {
      clearTimeout(timeout);
      throw error;
    }
  }

  /**
   * Static convenience methods that match the original UI service interface
   */

  /**
   * Test connection to MCP server and get basic info
   */
  static async testConnection(
    connection: Connection,
    fetch?: FetchFunction
  ): Promise<boolean> {
    const service = MCPService.getInstance(undefined, fetch);
    return service.testConnection(connection);
  }

  /**
   * Connect to MCP server and perform full introspection
   */
  static async connectAndIntrospect(
    connection: Connection,
    fetch?: FetchFunction
  ) {
    const service = MCPService.getInstance(undefined, fetch);
    return service.connectAndIntrospect(connection);
  }

  /**
   * Execute a tool on the MCP server
   */
  static async executeTool(
    connection: Connection,
    toolName: string,
    arguments_: Record<string, any> = {},
    fetch?: FetchFunction
  ) {
    const service = MCPService.getInstance(undefined, fetch);
    return service.executeTool(connection, toolName, arguments_);
  }

  /**
   * Read a resource from the MCP server
   */
  static async readResource(
    connection: Connection,
    resourceUri: string,
    fetch?: FetchFunction
  ) {
    const service = MCPService.getInstance(undefined, fetch);
    return service.readResource(connection, resourceUri);
  }

  /**
   * Validate connection URL format
   */
  static validateConnectionUrl(url: string): boolean {
    return MCPAdapter.validateConnectionUrl(url);
  }

  /**
   * Format connection URL for display
   */
  static formatConnectionUrl(url: string): string {
    return MCPAdapter.formatConnectionUrl(url);
  }

  /**
   * Get connection status description
   */
  static getConnectionStatus(connection: Connection) {
    return MCPAdapter.getConnectionStatus(connection);
  }

  /**
   * Create a new connection with generated ID
   */
  static createConnection(connectionData: Omit<Connection, "id">): Connection {
    return MCPAdapter.createConnection(connectionData);
  }
}
