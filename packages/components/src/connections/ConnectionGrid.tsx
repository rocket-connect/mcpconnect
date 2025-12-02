import React from "react";
import { Connection } from "@mcpconnect/schemas";
import { ConnectionItem } from "./ConnectionItem";
import { Settings, Trash2, MessageSquare } from "lucide-react";

export interface ConnectionGridProps {
  connections: Connection[];
  onConnectionClick: (connection: Connection) => void;
  onEditConnection: (connection: Connection, event: React.MouseEvent) => void;
  onDeleteConnection: (connectionId: string, event: React.MouseEvent) => void;
  conversations?: Record<string, any[]>;
  onCheckConnectivity?: (connectionId: string) => Promise<boolean>;
}

export const ConnectionGrid: React.FC<ConnectionGridProps> = ({
  connections,
  onConnectionClick,
  onEditConnection,
  onDeleteConnection,
  onCheckConnectivity,
}) => {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {connections.map(connection => (
        <div key={connection.id} className="relative">
          <ConnectionItem
            {...connection}
            onClick={() => onConnectionClick(connection)}
            onCheckConnectivity={onCheckConnectivity}
          />

          {/* Compact action buttons positioned at bottom-right */}
          <div className="absolute bottom-2.5 right-2.5 flex gap-1">
            <button
              onClick={e => {
                e.stopPropagation();
                onConnectionClick(connection);
              }}
              className="p-1.5 bg-white/95 dark:bg-gray-800/95 backdrop-blur-sm rounded-md shadow-sm border border-gray-200/60 dark:border-gray-600/60 hover:bg-gray-50 dark:hover:bg-gray-700 hover:shadow-md transition-all duration-200 hover:scale-105"
              title="Open connection"
            >
              <MessageSquare className="w-3 h-3 text-gray-600 dark:text-gray-300" />
            </button>

            <button
              onClick={e => onEditConnection(connection, e)}
              className="p-1.5 bg-white/95 dark:bg-gray-800/95 backdrop-blur-sm rounded-md shadow-sm border border-gray-200/60 dark:border-gray-600/60 hover:bg-gray-50 dark:hover:bg-gray-700 hover:shadow-md transition-all duration-200 hover:scale-105"
              title="Edit connection"
            >
              <Settings className="w-3 h-3 text-gray-600 dark:text-gray-300" />
            </button>

            <button
              onClick={e => onDeleteConnection(connection.id, e)}
              className="p-1.5 bg-white/95 dark:bg-gray-800/95 backdrop-blur-sm rounded-md shadow-sm border border-gray-200/60 dark:border-gray-600/60 hover:bg-red-50 dark:hover:bg-red-900/30 hover:shadow-md transition-all duration-200 hover:scale-105 group"
              title="Delete connection"
            >
              <Trash2 className="w-3 h-3 text-gray-600 dark:text-gray-300 group-hover:text-red-600 dark:group-hover:text-red-400 transition-colors" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
};
