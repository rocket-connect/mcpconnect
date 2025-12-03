import React, { useState } from "react";
import { Database, Sparkles, ChevronRight, X, HelpCircle } from "lucide-react";

export interface VectorizeSchemaBannerProps {
  /** Whether the schema has already been vectorized */
  isVectorized?: boolean;
  /** Callback when user clicks to vectorize */
  onVectorize: () => void;
  /** Callback when user dismisses the banner */
  onDismiss?: () => void;
  /** Number of tools available to vectorize */
  toolCount?: number;
  /** Whether the connection uses OpenAI (required for embeddings) */
  isOpenAIConnection?: boolean;
}

export const VectorizeSchemaBanner: React.FC<VectorizeSchemaBannerProps> = ({
  isVectorized = false,
  onVectorize,
  onDismiss,
  toolCount = 0,
  isOpenAIConnection = true,
}) => {
  const [showTooltip, setShowTooltip] = useState(false);

  // Don't show if already vectorized or not an OpenAI connection
  if (isVectorized || !isOpenAIConnection) {
    return null;
  }

  const handleVectorizeClick = () => {
    console.log("[VectorizeSchemaBanner] Vectorize clicked", { toolCount });
    onVectorize();
  };

  const handleDismiss = (e: React.MouseEvent) => {
    e.stopPropagation();
    console.log("[VectorizeSchemaBanner] Banner dismissed");
    onDismiss?.();
  };

  return (
    <div className="relative bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-900/20 dark:to-indigo-900/20 rounded-lg border border-purple-200 dark:border-purple-800 p-4 mb-4">
      {/* Dismiss button */}
      {onDismiss && (
        <button
          onClick={handleDismiss}
          className="absolute top-2 right-2 p-1 text-purple-400 hover:text-purple-600 dark:hover:text-purple-300 transition-colors rounded"
          title="Dismiss"
        >
          <X className="w-4 h-4" />
        </button>
      )}

      <div className="flex items-start gap-3">
        {/* Icon */}
        <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-lg flex items-center justify-center flex-shrink-0 shadow-sm">
          <Sparkles className="w-5 h-5 text-white" />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0 pr-4">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-semibold text-sm text-gray-900 dark:text-white">
              Vectorize Your Tools
            </h3>
            <button
              onMouseEnter={() => setShowTooltip(true)}
              onMouseLeave={() => setShowTooltip(false)}
              className="text-purple-400 hover:text-purple-600 dark:hover:text-purple-300"
            >
              <HelpCircle className="w-3.5 h-3.5" />
            </button>
          </div>

          <p className="text-xs text-gray-600 dark:text-gray-400 mb-3">
            Enable intelligent tool selection with vector search. Instead of
            sending all {toolCount} tools to the AI, we&#39;ll use semantic
            search to find the most relevant ones for each prompt.
          </p>

          {/* Benefits list */}
          <div className="flex flex-wrap gap-2 mb-3">
            <span className="inline-flex items-center gap-1 text-[10px] px-2 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded-full">
              <Database className="w-3 h-3" />
              Reduce token usage
            </span>
            <span className="inline-flex items-center gap-1 text-[10px] px-2 py-1 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 rounded-full">
              <Sparkles className="w-3 h-3" />
              Faster responses
            </span>
          </div>

          {/* CTA Button */}
          <button
            onClick={handleVectorizeClick}
            className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-white bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 rounded-md transition-all shadow-sm hover:shadow"
          >
            <Database className="w-3.5 h-3.5" />
            Set Up Vector Search
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Tooltip */}
      {showTooltip && (
        <div className="absolute left-1/2 -translate-x-1/2 top-full mt-2 z-50 w-72 p-3 bg-gray-900 dark:bg-gray-700 text-white text-xs rounded-lg shadow-lg">
          <p className="font-medium mb-2">How it works:</p>
          <ol className="list-decimal list-inside space-y-1 text-gray-300">
            <li>Connect to a Neo4j database</li>
            <li>Your tools are indexed with embeddings</li>
            <li>Each prompt triggers a vector search</li>
            <li>Only the most relevant tools are sent to the AI</li>
          </ol>
          <p className="mt-2 text-purple-300">
            Powered by MCP RAG - reduces context by up to 90%
          </p>
          <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-0 h-0 border-l-8 border-r-8 border-b-8 border-l-transparent border-r-transparent border-b-gray-900 dark:border-b-gray-700" />
        </div>
      )}
    </div>
  );
};
