/**
 * Tool Selection Types for MCP Connect
 * Provides interfaces and types for intelligent tool selection via providers
 */

import { z } from "zod";

// Re-export Tool type from schemas (adjust import path as needed)
export type { Tool } from "./tool";

/**
 * Context provided to tool selection providers
 */
export interface ToolSelectionContext {
  /** The user's current prompt/message */
  prompt: string;

  /** Full conversation history (optional, for context-aware selection) */
  conversationHistory?: Array<{
    role: "user" | "assistant";
    content: string;
  }>;

  /** Connection ID for scoping tool selection */
  connectionId?: string;

  /** Maximum number of tools to return (provider hint) */
  maxTools?: number;

  /** Additional metadata for custom providers */
  metadata?: Record<string, unknown>;
}

/**
 * Result from tool selection
 */
export interface ToolSelectionResult {
  /** The selected subset of tools */
  tools: any[]; // Use Tool[] when importing from schemas

  /** Relevance scores for each tool (optional) */
  scores?: Map<string, number>;

  /** Provider-specific debug info */
  debug?: {
    /** Time taken for selection (ms) */
    selectionTimeMs?: number;
    /** Total tools considered */
    totalToolsConsidered?: number;
    /** Selection strategy used */
    strategy?: string;
    /** Any additional info */
    [key: string]: unknown;
  };
}

/**
 * Callbacks for tool selection lifecycle events
 */
export interface ToolSelectionCallbacks {
  /**
   * Called when tool selection (search) begins
   */
  onSelectionStart?: (event: {
    prompt: string;
    totalTools: number;
    providerId: string;
  }) => void;

  /**
   * Called when tool selection completes successfully
   */
  onSelectionComplete?: (event: {
    result: ToolSelectionResult;
    selectedCount: number;
    totalCount: number;
    durationMs: number;
  }) => void;

  /**
   * Called when tool selection fails
   */
  onSelectionError?: (event: { error: Error; willFallback: boolean }) => void;

  /**
   * Called when falling back to all tools
   */
  onSelectionFallback?: (event: {
    reason: string;
    originalError?: Error;
  }) => void;
}

/**
 * Abstract interface for tool selection providers
 *
 * Implementations can use any strategy: vector search, rules, ML models, etc.
 * The MCP RAG client implements this interface using Neo4j vector search.
 *
 * Note: Sync/indexing is handled separately by the client application.
 */
export interface ToolSelectionProvider {
  /** Unique identifier for this provider */
  readonly id: string;

  /** Human-readable name */
  readonly name: string;

  /**
   * Select relevant tools for a given context
   *
   * @param allTools - Complete set of available tools
   * @param context - Selection context including prompt and history
   * @param callbacks - Optional callbacks for start/complete/error events
   * @returns Promise resolving to selected tools with optional metadata
   */
  selectTools(
    allTools: any[], // Use Tool[] when importing from schemas
    context: ToolSelectionContext,
    callbacks?: ToolSelectionCallbacks
  ): Promise<ToolSelectionResult>;

  /**
   * Optional: Cleanup resources (close connections, etc.)
   */
  dispose?(): Promise<void>;
}

/**
 * Zod schema for serializable provider config
 */
export const ToolSelectionProviderConfigSchema = z.object({
  id: z.string(),
  name: z.string(),
  enabled: z.boolean().default(true),
  maxTools: z.number().positive().optional(),
  config: z.record(z.string(), z.unknown()).optional(),
});

export type ToolSelectionProviderConfig = z.infer<
  typeof ToolSelectionProviderConfigSchema
>;
