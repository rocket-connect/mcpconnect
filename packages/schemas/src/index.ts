// Connection schemas
export {
  ConnectionSchema,
  ConnectionStatusSchema,
  ConnectionTypeSchema,
  type Connection,
  type ConnectionStatus,
  type ConnectionType,
} from "./connection";

// Tool schemas
export {
  ToolSchema,
  ToolExecutionRequestSchema,
  ToolExecutionResponseSchema,
  ToolExecutionSchema,
  type Tool,
  type ToolExecutionRequest,
  type ToolExecutionResponse,
  type ToolExecution,
} from "./tool";

// Resource schemas
export {
  ResourceSchema,
  ResourceAccessRequestSchema,
  ResourceAccessResponseSchema,
  type Resource,
  type ResourceAccessRequest,
  type ResourceAccessResponse,
} from "./resource";

// Chat schemas
export {
  ChatMessageSchema,
  ChatConversationSchema,
  ChatSessionSchema,
  type ChatMessage,
  type ChatConversation,
  type ChatSession,
} from "./chat";

// Server schemas
export {
  ServerOptionsSchema,
  ServerStatusSchema,
  HealthCheckSchema,
  type ServerOptions,
  type ServerStatus,
  type HealthCheck,
} from "./server";

// Theme schemas
export {
  ThemeSchema,
  ThemeContextSchema,
  ThemeConfigSchema,
  type Theme,
  type ThemeContextType,
  type ThemeConfig,
} from "./theme";

// MCP Protocol schemas
export {
  MCPVersionSchema,
  MCPTransportSchema,
  MCPMessageTypeSchema,
  MCPMessageBaseSchema,
  MCPRequestSchema,
  MCPResponseSchema,
  MCPNotificationSchema,
  MCPCapabilitiesSchema,
  MCPInitializationSchema,
  type MCPVersion,
  type MCPTransport,
  type MCPMessageType,
  type MCPRequest,
  type MCPResponse,
  type MCPNotification,
  type MCPCapabilities,
  type MCPInitialization,
} from "./mcp-protocol";

// API schemas
export {
  APIHeadersSchema,
  APIErrorSchema,
  APIResponseSchema,
  PaginatedResponseSchema,
  PaginatedRequestSchema,
  BulkOperationSchema,
  type APIHeaders,
  type APIError,
  type APIResponse,
  type PaginatedRequest,
  type BulkOperation,
} from "./api";

// UI schemas
export {
  UIVariantSchema,
  UISizeSchema,
  UILayoutModeSchema,
  UINotificationSchema,
  UIPanelSchema,
  UILayoutSchema,
  type UIVariant,
  type UISize,
  type UILayoutMode,
  type UINotification,
  type UIPanel,
  type UILayout,
} from "./ui";

// Re-export zod for convenience
export { z } from "zod";
