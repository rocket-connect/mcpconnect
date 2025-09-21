import {
  ConnectionGrid,
  ConnectionEmptyState,
  ConnectionHeader,
} from "@mcpconnect/components";
import { Connection, Resource, Tool } from "@mcpconnect/schemas";
import { useNavigate } from "react-router-dom";
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

  const handleDeleteConnection = async (
    connectionId: string,
    event: React.MouseEvent
  ) => {
    event.stopPropagation();
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
            <ConnectionHeader
              connectionCount={connections.length}
              onCreateConnection={handleCreateConnection}
            />
          )}

          {/* Connections Grid or Empty State */}
          {connections.length === 0 ? (
            <ConnectionEmptyState onCreateConnection={handleCreateConnection} />
          ) : (
            <ConnectionGrid
              connections={connections}
              onConnectionClick={handleConnectionClick}
              onEditConnection={handleEditConnection}
              onDeleteConnection={handleDeleteConnection}
              conversations={conversations}
            />
          )}
        </div>
      </div>

      <ConnectionModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSaveConnection}
        onDelete={(connectionId: string) => {
          const mockEvent = { stopPropagation: () => {} } as React.MouseEvent;
          handleDeleteConnection(connectionId, mockEvent);
        }}
        connection={editingConnection}
        existingConnections={connections}
      />
    </>
  );
};
