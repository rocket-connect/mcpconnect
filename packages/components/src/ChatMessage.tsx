import React, { ReactNode } from "react";
import { ChatMessage as ChatMessageType } from "@mcpconnect/schemas";

export interface ChatMessageProps extends ChatMessageType {
  children?: ReactNode;
}

export const ChatMessage: React.FC<ChatMessageProps> = ({
  message,
  isUser = false,
  isExecuting = false,
  executingTool = "tool",
  toolExecution,
  children,
}) => (
  <div className={`flex gap-3 mb-4 ${isUser ? "flex-row-reverse" : ""}`}>
    <div
      className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
        isUser
          ? "bg-blue-600 text-white"
          : isExecuting || toolExecution?.status === "pending"
            ? "bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-200 border border-orange-200 dark:border-orange-800"
            : toolExecution?.status === "error"
              ? "bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200 border border-red-200 dark:border-red-800"
              : "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200 border border-green-200 dark:border-green-800"
      }`}
    >
      {isExecuting || toolExecution?.status === "pending" ? (
        <div className="flex items-center gap-2 text-sm">
          <div className="w-4 h-4 animate-pulse bg-current rounded-full opacity-50" />
          Executing {executingTool || toolExecution?.toolName || "tool"}...
        </div>
      ) : toolExecution?.status === "error" ? (
        <div className="text-sm">
          Error executing {toolExecution.toolName}: {toolExecution.error}
        </div>
      ) : (
        <div className="text-sm">{message || children}</div>
      )}
    </div>
  </div>
);
