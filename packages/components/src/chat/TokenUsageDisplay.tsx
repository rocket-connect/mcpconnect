import React, { useMemo } from "react";

export interface TokenUsageDisplayProps {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  lastUpdated: Date | null;
  // Exclude semantic tool tokens if provided
  excludeSemanticTools?: boolean;
}

// Token thresholds for visual indicators
const THRESHOLDS = {
  low: 10000, // Under 10k - green
  medium: 50000, // 10k-50k - yellow
  high: 100000, // 50k-100k - orange
  critical: 200000, // Over 200k - red
};

// Format large numbers with K/M suffix
function formatTokenCount(count: number): string {
  if (count >= 1000000) {
    return `${(count / 1000000).toFixed(1)}M`;
  }
  if (count >= 1000) {
    return `${(count / 1000).toFixed(1)}K`;
  }
  return count.toString();
}

// Get color based on token count
function getUsageColor(tokens: number): {
  bg: string;
  text: string;
  progress: string;
  border: string;
} {
  if (tokens < THRESHOLDS.low) {
    return {
      bg: "bg-emerald-50 dark:bg-emerald-900/20",
      text: "text-emerald-700 dark:text-emerald-300",
      progress: "bg-emerald-500",
      border: "border-emerald-200 dark:border-emerald-800",
    };
  }
  if (tokens < THRESHOLDS.medium) {
    return {
      bg: "bg-yellow-50 dark:bg-yellow-900/20",
      text: "text-yellow-700 dark:text-yellow-300",
      progress: "bg-yellow-500",
      border: "border-yellow-200 dark:border-yellow-800",
    };
  }
  if (tokens < THRESHOLDS.high) {
    return {
      bg: "bg-orange-50 dark:bg-orange-900/20",
      text: "text-orange-700 dark:text-orange-300",
      progress: "bg-orange-500",
      border: "border-orange-200 dark:border-orange-800",
    };
  }
  return {
    bg: "bg-red-50 dark:bg-red-900/20",
    text: "text-red-700 dark:text-red-300",
    progress: "bg-red-500",
    border: "border-red-200 dark:border-red-800",
  };
}

// Get progress percentage (capped at 100%)
function getProgressPercentage(tokens: number): number {
  // Use critical threshold as 100%
  return Math.min((tokens / THRESHOLDS.critical) * 100, 100);
}

// Get usage level label
function getUsageLabel(tokens: number): string {
  if (tokens < THRESHOLDS.low) return "Low";
  if (tokens < THRESHOLDS.medium) return "Moderate";
  if (tokens < THRESHOLDS.high) return "High";
  return "Very High";
}

export const TokenUsageDisplay: React.FC<TokenUsageDisplayProps> = ({
  promptTokens,
  completionTokens,
  totalTokens,
  lastUpdated,
}) => {
  const colors = useMemo(() => getUsageColor(totalTokens), [totalTokens]);
  const progress = useMemo(
    () => getProgressPercentage(totalTokens),
    [totalTokens]
  );
  const usageLabel = useMemo(() => getUsageLabel(totalTokens), [totalTokens]);

  // Don't show if no tokens used yet
  if (totalTokens === 0) {
    return null;
  }

  return (
    <div
      className={`flex items-center gap-3 px-3 py-1.5 rounded-lg border ${colors.bg} ${colors.border} transition-all duration-300`}
    >
      {/* Token icon */}
      <div className={`flex-shrink-0 ${colors.text}`}>
        <svg
          className="w-4 h-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z"
          />
        </svg>
      </div>

      {/* Main content */}
      <div className="flex flex-col min-w-0">
        <div className="flex items-center gap-2">
          <span className={`text-xs font-medium ${colors.text}`}>
            {formatTokenCount(totalTokens)} tokens
          </span>
          <span
            className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${colors.bg} ${colors.text} border ${colors.border}`}
          >
            {usageLabel}
          </span>
        </div>

        {/* Progress bar */}
        <div className="w-24 h-1 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden mt-1">
          <div
            className={`h-full ${colors.progress} transition-all duration-500 ease-out`}
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Breakdown tooltip trigger */}
      <div className="relative group">
        <button
          className={`text-xs ${colors.text} opacity-60 hover:opacity-100 transition-opacity`}
          aria-label="View token breakdown"
        >
          <svg
            className="w-3.5 h-3.5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        </button>

        {/* Tooltip */}
        <div className="absolute right-0 top-full mt-2 w-48 p-3 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
          <div className="text-xs font-medium text-gray-900 dark:text-gray-100 mb-2">
            Token Breakdown
          </div>
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs">
              <span className="text-gray-500 dark:text-gray-400">
                Input (prompt)
              </span>
              <span className="text-gray-900 dark:text-gray-100 font-mono">
                {formatTokenCount(promptTokens)}
              </span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-gray-500 dark:text-gray-400">
                Output (completion)
              </span>
              <span className="text-gray-900 dark:text-gray-100 font-mono">
                {formatTokenCount(completionTokens)}
              </span>
            </div>
            <div className="border-t border-gray-200 dark:border-gray-700 pt-1.5 mt-1.5">
              <div className="flex justify-between text-xs font-medium">
                <span className="text-gray-700 dark:text-gray-300">Total</span>
                <span className={`font-mono ${colors.text}`}>
                  {formatTokenCount(totalTokens)}
                </span>
              </div>
            </div>
          </div>
          {lastUpdated && (
            <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-700">
              <div className="text-[10px] text-gray-400 dark:text-gray-500">
                Last updated: {lastUpdated.toLocaleTimeString()}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
