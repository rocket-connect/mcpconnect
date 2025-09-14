// LocalStorage adapter exports
export { LocalStorageAdapter } from "./local-storage-adapter";
export type { LocalStorageConfig } from "./local-storage-adapter";

// Re-export base types for convenience
export type {
  StorageAdapter,
  StorageConfig,
  StorageItem,
  StorageQuery,
  StorageResult,
  StorageOptions,
  StorageCapabilities,
  StorageTransaction,
} from "@mcpconnect/base-adapters";
