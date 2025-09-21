import React from "react";
import { Send, Loader, Zap } from "lucide-react";
import { Button } from "../common/Button";

export interface ChatInputProps {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  disabled: boolean;
  connectionName?: string;
  enabledToolsCount: number;
  disabledToolsCount: number;
  streamingEnabled: boolean;
  isConnected?: boolean;
  isLoading: boolean;
  isStreaming: boolean;
  streamingStatus?: string;
}

export const ChatInput: React.FC<ChatInputProps> = ({
  value,
  onChange,
  onSend,
  disabled,
  connectionName,
  enabledToolsCount,
  disabledToolsCount,
  streamingEnabled,
  isConnected,
  isLoading,
  isStreaming,
  streamingStatus,
}) => {
  const getPlaceholder = () => {
    if (disabled) {
      return "Configure API key to start using tools...";
    }
    if (connectionName) {
      return `Chat with AI about ${connectionName}... (${enabledToolsCount} tools enabled${disabledToolsCount > 0 ? `, ${disabledToolsCount} disabled` : ""}, ${streamingEnabled ? "streaming" : "standard"} mode)`;
    }
    return "Type a message...";
  };

  return (
    <div className="flex-shrink-0 border-t border-gray-200 dark:border-gray-800 p-6 bg-white dark:bg-gray-950">
      <div className="max-w-4xl mx-auto">
        <div className="flex gap-3">
          <input
            type="text"
            placeholder={getPlaceholder()}
            value={value}
            onChange={e => onChange(e.target.value)}
            onKeyPress={e => e.key === "Enter" && !e.shiftKey && onSend()}
            disabled={disabled}
            className="flex-1 px-4 py-3 border border-gray-200 dark:border-gray-700 rounded-lg 
                     bg-white dark:bg-gray-900
                     text-gray-900 dark:text-gray-100
                     placeholder:text-gray-500 dark:placeholder:text-gray-400
                     focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-gray-100 focus:border-transparent
                     disabled:opacity-50 disabled:cursor-not-allowed
                     transition-colors"
          />
          <Button
            onClick={onSend}
            disabled={!value.trim() || disabled}
            className="px-4 py-3 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 rounded-lg hover:bg-gray-800 dark:hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isLoading || isStreaming ? (
              <Loader className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </Button>
        </div>
        {isConnected === false && (
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
            Connection offline - messages will be queued
          </p>
        )}
        {isStreaming && (
          <p className="text-xs text-blue-600 dark:text-blue-400 mt-2 flex items-center gap-1">
            <Zap className="w-3 h-3" />
            {streamingStatus || "Streaming response..."}
          </p>
        )}
      </div>
    </div>
  );
};
