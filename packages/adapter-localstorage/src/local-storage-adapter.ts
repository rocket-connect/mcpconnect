import {
  StorageAdapter,
  StorageConfigSchema,
  StorageItem,
  StorageQuery,
  StorageResult,
  StorageOptions,
  StorageCapabilities,
  StorageTransaction,
  AdapterError,
  AdapterStatus,
} from "@mcpconnect/base-adapters";
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
 * Simple transaction implementation for LocalStorage
 */
class LocalStorageTransaction implements StorageTransaction {
  private operations: Array<() => void> = [];
  private rollbackOperations: Array<() => void> = [];
  private adapter: LocalStorageAdapter;

  constructor(adapter: LocalStorageAdapter) {
    this.adapter = adapter;
  }

  async set(
    key: string,
    value: unknown,
    options?: StorageOptions
  ): Promise<void> {
    console.log("Transaction.set:", { key, hasValue: !!value, options });

    // Store the current value for rollback
    const currentItem = await this.adapter.get(key);

    this.operations.push(() => {
      console.log("Executing transaction set:", key);
    });

    this.rollbackOperations.push(() => {
      if (currentItem) {
        console.log("Rolling back set operation for:", key);
      } else {
        console.log("Rolling back set operation (delete) for:", key);
      }
    });
  }

  async get(key: string): Promise<StorageItem | null> {
    console.log("Transaction.get:", key);
    return this.adapter.get(key);
  }

  async delete(key: string): Promise<boolean> {
    console.log("Transaction.delete:", key);

    const currentItem = await this.adapter.get(key);

    this.operations.push(() => {
      console.log("Executing transaction delete:", key);
    });

    this.rollbackOperations.push(() => {
      if (currentItem) {
        console.log("Rolling back delete operation for:", key);
      }
    });

    return !!currentItem;
  }

  async commit(): Promise<void> {
    console.log(
      "Transaction.commit - executing",
      this.operations.length,
      "operations"
    );

    try {
      for (const operation of this.operations) {
        operation();
      }
      this.operations = [];
      this.rollbackOperations = [];
    } catch (error) {
      await this.rollback();
      throw error;
    }
  }

  async rollback(): Promise<void> {
    console.log(
      "Transaction.rollback - rolling back",
      this.rollbackOperations.length,
      "operations"
    );

    for (const rollbackOperation of this.rollbackOperations.reverse()) {
      try {
        rollbackOperation();
      } catch (error) {
        console.error("Error during rollback:", error);
      }
    }

    this.operations = [];
    this.rollbackOperations = [];
  }
}

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

    // Set up cleanup interval if auto-cleanup is enabled
    if (this.config.autoCleanup) {
      console.log(
        "Setting up auto-cleanup interval:",
        this.config.cleanupInterval
      );
    }
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

  async setBatch(
    items: Array<{ key: string; value: unknown; options?: StorageOptions }>
  ): Promise<void> {
    for (const item of items) {
      await this.set(item.key, item.value, item.options);
    }
  }

  async getBatch(keys: string[]): Promise<StorageItem[]> {
    const items: StorageItem[] = [];

    for (const key of keys) {
      const item = await this.get(key);
      if (item) {
        items.push(item);
      }
    }

    return items;
  }

  async deleteBatch(keys: string[]): Promise<number> {
    let deletedCount = 0;

    for (const key of keys) {
      const deleted = await this.delete(key);
      if (deleted) {
        deletedCount++;
      }
    }

    return deletedCount;
  }

  async query(query: StorageQuery): Promise<StorageResult> {
    const allKeys = await this.keys(query.prefix);
    let matchingItems: StorageItem[] = [];

    for (const key of allKeys) {
      if (query.limit && matchingItems.length >= query.limit) {
        break;
      }

      const item = await this.get(key.replace(this.config.prefix, ""));
      if (item) {
        let matches = true;

        if (query.tags && item.metadata.tags) {
          matches = query.tags.some(tag => item.metadata.tags!.includes(tag));
        }

        if (query.type && item.metadata.type !== query.type) {
          matches = false;
        }

        if (matches) {
          matchingItems.push(item);
        }
      }
    }

    if (query.offset) {
      matchingItems = matchingItems.slice(query.offset);
    }

    return {
      items: matchingItems,
      total: matchingItems.length,
      hasMore: false,
      metadata: { queryExecutedAt: new Date().toISOString() },
    };
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

  async stats(): Promise<{
    itemCount: number;
    totalSize: number;
    usedSpace: number;
    availableSpace?: number;
  }> {
    const keys = await this.keys();
    let totalSize = 0;

    for (const key of keys) {
      const value = localStorage.getItem(key);
      if (value) {
        totalSize += value.length;
      }
    }

    return {
      itemCount: keys.length,
      totalSize,
      usedSpace: totalSize,
      availableSpace: Math.max(0, 10 * 1024 * 1024 - totalSize),
    };
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

  async cleanup(): Promise<number> {
    const keys = await this.keys();
    let cleanedCount = 0;

    for (const key of keys) {
      const plainKey = key.replace(this.config.prefix, "");
      const item = await this.get(plainKey);

      if (item?.metadata.expiresAt && item.metadata.expiresAt < new Date()) {
        await this.delete(plainKey);
        cleanedCount++;
      }
    }

    return cleanedCount;
  }

  async transaction<T>(
    callback: (tx: StorageTransaction) => Promise<T>
  ): Promise<T> {
    const tx = new LocalStorageTransaction(this);

    try {
      const result = await callback(tx);
      await tx.commit();
      return result;
    } catch (error) {
      await tx.rollback();
      throw error;
    }
  }

  // ===============================
  // MCP-SPECIFIC HELPER METHODS
  // ===============================

  /**
   * Store theme preference
   */
  async setTheme(theme: "light" | "dark" | "system"): Promise<void> {
    await this.set("theme", theme);
  }

  /**
   * Get theme preference
   */
  async getTheme(): Promise<"light" | "dark" | "system" | null> {
    const item = await this.get("theme");
    return item?.value as "light" | "dark" | "system" | null;
  }

  /**
   * Store LLM settings
   */
  async setLLMSettings(settings: any): Promise<void> {
    await this.set("llm-settings", settings);
  }

  /**
   * Get LLM settings
   */
  async getLLMSettings(): Promise<any> {
    const item = await this.get("llm-settings");
    return item?.value || null;
  }

  /**
   * Clear LLM settings
   */
  async clearLLMSettings(): Promise<void> {
    await this.delete("llm-settings");
  }

  /**
   * Store connections array
   */
  async setConnections(connections: any[]): Promise<void> {
    await this.set("connections", connections);
  }

  /**
   * Get connections array
   */
  async getConnections(): Promise<any[]> {
    const item = await this.get("connections");
    return item?.value as any[] || [];
  }

  /**
   * Store tools for a connection
   */
  async setConnectionTools(connectionId: string, tools: any[]): Promise<void> {
    const allTools = await this.get("tools");
    const toolsData = allTools?.value as Record<string, any[]> || {};
    toolsData[connectionId] = tools;
    await this.set("tools", toolsData);
  }

  /**
   * Get tools for a connection
   */
  async getConnectionTools(connectionId: string): Promise<any[]> {
    const item = await this.get("tools");
    const toolsData = item?.value as Record<string, any[]> || {};
    return toolsData[connectionId] || [];
  }

  /**
   * Store resources for a connection
   */
  async setConnectionResources(connectionId: string, resources: any[]): Promise<void> {
    const allResources = await this.get("resources");
    const resourcesData = allResources?.value as Record<string, any[]> || {};
    resourcesData[connectionId] = resources;
    await this.set("resources", resourcesData);
  }

  /**
   * Get resources for a connection
   */
  async getConnectionResources(connectionId: string): Promise<any[]> {
    const item = await this.get("resources");
    const resourcesData = item?.value as Record<string, any[]> || {};
    return resourcesData[connectionId] || [];
  }

  /**
   * Store conversations for a connection
   */
  async setConnectionConversations(connectionId: string, conversations: any[]): Promise<void> {
    const allConversations = await this.get("conversations");
    const conversationsData = allConversations?.value as Record<string, any[]> || {};
    conversationsData[connectionId] = conversations;
    await this.set("conversations", conversationsData);
  }

  /**
   * Get conversations for a connection
   */
  async getConnectionConversations(connectionId: string): Promise<any[]> {
    const item = await this.get("conversations");
    const conversationsData = item?.value as Record<string, any[]> || {};
    return conversationsData[connectionId] || [];
  }

  /**
   * Store tool executions for a connection
   */
  async setConnectionToolExecutions(connectionId: string, executions: any[]): Promise<void> {
    const allExecutions = await this.get("toolExecutions");
    const executionsData = allExecutions?.value as Record<string, any[]> || {};
    executionsData[connectionId] = executions;
    await this.set("toolExecutions", executionsData);
  }

  /**
   * Get tool executions for a connection
   */
  async getConnectionToolExecutions(connectionId: string): Promise<any[]> {
    const item = await this.get("toolExecutions");
    const executionsData = item?.value as Record<string, any[]> || {};
    return executionsData[connectionId] || [];
  }

  /**
   * Add a single tool execution to a connection
   */
  async addToolExecution(connectionId: string, execution: any): Promise<void> {
    const currentExecutions = await this.getConnectionToolExecutions(connectionId);
    
    // Update or add the execution
    const existingIndex = currentExecutions.findIndex(
      (exec: any) => exec.id === execution.id
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
   * Remove all data for a connection
   */
  async removeConnectionData(connectionId: string): Promise<void> {
    // Remove from tools
    const allTools = await this.get("tools");
    if (allTools?.value) {
      const toolsData = allTools.value as Record<string, any[]>;
      delete toolsData[connectionId];
      await this.set("tools", toolsData);
    }

    // Remove from resources
    const allResources = await this.get("resources");
    if (allResources?.value) {
      const resourcesData = allResources.value as Record<string, any[]>;
      delete resourcesData[connectionId];
      await this.set("resources", resourcesData);
    }

    // Remove from conversations
    const allConversations = await this.get("conversations");
    if (allConversations?.value) {
      const conversationsData = allConversations.value as Record<string, any[]>;
      delete conversationsData[connectionId];
      await this.set("conversations", conversationsData);
    }

    // Remove from tool executions
    const allExecutions = await this.get("toolExecutions");
    if (allExecutions?.value) {
      const executionsData = allExecutions.value as Record<string, any[]>;
      delete executionsData[connectionId];
      await this.set("toolExecutions", executionsData);
    }
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
    storageUsed: string;
  }> {
    const [connections, conversations, toolExecutions, tools, resources, stats] = await Promise.all([
      this.getConnections(),
      this.get("conversations"),
      this.get("toolExecutions"),
      this.get("tools"),
      this.get("resources"),
      this.stats()
    ]);

    const conversationsData = conversations?.value as Record<string, any[]> || {};
    const executionsData = toolExecutions?.value as Record<string, any[]> || {};
    const toolsData = tools?.value as Record<string, any[]> || {};
    const resourcesData = resources?.value as Record<string, any[]> || {};

    const totalConversations = Object.values(conversationsData).reduce(
      (total, convs) => total + convs.length, 0
    );
    
    const totalToolExecutions = Object.values(executionsData).reduce(
      (total, execs) => total + execs.length, 0
    );
    
    const totalTools = Object.values(toolsData).reduce(
      (total, tools) => total + tools.length, 0
    );
    
    const totalResources = Object.values(resourcesData).reduce(
      (total, resources) => total + resources.length, 0
    );

    const formatBytes = (bytes: number) => {
      if (bytes === 0) return "0 Bytes";
      const k = 1024;
      const sizes = ["Bytes", "KB", "MB", "GB"];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
    };

    return {
      connections: connections.length,
      totalConversations,
      totalToolExecutions,
      totalTools,
      totalResources,
      storageUsed: formatBytes(stats.totalSize),
    };
  }

  /**
   * Clear all MCPConnect data
   */
  async clearAllMCPData(): Promise<number> {
    return await this.clear(); // Clear all items with our prefix
  }
}