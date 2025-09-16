import { z } from "zod";
import { BaseConfigSchema, AdapterError, AdapterStatus } from "./types";

/**
 * Storage item schema
 */
export const StorageItemSchema = z.object({
  key: z.string(),
  value: z.unknown(),
  metadata: z.object({
    createdAt: z.date(),
    updatedAt: z.date(),
    expiresAt: z.date().optional(),
    tags: z.array(z.string()).optional(),
    size: z.number().optional(),
    type: z.string().optional(),
  }),
});

export type StorageItem = z.infer<typeof StorageItemSchema>;

/**
 * Storage query schema
 */
export const StorageQuerySchema = z.object({
  keys: z.array(z.string()).optional(),
  prefix: z.string().optional(),
  pattern: z.string().optional(),
  tags: z.array(z.string()).optional(),
  type: z.string().optional(),
  limit: z.number().positive().optional(),
  offset: z.number().min(0).optional(),
  sortBy: z.enum(["key", "createdAt", "updatedAt", "size"]).optional(),
  sortOrder: z.enum(["asc", "desc"]).default("asc"),
  includeExpired: z.boolean().default(false),
});

export type StorageQuery = z.infer<typeof StorageQuerySchema>;

/**
 * Storage result schema
 */
export const StorageResultSchema = z.object({
  items: z.array(StorageItemSchema),
  total: z.number().min(0),
  hasMore: z.boolean(),
  nextOffset: z.number().min(0).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export type StorageResult = z.infer<typeof StorageResultSchema>;

export const StorageOptionsSchema = z.object({
  ttl: z.number().positive().optional(), // Time to live in milliseconds
  tags: z.array(z.string()).optional(),
  type: z.string().optional(),
  compress: z.boolean().optional().default(false),
  encrypt: z.boolean().optional().default(false),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export type StorageOptions = z.infer<typeof StorageOptionsSchema>;

/**
 * Storage configuration schema
 */
export const StorageConfigSchema = BaseConfigSchema.extend({
  provider: z.string(),
  connectionString: z.string().optional(),
  maxSize: z.number().positive().optional(), // Maximum storage size in bytes
  compression: z.boolean().default(false),
  encryption: z.boolean().default(false),
  encryptionKey: z.string().optional(),
  autoCleanup: z.boolean().default(true),
  cleanupInterval: z.number().positive().default(3600000), // 1 hour in ms
  namespace: z.string().optional(),
});

export type StorageConfig = z.infer<typeof StorageConfigSchema>;

/**
 * Storage capabilities schema
 */
export const StorageCapabilitiesSchema = z.object({
  persistent: z.boolean(),
  transactional: z.boolean(),
  encrypted: z.boolean(),
  compressed: z.boolean(),
  ttlSupport: z.boolean(),
  querySupport: z.boolean(),
  batchOperations: z.boolean(),
  maxItemSize: z.number().positive().optional(),
  maxTotalSize: z.number().positive().optional(),
  supportedTypes: z.array(z.string()),
});

export type StorageCapabilities = z.infer<typeof StorageCapabilitiesSchema>;

/**
 * Abstract base class for storage adapters
 */
export abstract class StorageAdapter {
  protected config: StorageConfig;
  protected status: AdapterStatus = AdapterStatus.IDLE;

  constructor(config: StorageConfig) {
    this.config = StorageConfigSchema.parse(config);
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
  getConfig(): StorageConfig {
    return { ...this.config };
  }

  /**
   * Get adapter capabilities
   */
  abstract getCapabilities(): Promise<StorageCapabilities>;

  /**
   * Initialize the adapter
   */
  abstract initialize(): Promise<void>;

  /**
   * Test connection to the storage provider
   */
  abstract testConnection(): Promise<boolean>;

  /**
   * Store a single item
   */
  abstract set(
    key: string,
    value: unknown,
    options?: StorageOptions
  ): Promise<void>;

  /**
   * Retrieve a single item
   */
  abstract get(key: string): Promise<StorageItem | null>;

  /**
   * Check if an item exists
   */
  abstract has(key: string): Promise<boolean>;

  /**
   * Delete a single item
   */
  abstract delete(key: string): Promise<boolean>;

  /**
   * Store multiple items in a batch
   */
  abstract setBatch(
    items: Array<{ key: string; value: unknown; options?: StorageOptions }>
  ): Promise<void>;

  /**
   * Retrieve multiple items
   */
  abstract getBatch(keys: string[]): Promise<StorageItem[]>;

  /**
   * Delete multiple items
   */
  abstract deleteBatch(keys: string[]): Promise<number>;

  /**
   * Query items with filters
   */
  abstract query(query: StorageQuery): Promise<StorageResult>;

  /**
   * List all keys matching a pattern
   */
  abstract keys(pattern?: string): Promise<string[]>;

  /**
   * Get storage statistics
   */
  abstract stats(): Promise<{
    itemCount: number;
    totalSize: number;
    usedSpace: number;
    availableSpace?: number;
  }>;

  /**
   * Clear all items (with optional pattern)
   */
  abstract clear(pattern?: string): Promise<number>;

  /**
   * Clean up expired items
   */
  abstract cleanup(): Promise<number>;

  abstract transaction<T>(
    callback: (tx: StorageTransaction) => Promise<T>
  ): Promise<T>;


  async setTheme(theme: "light" | "dark" | "system"): Promise<void> {
    await this.set("theme", theme);
  }

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
    return (item?.value as any[]) || [];
  }

  /**
   * Store tools for a connection
   */
  async setConnectionTools(connectionId: string, tools: any[]): Promise<void> {
    const allTools = await this.get("tools");
    const toolsData = (allTools?.value as Record<string, any[]>) || {};
    toolsData[connectionId] = tools;
    await this.set("tools", toolsData);
  }

  /**
   * Get tools for a connection
   */
  async getConnectionTools(connectionId: string): Promise<any[]> {
    const item = await this.get("tools");
    const toolsData = (item?.value as Record<string, any[]>) || {};
    return toolsData[connectionId] || [];
  }

  /**
   * Store resources for a connection
   */
  async setConnectionResources(
    connectionId: string,
    resources: any[]
  ): Promise<void> {
    const allResources = await this.get("resources");
    const resourcesData = (allResources?.value as Record<string, any[]>) || {};
    resourcesData[connectionId] = resources;
    await this.set("resources", resourcesData);
  }

  /**
   * Get resources for a connection
   */
  async getConnectionResources(connectionId: string): Promise<any[]> {
    const item = await this.get("resources");
    const resourcesData = (item?.value as Record<string, any[]>) || {};
    return resourcesData[connectionId] || [];
  }

  /**
   * Store conversations for a connection
   */
  async setConnectionConversations(
    connectionId: string,
    conversations: any[]
  ): Promise<void> {
    const allConversations = await this.get("conversations");
    const conversationsData =
      (allConversations?.value as Record<string, any[]>) || {};
    conversationsData[connectionId] = conversations;
    await this.set("conversations", conversationsData);
  }

  /**
   * Get conversations for a connection
   */
  async getConnectionConversations(connectionId: string): Promise<any[]> {
    const item = await this.get("conversations");
    const conversationsData = (item?.value as Record<string, any[]>) || {};
    return conversationsData[connectionId] || [];
  }

  /**
   * Store tool executions for a connection
   */
  async setConnectionToolExecutions(
    connectionId: string,
    executions: any[]
  ): Promise<void> {
    const allExecutions = await this.get("toolExecutions");
    const executionsData =
      (allExecutions?.value as Record<string, any[]>) || {};
    executionsData[connectionId] = executions;
    await this.set("toolExecutions", executionsData);
  }

  /**
   * Get tool executions for a connection
   */
  async getConnectionToolExecutions(connectionId: string): Promise<any[]> {
    const item = await this.get("toolExecutions");
    const executionsData = (item?.value as Record<string, any[]>) || {};
    return executionsData[connectionId] || [];
  }

  /**
   * Add a single tool execution to a connection
   */
  async addToolExecution(connectionId: string, execution: any): Promise<void> {
    const currentExecutions =
      await this.getConnectionToolExecutions(connectionId);

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
   * Update configuration
   */
  updateConfig(config: Partial<StorageConfig>): void {
    this.config = StorageConfigSchema.parse({ ...this.config, ...config });
  }

  /**
   * Validate storage key
   */
  protected validateKey(key: string): void {
    if (!key || key.length === 0) {
      throw new AdapterError("Storage key cannot be empty", "INVALID_KEY");
    }

    if (key.length > 1000) {
      throw new AdapterError("Storage key too long", "KEY_TOO_LONG");
    }
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
      `Storage adapter error in ${context}: ${message}`,
      "STORAGE_ADAPTER_ERROR",
      { context, originalError: error }
    );
  }
}

/**
 * Storage transaction interface
 */
export interface StorageTransaction {
  set(key: string, value: unknown, options?: StorageOptions): Promise<void>;
  get(key: string): Promise<StorageItem | null>;
  delete(key: string): Promise<boolean>;
  commit(): Promise<void>;
  rollback(): Promise<void>;
}
