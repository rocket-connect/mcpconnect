/* eslint-disable @typescript-eslint/no-explicit-any */
import { z } from "zod";
import { BaseConfigSchema, AdapterError, AdapterStatus } from "./types";
import { Connection, Tool, Resource, ToolExecution } from "@mcpconnect/schemas";

/**
 * MCP capabilities schema
 */
export const MCPCapabilitiesSchema = z.object({
  tools: z.boolean().optional(),
  resources: z.boolean().optional(),
  prompts: z.boolean().optional(),
  logging: z.boolean().optional(),
  experimental: z.record(z.string(), z.boolean()).optional(),
});

export type MCPCapabilities = z.infer<typeof MCPCapabilitiesSchema>;

/**
 * MCP server info schema
 */
export const MCPServerInfoSchema = z.object({
  name: z.string(),
  version: z.string(),
  description: z.string().optional(),
});

export type MCPServerInfo = z.infer<typeof MCPServerInfoSchema>;

/**
 * MCP initialization schema
 */
export const MCPInitializationSchema = z.object({
  protocolVersion: z.string(),
  capabilities: MCPCapabilitiesSchema,
  serverInfo: MCPServerInfoSchema,
});

export type MCPInitialization = z.infer<typeof MCPInitializationSchema>;

/**
 * MCP tool definition schema
 */
export const MCPToolDefinitionSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  inputSchema: z.object({
    type: z.literal("object"),
    properties: z.record(z.string(), z.unknown()),
    required: z.array(z.string()).optional(),
  }),
});

export type MCPToolDefinition = z.infer<typeof MCPToolDefinitionSchema>;

/**
 * MCP resource definition schema
 */
export const MCPResourceDefinitionSchema = z.object({
  name: z.string(),
  description: z.string(),
  uri: z.string(),
  mimeType: z.string().optional(),
  annotations: z
    .object({
      audience: z.array(z.string()).optional(),
      priority: z.number().optional(),
    })
    .optional(),
});

export type MCPResourceDefinition = z.infer<typeof MCPResourceDefinitionSchema>;

/**
 * MCP message schema
 */
export const MCPMessageSchema = z.object({
  jsonrpc: z.literal("2.0"),
  id: z.union([z.string(), z.number()]),
  method: z.string().optional(),
  params: z.record(z.string(), z.unknown()).optional(),
  result: z.unknown().optional(),
  error: z
    .object({
      code: z.number(),
      message: z.string(),
      data: z.unknown().optional(),
    })
    .optional(),
});

export type MCPMessage = z.infer<typeof MCPMessageSchema>;

/**
 * MCP connection result schema
 */
export const MCPConnectionResultSchema = z.object({
  isConnected: z.boolean(),
  serverInfo: MCPServerInfoSchema.optional(),
  capabilities: MCPCapabilitiesSchema.optional(),
  tools: z.array(z.unknown()),
  resources: z.array(z.unknown()),
  error: z.string().optional(),
});

export type MCPConnectionResult = z.infer<typeof MCPConnectionResultSchema>;

/**
 * MCP tool execution result schema
 */
export const MCPToolExecutionResultSchema = z.object({
  success: z.boolean(),
  result: z.unknown().optional(),
  error: z.string().optional(),
  execution: z.unknown(),
});

export type MCPToolExecutionResult = z.infer<
  typeof MCPToolExecutionResultSchema
>;

/**
 * MCP configuration schema
 */
export const MCPConfigSchema = BaseConfigSchema.extend({
  provider: z.literal("mcp"),
  protocolVersion: z.string().default("2024-11-05"),
  clientInfo: z.object({
    name: z.string(),
    version: z.string(),
    description: z.string().optional(),
  }),
});

export type MCPConfig = z.infer<typeof MCPConfigSchema>;

/**
 * SSE Event types for MCP streaming
 */
export interface MCPSSEEvent {
  type: "connected" | "message" | "error" | "complete" | "tool_progress";
  data?: any;
  id?: string;
}

/**
 * Abstract base class for MCP adapters with SSE support
 */
export abstract class MCPAdapter {
  protected config: MCPConfig;
  protected status: AdapterStatus = AdapterStatus.IDLE;
  private static requestId = 1;

  constructor(config: MCPConfig) {
    this.config = MCPConfigSchema.parse(config);
  }

  /**
   * Get adapter status
   */
  getStatus(): AdapterStatus {
    return this.status;
  }

  /**
   * Get adapter configuration
   */
  getConfig(): MCPConfig {
    return { ...this.config };
  }

  /**
   * Generate a unique request ID
   */
  protected getNextRequestId(): string {
    return `req_${MCPAdapter.requestId++}_${this.generateId()}`;
  }

  /**
   * Generate unique ID
   */
  protected generateId(): string {
    return (
      Math.random().toString(36).substring(2, 15) +
      Math.random().toString(36).substring(2, 15)
    );
  }

  /**
   * Prepare headers for MCP requests
   */
  protected prepareHeaders(connection: Connection): Record<string, string> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...connection.headers,
    };

    // Add SSE specific headers
    if (connection.connectionType === "sse") {
      headers["Accept"] = "text/event-stream";
      headers["Cache-Control"] = "no-cache";
      headers["Connection"] = "keep-alive";
    }

    // Add authentication headers
    if (connection.authType === "bearer" && connection.credentials?.token) {
      headers["Authorization"] = `Bearer ${connection.credentials.token}`;
    } else if (
      connection.authType === "apiKey" &&
      connection.credentials?.apiKey
    ) {
      headers["X-API-Key"] = connection.credentials.apiKey;
    } else if (
      connection.authType === "basic" &&
      connection.credentials?.username &&
      connection.credentials?.password
    ) {
      const auth = btoa(
        `${connection.credentials.username}:${connection.credentials.password}`
      );
      headers["Authorization"] = `Basic ${auth}`;
    }

    return headers;
  }

  /**
   * Send a JSON-RPC 2.0 request to the MCP server with connection type support
   */
  protected async sendMCPRequest(
    connection: Connection,
    method: string,
    params?: Record<string, any>
  ): Promise<any> {
    const url = new URL(connection.url);

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
          return this.sendSSERequest(connection, request);
        case "http":
          return this.sendHTTPRequest(connection, request); // ✅ HTTP should go to HTTP
        case "websocket":
          return this.sendWebSocketRequest(connection, request);
        default:
          // Auto-detect based on URL protocol
          if (url.protocol === "http:" || url.protocol === "https:") {
            return this.sendHTTPRequest(connection, request);
          } else if (url.protocol === "ws:" || url.protocol === "wss:") {
            return this.sendWebSocketRequest(connection, request);
          } else {
            throw new Error(`Unsupported protocol: ${url.protocol}`);
          }
      }
    } catch (error) {
      console.error(`[MCP] Request failed for ${method}:`, error);
      throw error;
    }
  }

  /**
   * Send request via SSE
   */
  protected async sendSSERequest(
    connection: Connection,
    request: MCPMessage
  ): Promise<any> {
    return new Promise((resolve, reject) => {
      const headers = this.prepareHeaders(connection);
      const timeout = setTimeout(() => {
        reject(new Error("SSE request timeout"));
      }, connection.timeout || 30000);

      // For SSE, we need to POST the request and listen to the stream
      fetch(connection.url, {
        method: "POST",
        headers: {
          ...headers,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(request),
      })
        .then(response => {
          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }

          if (!response.body) {
            throw new Error("No response body for SSE stream");
          }

          const reader = response.body.getReader();
          const decoder = new TextDecoder();
          let buffer = "";

          const readStream = async () => {
            try {
              // eslint-disable-next-line no-constant-condition
              while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split("\n");
                buffer = lines.pop() || "";

                for (const line of lines) {
                  if (line.startsWith("data: ")) {
                    try {
                      const data = line.slice(6);
                      if (data === "[DONE]") {
                        clearTimeout(timeout);
                        resolve(null);
                        return;
                      }

                      const event = JSON.parse(data) as MCPSSEEvent;
                      console.log(`[MCP] SSE event:`, event);

                      if (event.type === "complete" && event.data?.result) {
                        clearTimeout(timeout);
                        resolve(event.data.result);
                        return;
                      } else if (event.type === "error") {
                        clearTimeout(timeout);
                        reject(new Error(event.data?.message || "SSE error"));
                        return;
                      }
                    } catch (parseError) {
                      console.warn(
                        "Failed to parse SSE data:",
                        line,
                        parseError
                      );
                    }
                  }
                }
              }
            } catch (error) {
              clearTimeout(timeout);
              reject(error);
            }
          };

          readStream();
        })
        .catch(error => {
          clearTimeout(timeout);
          reject(error);
        });
    });
  }

  /**
   * Send request via HTTP
   */
  protected async sendHTTPRequest(
    connection: Connection,
    request: MCPMessage
  ): Promise<any> {
    const headers = this.prepareHeaders(connection);

    const response = await fetch(connection.url, {
      method: "POST",
      headers,
      body: JSON.stringify(request),
      signal: AbortSignal.timeout(connection.timeout || 30000),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const result = await response.json();
    console.log(`[MCP] HTTP response:`, result);

    if (result.error) {
      throw new Error(
        `MCP Error ${result.error.code}: ${result.error.message}`
      );
    }

    return result.result;
  }

  /**
   * Send request via WebSocket
   */
  protected async sendWebSocketRequest(
    connection: Connection,
    request: MCPMessage
  ): Promise<any> {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(connection.url);
      const timeout = setTimeout(() => {
        ws.close();
        reject(new Error("WebSocket request timeout"));
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
              new Error(
                `MCP Error ${response.error.code}: ${response.error.message}`
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
        reject(new Error(`WebSocket error: ${error}`));
      };

      ws.onclose = event => {
        clearTimeout(timeout);
        if (event.code !== 1000) {
          reject(
            new Error(
              `WebSocket closed unexpectedly: ${event.code} ${event.reason}`
            )
          );
        }
      };
    });
  }

  /**
   * Test connection to MCP server
   */
  async testConnection(connection: Connection): Promise<boolean> {
    try {
      console.log(
        `[MCP] Testing connection to ${connection.name} via ${connection.connectionType}`
      );
      const result = await this.sendMCPRequest(connection, "initialize", {
        protocolVersion: this.config.protocolVersion,
        capabilities: {
          tools: true,
          resources: true,
          prompts: true,
        },
        clientInfo: this.config.clientInfo,
      });

      return Boolean(result.protocolVersion && result.serverInfo);
    } catch (error) {
      console.log(`[MCP] Connection test failed: ${error}`);
      return false;
    }
  }

  /**
   * Connect to MCP server and perform full introspection
   */
  async connectAndIntrospect(
    connection: Connection
  ): Promise<MCPConnectionResult> {
    try {
      console.log(
        `[MCP] Connecting and introspecting ${connection.name} via ${connection.connectionType}`
      );

      // Step 1: Initialize connection
      const initResult = await this.sendMCPRequest(connection, "initialize", {
        protocolVersion: this.config.protocolVersion,
        capabilities: {
          tools: {},
          resources: {},
          prompts: {},
        },
        clientInfo: this.config.clientInfo,
      });

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
            {}
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
            {}
          );
          mcpResources = resourcesResult.resources || [];
          console.log(`[MCP] Found ${mcpResources.length} resources`);
        } catch (error) {
          console.warn("[MCP] Failed to list resources:", error);
        }
      }

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
      console.error(`[MCP] Connection failed for ${connection.name}:`, error);
      return {
        isConnected: false,
        tools: [],
        resources: [],
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Execute a tool on the MCP server
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

    try {
      console.log(
        `[MCP] Executing tool ${toolName} with arguments via ${connection.connectionType}:`,
        arguments_
      );

      const result = await this.sendMCPRequest(connection, "tools/call", {
        name: toolName,
        arguments: arguments_,
      });

      const endTime = Date.now();
      const duration = endTime - startTime;

      console.log(`[MCP] Tool execution result:`, result);

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
      const endTime = Date.now();
      const duration = endTime - startTime;
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      console.error(`[MCP] Tool execution failed:`, error);

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
  }

  /**
   * Read a resource from the MCP server
   */
  async readResource(
    connection: Connection,
    resourceUri: string
  ): Promise<any> {
    console.log(
      `[MCP] Reading resource: ${resourceUri} via ${connection.connectionType}`
    );

    const result = await this.sendMCPRequest(connection, "resources/read", {
      uri: resourceUri,
    });

    console.log(`[MCP] Resource content:`, result);
    return result;
  }

  /**
   * Validate connection URL format - updated for SSE support
   */
  static validateConnectionUrl(url: string): boolean {
    try {
      const parsedUrl = new URL(url);
      // Support HTTP/HTTPS and WebSocket protocols
      return ["http:", "https:", "ws:", "wss:"].includes(parsedUrl.protocol);
    } catch {
      return false;
    }
  }

  /**
   * Format connection URL for display
   */
  static formatConnectionUrl(url: string): string {
    try {
      const parsedUrl = new URL(url);
      return `${parsedUrl.protocol}//${parsedUrl.host}${parsedUrl.pathname}`;
    } catch {
      return url;
    }
  }

  /**
   * Get connection status description
   */
  static getConnectionStatus(connection: Connection): {
    status: "connected" | "disconnected" | "error" | "testing";
    message: string;
  } {
    if (!connection.isActive) {
      return { status: "disconnected", message: "Inactive" };
    }

    if (connection.isConnected) {
      return { status: "connected", message: "Connected" };
    }

    return { status: "disconnected", message: "Disconnected" };
  }

  /**
   * Convert MCP tool definition to internal Tool format
   */
  protected convertMCPToolToTool(mcpTool: MCPToolDefinition): Tool {
    const parameters: Tool["parameters"] = [];

    if (mcpTool.inputSchema?.properties) {
      for (const [name, schema] of Object.entries(
        mcpTool.inputSchema.properties
      )) {
        const isRequired =
          mcpTool.inputSchema.required?.includes(name) || false;
        const paramSchema = schema as any;

        parameters.push({
          name,
          type: this.mapJsonSchemaTypeToParameterType(
            paramSchema.type || "string"
          ),
          description: paramSchema.description || `Parameter ${name}`,
          required: isRequired,
          default: paramSchema.default,
        });
      }
    }

    return {
      id: this.generateId(),
      name: mcpTool.name,
      description: mcpTool.description,
      inputSchema: mcpTool.inputSchema,
      parameters,
      category: "mcp",
      tags: ["mcp", "introspected"],
      deprecated: false,
    };
  }

  /**
   * Convert MCP resource definition to internal Resource format
   */
  protected convertMCPResourceToResource(
    mcpResource: MCPResourceDefinition
  ): Resource {
    return {
      name: mcpResource.name,
      description: mcpResource.description,
      uri: mcpResource.uri,
      mimeType: mcpResource.mimeType,
      type: "data",
      permissions: {
        read: true,
        write: false, // MCP resources are typically read-only
        delete: false,
      },
      tags: ["mcp", "introspected"],
      metadata: mcpResource.annotations
        ? {
            audience: mcpResource.annotations.audience,
            priority: mcpResource.annotations.priority,
          }
        : undefined,
    };
  }

  /**
   * Map JSON Schema types to our parameter types
   */
  protected mapJsonSchemaTypeToParameterType(
    jsonType: string
  ): NonNullable<Tool["parameters"]>[0]["type"] {
    switch (jsonType) {
      case "string":
        return "string";
      case "number":
      case "integer":
        return "number";
      case "boolean":
        return "boolean";
      case "object":
        return "object";
      case "array":
        return "array";
      default:
        return "string";
    }
  }

  /**
   * Create a new connection with generated ID
   */
  static createConnection(connectionData: Omit<Connection, "id">): Connection {
    const generateId = () =>
      Math.random().toString(36).substring(2, 15) +
      Math.random().toString(36).substring(2, 15);

    return {
      id: generateId(),
      name: connectionData.name,
      url: connectionData.url,
      connectionType: connectionData.connectionType || "sse", // Default to SSE
      isActive: false,
      isConnected: false,
      headers: connectionData.headers,
      timeout: connectionData.timeout || 30000,
      retryAttempts: connectionData.retryAttempts || 3,
      authType: connectionData.authType || "none",
      credentials: connectionData.credentials,
    };
  }

  /**
   * Handle errors consistently
   */
  protected handleError(error: unknown, context: string): never {
    if (error instanceof AdapterError) {
      throw error;
    }

    const message = error instanceof Error ? error.message : String(error);
    throw new AdapterError(
      `MCP adapter error in ${context}: ${message}`,
      "MCP_ADAPTER_ERROR",
      { context, originalError: error }
    );
  }

  /**
   * Initialize the adapter
   */
  abstract initialize(): Promise<void>;

  /**
   * Clean up resources
   */
  abstract cleanup(): Promise<void>;
}
