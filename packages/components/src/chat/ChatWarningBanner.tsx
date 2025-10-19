import React from "react";
import { AlertTriangle, Wrench } from "lucide-react";

export interface ChatWarningBannerProps {
  type: "longConversation" | "manyTools";
  messageCount?: number;
  charCount?: number;
  toolCount?: number;
}

export const ChatWarningBanner: React.FC<ChatWarningBannerProps> = ({
  type,
  messageCount,
  charCount,
  toolCount,
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
    return (
      <div className="flex-shrink-0 bg-blue-50 dark:bg-blue-900/20 border-b border-blue-200 dark:border-blue-800 px-6 py-3">
        <div className="flex items-center gap-2 text-sm text-blue-800 dark:text-blue-200">
          <Wrench className="w-4 h-4" />
          <span>
            {toolCount} tools enabled. The AI may use multiple tools which could
            increase processing time and costs. You can disable unused tools in
            the sidebar.
          </span>
        </div>
      </div>
    );
  }

  return null;
};
