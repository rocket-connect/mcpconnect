import { MCPAdapter, MCPConfig } from "@mcpconnect/base-adapters";
import { Connection } from "@mcpconnect/schemas";

/**
 * Concrete implementation of MCP Service
 */
export class MCPService extends MCPAdapter {
  private static instance: MCPService | null = null;

  constructor(config?: Partial<MCPConfig>) {
    const defaultConfig: MCPConfig = {
      name: "mcpconnect-mcp-service",
      provider: "mcp",
      protocolVersion: "2024-11-05",
      debug: false,
      timeout: 30000,
      retries: 3,
      clientInfo: {
        name: "MCPConnect",
        version: "0.0.8",
        description: "MCPConnect browser-based MCP client",
      },
    };

    super({ ...defaultConfig, ...config });
  }

  /**
   * Get singleton instance
   */
  static getInstance(config?: Partial<MCPConfig>): MCPService {
    if (!MCPService.instance) {
      MCPService.instance = new MCPService(config);
    }
    return MCPService.instance;
  }

  async initialize(): Promise<void> {
    console.log("MCPService initialized");
    // No specific initialization needed for the service layer
  }

  async cleanup(): Promise<void> {
    console.log("MCPService cleaned up");
    // No specific cleanup needed for the service layer
  }

  /**
   * Static convenience methods that match the original UI service interface
   */

  /**
   * Test connection to MCP server and get basic info
   */
  static async testConnection(connection: Connection): Promise<boolean> {
    const service = MCPService.getInstance();
    return service.testConnection(connection);
  }

  /**
   * Connect to MCP server and perform full introspection
   */
  static async connectAndIntrospect(connection: Connection) {
    const service = MCPService.getInstance();
    return service.connectAndIntrospect(connection);
  }

  /**
   * Execute a tool on the MCP server
   */
  static async executeTool(
    connection: Connection,
    toolName: string,
    arguments_: Record<string, any> = {}
  ) {
    const service = MCPService.getInstance();
    return service.executeTool(connection, toolName, arguments_);
  }

  /**
   * Read a resource from the MCP server
   */
  static async readResource(connection: Connection, resourceUri: string) {
    const service = MCPService.getInstance();
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
