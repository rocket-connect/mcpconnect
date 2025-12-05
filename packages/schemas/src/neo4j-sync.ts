import { z } from "zod";

/**
 * Neo4j connection configuration for mcp-rag
 */
export const Neo4jConfigSchema = z.object({
  uri: z.string().min(1, "Neo4j URI is required"),
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
  database: z.string().optional().default("neo4j"),
});

export type Neo4jConfig = z.infer<typeof Neo4jConfigSchema>;

/**
 * Sync status values for Neo4j/mcp-rag integration
 */
export const Neo4jSyncStatusSchema = z.enum([
  "idle", // Never synced
  "syncing", // Sync in progress
  "synced", // Successfully synced and up-to-date
  "stale", // Hash mismatch - needs resync
  "error", // Sync failed
]);

export type Neo4jSyncStatus = z.infer<typeof Neo4jSyncStatusSchema>;

/**
 * Complete Neo4j sync state for a connection
 */
export const Neo4jSyncStateSchema = z.object({
  /** The connection ID this sync state belongs to */
  connectionId: z.string(),
  /** Current sync status */
  status: Neo4jSyncStatusSchema,
  /** Hash of the synced toolset from mcp-rag */
  toolsetHash: z.string().optional(),
  /** Number of tools in the synced toolset */
  toolCount: z.number().optional(),
  /** Timestamp of last successful sync */
  lastSyncTime: z.number().optional(),
  /** Error message if sync failed */
  error: z.string().optional(),
  /** Neo4j connection config (password stored separately for security) */
  neo4jConfig: Neo4jConfigSchema.omit({ password: true }).optional(),
  /** Base64 encoded password (optional - user can choose to save for convenience) */
  savedPassword: z.string().optional(),
  /** Whether the user opted to save the password */
  rememberPassword: z.boolean().optional(),
});

export type Neo4jSyncState = z.infer<typeof Neo4jSyncStateSchema>;
