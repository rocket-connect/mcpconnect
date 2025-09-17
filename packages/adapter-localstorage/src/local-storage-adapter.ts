import {
  StorageAdapter,
  StorageConfigSchema,
  StorageItem,
  StorageOptions,
  StorageCapabilities,
  AdapterError,
  AdapterStatus,
} from "@mcpconnect/base-adapters";
import {
  Connection,
  ChatConversation,
  Tool,
  Resource,
  ToolExecution,
} from "@mcpconnect/schemas";
import { z } from "zod";

/**
 * LocalStorage-specific configuration schema
 */
export const LocalStorageConfigSchema = StorageConfigSchema.extend({
  provider: z.literal("localstorage"),
  prefix: z.string().default("mcpconnect:"),
  maxItemSize: z
    .number()
    .positive()
    .default(5 * 1024 * 1024), // 5MB default
  simulateAsync: z.boolean().default(false), // For testing async behavior
});

export type LocalStorageConfig = z.infer<typeof LocalStorageConfigSchema>;

/**
 * LocalStorage implementation of StorageAdapter with MCP-specific methods
 */
export class LocalStorageAdapter extends StorageAdapter {
  protected config: LocalStorageConfig;

  constructor(config: LocalStorageConfig) {
    const parsedConfig = LocalStorageConfigSchema.parse(config);
    super(parsedConfig);
    this.config = parsedConfig;
  }

  async getCapabilities(): Promise<StorageCapabilities> {
    return {
      persistent: true, // LocalStorage persists across sessions
      transactional: true, // We provide basic transaction support
      encrypted: false, // LocalStorage doesn't encrypt by default
      compressed: false, // No built-in compression
      ttlSupport: true, // We can implement TTL manually
      querySupport: true, // We can implement basic queries
      batchOperations: true, // We support batch operations
      maxItemSize: this.config.maxItemSize,
      maxTotalSize: 10 * 1024 * 1024, // ~10MB typical LocalStorage limit
      supportedTypes: ["string", "number", "boolean", "object", "array"],
    };
  }

  async initialize(): Promise<void> {
    if (typeof window === "undefined" || !window.localStorage) {
      throw new AdapterError(
        "LocalStorage is not available in this environment",
        "LOCALSTORAGE_UNAVAILABLE"
      );
    }

    this.status = AdapterStatus.CONNECTED;
  }

  async testConnection(): Promise<boolean> {
    try {
      const testKey = `${this.config.prefix}test`;
      localStorage.setItem(testKey, "test");
      const retrieved = localStorage.getItem(testKey);
      localStorage.removeItem(testKey);
      return retrieved === "test";
    } catch {
      return false;
    }
  }

  async set(
    key: string,
    value: unknown,
    options?: StorageOptions
  ): Promise<void> {
    this.validateKey(key);

    const fullKey = `${this.config.prefix}${key}`;
    const item: StorageItem = {
      key,
      value,
      metadata: {
        createdAt: new Date(),
        updatedAt: new Date(),
        expiresAt: options?.ttl
          ? new Date(Date.now() + options.ttl)
          : undefined,
        tags: options?.tags,
        type: options?.type || typeof value,
        size: JSON.stringify(value).length,
      },
    };

    try {
      const serialized = JSON.stringify(item);

      if (serialized.length > this.config.maxItemSize!) {
        throw new AdapterError("Item size exceeds maximum", "ITEM_TOO_LARGE");
      }

      localStorage.setItem(fullKey, serialized);

      if (this.config.simulateAsync) {
        await new Promise(resolve => setTimeout(resolve, 10));
      }
    } catch (error) {
      this.handleError(error, "set");
    }
  }

  async get(key: string): Promise<StorageItem | null> {
    this.validateKey(key);

    const fullKey = `${this.config.prefix}${key}`;

    try {
      const serialized = localStorage.getItem(fullKey);

      if (!serialized) {
        return null;
      }

      const item: StorageItem = JSON.parse(serialized);

      // Check if item has expired
      if (item.metadata.expiresAt && item.metadata.expiresAt < new Date()) {
        await this.delete(key);
        return null;
      }

      if (this.config.simulateAsync) {
        await new Promise(resolve => setTimeout(resolve, 5));
      }

      return item;
    } catch (error) {
      this.handleError(error, "get");
    }
  }

  async has(key: string): Promise<boolean> {
    const item = await this.get(key);
    return item !== null;
  }

  async delete(key: string): Promise<boolean> {
    this.validateKey(key);

    const fullKey = `${this.config.prefix}${key}`;
    const existed = localStorage.getItem(fullKey) !== null;

    localStorage.removeItem(fullKey);

    if (this.config.simulateAsync) {
      await new Promise(resolve => setTimeout(resolve, 5));
    }

    return existed;
  }

  async keys(pattern?: string): Promise<string[]> {
    const keys: string[] = [];
    const prefix = pattern
      ? `${this.config.prefix}${pattern}`
      : this.config.prefix;

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(prefix)) {
        keys.push(key);
      }
    }

    return keys;
  }

  async clear(pattern?: string): Promise<number> {
    const keys = await this.keys(pattern);
    let deletedCount = 0;

    for (const key of keys) {
      localStorage.removeItem(key);
      deletedCount++;
    }

    return deletedCount;
  }

  async getConnections(): Promise<Connection[]> {
    const item = await this.get("connections");
    return (item?.value as Connection[]) || [];
  }

  /**
   * Store connections array with proper typing
   */
  async setConnections(connections: Connection[]): Promise<void> {
    await this.set("connections", connections, {
      type: "array",
      tags: ["mcp", "connections"],
      compress: true,
      encrypt: false,
    });
  }

  /**
   * Get tools for a connection with proper typing
   */
  async getConnectionTools(connectionId: string): Promise<Tool[]> {
    const allTools = await this.get("tools");
    const toolsData = (allTools?.value as Record<string, Tool[]>) || {};
    return toolsData[connectionId] || [];
  }

  /**
   * Store tools for a connection with proper typing
   */
  async setConnectionTools(connectionId: string, tools: Tool[]): Promise<void> {
    const allTools = await this.get("tools");
    const toolsData = (allTools?.value as Record<string, Tool[]>) || {};
    toolsData[connectionId] = tools;
    await this.set("tools", toolsData, {
      type: "object",
      tags: ["mcp", "tools"],
      compress: true,
      encrypt: false,
    });
  }

  /**
   * Get resources for a connection with proper typing
   */
  async getConnectionResources(connectionId: string): Promise<Resource[]> {
    const allResources = await this.get("resources");
    const resourcesData =
      (allResources?.value as Record<string, Resource[]>) || {};
    return resourcesData[connectionId] || [];
  }

  /**
   * Store resources for a connection with proper typing
   */
  async setConnectionResources(
    connectionId: string,
    resources: Resource[]
  ): Promise<void> {
    const allResources = await this.get("resources");
    const resourcesData =
      (allResources?.value as Record<string, Resource[]>) || {};
    resourcesData[connectionId] = resources;
    await this.set("resources", resourcesData, {
      type: "object",
      tags: ["mcp", "resources"],
      compress: true,
      encrypt: false,
    });
  }

  /**
   * Get conversations for a connection with proper typing
   */
  async getConnectionConversations(
    connectionId: string
  ): Promise<ChatConversation[]> {
    const allConversations = await this.get("conversations");
    const conversationsData =
      (allConversations?.value as Record<string, ChatConversation[]>) || {};
    return conversationsData[connectionId] || [];
  }

  /**
   * Store conversations for a connection with proper typing
   */
  async setConnectionConversations(
    connectionId: string,
    conversations: ChatConversation[]
  ): Promise<void> {
    const allConversations = await this.get("conversations");
    const conversationsData =
      (allConversations?.value as Record<string, ChatConversation[]>) || {};
    conversationsData[connectionId] = conversations;
    await this.set("conversations", conversationsData, {
      type: "object",
      tags: ["mcp", "conversations"],
      compress: true,
      encrypt: false,
    });
  }

  /**
   * Get tool executions for a connection with proper typing
   */
  async getConnectionToolExecutions(
    connectionId: string
  ): Promise<ToolExecution[]> {
    const allExecutions = await this.get("toolExecutions");
    const executionsData =
      (allExecutions?.value as Record<string, ToolExecution[]>) || {};
    return executionsData[connectionId] || [];
  }

  /**
   * Store tool executions for a connection with proper typing
   */
  async setConnectionToolExecutions(
    connectionId: string,
    executions: ToolExecution[]
  ): Promise<void> {
    const allExecutions = await this.get("toolExecutions");
    const executionsData =
      (allExecutions?.value as Record<string, ToolExecution[]>) || {};
    executionsData[connectionId] = executions;
    await this.set("toolExecutions", executionsData, {
      type: "object",
      tags: ["mcp", "executions"],
      compress: true,
      encrypt: false,
    });
  }

  /**
   * Add a single tool execution to a connection (optimized)
   */
  async addToolExecution(
    connectionId: string,
    execution: ToolExecution
  ): Promise<void> {
    const currentExecutions =
      await this.getConnectionToolExecutions(connectionId);

    // Update or add the execution
    const existingIndex = currentExecutions.findIndex(
      (exec: ToolExecution) => exec.id === execution.id
    );

    if (existingIndex !== -1) {
      currentExecutions[existingIndex] = {
        ...currentExecutions[existingIndex],
        ...execution,
      };
    } else {
      currentExecutions.push(execution);
    }

    await this.setConnectionToolExecutions(connectionId, currentExecutions);
  }

  /**
   * Remove all data for a connection (optimized)
   */
  async removeConnectionData(connectionId: string): Promise<void> {
    // Use batch operations for efficiency
    const updates: Array<Promise<void>> = [];

    // Remove from tools
    const allTools = await this.get("tools");
    if (allTools?.value) {
      const toolsData = allTools.value as Record<string, Tool[]>;
      delete toolsData[connectionId];
      updates.push(this.set("tools", toolsData));
    }

    // Remove from resources
    const allResources = await this.get("resources");
    if (allResources?.value) {
      const resourcesData = allResources.value as Record<string, Resource[]>;
      delete resourcesData[connectionId];
      updates.push(this.set("resources", resourcesData));
    }

    // Remove from conversations
    const allConversations = await this.get("conversations");
    if (allConversations?.value) {
      const conversationsData = allConversations.value as Record<
        string,
        ChatConversation[]
      >;
      delete conversationsData[connectionId];
      updates.push(this.set("conversations", conversationsData));
    }

    // Remove from tool executions
    const allExecutions = await this.get("toolExecutions");
    if (allExecutions?.value) {
      const executionsData = allExecutions.value as Record<
        string,
        ToolExecution[]
      >;
      delete executionsData[connectionId];
      updates.push(this.set("toolExecutions", executionsData));
    }

    // Execute all updates
    await Promise.all(updates);
  }

  /**
   * Get storage statistics for MCPConnect data
   */
  async getMCPStats(): Promise<{
    connections: number;
    totalConversations: number;
    totalToolExecutions: number;
    totalTools: number;
    totalResources: number;
  }> {
    const [connections, conversations, toolExecutions, tools, resources] =
      await Promise.all([
        this.getConnections(),
        this.get("conversations"),
        this.get("toolExecutions"),
        this.get("tools"),
        this.get("resources"),
      ]);

    const conversationsData =
      (conversations?.value as Record<string, ChatConversation[]>) || {};
    const executionsData =
      (toolExecutions?.value as Record<string, ToolExecution[]>) || {};
    const toolsData = (tools?.value as Record<string, Tool[]>) || {};
    const resourcesData =
      (resources?.value as Record<string, Resource[]>) || {};

    const totalConversations = Object.values(conversationsData).reduce(
      (total, convs) => total + convs.length,
      0
    );

    const totalToolExecutions = Object.values(executionsData).reduce(
      (total, execs) => total + execs.length,
      0
    );

    const totalTools = Object.values(toolsData).reduce(
      (total, tools) => total + tools.length,
      0
    );

    const totalResources = Object.values(resourcesData).reduce(
      (total, resources) => total + resources.length,
      0
    );

    return {
      connections: connections.length,
      totalConversations,
      totalToolExecutions,
      totalTools,
      totalResources,
    };
  }

  /**
   * Clear all MCPConnect data
   */
  async clearAllMCPData(): Promise<number> {
    return await this.clear(); // Clear all items with our prefix
  }
}
