import React from "react";
import { Search, Sparkles, Clock, CheckCircle2 } from "lucide-react";

export interface SemanticSearchMessageProps {
  isSearching: boolean;
  searchId: string | null;
  relevantTools: Array<{ name: string; score: number }>;
  searchDuration: number | null;
  totalTools?: number;
  prompt?: string;
}

export const SemanticSearchMessage: React.FC<SemanticSearchMessageProps> = ({
  isSearching,
  relevantTools,
  searchDuration,
  totalTools = 0,
}) => {
  // Don't render if not searching and no results
  if (!isSearching && relevantTools.length === 0) return null;

  return (
    <div className="group relative">
      <div className="flex gap-4 mb-6">
        {/* Icon */}
        <div className="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center bg-gradient-to-br from-purple-500 to-indigo-600">
          {isSearching ? (
            <Search className="w-4 h-4 text-white animate-pulse" />
          ) : (
            <Sparkles className="w-4 h-4 text-white" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-900/20 dark:to-indigo-900/20 rounded-lg border border-purple-200 dark:border-purple-800 p-3">
            {isSearching ? (
              /* Searching state */
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />
                  <span className="text-sm font-medium text-purple-700 dark:text-purple-300">
                    Searching for relevant tools...
                  </span>
                </div>
                <span className="text-xs px-2 py-0.5 bg-purple-200/50 dark:bg-purple-800/50 text-purple-600 dark:text-purple-400 rounded-full">
                  Vector Search
                </span>
              </div>
            ) : (
              /* Completed state */
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-green-500" />
                    <span className="text-sm font-medium text-gray-900 dark:text-white">
                      Found {relevantTools.length} relevant tool
                      {relevantTools.length !== 1 ? "s" : ""}
                    </span>
                    {totalTools > 0 && (
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        (from {totalTools} total)
                      </span>
                    )}
                  </div>
                  {searchDuration !== null && (
                    <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                      <Clock className="w-3 h-3" />
                      {searchDuration}ms
                    </div>
                  )}
                </div>

                {/* Show top tools */}
                {relevantTools.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {relevantTools.slice(0, 5).map(tool => (
                      <span
                        key={tool.name}
                        className="inline-flex items-center gap-1 px-2 py-0.5 bg-white dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700 text-xs"
                      >
                        <span className="text-gray-700 dark:text-gray-300">
                          {tool.name}
                        </span>
                        <span className="text-purple-600 dark:text-purple-400 font-medium">
                          {Math.round(tool.score * 100)}%
                        </span>
                      </span>
                    ))}
                    {relevantTools.length > 5 && (
                      <span className="inline-flex items-center px-2 py-0.5 text-xs text-gray-500 dark:text-gray-400">
                        +{relevantTools.length - 5} more
                      </span>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
