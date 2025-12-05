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
}

export interface SyncResult {
  success: boolean;
  toolCount: number;
  error?: string;
}

let driver: Driver | null = null;
let ragClient: MCPRagClient | null = null;

/**
 * Convert MCPConnect Tool[] to AI SDK tool format expected by mcp-rag
 */
function convertToolsToAISDKFormat(
  tools: Tool[]
): Record<string, { description: string; parameters: unknown }> {
  const aiSDKTools: Record<
    string,
    { description: string; parameters: unknown }
  > = {};

  for (const tool of tools) {
    aiSDKTools[tool.name] = {
      description: tool.description,
      parameters: tool.inputSchema || {
        type: "object",
        properties: {},
      },
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
  } = options;

  try {
    console.log("[mcpRagService] Starting tool sync:", {
      toolCount: tools.length,
      toolSetName,
      neo4jUri: neo4jConfig.uri,
      hasApiKey: !!openaiApiKey,
      apiKeyLength: openaiApiKey?.length ?? 0,
      apiKeyPreview: openaiApiKey
        ? `${openaiApiKey.substring(0, 8)}...`
        : "MISSING",
    });

    // Close existing driver if any
    if (driver) {
      await driver.close();
    }

    // Create new Neo4j driver
    driver = neo4j.driver(
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
    ragClient = createMCPRag({
      model: openai("gpt-4"),
      openaiApiKey,
      neo4j: driver,
      // @ts-ignore
      tools: aiSDKTools,
      toolSetName,
      dangerouslyAllowBrowser: true,
    });

    // Sync tools to Neo4j with vector embeddings
    // This will:
    // - Create vector index if not exists
    // - Generate embeddings for each tool
    // - Store tool graph structure in Neo4j
    console.log("[mcpRagService] Calling rag.sync()...");
    await ragClient.sync();

    console.log("[mcpRagService] Tool sync completed successfully");

    return {
      success: true,
      toolCount: tools.length,
    };
  } catch (error) {
    console.error("[mcpRagService] Tool sync failed:", error);

    // Clean up on error
    if (driver) {
      await driver.close();
      driver = null;
    }
    ragClient = null;

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
 */
export function getRagClient(): MCPRagClient | null {
  return ragClient;
}

/**
 * Close Neo4j connection and cleanup
 */
export async function closeConnection(): Promise<void> {
  if (driver) {
    await driver.close();
    driver = null;
  }
  ragClient = null;
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
 */
export function createToolSelectionProvider(options?: {
  maxTools?: number;
}): ToolSelectionProvider | null {
  if (!ragClient || !driver) {
    console.warn(
      "[mcpRagService] Cannot create provider: RAG client or driver not initialized"
    );
    return null;
  }

  return new MCPRagToolSelectionProvider(ragClient, options);
}

/**
 * Check if the RAG client is initialized and ready
 */
export function isRagClientReady(): boolean {
  return ragClient !== null && driver !== null;
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

  // Already initialized
  if (ragClient && driver) {
    console.log("[mcpRagService] RAG client already initialized");
    return true;
  }

  try {
    console.log("[mcpRagService] Reinitializing RAG client:", {
      toolCount: tools.length,
      toolSetName,
      neo4jUri: neo4jConfig.uri,
    });

    // Close existing driver if any
    if (driver) {
      await driver.close();
    }

    // Create new Neo4j driver
    driver = neo4j.driver(
      neo4jConfig.uri,
      neo4j.auth.basic(neo4jConfig.username, neo4jConfig.password)
    );

    // Test connection
    await driver.getServerInfo();

    // Convert tools to AI SDK format
    const aiSDKTools = convertToolsToAISDKFormat(tools);

    // Create MCP-RAG client (no sync needed - tools already in Neo4j)
    ragClient = createMCPRag({
      model: openai("gpt-4"),
      openaiApiKey,
      neo4j: driver,
      // @ts-ignore
      tools: aiSDKTools,
      toolSetName,
      dangerouslyAllowBrowser: true,
    });

    console.log("[mcpRagService] RAG client reinitialized successfully");
    return true;
  } catch (error) {
    console.error("[mcpRagService] Failed to reinitialize RAG client:", error);

    // Clean up on error
    if (driver) {
      try {
        await driver.close();
      } catch (closeError) {
        console.error("[mcpRagService] Failed to close driver:", closeError);
      }
      driver = null;
    }
    ragClient = null;

    return false;
  }
}
