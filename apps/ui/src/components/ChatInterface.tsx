import { Button } from "@mcpconnect/components";
import { ChatMessage as ChatMessageType } from "@mcpconnect/schemas";
import { useParams, useNavigate } from "react-router-dom";
import { Send, ExternalLink } from "lucide-react";
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
  const [messageInput, setMessageInput] = useState("");

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
    syncToolCallState(messageId, !isCurrentlyExpanded);
  };

  const handleSendMessage = () => {
    if (!messageInput.trim()) return;
    // TODO: Implement message sending
    console.log("Sending message:", messageInput);
    setMessageInput("");
  };

  const CleanChatMessage = ({
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
    const toolName = message.executingTool || message.toolExecution?.toolName;

    return (
      <div className="group relative">
        {/* Clean Message Display */}
        <div
          className={`flex gap-4 mb-6 ${message.isUser ? "flex-row-reverse" : ""}`}
        >
          {/* Avatar */}
          <div
            className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-medium ${
              message.isUser
                ? "bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900"
                : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400"
            }`}
          >
            {message.isUser ? "U" : "A"}
          </div>

          {/* Message Content */}
          <div className="flex-1 min-w-0">
            <div
              className={`text-sm text-gray-900 dark:text-gray-100 ${message.isUser ? "text-right" : ""}`}
            >
              {hasToolExecution ? (
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
                      <div className="text-xs mt-1 text-gray-500 dark:text-gray-500">
                        {toolName}: {message.toolExecution.error}
                      </div>
                    </div>
                  ) : message.toolExecution?.status === "success" ? (
                    <div className="text-gray-600 dark:text-gray-400">
                      <div className="font-medium">
                        Tool executed successfully
                      </div>
                      <div className="text-xs mt-1 text-gray-500 dark:text-gray-500">
                        {toolName} completed
                      </div>
                    </div>
                  ) : (
                    <div>{message.message}</div>
                  )}
                </div>
              ) : (
                <div className="leading-relaxed">{message.message}</div>
              )}
            </div>

            {/* Tool Actions */}
            {hasToolExecution && (
              <div className="flex items-center gap-2 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => handleToolCallExpand(messageId, toolName)}
                  className={`text-xs px-2 py-1 rounded border transition-colors ${
                    isExpanded
                      ? "border-gray-400 dark:border-gray-600 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300"
                      : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 text-gray-500 dark:text-gray-500"
                  }`}
                >
                  {isExpanded ? "Collapse" : "Expand"} Details
                </button>
              </div>
            )}

            {/* Expanded Details */}
            {isExpanded && hasToolExecution && (
              <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg">
                <div className="text-xs space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium text-gray-900 dark:text-gray-100">
                      Tool Execution Details
                    </h4>
                  </div>

                  <div className="grid grid-cols-2 gap-4 text-xs">
                    <div>
                      <span className="text-gray-500 dark:text-gray-400">
                        Tool:
                      </span>
                      <span className="ml-2 font-mono text-gray-900 dark:text-gray-100">
                        {toolName || "Unknown"}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-500 dark:text-gray-400">
                        Status:
                      </span>
                      <span className="ml-2 font-medium text-gray-900 dark:text-gray-100">
                        {message.toolExecution?.status || "pending"}
                      </span>
                    </div>
                    {message.timestamp && (
                      <div className="col-span-2">
                        <span className="text-gray-500 dark:text-gray-400">
                          Executed at:
                        </span>
                        <span className="ml-2 text-gray-900 dark:text-gray-100 font-mono text-xs">
                          {message.timestamp.toLocaleString()}
                        </span>
                      </div>
                    )}
                  </div>

                  {message.toolExecution?.result ? (
                    <div>
                      <h5 className="font-medium text-gray-900 dark:text-gray-100 mb-1">
                        Result:
                      </h5>
                      <pre className="text-xs bg-white dark:bg-gray-800 p-2 rounded border border-gray-200 dark:border-gray-700 overflow-x-auto max-h-32 text-gray-800 dark:text-gray-200">
                        {typeof message.toolExecution.result === "string"
                          ? message.toolExecution.result
                          : JSON.stringify(
                              message.toolExecution.result,
                              null,
                              2
                            )}
                      </pre>
                    </div>
                  ) : (
                    <></>
                  )}

                  {message.toolExecution?.error && (
                    <div>
                      <h5 className="font-medium text-gray-900 dark:text-gray-100 mb-1">
                        Error:
                      </h5>
                      <div className="text-gray-800 dark:text-gray-200 text-xs bg-gray-100 dark:bg-gray-800 p-2 rounded border border-gray-200 dark:border-gray-700">
                        {message.toolExecution.error}
                      </div>
                    </div>
                  )}

                  <div className="pt-2 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between">
                    <div className="text-xs text-gray-400 dark:text-gray-600">
                      ID: {messageId}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  // Show connection selector if no connection selected
  if (!connectionId) {
    return (
      <div className="flex-1 flex items-center justify-center bg-white dark:bg-gray-950 transition-colors">
        <div className="text-center">
          <div className="w-12 h-12 bg-gray-100 dark:bg-gray-800 rounded-lg mx-auto mb-4 flex items-center justify-center">
            <ExternalLink className="w-6 h-6 text-gray-400 dark:text-gray-600" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
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
    <div className="flex-1 flex flex-col bg-white dark:bg-gray-950 transition-colors">
      {/* Header */}
      <div className="border-b border-gray-200 dark:border-gray-800 p-6 bg-white dark:bg-gray-950">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              {currentConversation?.title || "Chat"}
            </h2>
            <div className="flex items-center gap-4 mt-1 text-sm text-gray-500 dark:text-gray-400">
              <span>{currentConnection?.name}</span>
              <span>•</span>
              <span>{currentMessages.length} messages</span>
              {currentConnection && (
                <>
                  <span>•</span>
                  <div className="flex items-center gap-1">
                    <div
                      className={`w-1.5 h-1.5 rounded-full ${
                        currentConnection.isConnected
                          ? "bg-green-500"
                          : "bg-gray-400"
                      }`}
                    />
                    {currentConnection.isConnected
                      ? "Connected"
                      : "Disconnected"}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Chat selector if multiple chats exist */}
          {connectionConversations.length > 1 && (
            <select
              value={chatId || "0"}
              onChange={e =>
                navigate(`/connections/${connectionId}/chat/${e.target.value}`)
              }
              className="text-sm px-3 py-1 border border-gray-200 dark:border-gray-700 rounded bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
            >
              {connectionConversations.map((conv, index) => (
                <option key={conv.id} value={index.toString()}>
                  {conv.title} ({conv.messages.length})
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto px-6 py-8">
          {currentMessages.length === 0 ? (
            <div className="text-center py-12 text-gray-500 dark:text-gray-400">
              <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-lg mx-auto mb-4 flex items-center justify-center">
                <ExternalLink className="w-8 h-8" />
              </div>
              <p className="text-lg font-medium mb-2 text-gray-900 dark:text-gray-100">
                No messages yet
              </p>
              <p className="text-sm">
                {currentConnection
                  ? `Start a conversation with ${currentConnection.name}`
                  : "Select a connection to start chatting"}
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {Array.isArray(currentMessages) &&
                currentMessages.map((msg, index) => (
                  <CleanChatMessage
                    key={msg.id || `msg-${index}`}
                    message={msg}
                    index={index}
                  />
                ))}
            </div>
          )}
        </div>
      </div>

      {/* Input */}
      <div className="border-t border-gray-200 dark:border-gray-800 p-6 bg-white dark:bg-gray-950">
        <div className="max-w-4xl mx-auto">
          <div className="flex gap-3">
            <input
              type="text"
              placeholder={
                currentConnection
                  ? `Message ${currentConnection.name}...`
                  : "Type a message..."
              }
              value={messageInput}
              onChange={e => setMessageInput(e.target.value)}
              onKeyPress={e => e.key === "Enter" && handleSendMessage()}
              className="flex-1 px-4 py-3 border border-gray-200 dark:border-gray-700 rounded-lg 
                       bg-white dark:bg-gray-900
                       text-gray-900 dark:text-gray-100
                       placeholder:text-gray-500 dark:placeholder:text-gray-400
                       focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-gray-100 focus:border-transparent
                       transition-colors"
            />
            <Button
              onClick={handleSendMessage}
              disabled={!messageInput.trim()}
              className="px-4 py-3 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 rounded-lg hover:bg-gray-800 dark:hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
          {currentConnection && !currentConnection.isConnected && (
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
              Connection offline - messages will be queued
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
