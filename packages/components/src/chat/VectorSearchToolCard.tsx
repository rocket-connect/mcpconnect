/* eslint-disable react/no-unescaped-entities */
import React, { useState } from "react";
import {
  Search,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Clock,
  Zap,
} from "lucide-react";

export interface VectorSearchResult {
  toolName: string;
  score: number;
  description?: string;
}

export interface VectorSearchToolCardProps {
  /** The original prompt that triggered the search */
  prompt: string;
  /** Tools found via vector search */
  selectedTools: VectorSearchResult[];
  /** Total tools in the toolset */
  totalTools: number;
  /** Time taken for the search in milliseconds */
  searchTimeMs?: number;
  /** Whether the search is still in progress */
  isSearching?: boolean;
  /** Timestamp of the search */
  timestamp?: Date;
}

export const VectorSearchToolCard: React.FC<VectorSearchToolCardProps> = ({
  prompt,
  selectedTools,
  totalTools,
  searchTimeMs,
  isSearching = false,
  timestamp,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const handleToggle = () => {
    console.log("[VectorSearchToolCard] Toggle expanded:", !isExpanded);
    setIsExpanded(!isExpanded);
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  const getScoreColor = (score: number) => {
    if (score >= 0.8) return "text-green-600 dark:text-green-400";
    if (score >= 0.6) return "text-yellow-600 dark:text-yellow-400";
    return "text-orange-600 dark:text-orange-400";
  };

  const getScoreBg = (score: number) => {
    if (score >= 0.8) return "bg-green-100 dark:bg-green-900/30";
    if (score >= 0.6) return "bg-yellow-100 dark:bg-yellow-900/30";
    return "bg-orange-100 dark:bg-orange-900/30";
  };

  return (
    <div className="bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-900/10 dark:to-indigo-900/10 rounded-lg border border-purple-200 dark:border-purple-800 overflow-hidden">
      {/* Header */}
      <button
        onClick={handleToggle}
        className="w-full flex items-center justify-between p-3 hover:bg-purple-100/50 dark:hover:bg-purple-900/20 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-lg flex items-center justify-center flex-shrink-0">
            {isSearching ? (
              <Search className="w-4 h-4 text-white animate-pulse" />
            ) : (
              <Sparkles className="w-4 h-4 text-white" />
            )}
          </div>
          <div className="text-left">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-gray-900 dark:text-white">
                Vector Tool Selection
              </span>
              {isSearching ? (
                <span className="text-xs px-2 py-0.5 bg-purple-200 dark:bg-purple-800 text-purple-700 dark:text-purple-300 rounded-full animate-pulse">
                  Searching...
                </span>
              ) : (
                <span className="text-xs px-2 py-0.5 bg-purple-200 dark:bg-purple-800 text-purple-700 dark:text-purple-300 rounded-full">
                  {selectedTools.length} of {totalTools} tools
                </span>
              )}
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 truncate max-w-md">
              "{prompt.slice(0, 60)}
              {prompt.length > 60 ? "..." : ""}"
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {searchTimeMs !== undefined && !isSearching && (
            <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
              <Clock className="w-3 h-3" />
              {searchTimeMs}ms
            </div>
          )}
          {timestamp && (
            <span className="text-xs text-gray-400 dark:text-gray-500">
              {formatTime(timestamp)}
            </span>
          )}
          {isExpanded ? (
            <ChevronUp className="w-4 h-4 text-gray-400" />
          ) : (
            <ChevronDown className="w-4 h-4 text-gray-400" />
          )}
        </div>
      </button>

      {/* Expanded Content */}
      {isExpanded && !isSearching && (
        <div className="border-t border-purple-200 dark:border-purple-800 p-4">
          {/* Stats */}
          <div className="flex items-center gap-4 mb-4 text-xs">
            <div className="flex items-center gap-1.5 px-2 py-1 bg-white dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700">
              <Zap className="w-3 h-3 text-purple-500" />
              <span className="text-gray-600 dark:text-gray-400">
                Reduced context by{" "}
                <span className="font-medium text-purple-600 dark:text-purple-400">
                  {Math.round((1 - selectedTools.length / totalTools) * 100)}%
                </span>
              </span>
            </div>
            {searchTimeMs !== undefined && (
              <div className="flex items-center gap-1.5 px-2 py-1 bg-white dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700">
                <Clock className="w-3 h-3 text-indigo-500" />
                <span className="text-gray-600 dark:text-gray-400">
                  Search took{" "}
                  <span className="font-medium">{searchTimeMs}ms</span>
                </span>
              </div>
            )}
          </div>

          {/* Selected Tools */}
          <div className="space-y-2">
            <h4 className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">
              Selected Tools (by relevance)
            </h4>
            <div className="grid grid-cols-1 gap-2 max-h-48 overflow-y-auto">
              {selectedTools.map((tool, index) => (
                <div
                  key={tool.toolName}
                  className="flex items-center justify-between p-2 bg-white dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-xs font-medium text-gray-400 dark:text-gray-500 w-4">
                      #{index + 1}
                    </span>
                    <div className="min-w-0">
                      <span className="text-sm font-medium text-gray-900 dark:text-white block truncate">
                        {tool.toolName}
                      </span>
                      {tool.description && (
                        <span className="text-xs text-gray-500 dark:text-gray-400 block truncate">
                          {tool.description}
                        </span>
                      )}
                    </div>
                  </div>
                  <div
                    className={`flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${getScoreBg(tool.score)} ${getScoreColor(tool.score)}`}
                  >
                    {Math.round(tool.score * 100)}%
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
