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
    console.log("Transaction.set stub:", { key, hasValue: !!value, options });

    // Store the current value for rollback
    const currentItem = await this.adapter.get(key);

    this.operations.push(() => {
      // Actual set operation would go here
      console.log("Executing transaction set:", key);
    });

    this.rollbackOperations.push(() => {
      if (currentItem) {
        console.log("Rolling back set operation for:", key);
        // Restore previous value
      } else {
        console.log("Rolling back set operation (delete) for:", key);
        // Delete the key
      }
    });
  }

  async get(key: string): Promise<StorageItem | null> {
    console.log("Transaction.get stub:", key);
    return this.adapter.get(key);
  }

  async delete(key: string): Promise<boolean> {
    console.log("Transaction.delete stub:", key);

    const currentItem = await this.adapter.get(key);

    this.operations.push(() => {
      console.log("Executing transaction delete:", key);
    });

    this.rollbackOperations.push(() => {
      if (currentItem) {
        console.log("Rolling back delete operation for:", key);
        // Restore the item
      }
    });

    return !!currentItem;
  }

  async commit(): Promise<void> {
    console.log(
      "Transaction.commit stub - executing",
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
      "Transaction.rollback stub - rolling back",
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
 * LocalStorage implementation of StorageAdapter
 */
export class LocalStorageAdapter extends StorageAdapter {
  protected config: LocalStorageConfig;

  constructor(config: LocalStorageConfig) {
    const parsedConfig = LocalStorageConfigSchema.parse(config);
    super(parsedConfig);
    this.config = parsedConfig;
  }

  async getCapabilities(): Promise<StorageCapabilities> {
    console.log("LocalStorageAdapter.getCapabilities stub");

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
    console.log("LocalStorageAdapter.initialize stub");

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
      // setInterval(() => this.cleanup(), this.config.cleanupInterval);
    }
  }

  async testConnection(): Promise<boolean> {
    console.log("LocalStorageAdapter.testConnection stub");

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
    console.log("LocalStorageAdapter.set stub:", {
      key,
      hasValue: !!value,
      options,
    });

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
    console.log("LocalStorageAdapter.get stub:", key);

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
    console.log("LocalStorageAdapter.has stub:", key);

    const item = await this.get(key);
    return item !== null;
  }

  async delete(key: string): Promise<boolean> {
    console.log("LocalStorageAdapter.delete stub:", key);

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
    console.log("LocalStorageAdapter.setBatch stub:", items.length, "items");

    for (const item of items) {
      await this.set(item.key, item.value, item.options);
    }
  }

  async getBatch(keys: string[]): Promise<StorageItem[]> {
    console.log("LocalStorageAdapter.getBatch stub:", keys.length, "keys");

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
    console.log("LocalStorageAdapter.deleteBatch stub:", keys.length, "keys");

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
    console.log("LocalStorageAdapter.query stub:", query);

    const allKeys = await this.keys(query.prefix);
    let matchingItems: StorageItem[] = [];

    // This is a stub implementation - real implementation would be more efficient
    for (const key of allKeys) {
      if (query.limit && matchingItems.length >= query.limit) {
        break;
      }

      const item = await this.get(key.replace(this.config.prefix, ""));
      if (item) {
        // Apply filters (stub logic)
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

    // Apply offset
    if (query.offset) {
      matchingItems = matchingItems.slice(query.offset);
    }

    return {
      items: matchingItems,
      total: matchingItems.length,
      hasMore: false, // Stub implementation
      metadata: { queryExecutedAt: new Date().toISOString() },
    };
  }

  async keys(pattern?: string): Promise<string[]> {
    console.log("LocalStorageAdapter.keys stub:", pattern);

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
    console.log("LocalStorageAdapter.stats stub");

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
      availableSpace: Math.max(0, 10 * 1024 * 1024 - totalSize), // Estimate 10MB limit
    };
  }

  async clear(pattern?: string): Promise<number> {
    console.log("LocalStorageAdapter.clear stub:", pattern);

    const keys = await this.keys(pattern);
    let deletedCount = 0;

    for (const key of keys) {
      localStorage.removeItem(key);
      deletedCount++;
    }

    return deletedCount;
  }

  async cleanup(): Promise<number> {
    console.log("LocalStorageAdapter.cleanup stub");

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
    console.log("LocalStorageAdapter.transaction stub");

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
}
