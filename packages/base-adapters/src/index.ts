// Common types and utilities (no dependencies)
export {
  AdapterError,
  AdapterStatus,
  type BaseConfig,
  type AdapterMetadata,
  BaseConfigSchema,
} from "./types";

// LLM Adapter exports
export {
  LLMAdapter,
  type LLMConfig,
  type LLMMessage,
  type LLMResponse,
  type LLMStreamResponse,
  type LLMTool,
  type LLMToolCall,
  type LLMToolResult,
  type LLMUsage,
  type LLMCapabilities,
  LLMConfigSchema,
} from "./llm-adapter";

// Storage Adapter exports (depends on types)
export {
  StorageAdapter,
  type StorageConfig,
  type StorageItem,
  type StorageQuery,
  type StorageResult,
  type StorageOptions,
  type StorageCapabilities,
  type StorageTransaction,
  StorageConfigSchema,
  StorageItemSchema,
  StorageQuerySchema,
  StorageResultSchema,
  StorageOptionsSchema,
  StorageCapabilitiesSchema,
} from "./storage-adapter";

// MCP Adapter exports (depends on types)
export {
  MCPAdapter,
  type MCPConfig,
  type MCPCapabilities,
  type MCPServerInfo,
  type MCPInitialization,
  type MCPToolDefinition,
  type MCPResourceDefinition,
  type MCPMessage,
  type MCPConnectionResult,
  type MCPToolExecutionResult,
  MCPCapabilitiesSchema,
  MCPServerInfoSchema,
  MCPInitializationSchema,
  MCPToolDefinitionSchema,
  MCPResourceDefinitionSchema,
  MCPMessageSchema,
  MCPConnectionResultSchema,
  MCPToolExecutionResultSchema,
  MCPConfigSchema,
} from "./mcp-adapter";

// Re-export zod for convenience
export { z } from "zod";
