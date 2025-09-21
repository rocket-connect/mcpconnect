import { ConnectionItem } from "@mcpconnect/components";
import { Connection, Resource, Tool } from "@mcpconnect/schemas";
import { useNavigate } from "react-router-dom";
import {
  Plus,
  Settings,
  Trash2,
  MessageSquare,
  ExternalLink,
} from "lucide-react";
import { useState } from "react";
import { ConnectionModal } from "./ConnectionModal";
import { useStorage } from "../contexts/StorageContext";
import { MCPService } from "@mcpconnect/adapter-ai-sdk";

interface ConnectionViewProps {
  connections: Connection[];
}

export const ConnectionView = ({ connections }: ConnectionViewProps) => {
  const navigate = useNavigate();
  const { adapter, updateConversations, conversations } = useStorage();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingConnection, setEditingConnection] = useState<Connection | null>(
    null
  );

  const handleConnectionClick = (connection: Connection) => {
    navigate(`/connections/${connection.id}`);
  };

  const handleCreateConnection = () => {
    setEditingConnection(null);
    setIsModalOpen(true);
  };

  const handleEditConnection = (
    connection: Connection,
    event: React.MouseEvent
  ) => {
    event.stopPropagation();
    setEditingConnection(connection);
    setIsModalOpen(true);
  };

  const handleDeleteConnection = async (connectionId: string) => {
    const connection = connections.find(c => c.id === connectionId);
    if (!connection) return;

    const confirmed = confirm(
      `Are you sure you want to delete "${connection.name}"? This will also delete all associated chats and data. This cannot be undone.`
    );

    if (confirmed) {
      try {
        const updatedConnections = connections.filter(
          c => c.id !== connectionId
        );

        await adapter.setConnections(updatedConnections);

        const updatedConversations = { ...conversations };
        delete updatedConversations[connectionId];
        await updateConversations(updatedConversations);

        await adapter.removeConnectionData(connectionId);
        window.location.reload();
      } catch (error) {
        console.error("Failed to delete connection:", error);
        alert("Failed to delete connection. Please try again.");
      }
    }
  };

  const handleSaveConnection = async (connection: Connection) => {
    try {
      let updatedConnections: Connection[];

      if (editingConnection) {
        updatedConnections = connections.map(c =>
          c.id === editingConnection.id ? connection : c
        );
      } else {
        const connectionWithId = {
          ...connection,
          id: connection.id || MCPService.createConnection(connection).id,
        };
        updatedConnections = [...connections, connectionWithId];
      }

      let finalConnection = { ...connection };

      try {
        const introspectionResult =
          await MCPService.connectAndIntrospect(connection);

        if (introspectionResult.isConnected) {
          finalConnection.isConnected = true;

          if (introspectionResult.tools.length > 0) {
            const normalizedTools: Tool[] = (
              introspectionResult.tools as Tool[]
            ).map(tool => ({
              ...tool,
              deprecated: tool.deprecated ?? false,
              parameters:
                tool.parameters?.map(param => ({
                  ...param,
                  required: param.required ?? false,
                  default: param.default ?? undefined,
                })) ?? undefined,
            }));

            await adapter.setConnectionTools(connection.id, normalizedTools);
          }

          if (introspectionResult.resources.length > 0) {
            await adapter.setConnectionResources(
              connection.id,
              introspectionResult.resources as Resource[]
            );
          }
        } else {
          console.warn(`[ConnectionView] Connection test failed`);
          finalConnection.isConnected = false;

          alert(
            `Connection test failed: ${introspectionResult.error || "Unknown error"}\n\nThe connection will be saved but marked as disconnected.`
          );
        }
      } catch (connectionError) {
        console.error(
          "[ConnectionView] Connection introspection failed:",
          connectionError
        );
        finalConnection.isConnected = false;

        const errorMessage =
          connectionError instanceof Error
            ? connectionError.message
            : "Unknown error occurred";
        alert(
          `Failed to connect to MCP server: ${errorMessage}\n\nThe connection will be saved but marked as disconnected.`
        );
      }

      const finalUpdatedConnections = updatedConnections.map(c =>
        c.id === finalConnection.id ? finalConnection : c
      );

      await adapter.setConnections(finalUpdatedConnections);
      window.location.reload();
    } catch (error) {
      console.error("Failed to save connection:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error occurred";
      alert(
        `Failed to save connection: ${errorMessage}\n\nPlease check the connection details and try again.`
      );
    }
  };

  return (
    <>
      <div className="flex-1 overflow-y-auto p-6 bg-white dark:bg-gray-900 transition-colors">
        <div className="max-w-6xl mx-auto">
          {/* Header - Only show when we have connections */}
          {connections.length > 0 && (
            <div className="flex items-center justify-between mb-8">
              <div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                  MCP Connections
                </h2>
                <p className="text-gray-600 dark:text-gray-400">
                  Connect to Model Context Protocol servers to extend your LLM's
                  capabilities
                </p>
              </div>
              <button
                onClick={handleCreateConnection}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Add Connection
              </button>
            </div>
          )}

          {/* Connections Grid or Empty State */}
          {connections.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-lg mx-auto mb-4 flex items-center justify-center">
                <ExternalLink className="w-8 h-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                No connections yet
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                Create your first MCP connection to start using external tools
                with AI assistants
              </p>
              <button
                onClick={handleCreateConnection}
                className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
              >
                <Plus className="w-5 h-5" />
                Create Connection
              </button>
              <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Support this project on Github{" "}
                  <a
                    href="https://github.com/rocket-connect/mcpconnect"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    github.com/rocket-connect/mcpconnect
                  </a>
                </p>
              </div>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {connections.map(connection => (
                <div key={connection.id} className="group relative">
                  <ConnectionItem
                    {...connection}
                    onClick={() => handleConnectionClick(connection)}
                  />

                  {/* Action buttons on hover */}
                  <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="flex gap-1">
                      <button
                        onClick={e => {
                          e.stopPropagation();
                          handleConnectionClick(connection);
                        }}
                        className="p-1.5 bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm rounded-md shadow-sm border border-gray-200/50 dark:border-gray-600/50 hover:bg-gray-50 dark:hover:bg-gray-700 transition-all duration-200 hover:shadow-md"
                        title="Open connection"
                      >
                        <MessageSquare className="w-3.5 h-3.5 text-gray-600 dark:text-gray-400" />
                      </button>

                      <button
                        onClick={e => handleEditConnection(connection, e)}
                        className="p-1.5 bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm rounded-md shadow-sm border border-gray-200/50 dark:border-gray-600/50 hover:bg-gray-50 dark:hover:bg-gray-700 transition-all duration-200 hover:shadow-md"
                        title="Edit connection"
                      >
                        <Settings className="w-3.5 h-3.5 text-gray-600 dark:text-gray-400" />
                      </button>

                      <button
                        onClick={e => {
                          e.stopPropagation();
                          handleDeleteConnection(connection.id);
                        }}
                        className="p-1.5 bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm rounded-md shadow-sm border border-gray-200/50 dark:border-gray-600/50 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all duration-200 hover:shadow-md group/delete"
                        title="Delete connection"
                      >
                        <Trash2 className="w-3.5 h-3.5 text-gray-600 dark:text-gray-400 group-hover/delete:text-red-600 dark:group-hover/delete:text-red-400 transition-colors" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <ConnectionModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSaveConnection}
        onDelete={handleDeleteConnection}
        connection={editingConnection}
        existingConnections={connections}
      />
    </>
  );
};
