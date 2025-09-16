import { ConnectionItem } from "@mcpconnect/components";
import { Connection, Resource, Tool } from "@mcpconnect/schemas";
import { useNavigate } from "react-router-dom";
import { Plus, Server, Settings, Trash2 } from "lucide-react";
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
    // Navigate to connection overview
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
    event.stopPropagation(); // Prevent connection click
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
        // Remove connection using enhanced adapter method
        const updatedConnections = connections.filter(
          c => c.id !== connectionId
        );

        await adapter.setConnections(updatedConnections);

        // Remove associated conversations using adapter
        const updatedConversations = { ...conversations };
        delete updatedConversations[connectionId];
        await updateConversations(updatedConversations);

        // Remove all associated data using the adapter's optimized method
        await adapter.removeConnectionData(connectionId);

        // Refresh the page to reload data
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
        // Update existing connection
        updatedConnections = connections.map(c =>
          c.id === editingConnection.id ? connection : c
        );
      } else {
        // Add new connection - ensure it has a unique ID
        const connectionWithId = {
          ...connection,
          id: connection.id || MCPService.createConnection(connection).id,
        };
        updatedConnections = [...connections, connectionWithId];
      }

      // Test connection and discover tools/resources using MCPService
      let finalConnection = { ...connection };

      try {
        // Use MCPService for full introspection
        const introspectionResult =
          await MCPService.connectAndIntrospect(connection);

        if (introspectionResult.isConnected) {
          finalConnection.isConnected = true;

          // Store discovered tools and resources using adapter
          if (introspectionResult.tools.length > 0) {
            // Ensure tools have proper default values for required fields
            const normalizedTools: Tool[] = (
              introspectionResult.tools as Tool[]
            ).map(tool => ({
              ...tool,
              deprecated: tool.deprecated ?? false, // Ensure deprecated is never undefined
              parameters:
                tool.parameters?.map(param => ({
                  ...param,
                  required: param.required ?? false, // Ensure required is never undefined
                  default: param.default ?? undefined, // Ensure type consistency
                })) ?? undefined, // Handle case where parameters is undefined
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

          // Show user-friendly error message
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

        // Show user-friendly error for connection failures
        const errorMessage =
          connectionError instanceof Error
            ? connectionError.message
            : "Unknown error occurred";
        alert(
          `Failed to connect to MCP server: ${errorMessage}\n\nThe connection will be saved but marked as disconnected.`
        );
      }

      // Update the connections array with the final connection
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
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                Connections
              </h2>
              <p className="text-gray-600 dark:text-gray-400">
                Manage your MCP server connections
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

          {connections.length === 0 ? (
            <div className="text-center py-12 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
              <Server className="w-12 h-12 text-gray-400 dark:text-gray-500 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                No Connections
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                Add your first MCP server connection to get started
              </p>
              <button
                onClick={handleCreateConnection}
                className="flex items-center gap-2 mx-auto px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Add Connection
              </button>
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
                        className="p-1 bg-white dark:bg-gray-800 rounded shadow-lg border border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                        title="Open connection"
                      >
                        <svg
                          className="w-3 h-3 text-gray-600 dark:text-gray-400"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                          />
                        </svg>
                      </button>

                      <button
                        onClick={e => handleEditConnection(connection, e)}
                        className="p-1 bg-white dark:bg-gray-800 rounded shadow-lg border border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                        title="Edit connection"
                      >
                        <Settings className="w-3 h-3 text-gray-600 dark:text-gray-400" />
                      </button>

                      <button
                        onClick={e => {
                          e.stopPropagation();
                          handleDeleteConnection(connection.id);
                        }}
                        className="p-1 bg-white dark:bg-gray-800 rounded shadow-lg border border-gray-200 dark:border-gray-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                        title="Delete connection"
                      >
                        <Trash2 className="w-3 h-3 text-red-600 dark:text-red-400" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Quick Setup Guide */}
          <div className="mt-8 p-6 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
            <h3 className="text-lg font-medium text-blue-900 dark:text-blue-100 mb-3">
              Quick Setup Guide
            </h3>
            <div className="space-y-2 text-sm text-blue-800 dark:text-blue-200">
              <p>
                • <strong>HTTP MCP:</strong> http://localhost:3000/mcp or
                https://api.example.com/mcp
              </p>
              <p>
                • <strong>WebSocket MCP:</strong> ws://localhost:8080 or
                wss://api.example.com/mcp
              </p>
              <p>
                • Authentication is optional but recommended for production
                servers
              </p>
              <p>
                • MCPConnect will automatically discover and store available
                tools during connection setup
              </p>
            </div>
          </div>

          {/* Example Connection */}
          <div className="mt-6 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
            <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-2">
              Example Connection
            </h4>
            <div className="text-xs font-mono text-gray-600 dark:text-gray-400 bg-white dark:bg-gray-900 p-3 rounded border">
              <div>
                <strong>Name:</strong> My MCP Server
              </div>
              <div>
                <strong>URL:</strong> https://my-mcp-endpoint/mcp
              </div>
              <div>
                <strong>Auth:</strong> Bearer Token
              </div>
              <div>
                <strong>Token:</strong> my-token
              </div>
              <div>
                <strong>Headers:</strong> Authorization: Bearer my-token
              </div>
            </div>
          </div>
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
