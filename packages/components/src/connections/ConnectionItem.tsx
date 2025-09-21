/* eslint-disable jsx-a11y/no-static-element-interactions */
/* eslint-disable jsx-a11y/click-events-have-key-events */
import React from "react";
import { Connection, ConnectionType } from "@mcpconnect/schemas";
import { ConnectionStatus } from "./ConnectionStatus";
import { Zap, Globe, Radio } from "lucide-react";

export interface ConnectionItemProps
  extends Omit<
    Connection,
    "authType" | "credentials" | "headers" | "timeout" | "retryAttempts"
  > {
  onClick?: () => void;
}

export const ConnectionItem: React.FC<ConnectionItemProps> = ({
  name,
  url,
  connectionType = "sse",
  isActive = false,
  isConnected = true,
  onClick,
}) => {
  const getConnectionTypeIcon = (type: ConnectionType) => {
    switch (type) {
      case "sse":
        return <Zap className="w-3 h-3" />;
      case "http":
        return <Globe className="w-3 h-3" />;
      case "websocket":
        return <Radio className="w-3 h-3" />;
      default:
        return <Globe className="w-3 h-3" />;
    }
  };

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
      className={`p-4 rounded-lg border cursor-pointer transition-colors ${
        isActive
          ? "bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800"
          : "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700"
      }`}
    >
      <div className="space-y-3">
        <div className="flex items-start justify-between">
          <div className="font-medium text-sm text-gray-900 dark:text-white">
            {name}
          </div>
          <div
            className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${getConnectionTypeColor(connectionType)}`}
            title={`Connection type: ${connectionType.toUpperCase()}`}
          >
            {getConnectionTypeIcon(connectionType)}
            <span className="uppercase">{connectionType}</span>
          </div>
        </div>

        <div className="text-xs text-gray-500 dark:text-gray-400 break-all">
          {url}
        </div>

        <div className="flex items-center gap-2">
          <ConnectionStatus isConnected={isConnected} />
        </div>
      </div>
    </div>
  );
};
