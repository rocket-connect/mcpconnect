export { JsonCodeBlock } from "./JsonCodeBlock";
import React from "react";
import { Loader } from "lucide-react";
import { ChatMessage } from "@mcpconnect/schemas";
import { JsonCodeBlock } from "./JsonCodeBlock";

export interface ChatMessageComponentProps {
  message: ChatMessage;
  index: number;
  connectionId?: string;
  isExpanded: boolean;
  onToolCallExpand: (messageId: string, toolName?: string) => void;
  isToolEnabled: (toolName: string) => boolean;
}

export const ChatMessageComponent: React.FC<ChatMessageComponentProps> = ({
  message,
  index,
  isExpanded,
  onToolCallExpand,
  isToolEnabled,
}) => {
  const messageId = message.id || `msg-${index}`;
  const hasToolExecution =
    message.toolExecution || message.isExecuting || message.executingTool;
  const toolName = message.executingTool || message.toolExecution?.toolName;

  const toolWasDisabled = toolName && !isToolEnabled(toolName);

  if (message.isExecuting && !message.message && !hasToolExecution) {
    return null;
  }

  const copyToClipboard = async (text: string) => {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
      } else {
        const textArea = document.createElement("textarea");
        textArea.value = text;
        textArea.style.position = "fixed";
        textArea.style.left = "-999999px";
        textArea.style.top = "-999999px";
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        document.execCommand("copy");
        textArea.remove();
      }
    } catch (err) {
      console.warn("Failed to copy text: ", err);
    }
  };

  return (
    <div className="group relative">
      <div
        className={`flex gap-4 mb-6 ${message.isUser ? "flex-row-reverse" : ""}`}
      >
        <div
          className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-medium ${
            message.isUser
              ? "bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900"
              : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400"
          }`}
        >
          {message.isUser ? (
            "U"
          ) : message.isExecuting ? (
            <Loader className="w-4 h-4 animate-spin" />
          ) : (
            "A"
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div
            className={`text-sm text-gray-900 dark:text-gray-100 ${message.isUser ? "text-right" : ""}`}
          >
            {message.isExecuting && !message.message && !hasToolExecution ? (
              <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                <div className="w-3 h-3 border border-gray-400 border-t-transparent rounded-full animate-spin" />
                <span>Your LLM is thinking...</span>
              </div>
            ) : hasToolExecution ? (
              <div className="space-y-2">
                {message.isExecuting ||
                message.toolExecution?.status === "pending" ? (
                  <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                    <div className="w-3 h-3 border border-gray-400 border-t-transparent rounded-full animate-spin" />
                    <span>Executing {toolName}...</span>
                  </div>
                ) : message.toolExecution?.status === "error" ? (
                  <div className="text-gray-600 dark:text-gray-400">
                    <div className="font-medium">Tool execution failed</div>
                    <div className="text-xs mt-1 text-gray-500">
                      {toolName}: {message.toolExecution.error}
                    </div>
                  </div>
                ) : message.toolExecution?.status === "success" ? (
                  <div className="text-gray-600 dark:text-gray-400">
                    <div className="font-medium">
                      Tool executed successfully
                    </div>
                    <div className="text-xs mt-1 text-gray-500">
                      {toolName} completed
                      {toolWasDisabled && (
                        <span className="ml-2 text-amber-600 dark:text-amber-400">
                          (now disabled)
                        </span>
                      )}
                    </div>
                  </div>
                ) : (
                  <div>{message.message}</div>
                )}

                {/* Always visible expand button with better styling */}
                <div className="flex items-center gap-2 mt-3">
                  <button
                    onClick={() => onToolCallExpand(messageId, toolName)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border transition-all duration-200 ${
                      isExpanded
                        ? "bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-700 text-blue-700 dark:text-blue-300 shadow-sm"
                        : "bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 hover:border-gray-300 dark:hover:border-gray-600"
                    }`}
                  >
                    <svg
                      className={`w-3 h-3 transition-transform duration-200 ${
                        isExpanded ? "rotate-90" : ""
                      }`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 5l7 7-7 7"
                      />
                    </svg>
                    {isExpanded ? "Hide Details" : "Show Details"}
                  </button>

                  {/* Tool name badge */}
                  <div className="inline-flex items-center gap-1 px-2 py-1 bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 text-xs rounded-md border border-orange-200 dark:border-orange-800">
                    <svg
                      className="w-3 h-3"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                      />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                      />
                    </svg>
                    {toolName}
                    {toolWasDisabled && (
                      <span className="text-amber-600 dark:text-amber-400">
                        (disabled)
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="leading-relaxed whitespace-pre-wrap">
                {message.message}
              </div>
            )}
          </div>

          {/* Enhanced expanded details section with JSON highlighting */}
          {isExpanded && hasToolExecution && (
            <div className="mt-4 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
              {/* Header */}
              <div className="bg-gray-50 dark:bg-gray-800 px-4 py-3 border-b border-gray-200 dark:border-gray-700">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium text-gray-900 dark:text-gray-100 text-sm">
                    Tool Execution Details
                  </h4>
                  <div
                    className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                      message.toolExecution?.status === "success"
                        ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300"
                        : message.toolExecution?.status === "error"
                          ? "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300"
                          : "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300"
                    }`}
                  >
                    <div
                      className={`w-2 h-2 rounded-full ${
                        message.toolExecution?.status === "success"
                          ? "bg-green-500"
                          : message.toolExecution?.status === "error"
                            ? "bg-red-500"
                            : "bg-blue-500"
                      }`}
                    />
                    {message.toolExecution?.status || "pending"}
                  </div>
                </div>
              </div>

              {/* Content */}
              <div className="p-4 bg-white dark:bg-gray-900 space-y-4">
                {/* Metadata grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                  <div className="flex items-center justify-between py-2 px-3 bg-gray-50 dark:bg-gray-800 rounded-md">
                    <span className="text-gray-500 dark:text-gray-400 font-medium">
                      Tool:
                    </span>
                    <span className="font-mono text-gray-900 dark:text-gray-100 text-xs">
                      {toolName || "Unknown"}
                    </span>
                  </div>

                  {message.timestamp && (
                    <div className="flex items-center justify-between py-2 px-3 bg-gray-50 dark:bg-gray-800 rounded-md">
                      <span className="text-gray-500 dark:text-gray-400 font-medium">
                        Executed:
                      </span>
                      <span className="text-gray-900 dark:text-gray-100 text-xs">
                        {typeof message.timestamp === "string"
                          ? message.timestamp
                          : message.timestamp instanceof Date
                            ? message.timestamp.toLocaleTimeString()
                            : new Date(message.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                  )}
                </div>

                {/* Tool arguments section with JSON formatting */}
                {message.toolExecution && (
                  <div className="space-y-4">
                    {/* Arguments section - create a mock request structure if we have tool info */}
                    {toolName && (
                      <div>
                        <h5 className="font-medium text-gray-900 dark:text-gray-100 mb-2 text-sm flex items-center gap-2">
                          <svg
                            className="w-4 h-4 text-blue-500"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-3.582 8-8 8a8.955 8.955 0 01-4.126-.98L3 21l1.98-5.874A8.955 8.955 0 013 12c0-4.418 3.582-8 8-8s8 3.582 8 8z"
                            />
                          </svg>
                          Request
                        </h5>
                        <JsonCodeBlock
                          data={{
                            tool: toolName,
                            arguments: message.metadata?.arguments || {},
                            timestamp: message.timestamp,
                          }}
                          onCopy={() => {
                            const requestData = {
                              tool: toolName,
                              arguments: message.metadata?.arguments || {},
                              timestamp: message.timestamp,
                            };
                            copyToClipboard(
                              JSON.stringify(requestData, null, 2)
                            );
                          }}
                        />
                      </div>
                    )}

                    {/* Result section with JSON formatting */}
                    {message.toolExecution?.result !== undefined && (
                      <div>
                        <h5 className="font-medium text-gray-900 dark:text-gray-100 mb-2 text-sm flex items-center gap-2">
                          <svg
                            className="w-4 h-4 text-green-500"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                            />
                          </svg>
                          Response
                        </h5>
                        <JsonCodeBlock
                          data={{
                            success: true,
                            result: message.toolExecution.result,
                            timestamp: message.timestamp,
                          }}
                          onCopy={() => {
                            const responseData = {
                              success: true,
                              result: message.toolExecution?.result,
                              timestamp: message.timestamp,
                            };
                            copyToClipboard(
                              JSON.stringify(responseData, null, 2)
                            );
                          }}
                        />
                      </div>
                    )}

                    {/* Error section */}
                    {message.toolExecution?.error && (
                      <div>
                        <h5 className="font-medium text-gray-900 dark:text-gray-100 mb-2 text-sm flex items-center gap-2">
                          <svg
                            className="w-4 h-4 text-red-500"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
                            />
                          </svg>
                          Error
                        </h5>
                        <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                          <div className="text-red-800 dark:text-red-200 text-sm font-mono">
                            {message.toolExecution.error}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Footer */}
                <div className="pt-3 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                  <span>Execution ID: {messageId}</span>
                  <span>Tool executed via MCP</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
