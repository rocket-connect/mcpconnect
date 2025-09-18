import React from "react";
import { ExternalLink, Zap, ZapOff } from "lucide-react";

export interface EmptyStateProps {
  showApiWarning: boolean;
  connectionName?: string;
  enabledToolsCount: number;
  disabledToolsCount: number;
  streamingEnabled: boolean;
  onConfigure: () => void;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  showApiWarning,
  connectionName,
  enabledToolsCount,
  disabledToolsCount,
  streamingEnabled,
  onConfigure,
}) => {
  return (
    <div className="flex items-center justify-center h-full">
      <div className="text-center py-12 text-gray-500 dark:text-gray-400">
        <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-lg mx-auto mb-4 flex items-center justify-center">
          <ExternalLink className="w-8 h-8" />
        </div>
        <p className="text-lg font-medium mb-2 text-gray-900 dark:text-gray-100">
          {showApiWarning ? "Configure Claude API" : "Start a conversation"}
        </p>
        <p className="text-sm">
          {showApiWarning
            ? "Add your Anthropic API key to begin chatting with Claude"
            : `Start chatting with Claude about ${connectionName}. ${enabledToolsCount} tools are available${disabledToolsCount > 0 ? ` (${disabledToolsCount} disabled)` : ""}.`}
        </p>
        {showApiWarning && (
          <button
            onClick={onConfigure}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            Configure Claude
          </button>
        )}
        {!showApiWarning && (
          <div className="mt-4 flex items-center justify-center gap-2">
            {streamingEnabled ? (
              <Zap className="w-4 h-4 text-blue-500" />
            ) : (
              <ZapOff className="w-4 h-4 text-gray-400" />
            )}
            <span className="text-sm">
              {streamingEnabled ? "Streaming enabled" : "Standard mode"}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};
