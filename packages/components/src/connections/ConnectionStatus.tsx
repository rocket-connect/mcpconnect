import React from "react";
import { ConnectionStatus as ConnectionStatusType } from "@mcpconnect/schemas";
import { Loader2 } from "lucide-react";

export interface ConnectionStatusProps {
  isConnected?: boolean;
  isChecking?: boolean;
  label?: string;
  status?: ConnectionStatusType;
}

export const ConnectionStatus: React.FC<ConnectionStatusProps> = ({
  isConnected = true,
  isChecking = false,
  label,
  status,
}) => {
  const connected = status?.isConnected ?? isConnected;

  if (isChecking) {
    return (
      <div className="flex items-center gap-2">
        <Loader2 className="w-3 h-3 text-gray-400 animate-spin" />
        <span className="text-sm font-medium text-gray-500 dark:text-gray-400">
          Checking...
        </span>
      </div>
    );
  }

  const displayLabel = label || (connected ? "Connected" : "Disconnected");

  return (
    <div className="flex items-center gap-2">
      <div
        className={`w-2 h-2 rounded-full ${connected ? "bg-green-500" : "bg-red-500"}`}
      />
      <span className="text-sm font-medium text-gray-900 dark:text-white">
        {displayLabel}
      </span>
      {status?.latency && (
        <span className="text-xs text-gray-500 dark:text-gray-400">
          ({status.latency}ms)
        </span>
      )}
    </div>
  );
};
