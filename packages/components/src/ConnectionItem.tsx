/* eslint-disable jsx-a11y/no-static-element-interactions */
/* eslint-disable jsx-a11y/click-events-have-key-events */
import React from "react";
import { Connection } from "@mcpconnect/schemas";
import { ConnectionStatus } from "./ConnectionStatus";

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
  isActive = false,
  isConnected = true,
  onClick,
}) => (
  <div
    onClick={onClick}
    className={`p-4 rounded-lg border cursor-pointer transition-colors ${
      isActive
        ? "bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800"
        : "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700"
    }`}
  >
    <div className="space-y-3">
      <div className="font-medium text-sm text-gray-900 dark:text-white">
        {name}
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
