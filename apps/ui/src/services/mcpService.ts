// apps/ui/src/services/mcpService.ts
import { Connection, Tool, Resource, ToolExecution } from "@mcpconnect/schemas";
import { nanoid } from "nanoid";

export interface MCPCapabilities {
  tools?: boolean;
  resources?: boolean;
  prompts?: boolean;
  logging?: boolean;
  experimental?: Record<string, boolean>;
}

export interface MCPServerInfo {
  name: string;
  version: string;
  description?: string;
}

export interface MCPInitialization {
  protocolVersion: string;
  capabilities: MCPCapabilities;
  serverInfo: MCPServerInfo;
}

export interface MCPToolDefinition {
  id: string;
  name: string;
  description: string;
  inputSchema: {
    type: "object";
    properties: Record<string, any>;
    required?: string[];
  };
}

export interface MCPResourceDefinition {
  name: string;
  description: string;
  uri: string;
  mimeType?: string;
  annotations?: {
    audience?: string[];
    priority?: number;
  };
}

export interface MCPMessage {
  jsonrpc: "2.0";
  id: string | number;
  method?: string;
  params?: Record<string, any>;
  result?: any;
  error?: {
    code: number;
    message: string;
    data?: any;
  };
}

export interface MCPConnectionResult {
  isConnected: boolean;
  serverInfo?: MCPServerInfo;
  capabilities?: MCPCapabilities;
  tools: Tool[];
  resources: Resource[];
  error?: string;
}

export interface MCPToolExecutionResult {
  success: boolean;
  result?: any;
  error?: string;
  execution: ToolExecution;
}

/**
 * Centralized MCP service for all MCP protocol communications
 */
export class MCPService {
  private static requestId = 1;

  /**
   * Generate a unique request ID
   */
  private static getNextRequestId(): string {
    return `req_${this.requestId++}_${nanoid(8)}`;
  }

  /**
   * Prepare headers for MCP requests
   */
  private static prepareHeaders(
    connection: Connection
  ): Record<string, string> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...connection.headers,
    };

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
   * Send a JSON-RPC 2.0 request to the MCP server
   */
  private static async sendMCPRequest(
    connection: Connection,
    method: string,
    params?: Record<string, any>
  ): Promise<any> {
    const url = new URL(connection.url);
    const headers = this.prepareHeaders(connection);

    const request: MCPMessage = {
      jsonrpc: "2.0",
      id: this.getNextRequestId(),
      method,
      params: params || {},
    };

    console.log(
      `[MCP] Sending ${method} request to ${connection.url}:`,
      request
    );

    try {
      // For HTTP/HTTPS, send POST request
      if (url.protocol === "http:" || url.protocol === "https:") {
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
        console.log(`[MCP] Received ${method} response:`, result);

        if (result.error) {
          throw new Error(
            `MCP Error ${result.error.code}: ${result.error.message}`
          );
        }

        return result.result;
      }

      // For WebSocket, use WebSocket communication
      if (url.protocol === "ws:" || url.protocol === "wss:") {
        return this.sendWebSocketRequest(connection, request);
      }

      throw new Error(`Unsupported protocol: ${url.protocol}`);
    } catch (error) {
      console.error(`[MCP] Request failed for ${method}:`, error);
      throw error;
    }
  }

  /**
   * Send request via WebSocket
   */
  private static async sendWebSocketRequest(
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
   * Test connection to MCP server and get basic info
   */
  static async testConnection(connection: Connection): Promise<boolean> {
    try {
      console.log(`[MCP] Testing connection to ${connection.name}`);
      const result = await this.sendMCPRequest(connection, "initialize", {
        protocolVersion: "2024-11-05",
        capabilities: {
          tools: true,
          resources: true,
          prompts: true,
        },
        clientInfo: {
          name: "MCPConnect",
          version: "0.0.8",
          description: "MCPConnect browser-based MCP client",
        },
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
  static async connectAndIntrospect(
    connection: Connection
  ): Promise<MCPConnectionResult> {
    try {
      console.log(`[MCP] Connecting and introspecting ${connection.name}`);

      // Step 1: Initialize connection
      const initResult = await this.sendMCPRequest(connection, "initialize", {
        protocolVersion: "2024-11-05",
        capabilities: {
          tools: {},
          resources: {},
          prompts: {},
        },
        clientInfo: {
          name: "MCPConnect",
          version: "0.0.8",
          description: "MCPConnect browser-based MCP client",
        },
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
  static async executeTool(
    connection: Connection,
    toolName: string,
    arguments_: Record<string, any> = {}
  ): Promise<MCPToolExecutionResult> {
    const executionId = nanoid();
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
        `[MCP] Executing tool ${toolName} with arguments:`,
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
  static async readResource(
    connection: Connection,
    resourceUri: string
  ): Promise<any> {
    console.log(`[MCP] Reading resource: ${resourceUri}`);

    const result = await this.sendMCPRequest(connection, "resources/read", {
      uri: resourceUri,
    });

    console.log(`[MCP] Resource content:`, result);
    return result;
  }

  /**
   * Validate connection URL format
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
  private static convertMCPToolToTool(mcpTool: MCPToolDefinition): Tool {
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
      id: nanoid(),
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
  private static convertMCPResourceToResource(
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
  private static mapJsonSchemaTypeToParameterType(
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
    return {
      id: nanoid(),
      name: connectionData.name,
      url: connectionData.url,
      isActive: false,
      isConnected: false,
      headers: connectionData.headers,
      timeout: connectionData.timeout || 30000,
      retryAttempts: connectionData.retryAttempts || 3,
      authType: connectionData.authType || "none",
      credentials: connectionData.credentials,
    };
  }
}
