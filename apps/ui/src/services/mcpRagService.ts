/**
 * MCP-RAG Service
 *
 * Integrates with the @mcp-rag/client library to sync tools to Neo4j
 * for vector-based semantic tool selection.
 *
 * Based on: https://rconnect.tech/blog/semantic-tool-discovery
 */

import { createMCPRag } from "@mcp-rag/client";
import neo4j, { type Driver } from "neo4j-driver";
import type { Tool } from "@mcpconnect/schemas";
import { openai } from "@ai-sdk/openai";

type MCPRagClient = any;

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
