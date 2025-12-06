import React from "react";
import { Connection } from "@mcpconnect/schemas";

export interface ChatHeaderInfoProps {
  connection: Connection;
  messageCount: number;
  totalEnabledToolsCount: number;
  totalDisabledToolsCount: number;
  showApiWarning: boolean;
  children?: React.ReactNode; // For export button or other actions
}

export const ChatHeaderInfo: React.FC<ChatHeaderInfoProps> = ({
  connection,
  messageCount,
  totalEnabledToolsCount,
  totalDisabledToolsCount,
  showApiWarning,
  children,
}) => {
  return (
    <div className="flex-shrink-0 border-b border-gray-200 dark:border-gray-800 p-6 bg-white dark:bg-gray-950">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            {connection.name}
          </h2>
          <div className="flex items-center gap-4 mt-1 text-sm text-gray-500 dark:text-gray-400">
            <span>{messageCount} messages</span>
            <span className="flex items-center gap-1">
              {totalEnabledToolsCount} tools enabled
              {totalDisabledToolsCount > 0 && (
                <span className="text-amber-600 dark:text-amber-400">
                  ({totalDisabledToolsCount} disabled)
                </span>
              )}
            </span>
            {connection.isConnected !== undefined && (
              <>
                <span>•</span>
                <div className="flex items-center gap-1">
                  <div
                    className={`w-1.5 h-1.5 rounded-full ${
                      connection.isConnected ? "bg-green-500" : "bg-gray-400"
                    }`}
                  />
                  {connection.isConnected ? "Connected" : "Disconnected"}
                </div>
              </>
            )}
            {showApiWarning && (
              <>
                <span>•</span>
                <span className="text-amber-600 dark:text-amber-400">
                  AI provider not configured
                </span>
              </>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-4">{children}</div>
      </div>
    </div>
  );
};
