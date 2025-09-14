// apps/ui/src/components/ChatInterface.tsx - Updated to use shared inspector context
import { ChatMessage, Button } from "@mcpconnect/components";
import { ChatMessage as ChatMessageType } from "@mcpconnect/schemas";
import { useParams, useNavigate } from "react-router-dom";
import { Play, ExternalLink, Share2, Check, Copy } from "lucide-react";
import { useState } from "react";
import { useStorage } from "../contexts/StorageContext";
import { useInspector } from "../contexts/InspectorProvider";

interface ChatInterfaceProps {
  expandedToolCall?: boolean;
}

export const ChatInterface = (_args: ChatInterfaceProps) => {
  const { id: connectionId, chatId } = useParams();
  const navigate = useNavigate();
  const { connections, conversations } = useStorage();
  const { expandedToolCall: inspectorExpandedTool, syncToolCallState } =
    useInspector();

  // Local state for UI interactions
  const [copiedLink, setCopiedLink] = useState<string | null>(null);

  // Get the current connection and conversation
  const currentConnection = connectionId
    ? connections[parseInt(connectionId)]
    : null;
  const connectionConversations = connectionId
    ? conversations[connectionId] || []
    : [];
  const currentConversation = chatId
    ? connectionConversations[parseInt(chatId)]
    : connectionConversations[0];

  const currentMessages = currentConversation?.messages || [];

  // Use inspector's expanded state instead of local state
  const isToolCallExpanded = (messageId: string) => {
    return inspectorExpandedTool === messageId;
  };

  const handleToolCallExpand = (messageId: string, toolName?: string) => {
    const isCurrentlyExpanded = isToolCallExpanded(messageId);

    console.log("ChatInterface.handleToolCallExpand:", {
      messageId,
      toolName,
      isCurrentlyExpanded,
      willExpand: !isCurrentlyExpanded,
    });

    // Use inspector's sync function to coordinate state
    syncToolCallState(messageId, !isCurrentlyExpanded);
  };

  const handleShareToolCall = async (messageId: string) => {
    const shareUrl =
      connectionId && chatId
        ? `${window.location.origin}/connections/${connectionId}/chat/${chatId}/tools/${messageId}`
        : `${window.location.origin}/chat/tools/${messageId}`;

    try {
      if (navigator.share) {
        await navigator.share({
          title: "Tool Execution - MCPConnect",
          text: "Check out this tool execution result",
          url: shareUrl,
        });
      } else {
        await navigator.clipboard.writeText(shareUrl);
        setCopiedLink(messageId);
        setTimeout(() => setCopiedLink(null), 2000);
      }
    } catch (error) {
      console.error("Failed to share:", error);
    }
  };

  const EnhancedChatMessage = ({
    message,
    index,
  }: {
    message: ChatMessageType;
    index: number;
  }) => {
    const messageId = message.id || `msg-${index}`;
    const isExpanded = isToolCallExpanded(messageId);
    const hasToolExecution =
      message.toolExecution || message.isExecuting || message.executingTool;
    const isCopied = copiedLink === messageId;

    // Get the tool name for display
    const toolName = message.executingTool || message.toolExecution?.toolName;

    return (
      <div className="group relative">
        {/* Display tool name properly in chat message */}
        {hasToolExecution ? (
          <div
            className={`flex gap-3 mb-4 ${message.isUser ? "flex-row-reverse" : ""}`}
          >
            <div
              className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                message.isUser
                  ? "bg-blue-600 text-white"
                  : message.isExecuting ||
                      message.toolExecution?.status === "pending"
                    ? "bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-200 border border-orange-200 dark:border-orange-800"
                    : message.toolExecution?.status === "error"
                      ? "bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200 border border-red-200 dark:border-red-800"
                      : "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200 border border-green-200 dark:border-green-800"
              }`}
            >
              {message.isExecuting ||
              message.toolExecution?.status === "pending" ? (
                <div className="flex items-center gap-2 text-sm">
                  <div className="w-4 h-4 animate-pulse bg-current rounded-full opacity-50" />
                  <span>
                    Executing <strong>{toolName || "tool"}</strong>...
                  </span>
                </div>
              ) : message.toolExecution?.status === "error" ? (
                <div className="text-sm">
                  <div className="font-medium mb-1">Tool Execution Failed</div>
                  <div className="text-xs opacity-80">
                    <strong>{toolName}</strong>: {message.toolExecution.error}
                  </div>
                </div>
              ) : message.toolExecution?.status === "success" ? (
                <div className="text-sm">
                  <div className="font-medium mb-1">
                    Tool Executed Successfully
                  </div>
                  <div className="text-xs opacity-80">
                    <strong>{toolName}</strong> completed
                  </div>
                </div>
              ) : (
                <div className="text-sm">{message.message}</div>
              )}
            </div>
          </div>
        ) : (
          <ChatMessage key={messageId} {...message} />
        )}

        {hasToolExecution && (
          <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
            <button
              onClick={() => handleToolCallExpand(messageId, toolName)}
              className={`p-1 bg-white dark:bg-gray-800 rounded shadow-lg border transition-colors ${
                isExpanded
                  ? "border-blue-200 dark:border-blue-600 bg-blue-50 dark:bg-blue-900/30"
                  : "border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700"
              }`}
              title={
                isExpanded
                  ? "Collapse details (synced with inspector)"
                  : "Expand details (synced with inspector)"
              }
            >
              <ExternalLink
                className={`w-3 h-3 transition-all ${
                  isExpanded
                    ? "rotate-45 text-blue-600 dark:text-blue-400"
                    : "text-gray-600 dark:text-gray-400"
                }`}
              />
            </button>
            <button
              onClick={() => handleShareToolCall(messageId)}
              className="p-1 bg-white dark:bg-gray-800 rounded shadow-lg border border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              title="Share tool execution"
            >
              {isCopied ? (
                <Check className="w-3 h-3 text-green-600 dark:text-green-400" />
              ) : (
                <Share2 className="w-3 h-3 text-gray-600 dark:text-gray-400" />
              )}
            </button>
          </div>
        )}

        {/* Expanded tool call details - synchronized with inspector */}
        {isExpanded && hasToolExecution && (
          <div className="mt-2 p-4 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg animate-in slide-in-from-top-2">
            <div className="text-sm space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <h4 className="font-medium text-gray-900 dark:text-white">
                    Tool Execution Details
                  </h4>
                  <span className="px-2 py-1 text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full">
                    Synced with Inspector
                  </span>
                </div>
                <button
                  onClick={() => {
                    // Focus on the inspector panel
                    const inspectorElement = document.querySelector(
                      '[data-inspector="true"]'
                    );
                    if (inspectorElement) {
                      inspectorElement.scrollIntoView({
                        behavior: "smooth",
                        block: "center",
                      });
                    }
                  }}
                  className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
                  title="Focus inspector panel"
                >
                  View in Inspector →
                </button>
              </div>

              <div className="grid grid-cols-2 gap-4 text-xs">
                <div>
                  <span className="text-gray-500 dark:text-gray-400">
                    Tool:
                  </span>
                  <span className="ml-2 font-mono text-gray-900 dark:text-white">
                    {toolName || "Unknown"}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500 dark:text-gray-400">
                    Status:
                  </span>
                  <span
                    className={`ml-2 font-medium ${
                      message.toolExecution?.status === "success"
                        ? "text-green-600 dark:text-green-400"
                        : message.toolExecution?.status === "error"
                          ? "text-red-600 dark:text-red-400"
                          : "text-blue-600 dark:text-blue-400"
                    }`}
                  >
                    {message.toolExecution?.status || "pending"}
                  </span>
                </div>
                {message.timestamp && (
                  <div className="col-span-2">
                    <span className="text-gray-500 dark:text-gray-400">
                      Executed at:
                    </span>
                    <span className="ml-2 text-gray-900 dark:text-white font-mono text-xs">
                      {message.timestamp.toLocaleString()}
                    </span>
                  </div>
                )}
              </div>

              {message.toolExecution?.result ? (
                <div>
                  <h5 className="font-medium text-gray-900 dark:text-white mb-1">
                    Result:
                  </h5>
                  <pre className="text-xs bg-white dark:bg-gray-900 p-2 rounded border border-gray-200 dark:border-gray-600 overflow-x-auto max-h-32">
                    {typeof message.toolExecution.result === "string"
                      ? message.toolExecution.result
                      : JSON.stringify(message.toolExecution.result, null, 2)}
                  </pre>
                </div>
              ) : (
                <></>
              )}

              {message.toolExecution?.error && (
                <div>
                  <h5 className="font-medium text-red-600 dark:text-red-400 mb-1">
                    Error:
                  </h5>
                  <div className="text-red-600 dark:text-red-400 text-xs bg-red-50 dark:bg-red-900/20 p-2 rounded border border-red-200 dark:border-red-800">
                    {message.toolExecution.error}
                  </div>
                </div>
              )}

              <div className="pt-2 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between">
                <button
                  onClick={() => handleShareToolCall(messageId)}
                  className="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium transition-colors"
                >
                  {isCopied ? (
                    <>
                      <Check className="w-3 h-3" />
                      Link copied!
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" />
                      Copy share link
                    </>
                  )}
                </button>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  ID: {messageId}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  // Show connection selector if no connection selected
  if (!connectionId) {
    return (
      <div className="flex-1 flex items-center justify-center bg-white dark:bg-gray-900 transition-colors">
        <div className="text-center">
          <Play className="w-12 h-12 text-gray-400 dark:text-gray-500 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            Select a Connection
          </h3>
          <p className="text-gray-600 dark:text-gray-400">
            Choose a connection from the sidebar to start chatting
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-white dark:bg-gray-900 transition-colors">
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-2xl mx-auto">
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              {currentConnection ? (
                <>
                  {currentConversation?.title || "Chat"} -{" "}
                  {currentConnection.name}
                  <span className="text-sm font-normal text-gray-500 dark:text-gray-400 ml-2">
                    (
                    {currentConnection.isConnected
                      ? "Connected"
                      : "Disconnected"}
                    )
                  </span>
                </>
              ) : (
                "Chat Interface"
              )}
            </h2>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4 text-sm">
                <div className="text-blue-600 dark:text-blue-400 font-medium">
                  {currentMessages.length} messages
                </div>
                {inspectorExpandedTool && (
                  <div className="flex items-center gap-1 px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full text-xs">
                    <ExternalLink className="w-3 h-3" />
                    Inspector synced to {inspectorExpandedTool}
                  </div>
                )}
                {currentConnection && (
                  <div
                    className={`flex items-center gap-2 px-2 py-1 rounded-full text-xs ${
                      currentConnection.isConnected
                        ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300"
                        : "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300"
                    }`}
                  >
                    <div
                      className={`w-2 h-2 rounded-full ${
                        currentConnection.isConnected
                          ? "bg-green-500"
                          : "bg-red-500"
                      }`}
                    />
                    {currentConnection.url}
                  </div>
                )}
              </div>

              {/* Chat selector if multiple chats exist */}
              {connectionConversations.length > 1 && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    Chat:
                  </span>
                  <select
                    value={chatId || "0"}
                    onChange={e =>
                      navigate(
                        `/connections/${connectionId}/chat/${e.target.value}`
                      )
                    }
                    className="text-xs px-2 py-1 border border-gray-200 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  >
                    {connectionConversations.map((conv, index) => (
                      <option key={conv.id} value={index.toString()}>
                        {conv.title} ({conv.messages.length} messages)
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </div>

          {currentMessages.length === 0 ? (
            <div className="text-center py-12 text-gray-500 dark:text-gray-400">
              <div className="mb-4">
                <div className="w-12 h-12 bg-gray-200 dark:bg-gray-700 rounded-lg mx-auto mb-3 flex items-center justify-center">
                  <Play className="w-6 h-6" />
                </div>
              </div>
              <p className="text-lg font-medium mb-2">No messages yet</p>
              <p className="text-sm">
                {currentConnection
                  ? `Start a conversation with ${currentConnection.name}`
                  : "Select a connection to start chatting"}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {Array.isArray(currentMessages) &&
                currentMessages.map((msg, index) => (
                  <EnhancedChatMessage
                    key={msg.id || `msg-${index}`}
                    message={msg}
                    index={index}
                  />
                ))}
            </div>
          )}
        </div>
      </div>

      <div className="border-t border-gray-200 dark:border-gray-700 p-4 bg-gray-50 dark:bg-gray-800 transition-colors">
        <div className="max-w-2xl mx-auto">
          <div className="flex gap-3">
            <input
              type="text"
              placeholder={
                currentConnection
                  ? `Message ${currentConnection.name}...`
                  : "Type a message..."
              }
              className="flex-1 px-4 py-2 border border-gray-200 dark:border-gray-600 rounded-lg 
                       bg-white dark:bg-gray-700
                       text-gray-900 dark:text-white
                       placeholder:text-gray-500 dark:placeholder:text-gray-400
                       focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                       transition-colors"
            />
            <Button>
              <Play className="w-4 h-4" />
            </Button>
          </div>
          {currentConnection && !currentConnection.isConnected && (
            <p className="text-xs text-yellow-600 dark:text-yellow-400 mt-2">
              Connection offline - messages will be queued
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
