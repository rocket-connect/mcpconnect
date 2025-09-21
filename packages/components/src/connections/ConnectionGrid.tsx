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
}

export const ConnectionGrid: React.FC<ConnectionGridProps> = ({
  connections,
  onConnectionClick,
  onEditConnection,
  onDeleteConnection,
}) => {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {connections.map(connection => (
        <div key={connection.id} className="group relative">
          <ConnectionItem
            {...connection}
            onClick={() => onConnectionClick(connection)}
          />

          {/* Action buttons on hover */}
          <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
            <div className="flex gap-1">
              <button
                onClick={e => {
                  e.stopPropagation();
                  onConnectionClick(connection);
                }}
                className="p-1.5 bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm rounded-md shadow-sm border border-gray-200/50 dark:border-gray-600/50 hover:bg-gray-50 dark:hover:bg-gray-700 transition-all duration-200 hover:shadow-md"
                title="Open connection"
              >
                <MessageSquare className="w-3.5 h-3.5 text-gray-600 dark:text-gray-400" />
              </button>

              <button
                onClick={e => onEditConnection(connection, e)}
                className="p-1.5 bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm rounded-md shadow-sm border border-gray-200/50 dark:border-gray-600/50 hover:bg-gray-50 dark:hover:bg-gray-700 transition-all duration-200 hover:shadow-md"
                title="Edit connection"
              >
                <Settings className="w-3.5 h-3.5 text-gray-600 dark:text-gray-400" />
              </button>

              <button
                onClick={e => onDeleteConnection(connection.id, e)}
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
  );
};
