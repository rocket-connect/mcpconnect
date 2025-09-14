import { Connection, Tool, Resource } from "@mcpconnect/schemas";
import { nanoid } from "nanoid";

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

export interface MCPToolDefinition {
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

export interface MCPServerCapabilities {
  tools?: {
    listChanged?: boolean;
  };
  resources?: {
    subscribe?: boolean;
    listChanged?: boolean;
  };
  prompts?: {
    listChanged?: boolean;
  };
  logging?: {};
  experimental?: Record<string, any>;
}

export interface MCPServerInfo {
  name: string;
  version: string;
  description?: string;
}

export interface MCPInitializeResult {
  protocolVersion: string;
  capabilities: MCPServerCapabilities;
  serverInfo: MCPServerInfo;
}

export class MCPIntrospectionService {
  private static requestId = 1;

  /**
   * Generate a unique request ID
   */
  private static getNextRequestId(): string {
    return `req_${this.requestId++}_${nanoid(8)}`;
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

    // Prepare headers
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

    // Create the JSON-RPC request
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

      // For WebSocket, we need to implement WebSocket communication
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
   * Initialize connection with MCP server
   */
  static async initialize(
    connection: Connection
  ): Promise<MCPInitializeResult> {
    console.log(`[MCP] Initializing connection to ${connection.name}`);

    const result = await this.sendMCPRequest(connection, "initialize", {
      protocolVersion: "2024-11-05",
      capabilities: {
        tools: {},
        resources: {},
        prompts: {},
      },
      clientInfo: {
        name: "MCPConnect",
        version: "0.0.7",
        description: "MCPConnect browser-based MCP client",
      },
    });

    console.log(`[MCP] Server initialized:`, result.serverInfo);
    return result;
  }

  /**
   * List available tools from MCP server
   */
  static async listTools(connection: Connection): Promise<MCPToolDefinition[]> {
    console.log(`[MCP] Listing tools from ${connection.name}`);

    const result = await this.sendMCPRequest(connection, "tools/list", {});
    return result.tools || [];
  }

  /**
   * List available resources from MCP server
   */
  static async listResources(
    connection: Connection
  ): Promise<MCPResourceDefinition[]> {
    console.log(`[MCP] Listing resources from ${connection.name}`);

    const result = await this.sendMCPRequest(connection, "resources/list", {});
    return result.resources || [];
  }

  /**
   * Execute a tool on the MCP server
   */
  static async executeTool(
    connection: Connection,
    toolName: string,
    arguments_: Record<string, any> = {}
  ): Promise<any> {
    console.log(`[MCP] Executing tool ${toolName} with arguments:`, arguments_);

    const result = await this.sendMCPRequest(connection, "tools/call", {
      name: toolName,
      arguments: arguments_,
    });

    console.log(`[MCP] Tool execution result:`, result);
    return result;
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
   * Perform complete introspection of an MCP server
   */
  static async performIntrospection(connection: Connection): Promise<{
    serverInfo: MCPServerInfo;
    capabilities: MCPServerCapabilities;
    tools: Tool[];
    resources: Resource[];
  }> {
    try {
      console.log(`[MCP] Starting full introspection of ${connection.name}`);

      // Step 1: Initialize the connection
      const initResult = await this.initialize(connection);

      // Step 2: Get tools if supported
      let mcpTools: MCPToolDefinition[] = [];
      if (initResult.capabilities.tools) {
        try {
          mcpTools = await this.listTools(connection);
          console.log(`[MCP] Found ${mcpTools.length} tools`);
        } catch (error) {
          console.warn("[MCP] Failed to list tools:", error);
        }
      }

      // Step 3: Get resources if supported
      let mcpResources: MCPResourceDefinition[] = [];
      if (initResult.capabilities.resources) {
        try {
          mcpResources = await this.listResources(connection);
          console.log(`[MCP] Found ${mcpResources.length} resources`);
        } catch (error) {
          console.warn("[MCP] Failed to list resources:", error);
        }
      }

      // Step 4: Convert to our internal format
      const tools: Tool[] = mcpTools.map(mcpTool =>
        this.convertMCPToolToTool(mcpTool)
      );
      const resources: Resource[] = mcpResources.map(mcpResource =>
        this.convertMCPResourceToResource(mcpResource)
      );

      console.log(`[MCP] Introspection complete for ${connection.name}:`);
      console.log(
        `  - Server: ${initResult.serverInfo.name} v${initResult.serverInfo.version}`
      );
      console.log(`  - Tools: ${tools.length}`);
      console.log(`  - Resources: ${resources.length}`);

      return {
        serverInfo: initResult.serverInfo,
        capabilities: initResult.capabilities,
        tools,
        resources,
      };
    } catch (error) {
      console.error(
        `[MCP] Introspection failed for ${connection.name}:`,
        error
      );
      throw error;
    }
  }

  /**
   * Convert MCP tool definition to our internal Tool format
   */
  private static convertMCPToolToTool(mcpTool: MCPToolDefinition): Tool {
    // Convert input schema properties to parameters
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
   * Convert MCP resource definition to our internal Resource format
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
   * Test if a connection supports MCP protocol
   */
  static async testMCPConnection(connection: Connection): Promise<boolean> {
    try {
      const result = await this.initialize(connection);
      return Boolean(result.protocolVersion && result.serverInfo);
    } catch (error) {
      console.log(`[MCP] Connection test failed: ${error}`);
      return false;
    }
  }

  /**
   * Get server information without full introspection
   */
  static async getServerInfo(
    connection: Connection
  ): Promise<MCPServerInfo | null> {
    try {
      const result = await this.initialize(connection);
      return result.serverInfo;
    } catch (error) {
      console.error(`[MCP] Failed to get server info:`, error);
      return null;
    }
  }
}
