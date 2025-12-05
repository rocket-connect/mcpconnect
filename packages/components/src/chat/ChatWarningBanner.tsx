import React from "react";
import { AlertTriangle, Wrench, Sparkles } from "lucide-react";

export interface ChatWarningBannerProps {
  type: "longConversation" | "manyTools";
  messageCount?: number;
  charCount?: number;
  toolCount?: number;
  hasVectorSearch?: boolean;
  onEnableRag?: () => void;
}

export const ChatWarningBanner: React.FC<ChatWarningBannerProps> = ({
  type,
  messageCount,
  charCount,
  toolCount,
  hasVectorSearch,
  onEnableRag,
}) => {
  if (type === "longConversation") {
    return (
      <div className="flex-shrink-0 bg-orange-50 dark:bg-orange-900/20 border-b border-orange-200 dark:border-orange-800 px-6 py-3">
        <div className="flex items-center gap-2 text-sm text-orange-800 dark:text-orange-200">
          <AlertTriangle className="w-4 h-4" />
          <span>
            Long conversation detected ({messageCount} messages, ~
            {charCount?.toLocaleString()} characters). Sending messages may use
            significant tokens and increase costs. Consider starting a new chat.
          </span>
        </div>
      </div>
    );
  }

  if (type === "manyTools") {
    // If vector search is enabled, show a positive message instead of warning
    if (hasVectorSearch) {
      return (
        <div className="flex-shrink-0 bg-emerald-50 dark:bg-emerald-900/20 border-b border-emerald-200 dark:border-emerald-800 px-6 py-3">
          <div className="flex items-center gap-2 text-sm text-emerald-800 dark:text-emerald-200">
            <Sparkles className="w-4 h-4" />
            <span>
              Semantic tool selection is active. Only the most relevant tools
              from {toolCount} available will be used for each message.
            </span>
          </div>
        </div>
      );
    }

    return (
      <div className="flex-shrink-0 bg-blue-50 dark:bg-blue-900/20 border-b border-blue-200 dark:border-blue-800 px-6 py-3">
        <div className="flex items-center gap-2 text-sm text-blue-800 dark:text-blue-200">
          <Wrench className="w-4 h-4" />
          <span>
            {toolCount} tools enabled. The AI may use multiple tools which could
            increase processing time and costs.
            {onEnableRag ? (
              <>
                {" "}
                <button
                  onClick={onEnableRag}
                  className="underline hover:no-underline font-medium"
                >
                  Enable semantic tool selection
                </button>{" "}
                to automatically use only the most relevant tools.
              </>
            ) : (
              " You can disable unused tools in the sidebar."
            )}
          </span>
        </div>
      </div>
    );
  }

  return null;
};
