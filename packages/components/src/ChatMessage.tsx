import React, { ReactNode } from "react";

export interface ChatMessageProps {
  message?: string;
  isUser?: boolean;
  isExecuting?: boolean;
  executingTool?: string;
  children?: ReactNode;
}

export const ChatMessage: React.FC<ChatMessageProps> = ({
  message,
  isUser = false,
  isExecuting = false,
  executingTool = "tool",
  children,
}) => (
  <div className={`flex gap-3 mb-4 ${isUser ? "flex-row-reverse" : ""}`}>
    <div
      className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
        isUser
          ? "bg-blue-600 text-white"
          : isExecuting
            ? "bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-200 border border-orange-200 dark:border-orange-800"
            : "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200 border border-green-200 dark:border-green-800"
      }`}
    >
      {isExecuting ? (
        <div className="flex items-center gap-2 text-sm">
          <div className="w-4 h-4 animate-pulse bg-current rounded-full opacity-50" />
          Executing {executingTool}...
        </div>
      ) : (
        <div className="text-sm">{message || children}</div>
      )}
    </div>
  </div>
);
