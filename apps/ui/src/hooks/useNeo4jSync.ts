import { useCallback } from "react";
import { useStorage } from "../contexts/StorageContext";
import { computeToolsHash } from "../utils/toolsHash";
import type { Neo4jSyncOptions } from "@mcpconnect/components";

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
  } = useStorage();

  // Get current sync state
  const syncState = connectionId ? getNeo4jSyncState(connectionId) : undefined;

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

      console.log("[useNeo4jSync] Starting sync:", {
        connectionId,
        uri: config.uri,
        username: config.username,
        rememberPassword,
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

        // TODO: Replace this with actual mcp-rag sync call
        // For now, simulate the sync operation
        await new Promise(resolve => setTimeout(resolve, 2000));

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

  return {
    syncState,
    isVectorized: syncState?.status === "synced",
    isStale: syncState?.status === "stale",
    hasError: syncState?.status === "error",
    isSyncing: syncState?.status === "syncing",
    handleSync,
    handleResync,
    handleDelete,
    handleReset,
  };
}
