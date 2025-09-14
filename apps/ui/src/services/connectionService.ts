import { Connection } from "@mcpconnect/schemas";
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

export interface MCPTool {
  name: string;
  description: string;
  inputSchema?: Record<string, any>;
}

export interface MCPResource {
  name: string;
  description: string;
  uri?: string;
  mimeType?: string;
}

export class ConnectionService {
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

  /**
   * Test connection to MCP server
   */
  static async testConnection(connection: Connection): Promise<boolean> {
    try {
      const url = new URL(connection.url);

      // Create headers with auth if needed
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

      // For HTTP transport, try to initialize
      if (url.protocol === "http:" || url.protocol === "https:") {
        const response = await fetch(connection.url, {
          method: "POST",
          headers,
          body: JSON.stringify({
            jsonrpc: "2.0",
            id: 1,
            method: "initialize",
            params: {
              protocolVersion: "2024-11-05",
              capabilities: {
                tools: true,
                resources: true,
                prompts: true,
              },
              clientInfo: {
                name: "MCPConnect",
                version: "0.0.7",
              },
            },
          }),
        });

        return response.ok;
      }

      // For WebSocket, try to connect briefly
      if (url.protocol === "ws:" || url.protocol === "wss:") {
        return new Promise(resolve => {
          try {
            const ws = new WebSocket(connection.url);
            const timeout = setTimeout(() => {
              ws.close();
              resolve(false);
            }, 5000);

            ws.onopen = () => {
              clearTimeout(timeout);
              ws.close();
              resolve(true);
            };

            ws.onerror = () => {
              clearTimeout(timeout);
              resolve(false);
            };
          } catch {
            resolve(false);
          }
        });
      }

      return false;
    } catch (error) {
      console.error("Connection test failed:", error);
      return false;
    }
  }

  /**
   * Perform MCP introspection to discover tools and resources
   */
  static async introspectConnection(connection: Connection): Promise<{
    initialization: MCPInitialization;
    tools: MCPTool[];
    resources: MCPResource[];
  }> {
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

    try {
      // Step 1: Initialize connection
      const initResponse = await fetch(connection.url, {
        method: "POST",
        headers,
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "initialize",
          params: {
            protocolVersion: "2024-11-05",
            capabilities: {
              tools: true,
              resources: true,
              prompts: true,
            },
            clientInfo: {
              name: "MCPConnect",
              version: "0.0.7",
            },
          },
        }),
      });

      if (!initResponse.ok) {
        throw new Error(`Initialization failed: ${initResponse.statusText}`);
      }

      const initResult = await initResponse.json();
      const initialization: MCPInitialization = initResult.result;

      // Step 2: Get tools if supported
      let tools: MCPTool[] = [];
      if (initialization.capabilities.tools) {
        try {
          const toolsResponse = await fetch(connection.url, {
            method: "POST",
            headers,
            body: JSON.stringify({
              jsonrpc: "2.0",
              id: 2,
              method: "tools/list",
              params: {},
            }),
          });

          if (toolsResponse.ok) {
            const toolsResult = await toolsResponse.json();
            tools = toolsResult.result?.tools || [];
          }
        } catch (error) {
          console.warn("Failed to fetch tools:", error);
        }
      }

      // Step 3: Get resources if supported
      let resources: MCPResource[] = [];
      if (initialization.capabilities.resources) {
        try {
          const resourcesResponse = await fetch(connection.url, {
            method: "POST",
            headers,
            body: JSON.stringify({
              jsonrpc: "2.0",
              id: 3,
              method: "resources/list",
              params: {},
            }),
          });

          if (resourcesResponse.ok) {
            const resourcesResult = await resourcesResponse.json();
            resources = resourcesResult.result?.resources || [];
          }
        } catch (error) {
          console.warn("Failed to fetch resources:", error);
        }
      }

      return { initialization, tools, resources };
    } catch (error) {
      console.error("Introspection failed:", error);
      throw error;
    }
  }

  /**
   * Execute a tool on the MCP server
   */
  static async executeTool(
    connection: Connection,
    toolName: string,
    arguments_: Record<string, any> = {}
  ): Promise<any> {
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

    const response = await fetch(connection.url, {
      method: "POST",
      headers,
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: nanoid(),
        method: "tools/call",
        params: {
          name: toolName,
          arguments: arguments_,
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`Tool execution failed: ${response.statusText}`);
    }

    const result = await response.json();

    if (result.error) {
      throw new Error(`Tool error: ${result.error.message}`);
    }

    return result.result;
  }

  /**
   * Create default demo connection with nanoid
   */
  static createDefaultDemoConnection(): Connection {
    return {
      id: nanoid(),
      name: "Demo E-commerce Database",
      url: "ws://localhost:8080",
      isActive: true,
      isConnected: true,
      retryAttempts: 3,
      authType: "none",
      timeout: 30000,
      headers: {},
      credentials: {},
    };
  }

  /**
   * Validate connection URL format
   */
  static validateConnectionUrl(url: string): boolean {
    try {
      const parsedUrl = new URL(url);
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
}
