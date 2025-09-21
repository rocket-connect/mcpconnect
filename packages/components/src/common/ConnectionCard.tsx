/* eslint-disable jsx-a11y/no-static-element-interactions */
/* eslint-disable jsx-a11y/click-events-have-key-events */
import React from "react";
import { Connection, ConnectionType } from "@mcpconnect/schemas";
import { MessageSquare } from "lucide-react";
import { TruncatedText } from "./TruncatedText";

export interface ConnectionCardProps {
  connection: Connection;
  isSelected?: boolean;
  conversationCount?: number;
  onClick?: () => void;
  isDemoMode?: boolean;
}

export const ConnectionCard: React.FC<ConnectionCardProps> = ({
  connection,
  isSelected = false,
  conversationCount = 0,
  onClick,
  isDemoMode = false,
}) => {
  const getConnectionTypeColor = (type: ConnectionType) => {
    switch (type) {
      case "sse":
        return "text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/30";
      case "http":
        return "text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/30";
      case "websocket":
        return "text-purple-600 dark:text-purple-400 bg-purple-100 dark:bg-purple-900/30";
      default:
        return "text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-900/30";
    }
  };

  return (
    <div
      onClick={onClick}
      className={`p-3 rounded-lg border cursor-pointer transition-all duration-200 relative ${
        isSelected
          ? "bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800"
          : "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700"
      } ${isDemoMode ? "opacity-60" : ""}`}
    >
      {/* Demo overlay */}
      {isDemoMode && (
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/50 to-transparent dark:via-gray-800/50 rounded-lg pointer-events-none"></div>
      )}

      <div className="space-y-2 relative">
        <div className="flex items-start justify-between">
          <div className="font-medium text-sm text-gray-900 dark:text-white min-w-0 flex-1 pr-2">
            <TruncatedText text={connection.name} maxLength={32} />
          </div>
          <div
            className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium flex-shrink-0 ${getConnectionTypeColor(connection.connectionType || "http")}`}
          >
            {(connection.connectionType || "HTTP").toUpperCase()}
          </div>
        </div>

        <div className="text-xs text-gray-500 dark:text-gray-400 font-mono bg-gray-50 dark:bg-gray-900 px-2 py-1 rounded">
          <TruncatedText text={connection.url} maxLength={40} />
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <div
              className={`w-1.5 h-1.5 rounded-full ${connection.isConnected ? "bg-green-500" : "bg-red-500"}`}
            />
            <span className="text-xs text-gray-600 dark:text-gray-400">
              {connection.isConnected ? "Connected" : "Offline"}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <MessageSquare className="w-3 h-3 text-gray-400" />
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {conversationCount}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
