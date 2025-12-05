import React, { useState } from "react";
import {
  Send,
  Loader,
  Zap,
  Sparkles,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { Button } from "../common/Button";

export interface SemanticSearchStatus {
  isSearching: boolean;
  relevantToolsCount?: number;
  totalTools?: number;
  searchDuration?: number | null;
  relevantTools?: Array<{ name: string; score: number }>;
}

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
  semanticSearch?: SemanticSearchStatus;
  lastUsedTools?: Array<{ name: string; score: number }>;
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
  semanticSearch,
  lastUsedTools,
}) => {
  const [isToolsExpanded, setIsToolsExpanded] = useState(false);

  const getPlaceholder = () => {
    if (disabled) {
      return "Configure API key to start using tools...";
    }
    if (connectionName) {
      return `Chat with AI about ${connectionName}... (${enabledToolsCount} tools enabled${disabledToolsCount > 0 ? `, ${disabledToolsCount} disabled` : ""}, ${streamingEnabled ? "streaming" : "standard"} mode)`;
    }
    return "Type a message...";
  };

  // Show last used tools if available
  const hasLastUsedTools = lastUsedTools && lastUsedTools.length > 0;
  const visibleTools = isToolsExpanded
    ? lastUsedTools
    : lastUsedTools?.slice(0, 5);
  const hasMoreTools = lastUsedTools && lastUsedTools.length > 5;

  return (
    <div className="flex-shrink-0 border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950">
      {/* Semantic Search Loading State */}
      {semanticSearch?.isSearching && (
        <div className="max-w-4xl mx-auto px-6 pt-4">
          <div className="px-3 py-2 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-200 dark:border-purple-800">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 border-2 border-purple-400 dark:border-purple-500 border-t-transparent rounded-full animate-spin" />
              <span className="text-xs text-purple-700 dark:text-purple-300">
                Finding relevant tools...
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Last Used Tools - show when not searching */}
      {!semanticSearch?.isSearching && hasLastUsedTools && (
        <div className="max-w-4xl mx-auto px-6 pt-4">
          <div className="px-3 py-2 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-200 dark:border-purple-800">
            <div className="flex items-center gap-2 flex-wrap">
              <Sparkles className="w-3 h-3 text-purple-500" />
              <span className="text-xs text-purple-700 dark:text-purple-300">
                Tools used:
              </span>
              <div className="flex flex-wrap gap-1">
                {visibleTools?.map(tool => (
                  <span
                    key={tool.name}
                    className="px-1.5 py-0.5 text-xs bg-white dark:bg-gray-800 text-purple-700 dark:text-purple-300 rounded border border-purple-200 dark:border-purple-700"
                  >
                    {tool.name}
                  </span>
                ))}
              </div>
              {hasMoreTools && (
                <button
                  onClick={() => setIsToolsExpanded(!isToolsExpanded)}
                  className="flex items-center gap-0.5 text-xs text-purple-600 dark:text-purple-400 hover:text-purple-800 dark:hover:text-purple-200 transition-colors"
                >
                  {isToolsExpanded ? (
                    <>
                      <ChevronUp className="w-3 h-3" />
                      Show less
                    </>
                  ) : (
                    <>
                      <ChevronDown className="w-3 h-3" />+
                      {lastUsedTools.length - 5} more
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="max-w-4xl mx-auto p-6">
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
