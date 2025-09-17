/* eslint-disable @typescript-eslint/no-explicit-any */
import { z } from "zod";
import { BaseConfigSchema, AdapterError, AdapterStatus } from "./types";
import { Connection, Tool, Resource } from "@mcpconnect/schemas";

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
 * Abstract base class for MCP adapters - provides interface and basic utilities only
 */
export abstract class MCPAdapter {
  protected config: MCPConfig;
  protected status: AdapterStatus = AdapterStatus.IDLE;

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
   * Generate unique ID utility
   */
  protected generateId(): string {
    return (
      Math.random().toString(36).substring(2, 15) +
      Math.random().toString(36).substring(2, 15)
    );
  }

  /**
   * Map JSON Schema types to parameter types utility
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
   * Convert MCP tool definition to internal Tool format utility
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
   * Convert MCP resource definition to internal Resource format utility
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
   * Handle errors consistently utility
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
   * Static utilities
   */

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
      connectionType: connectionData.connectionType || "sse",
      isActive: false,
      isConnected: false,
      headers: connectionData.headers,
      timeout: connectionData.timeout || 30000,
      retryAttempts: connectionData.retryAttempts || 3,
      authType: connectionData.authType || "none",
      credentials: connectionData.credentials,
    };
  }

  // Abstract methods that implementations must provide
  abstract testConnection(connection: Connection): Promise<boolean>;

  abstract connectAndIntrospect(
    connection: Connection
  ): Promise<MCPConnectionResult>;

  abstract executeTool(
    connection: Connection,
    toolName: string,
    arguments_: Record<string, any>
  ): Promise<MCPToolExecutionResult>;

  abstract initialize(): Promise<void>;
  abstract cleanup(): Promise<void>;
}
