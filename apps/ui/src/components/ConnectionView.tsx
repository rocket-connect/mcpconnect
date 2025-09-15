import { ConnectionItem } from "@mcpconnect/components";
import { Connection } from "@mcpconnect/schemas";
import { useNavigate } from "react-router-dom";
import { Plus, Server, Settings, Trash2 } from "lucide-react";
import { useState } from "react";
import { ConnectionModal } from "./ConnectionModal";
import { useStorage } from "../contexts/StorageContext";
import { ConnectionService } from "../services/connectionService";

interface ConnectionViewProps {
  connections: Connection[];
}

export const ConnectionView = ({ connections }: ConnectionViewProps) => {
  const navigate = useNavigate();
  const { updateConversations, conversations } = useStorage();

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
        // Remove connection from localStorage by updating the connections array
        const updatedConnections = connections.filter(
          c => c.id !== connectionId
        );

        // Update localStorage with new connections array
        localStorage.setItem(
          "mcpconnect:connections",
          JSON.stringify({
            key: "connections",
            value: updatedConnections,
            metadata: {
              createdAt: new Date(),
              updatedAt: new Date(),
              size: JSON.stringify(updatedConnections).length,
              type: "array",
            },
          })
        );

        // Remove associated conversations
        const updatedConversations = { ...conversations };
        delete updatedConversations[connectionId];
        await updateConversations(updatedConversations);

        // Remove tools and resources from localStorage
        const toolsItem = localStorage.getItem("mcpconnect:tools");
        if (toolsItem) {
          const toolsData = JSON.parse(toolsItem);
          if (toolsData.value && typeof toolsData.value === "object") {
            delete toolsData.value[connectionId];
            localStorage.setItem("mcpconnect:tools", JSON.stringify(toolsData));
          }
        }

        const resourcesItem = localStorage.getItem("mcpconnect:resources");
        if (resourcesItem) {
          const resourcesData = JSON.parse(resourcesItem);
          if (resourcesData.value && typeof resourcesData.value === "object") {
            delete resourcesData.value[connectionId];
            localStorage.setItem(
              "mcpconnect:resources",
              JSON.stringify(resourcesData)
            );
          }
        }

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
          id:
            connection.id || ConnectionService.createConnection(connection).id,
        };
        updatedConnections = [...connections, connectionWithId];
      }

      // Test connection and perform introspection if successful
      let finalConnection = { ...connection };

      try {
        const isConnected = await ConnectionService.testConnection(connection);

        if (isConnected) {
          finalConnection.isConnected = true;

          try {
            const introspectionResult =
              await ConnectionService.introspectConnection(connection);

            // Convert MCP tools to our tool format
            const convertedTools = introspectionResult.tools.map(tool => ({
              id: `${connection.id}_${tool.name}`, // Create unique tool ID
              name: tool.name,
              description: tool.description,
              inputSchema: tool.inputSchema,
              parameters: [], // We'll populate this from inputSchema if needed
              category: "mcp",
              tags: ["mcp", "introspected"],
              deprecated: false,
            }));

            // Convert MCP resources to our resource format
            const convertedResources = introspectionResult.resources.map(
              resource => ({
                name: resource.name,
                description: resource.description,
                uri: resource.uri,
                mimeType: resource.mimeType,
                type: "data",
                permissions: {
                  read: true,
                  write: false,
                  delete: false,
                },
                tags: ["mcp", "introspected"],
              })
            );

            // Update tools in localStorage
            const toolsItem = localStorage.getItem("mcpconnect:tools");
            let toolsData = toolsItem ? JSON.parse(toolsItem) : { value: {} };
            toolsData.value[connection.id] = convertedTools;
            toolsData.metadata = {
              ...toolsData.metadata,
              updatedAt: new Date(),
              size: JSON.stringify(toolsData.value).length,
            };
            localStorage.setItem("mcpconnect:tools", JSON.stringify(toolsData));

            // Update resources in localStorage
            const resourcesItem = localStorage.getItem("mcpconnect:resources");
            let resourcesData = resourcesItem
              ? JSON.parse(resourcesItem)
              : { value: {} };
            resourcesData.value[connection.id] = convertedResources;
            resourcesData.metadata = {
              ...resourcesData.metadata,
              updatedAt: new Date(),
              size: JSON.stringify(resourcesData.value).length,
            };
            localStorage.setItem(
              "mcpconnect:resources",
              JSON.stringify(resourcesData)
            );
          } catch (introspectionError) {
            console.warn(
              "Introspection failed, but connection is valid:",
              introspectionError
            );
            // Connection is valid but introspection failed - that's OK
          }
        } else {
          finalConnection.isConnected = false;
        }
      } catch (testError) {
        console.error("Connection test failed:", testError);
        finalConnection.isConnected = false;
      }

      // Update the connections array with the final connection
      const finalUpdatedConnections = updatedConnections.map(c =>
        c.id === finalConnection.id ? finalConnection : c
      );

      // Save to localStorage
      localStorage.setItem(
        "mcpconnect:connections",
        JSON.stringify({
          key: "connections",
          value: finalUpdatedConnections,
          metadata: {
            createdAt: new Date(),
            updatedAt: new Date(),
            size: JSON.stringify(finalUpdatedConnections).length,
            type: "array",
          },
        })
      );

      // Refresh the page to reload all data
      window.location.reload();
    } catch (error) {
      console.error("Failed to save connection:", error);
      alert(
        "Failed to save connection. Please check the details and try again."
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
                • Authentication is optional but recommended for production
                servers
              </p>
              <p>
                • MCPConnect will automatically discover available tools and
                resources
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
