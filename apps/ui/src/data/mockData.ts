// apps/ui/src/data/mockData.ts - Replace with empty state
import {
  Connection,
  Tool,
  Resource,
  ToolExecution,
  ChatConversation,
} from "@mcpconnect/schemas";

/**
 * Empty data structures for clean start
 */
export const mockConnections: Connection[] = [];

export const mockTools: Record<string, Tool[]> = {};

export const mockResources: Record<string, Resource[]> = {};

export const mockConversations: Record<string, ChatConversation[]> = {};

export const mockToolExecutions: Record<string, ToolExecution[]> = {};

// Helper functions (keep for backward compatibility)
export function getAllToolExecutions(): ToolExecution[] {
  return [];
}

export function getExecutionsForConnection(): ToolExecution[] {
  return [];
}

export function getExecutionsForChat(): ToolExecution[] {
  return [];
}

export function getToolById(): Tool | undefined {
  return undefined;
}

export function getToolByIdGlobal(): Tool | undefined {
  return undefined;
}

export function getToolByName(): Tool | undefined {
  return undefined;
}

export function findToolConnectionId(): string | null {
  return null;
}

export function validateMockData(): boolean {
  return true;
}

export function generateNewId(): string {
  return "";
}

export function getConnectionById(): Connection | undefined {
  return undefined;
}

export function getConnectionIndexById(): number {
  return -1;
}

export default {
  connections: mockConnections,
  tools: mockTools,
  resources: mockResources,
  conversations: mockConversations,
  toolExecutions: mockToolExecutions,
  getAllToolExecutions,
  getExecutionsForConnection,
  getExecutionsForChat,
  getToolById,
  getToolByIdGlobal,
  getToolByName,
  findToolConnectionId,
  validateMockData,
  generateNewId,
  getConnectionById,
  getConnectionIndexById,
};
