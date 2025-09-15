import { Button } from "@mcpconnect/components";
import { ChatMessage as ChatMessageType } from "@mcpconnect/schemas";
import { useParams, useNavigate } from "react-router-dom";
import { Send, ExternalLink, Plus, Loader, X } from "lucide-react";
import { useState, useRef, useEffect, useCallback } from "react";
import { useStorage } from "../contexts/StorageContext";
import { useInspector } from "../contexts/InspectorProvider";
import { ModelService, LLMSettings } from "../services/modelService";
import { nanoid } from "nanoid";

interface ChatInterfaceProps {
  expandedToolCall?: boolean;
}

export const ChatInterface = (_args: ChatInterfaceProps) => {
  const { connectionId, chatId } = useParams();
  const navigate = useNavigate();
  const { connections, conversations, updateConversations } = useStorage();
  const { expandedToolCall: inspectorExpandedTool, syncToolCallState } =
    useInspector();

  // Local state for UI interactions
  const [messageInput, setMessageInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [llmSettings, setLlmSettings] = useState<LLMSettings | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load LLM settings on mount
  useEffect(() => {
    const settings = ModelService.loadSettings();
    setLlmSettings(settings);
  }, []);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [conversations]);

  // Get the current connection and conversation using chat ID
  const currentConnection = connections.find(conn => conn.id === connectionId);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const connectionConversations = connectionId
    ? conversations[connectionId] || []
    : [];

  // Find conversation by ID instead of index
  const currentConversation = chatId
    ? connectionConversations.find(conv => conv.id === chatId)
    : connectionConversations[0];

  const currentMessages = currentConversation?.messages || [];

  // Use inspector's expanded state instead of local state
  const isToolCallExpanded = (messageId: string) => {
    return inspectorExpandedTool === messageId;
  };

  const handleToolCallExpand = (messageId: string, _toolName?: string) => {
    const isCurrentlyExpanded = isToolCallExpanded(messageId);
    syncToolCallState(messageId, !isCurrentlyExpanded);
  };

  // Create a new chat conversation
  const handleNewChat = useCallback(async () => {
    if (!connectionId) return;

    try {
      const newChatId = nanoid();
      const newChat = {
        id: newChatId,
        title: `Chat ${connectionConversations.length + 1}`,
        messages: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Get current conversations and add new one
      const updatedConnectionConversations = [
        ...connectionConversations,
        newChat,
      ];
      const updatedConversations = {
        ...conversations,
        [connectionId]: updatedConnectionConversations,
      };

      // Update both storage and local state
      await updateConversations(updatedConversations);

      // Navigate to the new chat using its ID
      navigate(`/connections/${connectionId}/chat/${newChatId}`);
    } catch (error) {
      console.error("Failed to create new chat:", error);
    }
  }, [
    connectionId,
    connectionConversations,
    conversations,
    navigate,
    updateConversations,
  ]);

  useEffect(() => {
    const createInitialChatIfNeeded = async () => {
      if (connectionId && connectionConversations.length === 0) {
        // No chats exist for this connection, create one
        await handleNewChat();
      }
    };

    createInitialChatIfNeeded();
  }, [connectionId, connectionConversations.length, handleNewChat]);

  // Delete a chat conversation
  const handleDeleteChat = async (
    chatToDeleteId: string,
    event?: React.MouseEvent
  ) => {
    if (event) {
      event.stopPropagation(); // Prevent tab click
    }

    if (!connectionId || !chatToDeleteId) return;

    // Confirm deletion
    const chatToDelete = connectionConversations.find(
      conv => conv.id === chatToDeleteId
    );
    if (!chatToDelete) return;

    const confirmed = confirm(
      `Are you sure you want to delete "${chatToDelete.title}"? This cannot be undone.`
    );
    if (!confirmed) return;

    try {
      // Remove the chat from conversations
      const updatedConnectionConversations = connectionConversations.filter(
        conv => conv.id !== chatToDeleteId
      );

      const updatedConversations = {
        ...conversations,
        [connectionId]: updatedConnectionConversations,
      };

      // Update both storage and local state
      await updateConversations(updatedConversations);

      // If we're currently viewing the deleted chat, navigate away
      if (chatId === chatToDeleteId) {
        if (updatedConnectionConversations.length > 0) {
          // Navigate to the first remaining chat
          navigate(
            `/connections/${connectionId}/chat/${updatedConnectionConversations[0].id}`
          );
        } else {
          // No chats left, go to connection overview
          navigate(`/connections/${connectionId}`);
        }
      }
    } catch (error) {
      console.error("Failed to delete chat:", error);
    }
  };

  // Send a message to Anthropic
  const handleSendMessage = async () => {
    if (
      !messageInput.trim() ||
      !llmSettings?.apiKey ||
      !connectionId ||
      !currentConversation
    ) {
      if (!llmSettings?.apiKey) {
        console.warn(
          "No API key configured. Please configure Claude settings."
        );
      }
      return;
    }

    const userMessage: ChatMessageType = {
      id: nanoid(),
      message: messageInput.trim(),
      isUser: true,
      timestamp: new Date(),
      isExecuting: false,
    };

    try {
      setIsLoading(true);
      setMessageInput("");

      // Add user message immediately
      const updatedMessages = [...currentMessages, userMessage];
      await updateConversationMessages(updatedMessages);

      // Create assistant thinking message
      const thinkingMessage: ChatMessageType = {
        id: nanoid(),
        message: "",
        isUser: false,
        timestamp: new Date(),
        isExecuting: true,
      };

      const messagesWithThinking = [...updatedMessages, thinkingMessage];
      await updateConversationMessages(messagesWithThinking);

      // Call Anthropic API
      const response = await callAnthropicAPI(
        updatedMessages.filter(m => m.message)
      );

      // Replace thinking message with response
      const assistantMessage: ChatMessageType = {
        id: thinkingMessage.id,
        message: response,
        isUser: false,
        timestamp: new Date(),
        isExecuting: false,
      };

      const finalMessages = [...updatedMessages, assistantMessage];
      await updateConversationMessages(finalMessages);
    } catch (error) {
      console.error("Failed to send message:", error);

      // Replace thinking message with error
      const errorMessage: ChatMessageType = {
        id: nanoid(),
        message:
          "Sorry, I encountered an error. Please check your API settings and try again.",
        isUser: false,
        timestamp: new Date(),
        isExecuting: false,
      };

      const errorMessages = [...currentMessages, userMessage, errorMessage];
      await updateConversationMessages(errorMessages);
    } finally {
      setIsLoading(false);
    }
  };

  // Update conversation messages in both storage and state
  const updateConversationMessages = async (messages: ChatMessageType[]) => {
    if (!connectionId || !currentConversation) return;

    const updatedConversation = {
      ...currentConversation,
      messages,
      updatedAt: new Date(),
    };

    // Find the conversation by ID and update it
    const updatedConnectionConversations = connectionConversations.map(conv =>
      conv.id === currentConversation.id ? updatedConversation : conv
    );

    const allConversations = {
      ...conversations,
      [connectionId]: updatedConnectionConversations,
    };

    // Use the updateConversations function from StorageContext
    await updateConversations(allConversations);
  };

  // Call Anthropic API
  const callAnthropicAPI = async (
    messages: ChatMessageType[]
  ): Promise<string> => {
    if (!llmSettings) throw new Error("No LLM settings configured");

    const anthropicMessages = messages.map(msg => ({
      role: msg.isUser ? "user" : ("assistant" as const),
      content: msg.message || "",
    }));

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "anthropic-version": "2023-06-01",
        "anthropic-dangerous-direct-browser-access": "true",
        "x-api-key": llmSettings.apiKey,
      },
      body: JSON.stringify({
        model: llmSettings.model,
        max_tokens: llmSettings.maxTokens,
        temperature: llmSettings.temperature,
        messages: anthropicMessages,
      }),
    });

    if (!response.ok) {
      throw new Error(
        `API request failed: ${response.status} ${response.statusText}`
      );
    }

    const data = await response.json();
    return data.content?.[0]?.text || "No response received";
  };

  const handleTabClick = (selectedChatId: string) => {
    navigate(`/connections/${connectionId}/chat/${selectedChatId}`);
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
            {message.isUser ? (
              "U"
            ) : message.isExecuting ? (
              <Loader className="w-4 h-4 animate-spin" />
            ) : (
              "A"
            )}
          </div>

          {/* Message Content */}
          <div className="flex-1 min-w-0">
            <div
              className={`text-sm text-gray-900 dark:text-gray-100 ${message.isUser ? "text-right" : ""}`}
            >
              {message.isExecuting && !message.message ? (
                <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                  <div className="w-3 h-3 border border-gray-400 border-t-transparent rounded-full animate-spin" />
                  <span>Claude is thinking...</span>
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
                <div className="leading-relaxed whitespace-pre-wrap">
                  {message.message}
                </div>
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

  // Show API key warning if not configured
  const showApiWarning = !llmSettings?.apiKey;

  return (
    <div className="flex-1 flex flex-col bg-white dark:bg-gray-950 transition-colors">
      {/* Header with Connection Info */}
      <div className="border-b border-gray-200 dark:border-gray-800 p-6 bg-white dark:bg-gray-950">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              {currentConnection?.name}
            </h2>
            <div className="flex items-center gap-4 mt-1 text-sm text-gray-500 dark:text-gray-400">
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
              {showApiWarning && (
                <>
                  <span>•</span>
                  <span className="text-amber-600 dark:text-amber-400">
                    Claude API not configured
                  </span>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Chat Tabs with Delete Buttons */}
      {connectionConversations.length > 0 && (
        <div className="border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900">
          <div className="flex items-center px-6">
            <div className="flex overflow-x-auto scrollbar-hide">
              {connectionConversations.map(conv => {
                const isActive = chatId === conv.id;
                return (
                  <div key={conv.id} className="relative flex-shrink-0 group">
                    <button
                      onClick={() => handleTabClick(conv.id)}
                      className={`flex items-center px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                        isActive
                          ? "border-blue-500 text-blue-600 dark:text-blue-400 bg-white dark:bg-gray-950"
                          : "border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600"
                      }`}
                    >
                      <span className="truncate max-w-32">{conv.title}</span>
                      <span className="ml-2 text-xs opacity-60">
                        ({conv.messages.length})
                      </span>
                    </button>

                    {/* Delete Button - Only show on hover and when there's more than 1 chat */}
                    {connectionConversations.length > 1 && (
                      <button
                        onClick={e => handleDeleteChat(conv.id, e)}
                        className={`absolute top-1 right-1 p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity ${
                          isActive
                            ? "text-gray-600 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                            : "text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                        }`}
                        title={`Delete "${conv.title}"`}
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            {/* New Chat Button */}
            <button
              onClick={handleNewChat}
              className="flex-shrink-0 ml-4 p-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
              title="Create new chat"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* API Key Warning */}
      {showApiWarning && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border-b border-amber-200 dark:border-amber-800 px-6 py-3">
          <div className="flex items-center gap-2 text-sm text-amber-800 dark:text-amber-200">
            <div className="w-4 h-4 bg-amber-400 rounded-full flex items-center justify-center">
              <span className="text-xs text-amber-900">!</span>
            </div>
            <span>
              Configure your Anthropic API key in Settings to start chatting
              with Claude
            </span>
          </div>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto px-6 py-8">
          {currentMessages.length === 0 ? (
            <div className="text-center py-12 text-gray-500 dark:text-gray-400">
              <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-lg mx-auto mb-4 flex items-center justify-center">
                <ExternalLink className="w-8 h-8" />
              </div>
              <p className="text-lg font-medium mb-2 text-gray-900 dark:text-gray-100">
                {showApiWarning
                  ? "Configure Claude API"
                  : "Start a conversation"}
              </p>
              <p className="text-sm">
                {showApiWarning
                  ? "Add your Anthropic API key in Settings to begin chatting"
                  : `Start chatting with Claude about ${currentConnection?.name}`}
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
              <div ref={messagesEndRef} />
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
                showApiWarning
                  ? "Configure API key to start chatting..."
                  : currentConnection
                    ? `Message Claude about ${currentConnection.name}...`
                    : "Type a message..."
              }
              value={messageInput}
              onChange={e => setMessageInput(e.target.value)}
              onKeyPress={e =>
                e.key === "Enter" && !e.shiftKey && handleSendMessage()
              }
              disabled={showApiWarning || isLoading}
              className="flex-1 px-4 py-3 border border-gray-200 dark:border-gray-700 rounded-lg 
                       bg-white dark:bg-gray-900
                       text-gray-900 dark:text-gray-100
                       placeholder:text-gray-500 dark:placeholder:text-gray-400
                       focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-gray-100 focus:border-transparent
                       disabled:opacity-50 disabled:cursor-not-allowed
                       transition-colors"
            />
            <Button
              onClick={handleSendMessage}
              disabled={!messageInput.trim() || showApiWarning || isLoading}
              className="px-4 py-3 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 rounded-lg hover:bg-gray-800 dark:hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isLoading ? (
                <Loader className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
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
