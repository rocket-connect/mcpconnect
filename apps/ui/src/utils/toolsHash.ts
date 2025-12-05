import { Tool } from "@mcpconnect/schemas";

/**
 * Default hash function - simple bitwise hash.
 * Matches the hash function used in @mcp-rag/client
 */
function hashString(input: string): string {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    const char = input.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return `toolset-${Math.abs(hash).toString(16)}`;
}

/**
 * Recursively sort all keys in an object/array for deterministic JSON serialization.
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
 * Clone a tool for hashing - extracts only the hashable properties.
 */
function cloneToolForHashing(tool: Tool): Record<string, unknown> {
  return {
    name: tool.name,
    description: tool.description,
    parameters: tool.parameters,
    inputSchema: tool.inputSchema,
  };
}

/**
 * Compute a hash of the tools array that matches @mcp-rag/client's hash computation.
 * This allows comparing the local tool state with what's synced in Neo4j.
 */
export function computeToolsHash(tools: Tool[]): string {
  const toolEntries = [...tools]
    .sort((a, b) => a.name.localeCompare(b.name))
    .map(tool => [tool.name, cloneToolForHashing(tool)]);

  const sortedToolsObject = Object.fromEntries(toolEntries);
  const deepSortedObject = sortObjectKeysDeep(sortedToolsObject);
  const jsonString = JSON.stringify(deepSortedObject);
  return hashString(jsonString);
}
