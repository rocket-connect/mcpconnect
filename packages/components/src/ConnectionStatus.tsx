import React from "react";

export interface ConnectionStatusProps {
  isConnected?: boolean;
  label?: string;
}

export const ConnectionStatus: React.FC<ConnectionStatusProps> = ({
  isConnected = true,
  label,
}) => (
  <div className="flex items-center gap-2">
    <div
      className={`w-2 h-2 rounded-full ${isConnected ? "bg-green-500" : "bg-red-500"}`}
    />
    <span className="text-sm font-medium text-gray-900 dark:text-white">
      {label || (isConnected ? "Connected" : "Disconnected")}
    </span>
  </div>
);
