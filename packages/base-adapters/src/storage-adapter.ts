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

/**
 * Storage options schema
 */
export const StorageOptionsSchema = z.object({
  ttl: z.number().positive().optional(), // Time to live in milliseconds
  tags: z.array(z.string()).optional(),
  type: z.string().optional(),
  compress: z.boolean().default(false),
  encrypt: z.boolean().default(false),
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

  /**
   * Start a transaction (if supported)
   */
  abstract transaction<T>(
    callback: (tx: StorageTransaction) => Promise<T>
  ): Promise<T>;

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
