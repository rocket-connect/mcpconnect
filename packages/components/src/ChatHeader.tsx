import React from "react";
import { Zap, ZapOff } from "lucide-react";

export interface ChatHeaderProps {
  connectionName?: string;
  messageCount: number;
  enabledToolsCount: number;
  disabledToolsCount: number;
  isConnected?: boolean;
  showApiWarning: boolean;
  streamingEnabled: boolean;
  onStreamingToggle: () => void;
  isLoading: boolean;
  isStreaming: boolean;
}

export const ChatHeader: React.FC<ChatHeaderProps> = ({
  connectionName,
  messageCount,
  enabledToolsCount,
  disabledToolsCount,
  isConnected,
  showApiWarning,
  streamingEnabled,
  onStreamingToggle,
  isLoading,
  isStreaming,
}) => {
  return (
    <div className="flex-shrink-0 border-b border-gray-200 dark:border-gray-800 p-6 bg-white dark:bg-gray-950">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            {connectionName}
          </h2>
          <div className="flex items-center gap-4 mt-1 text-sm text-gray-500 dark:text-gray-400">
            <span>{messageCount} messages</span>
            <span>
              {enabledToolsCount} tools enabled
              {disabledToolsCount > 0 && (
                <span className="text-amber-600 dark:text-amber-400">
                  {" "}
                  ({disabledToolsCount} disabled)
                </span>
              )}
            </span>
            {isConnected !== undefined && (
              <>
                <span>•</span>
                <div className="flex items-center gap-1">
                  <div
                    className={`w-1.5 h-1.5 rounded-full ${
                      isConnected ? "bg-green-500" : "bg-gray-400"
                    }`}
                  />
                  {isConnected ? "Connected" : "Disconnected"}
                </div>
              </>
            )}
            {showApiWarning && (
              <>
                <span>•</span>
                <span className="text-amber-600 dark:text-amber-400">
                  Claude API not configured
                </span>
              </>
            )}
            {!showApiWarning && (
              <>
                <span>•</span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={onStreamingToggle}
                    className={`flex items-center gap-1 px-2 py-1 text-xs rounded transition-colors ${
                      streamingEnabled
                        ? "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300"
                        : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400"
                    }`}
                    title={
                      streamingEnabled
                        ? "Streaming enabled - click to disable"
                        : "Streaming disabled - click to enable"
                    }
                    disabled={isLoading || isStreaming}
                  >
                    {streamingEnabled ? (
                      <Zap className="w-3 h-3" />
                    ) : (
                      <ZapOff className="w-3 h-3" />
                    )}
                    {streamingEnabled ? "Streaming" : "Standard"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
