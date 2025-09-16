// packages/adapter-ai-sdk/src/mcp-service.ts - Fixed version with better SSE handling
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable no-constant-condition */
/* eslint-disable no-async-promise-executor */
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
} from "@mcpconnect/base-adapters";
import { Connection, Tool, Resource, ToolExecution } from "@mcpconnect/schemas";
import {
  postJsonToApi,
  createJsonResponseHandler,
  createJsonErrorResponseHandler,
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
 * Enhanced MCP Service implementation with improved SSE handling for large responses
 */
export class MCPService extends MCPAdapter {
  private static instance: MCPService | null = null;
  private static requestId = 1;
  private fetch?: FetchFunction;
  private sessionCache = new Map<string, string>();
  private connectionCache = new Map<
    string,
    {
      isConnected: boolean;
      lastUsed: number;
      sessionId?: string;
    }
  >();
  private pendingRequests = new Map<
    string,
    {
      resolve: (value: any) => void;
      reject: (reason: any) => void;
      timeout: any;
    }
  >();

  constructor(config?: Partial<MCPConfig>, fetch?: FetchFunction) {
    const defaultConfig: MCPConfig = {
      name: "mcpconnect-mcp-service",
      provider: "mcp",
      protocolVersion: "2025-06-18",
      debug: false,
      timeout: 60000, // Increased timeout for large responses
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

  static getInstance(
    config?: Partial<MCPConfig>,
    fetch?: FetchFunction
  ): MCPService {
    if (fetch || !MCPService.instance) {
      MCPService.instance = new MCPService(config, fetch);
    }
    return MCPService.instance;
  }

  private getNextRequestId(): string {
    return `req_${MCPService.requestId++}_${this.generateId()}`;
  }

  private prepareHeaders(connection: Connection): Record<string, string> {
    const baseHeaders: Record<string, string> = {
      "Content-Type": "application/json",
    };

    const connectionHeaders = connection.headers || {};
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

    return withUserAgentSuffix(
      combineHeaders(baseHeaders, connectionHeaders, authHeaders),
      "mcpconnect/0.0.11"
    );
  }

  private prepareSSEHeaders(connection: Connection): Record<string, string> {
    const headers = this.prepareHeaders(connection);
    return {
      ...headers,
      Accept: "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    };
  }

  private createErrorHandler(): ResponseHandler<APICallError> {
    return createJsonErrorResponseHandler({
      errorSchema: MCPErrorResponseSchema,
      errorToMessage: error =>
        `MCP Error ${error.error.code}: ${error.error.message}`,
      isRetryable: (response, error) => {
        if (response.status >= 500) return true;
        if (error?.error.code === -32601) return false;
        if (error?.error.code === -32602) return false;
        return false;
      },
    });
  }

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

  private createSuccessHandler(): ResponseHandler<any> {
    return createJsonResponseHandler(MCPSuccessResponseSchema);
  }

  /**
   * FIXED: Enhanced SSE request handling with better session management and timeout handling
   */
  private async sendSSERequest(
    connection: Connection,
    request: MCPMessage,
    abortSignal?: AbortSignal
  ): Promise<any> {
    console.log(`[MCP SSE] Sending request:`, {
      method: request.method,
      id: request.id,
      url: connection.url,
    });

    return new Promise(async (resolve, reject) => {
      // Increased timeout for large responses like tool lists
      const timeoutMs = connection.timeout || 60000;
      const timeout = setTimeout(() => {
        this.cleanupPendingRequest(request.id as string);
        reject(new AdapterError("SSE request timeout", "REQUEST_TIMEOUT"));
      }, timeoutMs);

      // Store the pending request for cleanup
      this.pendingRequests.set(request.id as string, {
        resolve,
        reject,
        timeout,
      });

      try {
        // Get or establish session
        let sessionId = this.sessionCache.get(connection.url);

        if (!sessionId) {
          sessionId = await this.establishSSESession(connection, abortSignal);
          this.sessionCache.set(connection.url, sessionId);
        }

        // Send request to /message endpoint
        const messageUrl = connection.url.replace(
          /\/sse\/?$/,
          `/message?sessionId=${sessionId}`
        );
        console.log(`[MCP SSE] POST to:`, messageUrl);

        const fetchFn = this.fetch || fetch;
        const response = await fetchFn(messageUrl, {
          method: "POST",
          headers: this.prepareHeaders(connection),
          body: JSON.stringify(request),
          signal: abortSignal,
        });

        if (!response.ok) {
          this.cleanupPendingRequest(request.id as string);

          // Handle session expiry
          if (response.status === 400 || response.status === 404) {
            console.log(
              `[MCP SSE] Session may be invalid, clearing cache and retrying...`
            );
            this.sessionCache.delete(connection.url);
            this.connectionCache.delete(connection.url);

            // Retry with fresh session
            try {
              sessionId = await this.establishSSESession(
                connection,
                abortSignal
              );
              this.sessionCache.set(connection.url, sessionId);

              const retryUrl = connection.url.replace(
                /\/sse\/?$/,
                `/message?sessionId=${sessionId}`
              );
              const retryResponse = await fetchFn(retryUrl, {
                method: "POST",
                headers: this.prepareHeaders(connection),
                body: JSON.stringify(request),
                signal: abortSignal,
              });

              if (!retryResponse.ok) {
                throw new AdapterError(
                  `SSE message request failed after retry: ${retryResponse.status} ${retryResponse.statusText}`,
                  "SSE_REQUEST_FAILED"
                );
              }
            } catch (retryError) {
              throw new AdapterError(
                `SSE retry failed: ${retryError}`,
                "SSE_RETRY_FAILED"
              );
            }
          } else {
            throw new AdapterError(
              `SSE message request failed: ${response.status} ${response.statusText}`,
              "SSE_REQUEST_FAILED",
              { status: response.status, statusText: response.statusText }
            );
          }
        }

        console.log(
          `[MCP SSE] Request sent successfully, waiting for response on SSE stream for ID: ${request.id}`
        );

        // The response will come through the SSE listener we set up in establishSSESession
        // The promise will be resolved by the SSE message handler
      } catch (error) {
        this.cleanupPendingRequest(request.id as string);
        console.error("[MCP SSE] Request error:", error);
        reject(error);
      }
    });
  }

  /**
   * FIXED: Enhanced SSE session establishment with persistent listener
   */
  private async establishSSESession(
    connection: Connection,
    abortSignal?: AbortSignal
  ): Promise<string> {
    console.log(`[MCP SSE] Establishing session at: ${connection.url}`);

    return new Promise(async (resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(
          new AdapterError("Session establishment timeout", "SESSION_TIMEOUT")
        );
      }, connection.timeout || 30000);

      try {
        const fetchFn = this.fetch || fetch;
        const response = await fetchFn(connection.url, {
          method: "GET",
          headers: this.prepareSSEHeaders(connection),
          signal: abortSignal,
        });

        if (!response.ok) {
          clearTimeout(timeout);
          throw new AdapterError(
            `SSE session failed: ${response.status} ${response.statusText}`,
            "SSE_SESSION_FAILED"
          );
        }

        if (!response.body) {
          clearTimeout(timeout);
          throw new AdapterError("No response body for session", "SSE_NO_BODY");
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let sessionId: string | null = null;
        let sessionEstablished = false;

        try {
          while (true) {
            const { done, value } = await reader.read();

            if (done) {
              console.log("[MCP SSE] Session stream ended");
              break;
            }

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() || "";

            for (const line of lines) {
              const trimmed = line.trim();
              if (!trimmed) continue;

              // Handle session establishment
              if (!sessionEstablished) {
                if (trimmed.startsWith("event: endpoint")) {
                  continue;
                }

                if (
                  trimmed.startsWith("data:") &&
                  trimmed.includes("sessionId=")
                ) {
                  const data = trimmed.substring(5).trim();
                  const match = data.match(/sessionId=([^&\s]+)/);
                  if (match) {
                    sessionId = match[1];
                    console.log(`[MCP SSE] Session established: ${sessionId}`);
                    clearTimeout(timeout);
                    sessionEstablished = true;
                    resolve(sessionId);

                    // Continue listening for responses in the background
                    this.startSSEListener(reader, decoder, buffer);
                    return;
                  }
                }
              }
            }
          }

          if (!sessionEstablished) {
            clearTimeout(timeout);
            reader.releaseLock();
            throw new AdapterError(
              "No session ID found in SSE stream",
              "SSE_NO_SESSION_ID"
            );
          }
        } catch (streamError) {
          clearTimeout(timeout);
          reader.releaseLock();
          throw streamError;
        }
      } catch (error) {
        clearTimeout(timeout);
        console.error("[MCP SSE] Session establishment error:", error);
        reject(error);
      }
    });
  }

  /**
   * FIXED: Enhanced SSE listener with better buffer management for large responses
   */
  private async startSSEListener(
    reader: ReadableStreamDefaultReader<Uint8Array>,
    decoder: TextDecoder,
    initialBuffer: string
  ): Promise<void> {
    let buffer = initialBuffer;
    let currentMessage = "";
    let isInJsonMessage = false;
    let braceCount = 0;

    console.log("[MCP SSE] Starting persistent SSE listener");

    try {
      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          console.log("[MCP SSE] Persistent listener stream ended");
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;

          console.log(
            `[MCP SSE] Processing line: "${trimmed.substring(0, 100)}${trimmed.length > 100 ? "..." : ""}"`
          );

          // Skip endpoint events
          if (trimmed.startsWith("event: endpoint")) {
            continue;
          }

          // Handle message events
          if (trimmed.startsWith("event: message")) {
            isInJsonMessage = true;
            currentMessage = "";
            braceCount = 0;
            continue;
          }

          // Handle data lines
          if (trimmed.startsWith("data:")) {
            const data = trimmed.substring(5).trim();
            if (!data) continue;

            if (isInJsonMessage) {
              // Accumulate JSON data
              currentMessage += data;

              // Count braces to detect complete JSON
              for (const char of data) {
                if (char === "{") braceCount++;
                if (char === "}") braceCount--;
              }

              // If braces are balanced, we have a complete message
              if (braceCount === 0 && currentMessage.includes('"jsonrpc"')) {
                console.log(
                  `[MCP SSE] Complete message received (${currentMessage.length} chars)`
                );
                this.handleCompleteSSEMessage(currentMessage);
                currentMessage = "";
                isInJsonMessage = false;
              }
            } else {
              // Try to parse as standalone JSON
              this.tryParseAndHandleMessage(data);
            }
          }
        }
      }
    } catch (error) {
      console.error("[MCP SSE] Persistent listener error:", error);
    } finally {
      reader.releaseLock();
    }
  }

  /**
   * FIXED: Better message handling with improved JSON parsing
   */
  private handleCompleteSSEMessage(messageData: string): void {
    try {
      const parsedData = JSON.parse(messageData);
      console.log(`[MCP SSE] Parsed complete message:`, {
        id: parsedData.id,
        hasResult: !!parsedData.result,
        hasError: !!parsedData.error,
        resultSize: parsedData.result
          ? JSON.stringify(parsedData.result).length
          : 0,
      });

      if (parsedData.jsonrpc === "2.0" && parsedData.id) {
        const requestId = String(parsedData.id);
        const pendingRequest = this.pendingRequests.get(requestId);

        if (pendingRequest) {
          console.log(
            `[MCP SSE] Found matching pending request for ID: ${requestId}`
          );
          this.cleanupPendingRequest(requestId);

          if (parsedData.error) {
            pendingRequest.reject(
              new AdapterError(
                `MCP Error ${parsedData.error.code}: ${parsedData.error.message}`,
                "MCP_ERROR",
                parsedData.error
              )
            );
          } else {
            pendingRequest.resolve(parsedData.result);
          }
        } else {
          console.log(
            `[MCP SSE] No pending request found for ID: ${requestId}`
          );
        }
      }
    } catch (parseError) {
      console.error(`[MCP SSE] Failed to parse complete message:`, parseError);
      console.log(
        `[MCP SSE] Raw message data (first 500 chars):`,
        messageData.substring(0, 500)
      );
    }
  }

  /**
   * Fallback message parsing for standalone JSON
   */
  private tryParseAndHandleMessage(data: string): void {
    try {
      const parsedData = JSON.parse(data);
      if (parsedData.jsonrpc === "2.0" && parsedData.id) {
        this.handleCompleteSSEMessage(data);
      }
    } catch {
      // Not a valid JSON message, ignore
    }
  }

  /**
   * Clean up pending requests
   */
  private cleanupPendingRequest(requestId: string): void {
    const pendingRequest = this.pendingRequests.get(requestId);
    if (pendingRequest) {
      clearTimeout(pendingRequest.timeout);
      this.pendingRequests.delete(requestId);
    }
  }

  /**
   * Send a JSON-RPC 2.0 request with improved routing logic
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
      `[MCP] Sending ${method} request via ${connection.connectionType}:`,
      {
        id: request.id,
        method: request.method,
        hasParams: Object.keys(request.params || {}).length > 0,
      }
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
          const url = new URL(connection.url);
          if (
            url.pathname.includes("/sse") ||
            connection.url.includes("/sse")
          ) {
            return this.sendSSERequest(connection, request, abortSignal);
          } else if (url.protocol === "ws:" || url.protocol === "wss:") {
            return this.sendWebSocketRequest(connection, request);
          } else {
            return this.sendHTTPRequest(connection, request, abortSignal);
          }
        }
      }
    } catch (error) {
      console.error(`[MCP] Request failed for ${method}:`, error);
      throw error;
    }
  }

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

      console.log(`[MCP HTTP] Response:`, value);
      return value.result;
    } catch (error) {
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
        console.log(`[MCP WebSocket] Connected to ${connection.url}`);
        ws.send(JSON.stringify(request));
      };

      ws.onmessage = event => {
        try {
          const response = JSON.parse(event.data);
          console.log(`[MCP WebSocket] Response:`, response);

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
    console.log(
      "MCPService initialized with enhanced SSE handling for large responses"
    );
    this.status = AdapterStatus.IDLE;
  }

  async cleanup(): Promise<void> {
    console.log("MCPService cleaned up");

    // Clean up all pending requests
    for (const [, pendingRequest] of this.pendingRequests) {
      clearTimeout(pendingRequest.timeout);
      pendingRequest.reject(new AdapterError("Service cleanup", "CLEANUP"));
    }
    this.pendingRequests.clear();

    this.sessionCache.clear();
    this.connectionCache.clear();
    this.status = AdapterStatus.DISCONNECTED;
  }

  // Rest of the methods remain the same...
  // [Previous implementation for testConnection, connectAndIntrospect, executeTool, etc.]

  async testConnection(connection: Connection): Promise<boolean> {
    try {
      console.log(`[MCP] Testing connection: ${connection.name}`);

      this.sessionCache.delete(connection.url);
      this.connectionCache.delete(connection.url);

      const abortController = new AbortController();
      const timeout = setTimeout(() => {
        abortController.abort();
      }, connection.timeout || 30000);

      try {
        const result = await this.sendMCPRequest(
          connection,
          "initialize",
          {
            protocolVersion: "2025-06-18",
            capabilities: {
              sampling: {},
              elicitation: {},
              roots: { listChanged: true },
            },
            clientInfo: this.config.clientInfo,
          },
          abortController.signal
        );

        clearTimeout(timeout);
        console.log(`[MCP] Test successful:`, result.serverInfo?.name);

        this.connectionCache.set(connection.url, {
          isConnected: true,
          lastUsed: Date.now(),
        });

        return Boolean(result.protocolVersion && result.serverInfo);
      } catch (error) {
        clearTimeout(timeout);
        if (isAbortError(error)) {
          console.log(`[MCP] Test aborted: timeout`);
        } else {
          console.log(`[MCP] Test failed:`, error);
        }
        return false;
      }
    } catch (error) {
      console.log(`[MCP] Test error: ${error}`);
      return false;
    }
  }

  async connectAndIntrospect(
    connection: Connection
  ): Promise<MCPConnectionResult> {
    const maxRetries = connection.retryAttempts || 2;
    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        console.log(
          `[MCP] Connect attempt ${attempt + 1}/${maxRetries + 1}: ${connection.name}`
        );

        const abortController = new AbortController();
        const timeout = setTimeout(() => {
          abortController.abort();
        }, connection.timeout || 60000); // Increased timeout

        try {
          // Step 1: Initialize
          const initResult = await this.sendMCPRequest(
            connection,
            "initialize",
            {
              protocolVersion: "2025-06-18",
              capabilities: {
                sampling: {},
                elicitation: {},
                roots: { listChanged: true },
              },
              clientInfo: this.config.clientInfo,
            },
            abortController.signal
          );

          const serverInfo: MCPServerInfo = initResult.serverInfo;
          const capabilities: MCPCapabilities = initResult.capabilities;

          console.log(
            `[MCP] Initialized: ${serverInfo.name} v${serverInfo.version}`
          );

          // Step 2: Get tools with longer timeout for large tool lists
          let mcpTools: MCPToolDefinition[] = [];
          if (capabilities.tools) {
            try {
              console.log("[MCP] Requesting tools list...");
              const toolsResult = await this.sendMCPRequest(
                connection,
                "tools/list",
                { _meta: { progressToken: 2 } },
                abortController.signal
              );
              mcpTools = toolsResult.tools || [];
              console.log(`[MCP] Successfully loaded ${mcpTools.length} tools`);
            } catch (error) {
              console.warn("[MCP] Tools listing failed:", error);
            }
          }

          // Step 3: Get resources
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
              console.warn("[MCP] Resources listing failed:", error);
            }
          }

          clearTimeout(timeout);

          // Convert to internal format
          const tools: Tool[] = mcpTools.map(mcpTool =>
            this.convertMCPToolToTool(mcpTool)
          );
          const resources: Resource[] = mcpResources.map(mcpResource =>
            this.convertMCPResourceToResource(mcpResource)
          );

          this.connectionCache.set(connection.url, {
            isConnected: true,
            lastUsed: Date.now(),
          });

          console.log(
            `[MCP] Connection successful: ${tools.length} tools, ${resources.length} resources`
          );

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

        this.sessionCache.delete(connection.url);
        this.connectionCache.delete(connection.url);

        if (attempt < maxRetries) {
          const backoffMs = Math.min(1000 * Math.pow(2, attempt), 5000);
          console.log(
            `[MCP] Attempt ${attempt + 1} failed, retrying in ${backoffMs}ms...`
          );
          await delay(backoffMs);
        }
      }
    }

    console.error(`[MCP] All attempts failed:`, lastError);
    return {
      isConnected: false,
      tools: [],
      resources: [],
      error: lastError?.message || "Connection failed after all retries",
    };
  }

  async executeTool(
    connection: Connection,
    toolName: string,
    arguments_: Record<string, any> = {}
  ): Promise<MCPToolExecutionResult> {
    const executionId = this.generateId();
    const startTime = Date.now();

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

    const maxRetries = Math.min(connection.retryAttempts || 2, 3);
    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        console.log(
          `[MCP] Executing ${toolName} (attempt ${attempt + 1}/${maxRetries + 1})`
        );

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

          console.log(
            `[MCP] Tool ${toolName} executed successfully in ${duration}ms`
          );

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

        if (isAbortError(error)) {
          break;
        }

        if (
          lastError.message.includes("session") ||
          lastError.message.includes("404")
        ) {
          console.log(
            `[MCP] Clearing session cache due to error: ${lastError.message}`
          );
          this.sessionCache.delete(connection.url);
          this.connectionCache.delete(connection.url);
        }

        if (attempt < maxRetries) {
          const backoffMs = Math.min(500 * Math.pow(2, attempt), 2000);
          console.log(`[MCP] Tool execution retry in ${backoffMs}ms...`);
          await delay(backoffMs);
        }
      }
    }

    const endTime = Date.now();
    const duration = endTime - startTime;
    const errorMessage =
      lastError?.message || "Tool execution failed after all retries";

    console.error(`[MCP] Tool execution failed:`, errorMessage);

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

  async readResource(
    connection: Connection,
    resourceUri: string
  ): Promise<any> {
    console.log(`[MCP] Reading resource: ${resourceUri}`);

    const abortController = new AbortController();
    const timeout = setTimeout(() => {
      abortController.abort();
    }, connection.timeout || 30000);

    try {
      const result = await this.sendMCPRequest(
        connection,
        "resources/read",
        { uri: resourceUri },
        abortController.signal
      );

      clearTimeout(timeout);
      console.log(`[MCP] Resource read successfully`);
      return result;
    } catch (error) {
      clearTimeout(timeout);
      throw error;
    }
  }

  // Static convenience methods remain the same...
  static async testConnection(
    connection: Connection,
    fetch?: FetchFunction
  ): Promise<boolean> {
    const service = MCPService.getInstance(undefined, fetch);
    return service.testConnection(connection);
  }

  static async connectAndIntrospect(
    connection: Connection,
    fetch?: FetchFunction
  ) {
    const service = MCPService.getInstance(undefined, fetch);
    return service.connectAndIntrospect(connection);
  }

  static async executeTool(
    connection: Connection,
    toolName: string,
    arguments_: Record<string, any> = {},
    fetch?: FetchFunction
  ) {
    const service = MCPService.getInstance(undefined, fetch);
    return service.executeTool(connection, toolName, arguments_);
  }

  static async readResource(
    connection: Connection,
    resourceUri: string,
    fetch?: FetchFunction
  ) {
    const service = MCPService.getInstance(undefined, fetch);
    return service.readResource(connection, resourceUri);
  }

  static validateConnectionUrl(url: string): boolean {
    return MCPAdapter.validateConnectionUrl(url);
  }

  static formatConnectionUrl(url: string): string {
    return MCPAdapter.formatConnectionUrl(url);
  }

  static getConnectionStatus(connection: Connection) {
    return MCPAdapter.getConnectionStatus(connection);
  }

  static createConnection(connectionData: Omit<Connection, "id">): Connection {
    return MCPAdapter.createConnection(connectionData);
  }
}
