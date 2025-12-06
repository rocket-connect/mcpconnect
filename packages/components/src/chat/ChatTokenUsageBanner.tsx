import React from "react";
import { Calculator } from "lucide-react";

export interface ChatTokenUsageBannerProps {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  messageCount: number;
  /** Connection ID - banner only shows when this is defined */
  connectionId?: string;
  /** Chat ID - banner only shows when this is defined and not "new" */
  chatId?: string;
}

function formatTokenCount(count: number): string {
  if (count >= 1000000) {
    return `${(count / 1000000).toFixed(1)}M`;
  }
  if (count >= 1000) {
    return `${(count / 1000).toFixed(1)}K`;
  }
  return count.toLocaleString();
}

export const ChatTokenUsageBanner: React.FC<ChatTokenUsageBannerProps> = ({
  promptTokens,
  completionTokens,
  totalTokens,
  messageCount,
  connectionId,
  chatId,
}) => {
  // Only show banner when we have a valid chat selected with token usage
  if (
    !connectionId ||
    !chatId ||
    chatId === "new" ||
    messageCount < 1 ||
    totalTokens === 0
  ) {
    return null;
  }

  return (
    <div className="w-full border-b border-purple-200 dark:border-purple-800 bg-purple-50 dark:bg-purple-900/20">
      <div className="max-w-4xl mx-auto px-6 py-2">
        <div className="flex items-center gap-3">
          <Calculator className="w-4 h-4 text-purple-500 dark:text-purple-400 flex-shrink-0" />
          <div className="flex items-center gap-4 text-xs">
            <span className="text-purple-700 dark:text-purple-300 font-medium">
              Chat Total:
            </span>
            <div className="flex items-center gap-3">
              <span className="text-purple-600 dark:text-purple-400">
                <span className="font-mono">
                  {formatTokenCount(promptTokens)}
                </span>{" "}
                <span className="text-purple-500 dark:text-purple-500">
                  input tokens
                </span>
              </span>
              <span className="text-purple-600 dark:text-purple-400">
                <span className="font-mono">
                  {formatTokenCount(completionTokens)}
                </span>{" "}
                <span className="text-purple-500 dark:text-purple-500">
                  output tokens
                </span>
              </span>
              <span className="text-purple-700 dark:text-purple-300 font-medium border-l border-purple-300 dark:border-purple-700 pl-3">
                <span className="font-mono">
                  {formatTokenCount(totalTokens)}
                </span>{" "}
                <span className="text-purple-500 dark:text-purple-500">
                  total tokens
                </span>
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
