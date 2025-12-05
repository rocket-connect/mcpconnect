import { useCallback, useEffect, useState, useRef } from "react";
import { useStorage } from "../contexts/StorageContext";
import { computeToolsHash } from "../utils/toolsHash";
import type { Neo4jConnectionConfig } from "@mcpconnect/components";
import {
  syncToolsToNeo4j,
  isRagClientReady,
  reinitializeRagClient,
} from "../services/mcpRagService";
import { ModelService } from "../services/modelService";

export interface Neo4jSyncOptions {
  config: Neo4jConnectionConfig;
  rememberPassword: boolean;
  openaiApiKey?: string;
}

export interface Neo4jSyncResult {
  hash: string;
  toolCount: number;
}

/**
 * Shared hook for Neo4j sync functionality
 * Used by both Sidebar and SettingsModal to ensure consistent behavior
 */
export function useNeo4jSync(connectionId: string | undefined) {
  const {
    tools,
    getNeo4jSyncState,
    updateNeo4jSyncState,
    deleteNeo4jSyncState,
    llmSettings,
  } = useStorage();

  // Get current sync state
  const syncState = connectionId ? getNeo4jSyncState(connectionId) : undefined;

  // Track if RAG client is ready (for vector search to work)
  const [isClientReady, setIsClientReady] = useState(isRagClientReady());
  const initializingRef = useRef(false);

  // Reinitialize RAG client on mount if we have a synced state with saved password
  useEffect(() => {
    const reinitialize = async () => {
      if (!connectionId || !syncState || initializingRef.current) {
        return;
      }

      // Only reinitialize if status is synced and we have saved credentials
      if (syncState.status !== "synced" || !syncState.neo4jConfig) {
        return;
      }

      // Check if RAG client is already ready
      if (isRagClientReady()) {
        setIsClientReady(true);
        return;
      }

      // We need the password to reinitialize
      if (!syncState.savedPassword) {
        console.warn(
          "[useNeo4jSync] Cannot reinitialize: no saved password. User will need to reconnect."
        );
        return;
      }

      // We need the OpenAI API key
      let openaiApiKey: string | undefined;

      // First try from context
      if (llmSettings?.provider === "openai" && llmSettings?.apiKey) {
        openaiApiKey = llmSettings.apiKey;
      } else {
        // Fall back to loading from storage
        try {
          const settings = await ModelService.loadSettings();
          if (settings?.provider === "openai" && settings?.apiKey) {
            openaiApiKey = settings.apiKey;
          }
        } catch (error) {
          console.error("[useNeo4jSync] Failed to load LLM settings:", error);
        }
      }

      if (!openaiApiKey) {
        console.warn(
          "[useNeo4jSync] Cannot reinitialize: OpenAI API key not available"
        );
        return;
      }

      initializingRef.current = true;

      try {
        // Decode the saved password
        const password = atob(syncState.savedPassword);
        const connectionTools = tools[connectionId] || [];

        console.log(
          "[useNeo4jSync] Reinitializing RAG client for:",
          connectionId
        );

        const success = await reinitializeRagClient({
          neo4jConfig: {
            ...syncState.neo4jConfig,
            password,
          },
          openaiApiKey,
          tools: connectionTools,
          toolSetName: connectionId,
        });

        setIsClientReady(success);

        if (!success) {
          console.warn(
            "[useNeo4jSync] Failed to reinitialize RAG client - vector search won't work until reconnected"
          );
        }
      } catch (error) {
        console.error("[useNeo4jSync] Error reinitializing RAG client:", error);
        setIsClientReady(false);
      } finally {
        initializingRef.current = false;
      }
    };

    reinitialize();
  }, [connectionId, syncState, tools, llmSettings]);

  // Helper to encode password for storage (base64)
  const encodePassword = (password: string): string => {
    return btoa(password);
  };

  // Handle sync operation
  const handleSync = useCallback(
    async (options: Neo4jSyncOptions): Promise<Neo4jSyncResult> => {
      if (!connectionId) {
        throw new Error("No connection selected");
      }

      const { config, rememberPassword } = options;

      const { openaiApiKey } = options;

      console.log("[useNeo4jSync] Starting sync:", {
        connectionId,
        uri: config.uri,
        username: config.username,
        rememberPassword,
        hasOpenAIKey: !!openaiApiKey,
      });

      // Update status to syncing with config
      await updateNeo4jSyncState(connectionId, {
        status: "syncing",
        neo4jConfig: {
          uri: config.uri,
          username: config.username,
          database: config.database || "neo4j",
        },
        savedPassword: rememberPassword
          ? encodePassword(config.password)
          : undefined,
        rememberPassword,
      });

      try {
        // Compute the hash of current tools
        const connectionTools = tools[connectionId] || [];
        const hash = computeToolsHash(connectionTools);
        const toolCount = connectionTools.length;

        // Validate OpenAI API key is provided
        if (!openaiApiKey) {
          throw new Error(
            "OpenAI API key is required for vector embeddings. Please configure OpenAI as your provider in settings."
          );
        }

        // Sync tools to Neo4j with vector embeddings
        const syncResult = await syncToolsToNeo4j({
          neo4jConfig: {
            uri: config.uri,
            username: config.username,
            password: config.password,
            database: config.database,
          },
          openaiApiKey,
          tools: connectionTools,
          toolSetName: connectionId,
        });

        if (!syncResult.success) {
          throw new Error(syncResult.error || "Sync failed");
        }

        // Update state with sync result (preserve password settings)
        await updateNeo4jSyncState(connectionId, {
          status: "synced",
          toolsetHash: hash,
          toolCount,
          lastSyncTime: Date.now(),
          error: undefined,
          neo4jConfig: {
            uri: config.uri,
            username: config.username,
            database: config.database || "neo4j",
          },
          savedPassword: rememberPassword
            ? encodePassword(config.password)
            : undefined,
          rememberPassword,
        });

        console.log("[useNeo4jSync] Sync complete:", { hash, toolCount });
        return { hash, toolCount };
      } catch (error) {
        console.error("[useNeo4jSync] Sync failed:", error);
        await updateNeo4jSyncState(connectionId, {
          status: "error",
          error: error instanceof Error ? error.message : "Sync failed",
        });
        throw error;
      }
    },
    [connectionId, tools, updateNeo4jSyncState]
  );

  // Handle resync (same as sync)
  const handleResync = useCallback(
    async (options: Neo4jSyncOptions): Promise<Neo4jSyncResult> => {
      return handleSync(options);
    },
    [handleSync]
  );

  // Handle delete toolset
  const handleDelete = useCallback(async () => {
    if (!connectionId) {
      throw new Error("No connection selected");
    }

    console.log("[useNeo4jSync] Deleting toolset");

    // TODO: Call mcp-rag deleteToolsetByHash here to remove from Neo4j

    await deleteNeo4jSyncState(connectionId);
    console.log("[useNeo4jSync] Toolset deleted");
  }, [connectionId, deleteNeo4jSyncState]);

  // Handle full reset (same as delete for now)
  const handleReset = useCallback(async () => {
    if (!connectionId) {
      throw new Error("No connection selected");
    }

    console.log("[useNeo4jSync] Resetting all data");

    // TODO: Call mcp-rag deleteToolsetByHash here to remove from Neo4j

    await deleteNeo4jSyncState(connectionId);
    console.log("[useNeo4jSync] Full reset complete");
  }, [connectionId, deleteNeo4jSyncState]);

  // Update isClientReady when sync completes
  useEffect(() => {
    if (isRagClientReady()) {
      setIsClientReady(true);
    }
  }, [syncState?.status]);

  return {
    syncState,
    // isVectorized is true only if sync state is synced AND RAG client is ready
    isVectorized: syncState?.status === "synced" && isClientReady,
    isStale: syncState?.status === "stale",
    hasError: syncState?.status === "error",
    isSyncing: syncState?.status === "syncing",
    isClientReady,
    handleSync,
    handleResync,
    handleDelete,
    handleReset,
  };
}
