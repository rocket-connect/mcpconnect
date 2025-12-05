/**
 * MCP-RAG Service
 *
 * Integrates with the @mcp-rag/client library to sync tools to Neo4j
 * for vector-based semantic tool selection.
 *
 * Based on: https://rconnect.tech/blog/semantic-tool-discovery
 */

import { createMCPRag, MCPRagClient } from "@mcp-rag/client";
import neo4j, { type Driver } from "neo4j-driver";
import type {
  Tool,
  ToolSelectionProvider,
  ToolSelectionContext,
  ToolSelectionResult,
  ToolSelectionCallbacks,
} from "@mcpconnect/schemas";
import { openai } from "@ai-sdk/openai";
import { jsonSchema } from "ai";

export interface Neo4jConfig {
  uri: string;
  username: string;
  password: string;
  database?: string;
}

export interface SyncOptions {
  neo4jConfig: Neo4jConfig;
  openaiApiKey: string;
  tools: Tool[];
  toolSetName?: string;
  /** If true, deletes existing toolset before syncing (for resync) */
  forceSync?: boolean;
  /** Previous toolset hash to delete before syncing */
  previousHash?: string;
}

export interface SyncResult {
  success: boolean;
  toolCount: number;
  hash?: string;
  error?: string;
}

// Per-connection state management
interface ConnectionRagState {
  driver: Driver;
  ragClient: MCPRagClient;
  connectionId: string;
}

// Map of connectionId -> RAG state
const connectionRagStates = new Map<string, ConnectionRagState>();

// Current active connection (for backwards compatibility)
let currentConnectionId: string | null = null;

/**
 * Recursively sort all keys in an object/array for deterministic JSON serialization.
 * This ensures the same data structure always produces the same JSON string
 * regardless of the original property insertion order.
 */
function sortObjectKeysDeep(obj: unknown): unknown {
  if (obj === null || typeof obj !== "object") {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(sortObjectKeysDeep);
  }

  const sortedKeys = Object.keys(obj as Record<string, unknown>).sort();
  const result: Record<string, unknown> = {};
  for (const key of sortedKeys) {
    result[key] = sortObjectKeysDeep((obj as Record<string, unknown>)[key]);
  }
  return result;
}

/**
 * Ensure inputSchema is a valid JSON Schema object.
 * The AI SDK's asSchema function expects a proper JSON Schema.
 *
 * We create a clean copy to avoid any prototype chain issues that might
 * cause the asSchema function to misidentify this as a Zod schema.
 */
function normalizeInputSchema(
  inputSchema: Record<string, unknown> | undefined
): Record<string, unknown> {
  // Default empty schema
  const defaultSchema: Record<string, unknown> = {
    type: "object",
    properties: {},
  };

  if (!inputSchema || typeof inputSchema !== "object") {
    return defaultSchema;
  }

  // Create a clean JSON copy to remove any prototype chain or special properties
  // This prevents asSchema from mistaking this for a Zod schema
  try {
    const cleanSchema = JSON.parse(JSON.stringify(inputSchema));

    // Ensure required fields for a valid JSON Schema
    if (!cleanSchema.type) {
      cleanSchema.type = "object";
    }

    // Ensure properties exists if type is object
    if (cleanSchema.type === "object" && !cleanSchema.properties) {
      cleanSchema.properties = {};
    }

    return cleanSchema;
  } catch {
    // If JSON serialization fails, return default
    return defaultSchema;
  }
}

/**
 * Convert MCPConnect Tool[] to AI SDK tool format expected by mcp-rag
 *
 * Important: We normalize the inputSchema by deep-sorting all keys to ensure
 * consistent hashing regardless of property order from MCP server polling.
 *
 * We wrap the schema using AI SDK's jsonSchema() helper to ensure asSchema()
 * can properly handle it without trying to detect it as a Zod schema.
 */
function convertToolsToAISDKFormat(
  tools: Tool[]
): Record<
  string,
  { description: string; inputSchema: ReturnType<typeof jsonSchema> }
> {
  const aiSDKTools: Record<
    string,
    { description: string; inputSchema: ReturnType<typeof jsonSchema> }
  > = {};

  // Sort tools by name for consistent ordering
  const sortedTools = [...tools].sort((a, b) => a.name.localeCompare(b.name));

  for (const tool of sortedTools) {
    // First normalize the schema to ensure it's valid
    const validSchema = normalizeInputSchema(tool.inputSchema);
    // Then deep sort for consistent hashing
    const normalizedSchema = sortObjectKeysDeep(validSchema) as Record<
      string,
      unknown
    >;

    // Wrap with AI SDK's jsonSchema helper so asSchema() handles it correctly
    aiSDKTools[tool.name] = {
      description: tool.description || "",
      inputSchema: jsonSchema(normalizedSchema),
    };
  }

  return aiSDKTools;
}

/**
 * Test Neo4j connection without syncing tools
 */
export async function testNeo4jConnection(
  config: Neo4jConfig
): Promise<boolean> {
  let testDriver: Driver | null = null;

  try {
    testDriver = neo4j.driver(
      config.uri,
      neo4j.auth.basic(config.username, config.password)
    );

    const serverInfo = await testDriver.getServerInfo();
    console.log("[mcpRagService] Neo4j connection successful:", serverInfo);
    return true;
  } catch (error) {
    console.error("[mcpRagService] Neo4j connection failed:", error);
    return false;
  } finally {
    if (testDriver) {
      await testDriver.close();
    }
  }
}

/**
 * Sync tools to Neo4j with vector embeddings using mcp-rag
 *
 * This creates vector embeddings for each tool using OpenAI's
 * text-embedding-3-small model and stores them in Neo4j for
 * semantic similarity search.
 */
export async function syncToolsToNeo4j(
  options: SyncOptions
): Promise<SyncResult> {
  const {
    neo4jConfig,
    openaiApiKey,
    tools,
    toolSetName = "mcpconnect",
    forceSync = false,
    previousHash,
  } = options;

  // Use toolSetName as connectionId for per-connection state
  const connectionId = toolSetName;

  try {
    console.log("[mcpRagService] Starting tool sync:", {
      toolCount: tools.length,
      toolSetName,
      connectionId,
      neo4jUri: neo4jConfig.uri,
      hasApiKey: !!openaiApiKey,
      apiKeyLength: openaiApiKey?.length ?? 0,
      apiKeyPreview: openaiApiKey
        ? `${openaiApiKey.substring(0, 8)}...`
        : "MISSING",
      forceSync,
      previousHash,
    });

    // Close existing state for this connection if any
    const existingState = connectionRagStates.get(connectionId);
    if (existingState) {
      try {
        await existingState.driver.close();
      } catch (err) {
        console.warn("[mcpRagService] Failed to close existing driver:", err);
      }
      connectionRagStates.delete(connectionId);
    }

    // Create new Neo4j driver
    const driver = neo4j.driver(
      neo4jConfig.uri,
      neo4j.auth.basic(neo4jConfig.username, neo4jConfig.password)
    );

    // Convert tools to AI SDK format expected by mcp-rag
    const aiSDKTools = convertToolsToAISDKFormat(tools);

    console.log("[mcpRagService] Converted tools to AI SDK format:", {
      toolNames: Object.keys(aiSDKTools),
    });

    // Create MCP-RAG client
    // The createMCPRag function creates a wrapper that handles:
    // 1. Vector index creation in Neo4j
    // 2. Embedding generation via OpenAI
    // 3. Tool decomposition (tool, params, return types)
    const ragClient = createMCPRag({
      model: openai("gpt-4"),
      openaiApiKey,
      neo4j: driver,
      // @ts-ignore
      tools: aiSDKTools,
      dangerouslyAllowBrowser: true,
    });

    // Store the state for this connection
    connectionRagStates.set(connectionId, {
      driver,
      ragClient,
      connectionId,
    });
    currentConnectionId = connectionId;

    // If forceSync is true and we have a previous hash, delete the old toolset first
    // This ensures a clean sync when tools have changed
    if (forceSync && previousHash) {
      console.log(
        "[mcpRagService] Force sync enabled, deleting previous toolset:",
        previousHash
      );
      try {
        const deleteResult = await ragClient.deleteToolsetByHash(previousHash);
        console.log("[mcpRagService] Previous toolset deleted:", deleteResult);
      } catch (deleteError) {
        console.warn(
          "[mcpRagService] Failed to delete previous toolset (continuing with sync):",
          deleteError
        );
      }
    }

    // Sync tools to Neo4j with vector embeddings
    // This will:
    // - Create vector index if not exists
    // - Generate embeddings for each tool
    // - Store tool graph structure in Neo4j
    console.log("[mcpRagService] Calling rag.sync()...");
    const syncResult = await ragClient.sync();

    console.log(
      "[mcpRagService] Tool sync completed successfully with hash:",
      syncResult.hash
    );

    return {
      success: true,
      toolCount: tools.length,
      hash: syncResult.hash,
    };
  } catch (error) {
    console.error("[mcpRagService] Tool sync failed:", error);

    // Clean up on error
    const state = connectionRagStates.get(connectionId);
    if (state) {
      try {
        await state.driver.close();
      } catch (err) {
        console.warn("[mcpRagService] Failed to close driver on error:", err);
      }
      connectionRagStates.delete(connectionId);
    }
    if (currentConnectionId === connectionId) {
      currentConnectionId = null;
    }

    return {
      success: false,
      toolCount: 0,
      error:
        error instanceof Error ? error.message : "Unknown error during sync",
    };
  }
}

/**
 * Get the current MCP-RAG client instance
 * Can be used for tool selection queries after sync
 * @param connectionId - Optional connection ID. If not provided, uses current active connection
 */
export function getRagClient(connectionId?: string): MCPRagClient | null {
  const targetId = connectionId ?? currentConnectionId;
  if (!targetId) return null;

  const state = connectionRagStates.get(targetId);
  return state?.ragClient ?? null;
}

/**
 * Get the RAG state for a specific connection
 */
export function getConnectionRagState(
  connectionId: string
): ConnectionRagState | null {
  return connectionRagStates.get(connectionId) ?? null;
}

/**
 * Close Neo4j connection and cleanup for a specific connection
 * @param connectionId - Optional connection ID. If not provided, closes current active connection
 */
export async function closeConnection(connectionId?: string): Promise<void> {
  const targetId = connectionId ?? currentConnectionId;
  if (!targetId) return;

  const state = connectionRagStates.get(targetId);
  if (state) {
    try {
      await state.driver.close();
    } catch (err) {
      console.warn("[mcpRagService] Failed to close driver:", err);
    }
    connectionRagStates.delete(targetId);
  }

  if (currentConnectionId === targetId) {
    currentConnectionId = null;
  }
}

/**
 * Close all connections
 */
export async function closeAllConnections(): Promise<void> {
  for (const [connectionId, state] of connectionRagStates) {
    try {
      await state.driver.close();
    } catch (err) {
      console.warn(
        `[mcpRagService] Failed to close driver for ${connectionId}:`,
        err
      );
    }
  }
  connectionRagStates.clear();
  currentConnectionId = null;
}

/**
 * MCP RAG Tool Selection Provider
 *
 * Implements the ToolSelectionProvider interface using MCP RAG's
 * semantic vector search to find relevant tools for a given prompt.
 *
 * Uses the mcp-rag client's getActiveTools method which handles:
 * - Embedding generation via OpenAI
 * - Vector search in Neo4j
 * - Tool scoring and ranking
 */
export class MCPRagToolSelectionProvider implements ToolSelectionProvider {
  readonly id = "mcp-rag";
  readonly name = "MCP RAG Semantic Tool Selection";

  private client: MCPRagClient;
  private maxTools: number;

  constructor(client: MCPRagClient, options?: { maxTools?: number }) {
    this.client = client;
    this.maxTools = options?.maxTools ?? 10;
  }

  async selectTools(
    allTools: Tool[],
    context: ToolSelectionContext,
    _callbacks?: ToolSelectionCallbacks
  ): Promise<ToolSelectionResult> {
    const startTime = Date.now();
    const prompt = context.prompt;
    const maxTools = context.maxTools ?? this.maxTools;

    console.log("[MCPRagToolSelectionProvider] Selecting tools for:", {
      prompt: prompt.substring(0, 100) + (prompt.length > 100 ? "..." : ""),
      totalTools: allTools.length,
      maxTools,
    });

    try {
      // Create a tool name to Tool map for quick lookup
      const toolMap = new Map<string, Tool>();
      for (const tool of allTools) {
        toolMap.set(tool.name, tool);
      }

      // Use the mcp-rag client's getActiveTools method
      // This handles embedding generation and vector search internally
      const result = await this.client.getActiveTools({ prompt, maxTools });

      // Map the AI SDK tools back to MCPConnect Tool format
      const selectedTools: Tool[] = [];
      const scores = new Map<string, number>();

      for (const toolName of result.names) {
        const tool = toolMap.get(toolName);
        if (tool) {
          selectedTools.push(tool);
          // Note: getActiveTools doesn't return scores, so we estimate based on position
          // The tools are returned in order of relevance
          const position = result.names.indexOf(toolName);
          const estimatedScore = 1 - (position / result.names.length) * 0.5;
          scores.set(toolName, estimatedScore);
        }
      }

      const durationMs = Date.now() - startTime;

      console.log("[MCPRagToolSelectionProvider] Selected tools:", {
        selectedCount: selectedTools.length,
        totalCount: allTools.length,
        durationMs,
        tools: selectedTools.map(t => ({
          name: t.name,
          score: scores.get(t.name),
        })),
      });

      return {
        tools: selectedTools,
        scores,
        debug: {
          selectionTimeMs: durationMs,
          totalToolsConsidered: allTools.length,
          strategy: "mcp-rag-vector-search",
        },
      };
    } catch (error) {
      console.error("[MCPRagToolSelectionProvider] Selection failed:", error);
      throw error;
    }
  }

  async dispose(): Promise<void> {
    // Nothing to dispose - the driver is managed by the service
  }
}

/**
 * Create a ToolSelectionProvider using MCP RAG
 * Returns null if no RAG client is available
 * @param connectionId - Optional connection ID. If not provided, uses current active connection
 */
export function createToolSelectionProvider(options?: {
  maxTools?: number;
  connectionId?: string;
}): ToolSelectionProvider | null {
  const targetId = options?.connectionId ?? currentConnectionId;
  if (!targetId) {
    console.warn(
      "[mcpRagService] Cannot create provider: no active connection"
    );
    return null;
  }

  const state = connectionRagStates.get(targetId);
  if (!state) {
    console.warn(
      "[mcpRagService] Cannot create provider: RAG client or driver not initialized for connection:",
      targetId
    );
    return null;
  }

  return new MCPRagToolSelectionProvider(state.ragClient, options);
}

/**
 * Check if the RAG client is initialized and ready
 * @param connectionId - Optional connection ID. If not provided, uses current active connection
 */
export function isRagClientReady(connectionId?: string): boolean {
  const targetId = connectionId ?? currentConnectionId;
  if (!targetId) return false;

  const state = connectionRagStates.get(targetId);
  return state !== undefined;
}

/**
 * Get the current toolset hash from the RAG client
 * Returns null if the RAG client is not initialized
 * @param connectionId - Optional connection ID. If not provided, uses current active connection
 */
export function getToolsetHash(connectionId?: string): string | null {
  const targetId = connectionId ?? currentConnectionId;
  if (!targetId) {
    console.warn(
      "[mcpRagService] Cannot get toolset hash: no active connection"
    );
    return null;
  }

  const state = connectionRagStates.get(targetId);
  if (!state) {
    console.warn(
      "[mcpRagService] Cannot get toolset hash: RAG client not initialized for connection:",
      targetId
    );
    return null;
  }
  return state.ragClient.getToolsetHash();
}

export interface DeleteToolsetResult {
  deletedToolsets: number;
  deletedTools: number;
  deletedParams: number;
  deletedReturnTypes: number;
}

/**
 * Delete a toolset from Neo4j by its hash
 *
 * This removes the toolset and all associated tools, parameters,
 * and return types from the Neo4j database.
 *
 * @param hash - The toolset hash to delete (or uses current hash if not provided)
 * @param connectionId - Optional connection ID. If not provided, uses current active connection
 * @returns The result of the deletion operation
 */
export async function deleteToolsetByHash(
  hash?: string,
  connectionId?: string
): Promise<DeleteToolsetResult> {
  const targetId = connectionId ?? currentConnectionId;
  if (!targetId) {
    console.warn("[mcpRagService] Cannot delete toolset: no active connection");
    return {
      deletedToolsets: 0,
      deletedTools: 0,
      deletedParams: 0,
      deletedReturnTypes: 0,
    };
  }

  const state = connectionRagStates.get(targetId);
  if (!state) {
    console.warn(
      "[mcpRagService] Cannot delete toolset: RAG client not initialized for connection:",
      targetId
    );
    return {
      deletedToolsets: 0,
      deletedTools: 0,
      deletedParams: 0,
      deletedReturnTypes: 0,
    };
  }

  // Use provided hash or get current toolset hash
  const targetHash = hash ?? state.ragClient.getToolsetHash();

  console.log(
    "[mcpRagService] Deleting toolset with hash:",
    targetHash,
    "for connection:",
    targetId
  );

  try {
    const result = await state.ragClient.deleteToolsetByHash(targetHash);

    console.log("[mcpRagService] Toolset deleted:", result);

    return result;
  } catch (error) {
    console.error("[mcpRagService] Failed to delete toolset:", error);
    throw error;
  }
}

/**
 * Reinitialize the RAG client with stored configuration
 * Used to restore state after page reload when sync state exists
 */
export async function reinitializeRagClient(options: {
  neo4jConfig: Neo4jConfig;
  openaiApiKey: string;
  tools: Tool[];
  toolSetName?: string;
}): Promise<boolean> {
  const {
    neo4jConfig,
    openaiApiKey,
    tools,
    toolSetName = "mcpconnect",
  } = options;

  // Use toolSetName as connectionId
  const connectionId = toolSetName;

  // Already initialized for this connection
  const existingState = connectionRagStates.get(connectionId);
  if (existingState) {
    console.log(
      "[mcpRagService] RAG client already initialized for connection:",
      connectionId
    );
    currentConnectionId = connectionId;
    return true;
  }

  try {
    console.log("[mcpRagService] Reinitializing RAG client:", {
      toolCount: tools.length,
      toolSetName,
      connectionId,
      neo4jUri: neo4jConfig.uri,
    });

    // Create new Neo4j driver
    const driver = neo4j.driver(
      neo4jConfig.uri,
      neo4j.auth.basic(neo4jConfig.username, neo4jConfig.password)
    );

    // Test connection
    await driver.getServerInfo();

    // Convert tools to AI SDK format
    const aiSDKTools = convertToolsToAISDKFormat(tools);

    // Create MCP-RAG client (no sync needed - tools already in Neo4j)
    const ragClient = createMCPRag({
      model: openai("gpt-4"),
      openaiApiKey,
      neo4j: driver,
      // @ts-ignore
      tools: aiSDKTools,
      dangerouslyAllowBrowser: true,
    });

    // Store the state for this connection
    connectionRagStates.set(connectionId, {
      driver,
      ragClient,
      connectionId,
    });
    currentConnectionId = connectionId;

    console.log(
      "[mcpRagService] RAG client reinitialized successfully for connection:",
      connectionId
    );
    return true;
  } catch (error) {
    console.error("[mcpRagService] Failed to reinitialize RAG client:", error);

    // Clean up on error - we didn't store it yet, so just log
    return false;
  }
}
