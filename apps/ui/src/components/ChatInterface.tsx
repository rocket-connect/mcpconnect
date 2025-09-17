/* eslint-disable react-hooks/exhaustive-deps */
import { Button } from "@mcpconnect/components";
import { ChatMessage as ChatMessageType } from "@mcpconnect/schemas";
import { useParams, useNavigate } from "react-router-dom";
import {
  Send,
  ExternalLink,
  Plus,
  Loader,
  X,
  Settings,
  Zap,
  ZapOff,
} from "lucide-react";
import { useState, useRef, useEffect, useCallback } from "react";
import { useStorage } from "../contexts/StorageContext";
import { useInspector } from "../contexts/InspectorProvider";
import { ModelService, LLMSettings } from "../services/modelService";
import { ChatService, SSEEvent } from "../services/chatService";
import { SettingsModal } from "./SettingsModal";
import { nanoid } from "nanoid";

interface ChatInterfaceProps {
  expandedToolCall?: boolean;
}

export const ChatInterface = (_args: ChatInterfaceProps) => {
  const { connectionId, chatId } = useParams();
  const navigate = useNavigate();
  const {
    connections,
    tools,
    conversations,
    updateConversations,
    refreshAll,
    getEnabledTools,
    isToolEnabled,
    onToolStateChange, // NEW: Subscribe to tool state changes
  } = useStorage();
  const { expandedToolCall: inspectorExpandedTool, syncToolCallState } =
    useInspector();

  // Local state for UI interactions
  const [messageInput, setMessageInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingEnabled, setStreamingEnabled] = useState(true);
  const [currentStreamingContent, setCurrentStreamingContent] = useState("");
  const [streamingStatus, setStreamingStatus] = useState<string>("");
  const [llmSettings, setLlmSettings] = useState<LLMSettings | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isCreatingChat, setIsCreatingChat] = useState(false);
  const [isLoadingSettings, setIsLoadingSettings] = useState(true);

  // NEW: Reactive tool state - forces re-render when tool enablement changes
  const [toolStateVersion, setToolStateVersion] = useState(0);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const streamingMessageRef = useRef<string>("");
  const abortControllerRef = useRef<AbortController | null>(null);

  // Load LLM settings on mount (async)
  useEffect(() => {
    const loadSettings = async () => {
      setIsLoadingSettings(true);
      try {
        const settings = await ModelService.loadSettings();
        setLlmSettings(settings);
      } catch (error) {
        console.error("Failed to load LLM settings:", error);
        setLlmSettings(null);
      } finally {
        setIsLoadingSettings(false);
      }
    };

    loadSettings();
  }, []);

  // NEW: Listen for tool state changes and force re-render
  useEffect(() => {
    if (!connectionId) return;

    console.log(
      `[ChatInterface] Setting up tool state listener for ${connectionId}`
    );

    const cleanup = onToolStateChange(changedConnectionId => {
      if (changedConnectionId === connectionId) {
        console.log(
          `[ChatInterface] Tool state changed for ${connectionId}, updating UI`
        );
        // Force re-render by incrementing version
        setToolStateVersion(prev => prev + 1);
      }
    });

    return cleanup;
  }, [connectionId, onToolStateChange]);

  // Reload settings when settings modal closes
  const handleSettingsClose = useCallback(async () => {
    setIsSettingsOpen(false);

    try {
      const settings = await ModelService.loadSettings();
      setLlmSettings(settings);
    } catch (error) {
      console.error("Failed to reload LLM settings:", error);
    }
  }, []);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [conversations, currentStreamingContent]);

  // Cleanup abort controller on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  // Get the current connection and conversation using chat ID
  const currentConnection = connections.find(conn => conn.id === connectionId);
  const connectionConversations = connectionId
    ? conversations[connectionId] || []
    : [];

  // Find conversation by ID instead of index
  const currentConversation =
    chatId && chatId !== "new"
      ? connectionConversations.find(conv => conv.id === chatId)
      : connectionConversations[0];

  const currentMessages = currentConversation?.messages || [];
  const allConnectionTools = connectionId ? tools[connectionId] || [] : [];

  // NEW: Get enabled tools reactively - this will update when toolStateVersion changes
  const enabledConnectionTools = connectionId
    ? getEnabledTools(connectionId)
    : [];

  // NEW: Calculate disabled tools count reactively
  const disabledToolsCount =
    allConnectionTools.length - enabledConnectionTools.length;

  // DEBUG: Log tool state changes
  useEffect(() => {
    if (connectionId) {
      console.log(`[ChatInterface] Tool state update for ${connectionId}:`, {
        toolStateVersion,
        totalTools: allConnectionTools.length,
        enabledTools: enabledConnectionTools.length,
        disabledTools: disabledToolsCount,
        enabledToolNames: enabledConnectionTools.map(t => t.name),
      });
    }
  }, [
    connectionId,
    toolStateVersion,
    allConnectionTools.length,
    enabledConnectionTools.length,
    disabledToolsCount,
  ]);

  // Use inspector's expanded state instead of local state
  const isToolCallExpanded = (messageId: string) => {
    return inspectorExpandedTool === messageId;
  };

  const handleToolCallExpand = (messageId: string, _toolName?: string) => {
    const isCurrentlyExpanded = isToolCallExpanded(messageId);
    syncToolCallState(messageId, !isCurrentlyExpanded);
  };

  // Create a new chat conversation
  const handleNewChat = useCallback(
    async (isAutoCreated = false) => {
      if (!connectionId) return;

      try {
        const newChatId = nanoid();
        const chatNumber = connectionConversations.length + 1;
        const chatTitle = isAutoCreated
          ? `${currentConnection?.name || "Chat"} - Session 1`
          : `Chat ${chatNumber}`;

        const newChat = {
          id: newChatId,
          title: chatTitle,
          messages: [],
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        const updatedConnectionConversations = [
          ...connectionConversations,
          newChat,
        ];
        const updatedConversations = {
          ...conversations,
          [connectionId]: updatedConnectionConversations,
        };

        await updateConversations(updatedConversations);

        navigate(`/connections/${connectionId}/chat/${newChatId}`, {
          replace: isAutoCreated,
        });

        return newChatId;
      } catch (error) {
        console.error("Failed to create new chat:", error);
        throw error;
      }
    },
    [
      connectionId,
      connectionConversations,
      conversations,
      navigate,
      updateConversations,
      currentConnection?.name,
    ]
  );

  // Auto-create chat for new connections or when chatId is "new"
  useEffect(() => {
    const createInitialChatIfNeeded = async () => {
      if (!connectionId || isCreatingChat) return;

      if (chatId === "new" || connectionConversations.length === 0) {
        setIsCreatingChat(true);
        try {
          await handleNewChat(true);
        } catch (error) {
          console.error("Failed to auto-create chat:", error);
        } finally {
          setIsCreatingChat(false);
        }
      }
    };

    createInitialChatIfNeeded();
  }, [connectionId, chatId, connectionConversations.length, isCreatingChat]);

  // Delete a chat conversation
  const handleDeleteChat = async (
    chatToDeleteId: string,
    event?: React.MouseEvent
  ) => {
    if (event) {
      event.stopPropagation();
    }

    if (!connectionId || !chatToDeleteId) return;

    const chatToDelete = connectionConversations.find(
      conv => conv.id === chatToDeleteId
    );
    if (!chatToDelete) return;

    const confirmed = confirm(
      `Are you sure you want to delete "${chatToDelete.title}"? This cannot be undone.`
    );
    if (!confirmed) return;

    try {
      const updatedConnectionConversations = connectionConversations.filter(
        conv => conv.id !== chatToDeleteId
      );
      const updatedConversations = {
        ...conversations,
        [connectionId]: updatedConnectionConversations,
      };

      await updateConversations(updatedConversations);

      if (chatId === chatToDeleteId) {
        if (updatedConnectionConversations.length > 0) {
          navigate(
            `/connections/${connectionId}/chat/${updatedConnectionConversations[0].id}`
          );
        } else {
          await handleNewChat();
        }
      }
    } catch (error) {
      console.error("Failed to delete chat:", error);
    }
  };

  // Handle streaming toggle
  const handleStreamingToggle = () => {
    if (isStreaming) {
      // Cancel current streaming
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      setIsStreaming(false);
      setCurrentStreamingContent("");
      setStreamingStatus("");
      streamingMessageRef.current = "";
    }
    setStreamingEnabled(!streamingEnabled);
  };

  // Update conversation messages in both storage and state
  const updateConversationMessages = async (messages: ChatMessageType[]) => {
    if (!connectionId || !currentConversation) return;

    const updatedConversation = {
      ...currentConversation,
      messages,
      updatedAt: new Date(),
    };

    const updatedConnectionConversations = connectionConversations.map(conv =>
      conv.id === currentConversation.id ? updatedConversation : conv
    );

    const allConversations = {
      ...conversations,
      [connectionId]: updatedConnectionConversations,
    };

    await updateConversations(allConversations);
  };

  const handleStreamingEvent = useCallback(
    async (event: SSEEvent) => {
      switch (event.type) {
        case "thinking":
          setStreamingStatus("Claude is thinking...");
          setCurrentStreamingContent("");
          break;

        case "token":
          if (event.data?.delta) {
            streamingMessageRef.current += event.data.delta;
            setCurrentStreamingContent(streamingMessageRef.current);
            setStreamingStatus("Streaming response...");
          }
          break;

        case "tool_start":
          setStreamingStatus(`Executing ${event.data?.toolName || "tool"}...`);
          break;

        case "tool_end":
          setStreamingStatus(`Completed ${event.data?.toolName || "tool"}`);
          await refreshAll();
          break;

        case "message_complete":
          setCurrentStreamingContent("");
          setStreamingStatus("");
          streamingMessageRef.current = "";

          if (
            event.data?.assistantMessage &&
            event.data?.toolExecutionMessages
          ) {
            const userMessage: ChatMessageType = {
              id: nanoid(),
              message: messageInput.trim(),
              isUser: true,
              timestamp: new Date(),
              isExecuting: false,
            };

            const finalMessages = [
              ...currentMessages,
              userMessage,
              ...event.data.toolExecutionMessages,
              event.data.assistantMessage,
            ];

            await updateConversationMessages(finalMessages);
            await refreshAll();
          }
          break;

        case "error":
          {
            console.error(
              "[ChatInterface] Streaming error:",
              event.data?.error
            );
            setCurrentStreamingContent("");
            setStreamingStatus("");
            streamingMessageRef.current = "";

            // Create a proper error message for display
            const errorText =
              event.data?.error || "An error occurred during streaming";

            const errorMessage: ChatMessageType = {
              id: nanoid(),
              message: `Error: ${errorText}`,
              isUser: false,
              timestamp: new Date(),
              isExecuting: false,
            };

            const userMessage: ChatMessageType = {
              id: nanoid(),
              message: messageInput.trim(),
              isUser: true,
              timestamp: new Date(),
              isExecuting: false,
            };

            const errorMessages = [
              ...currentMessages,
              userMessage,
              errorMessage,
            ];
            await updateConversationMessages(errorMessages);
          }
          break;
      }
    },
    [currentMessages, messageInput, refreshAll, updateConversationMessages]
  );

  // NEW: Updated send message to use fresh enabled tools
  const handleSendMessage = async () => {
    if (
      !messageInput.trim() ||
      !llmSettings?.apiKey ||
      !connectionId ||
      !currentConversation ||
      !currentConnection ||
      isLoading ||
      isStreaming
    ) {
      if (!llmSettings?.apiKey) {
        console.warn(
          "No API key configured. Please configure Claude settings."
        );
      }
      return;
    }

    // Create abort controller for this request
    abortControllerRef.current = new AbortController();

    try {
      setIsLoading(true);
      setIsStreaming(streamingEnabled);
      setCurrentStreamingContent("");
      setStreamingStatus("");
      streamingMessageRef.current = "";
      const originalMessage = messageInput.trim();
      setMessageInput("");

      // NEW: Get the latest enabled tools at the time of sending
      const currentEnabledTools = getEnabledTools(connectionId);

      console.log(
        `[ChatInterface] Sending message with ${currentEnabledTools.length} enabled tools:`,
        currentEnabledTools.map(t => t.name)
      );

      // Use fresh enabled tools for the chat context
      const chatContext = {
        connection: currentConnection,
        tools: currentEnabledTools, // This is now fresh at send time
        llmSettings,
      };

      if (!ChatService.validateChatContext(chatContext)) {
        throw new Error("Invalid chat context");
      }

      const conversationMessages = currentMessages.filter(
        m => m.message && !m.isExecuting
      );

      if (streamingEnabled) {
        // Use streaming approach
        await ChatService.sendMessageWithStreaming(
          originalMessage,
          chatContext,
          conversationMessages,
          handleStreamingEvent
        );
      } else {
        // Fallback to non-streaming approach
        const userMessage: ChatMessageType = {
          id: nanoid(),
          message: originalMessage,
          isUser: true,
          timestamp: new Date(),
          isExecuting: false,
        };

        const updatedMessages = [...currentMessages, userMessage];
        await updateConversationMessages(updatedMessages);

        const thinkingMessage = ChatService.createThinkingMessage();
        const messagesWithThinking = [...updatedMessages, thinkingMessage];
        await updateConversationMessages(messagesWithThinking);

        const response = await ChatService.sendMessage(
          originalMessage,
          chatContext,
          conversationMessages
        );

        let finalMessages = [...updatedMessages];

        if (response.toolExecutionMessages.length > 0) {
          finalMessages = [...finalMessages, ...response.toolExecutionMessages];

          for (const toolMsg of response.toolExecutionMessages) {
            if (toolMsg.toolExecution) {
              const execution = {
                id: toolMsg.id || nanoid(),
                tool: toolMsg.executingTool || toolMsg.toolExecution.toolName,
                status: toolMsg.toolExecution.status,
                duration: 0,
                timestamp: new Date().toLocaleTimeString(),
                request: {
                  tool: toolMsg.executingTool || toolMsg.toolExecution.toolName,
                  arguments: {},
                  timestamp: new Date().toISOString(),
                },
                ...(toolMsg.toolExecution.result
                  ? {
                      response: {
                        success: true,
                        result: toolMsg.toolExecution.result,
                        timestamp: new Date().toISOString(),
                      },
                    }
                  : {}),
                ...(toolMsg.toolExecution.error && {
                  error: toolMsg.toolExecution.error,
                }),
              };

              await ChatService.storeToolExecution(connectionId, execution);
            }
          }
        }

        finalMessages.push(response.assistantMessage);
        await updateConversationMessages(finalMessages);
        await refreshAll();
      }
    } catch (error) {
      console.error("Failed to send message:", error);

      if ((error as Error).name === "AbortError") {
        return;
      }

      const errorMessage: ChatMessageType = {
        id: nanoid(),
        message: ChatService.getErrorMessage(error),
        isUser: false,
        timestamp: new Date(),
        isExecuting: false,
      };

      const userMessage: ChatMessageType = {
        id: nanoid(),
        message: messageInput.trim(),
        isUser: true,
        timestamp: new Date(),
        isExecuting: false,
      };

      setCurrentStreamingContent("");
      setStreamingStatus("");
      streamingMessageRef.current = "";
      const errorMessages = [...currentMessages, userMessage, errorMessage];
      await updateConversationMessages(errorMessages);
    } finally {
      setIsLoading(false);
      setIsStreaming(false);
      abortControllerRef.current = null;
    }
  };

  const handleTabClick = (selectedChatId: string) => {
    navigate(`/connections/${connectionId}/chat/${selectedChatId}`);
  };

  // Clean chat message component
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

    // Show warning if tool was disabled after execution
    const toolWasDisabled =
      toolName && connectionId && !isToolEnabled(connectionId, toolName);

    if (message.isExecuting && !message.message && !hasToolExecution) {
      return null;
    }

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
                </div>
              ) : (
                <div className="leading-relaxed whitespace-pre-wrap">
                  {message.message}
                </div>
              )}
            </div>

            {hasToolExecution && (
              <div className="flex items-center gap-2 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => handleToolCallExpand(messageId, toolName)}
                  className={`text-xs px-2 py-1 rounded border transition-colors ${
                    isExpanded
                      ? "border-gray-400 dark:border-gray-600 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300"
                      : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 text-gray-500"
                  }`}
                >
                  {isExpanded ? "Collapse" : "Expand"} Details
                </button>
              </div>
            )}

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
                        {toolWasDisabled && (
                          <span className="ml-2 text-amber-600 dark:text-amber-400">
                            (disabled)
                          </span>
                        )}
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
                      <div className="text-gray-800 dark:text-gray-200 text-xs bg-gray-100 dark:bg-gray-800 p-2 rounded border">
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

  // Streaming message component
  const StreamingMessage = () => {
    if (!currentStreamingContent && !streamingStatus) return null;

    return (
      <div className="group relative">
        <div className="flex gap-4 mb-6">
          <div className="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-medium bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400">
            <Loader className="w-4 h-4 animate-spin" />
          </div>

          <div className="flex-1 min-w-0">
            <div className="text-sm text-gray-900 dark:text-gray-100">
              {currentStreamingContent ? (
                <div className="leading-relaxed whitespace-pre-wrap">
                  {currentStreamingContent}
                  <span className="inline-block w-2 h-4 ml-1 bg-blue-500 animate-pulse" />
                </div>
              ) : (
                <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                  <div className="w-3 h-3 border border-gray-400 border-t-transparent rounded-full animate-spin" />
                  <span>{streamingStatus}</span>
                </div>
              )}
            </div>
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

  // Show loading if creating chat or loading settings
  if (isCreatingChat || isLoadingSettings) {
    return (
      <div className="flex-1 flex items-center justify-center bg-white dark:bg-gray-950 transition-colors">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">
            {isCreatingChat ? "Setting up your chat..." : "Loading settings..."}
          </p>
        </div>
      </div>
    );
  }

  const showApiWarning = !llmSettings?.apiKey;

  return (
    <>
      <div className="flex flex-col h-full bg-white dark:bg-gray-950 transition-colors">
        {/* Fixed Header with Connection Info */}
        <div className="flex-shrink-0 border-b border-gray-200 dark:border-gray-800 p-6 bg-white dark:bg-gray-950">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                {currentConnection?.name}
              </h2>
              <div className="flex items-center gap-4 mt-1 text-sm text-gray-500 dark:text-gray-400">
                <span>{currentMessages.length} messages</span>
                <span>
                  {enabledConnectionTools.length} tools enabled
                  {disabledToolsCount > 0 && (
                    <span className="text-amber-600 dark:text-amber-400">
                      {" "}
                      ({disabledToolsCount} disabled)
                    </span>
                  )}
                </span>
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
                {llmSettings?.apiKey && (
                  <>
                    <span>•</span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleStreamingToggle}
                        className={`flex items-center gap-1 px-2 py-1 text-xs rounded transition-colors ${
                          streamingEnabled
                            ? "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300"
                            : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400"
                        }`}
                        title={
                          streamingEnabled
                            ? "Streaming enabled - click to disable"
                            : "Streaming disabled - click to enable"
                        }
                        disabled={isLoading || isStreaming}
                      >
                        {streamingEnabled ? (
                          <Zap className="w-3 h-3" />
                        ) : (
                          <ZapOff className="w-3 h-3" />
                        )}
                        {streamingEnabled ? "Streaming" : "Standard"}
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>

            {showApiWarning && (
              <button
                onClick={() => setIsSettingsOpen(true)}
                className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 transition-colors"
              >
                <Settings className="w-4 h-4" />
                Configure Claude
              </button>
            )}
          </div>
        </div>

        {/* Fixed Chat Tabs with Delete Buttons */}
        {connectionConversations.length > 0 && (
          <div className="flex-shrink-0 border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900">
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

              <button
                onClick={() => handleNewChat()}
                className="flex-shrink-0 ml-4 p-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
                title="Create new chat"
                disabled={isLoading || isStreaming}
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Fixed API Key Warning */}
        {showApiWarning && (
          <div className="flex-shrink-0 bg-amber-50 dark:bg-amber-900/20 border-b border-amber-200 dark:border-amber-800 px-6 py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm text-amber-800 dark:text-amber-200">
                <div className="w-4 h-4 bg-amber-400 rounded-full flex items-center justify-center">
                  <span className="text-xs text-amber-900">!</span>
                </div>
                <span>
                  Configure your Anthropic API key to start chatting with Claude
                </span>
              </div>
              <button
                onClick={() => setIsSettingsOpen(true)}
                className="text-amber-700 dark:text-amber-300 hover:text-amber-900 dark:hover:text-amber-100 text-sm font-medium"
              >
                Configure Now
              </button>
            </div>
          </div>
        )}

        {/* Tool Status Warning */}
        {disabledToolsCount > 0 && !showApiWarning && (
          <div className="flex-shrink-0 bg-blue-50 dark:bg-blue-900/20 border-b border-blue-200 dark:border-blue-800 px-6 py-2">
            <div className="flex items-center gap-2 text-sm text-blue-800 dark:text-blue-200">
              <div className="w-4 h-4 bg-blue-400 rounded-full flex items-center justify-center">
                <span className="text-xs text-blue-900">i</span>
              </div>
              <span>
                {disabledToolsCount} tool
                {disabledToolsCount === 1 ? " is" : "s are"} disabled and won't
                be used in conversations
              </span>
            </div>
          </div>
        )}

        {/* Scrollable Messages Container */}
        <div className="flex-1 overflow-y-auto min-h-0">
          <div className="h-full">
            <div className="max-w-4xl mx-auto px-6 py-8 min-h-full">
              {currentMessages.length === 0 && !currentStreamingContent ? (
                <div className="flex items-center justify-center h-full">
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
                        ? "Add your Anthropic API key to begin chatting with Claude"
                        : `Start chatting with Claude about ${currentConnection?.name}. ${enabledConnectionTools.length} tools are available${disabledToolsCount > 0 ? ` (${disabledToolsCount} disabled)` : ""}.`}
                    </p>
                    {showApiWarning && (
                      <button
                        onClick={() => setIsSettingsOpen(true)}
                        className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                      >
                        Configure Claude
                      </button>
                    )}
                    {!showApiWarning && (
                      <div className="mt-4 flex items-center justify-center gap-2">
                        {streamingEnabled ? (
                          <Zap className="w-4 h-4 text-blue-500" />
                        ) : (
                          <ZapOff className="w-4 h-4 text-gray-400" />
                        )}
                        <span className="text-sm">
                          {streamingEnabled
                            ? "Streaming enabled"
                            : "Standard mode"}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="space-y-6">
                  {Array.isArray(currentMessages) &&
                    currentMessages
                      .filter(
                        msg =>
                          !(
                            msg.isExecuting &&
                            !msg.message &&
                            !msg.executingTool &&
                            !msg.toolExecution
                          )
                      )
                      .map((msg, index) => (
                        <CleanChatMessage
                          key={msg.id || `msg-${index}`}
                          message={msg}
                          index={index}
                        />
                      ))}

                  {/* Show streaming message if active */}
                  {(isStreaming ||
                    currentStreamingContent ||
                    streamingStatus) && <StreamingMessage />}

                  <div ref={messagesEndRef} />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Fixed Input */}
        <div className="flex-shrink-0 border-t border-gray-200 dark:border-gray-800 p-6 bg-white dark:bg-gray-950">
          <div className="max-w-4xl mx-auto">
            <div className="flex gap-3">
              <input
                type="text"
                placeholder={
                  showApiWarning
                    ? "Configure API key to start chatting..."
                    : currentConnection
                      ? `Message Claude about ${currentConnection.name}... (${enabledConnectionTools.length} tools enabled${disabledToolsCount > 0 ? `, ${disabledToolsCount} disabled` : ""}, ${streamingEnabled ? "streaming" : "standard"} mode)`
                      : "Type a message..."
                }
                value={messageInput}
                onChange={e => setMessageInput(e.target.value)}
                onKeyPress={e =>
                  e.key === "Enter" && !e.shiftKey && handleSendMessage()
                }
                disabled={showApiWarning || isLoading || isStreaming}
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
                disabled={
                  !messageInput.trim() ||
                  showApiWarning ||
                  isLoading ||
                  isStreaming
                }
                className="px-4 py-3 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 rounded-lg hover:bg-gray-800 dark:hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isLoading || isStreaming ? (
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
            {isStreaming && (
              <p className="text-xs text-blue-600 dark:text-blue-400 mt-2 flex items-center gap-1">
                <Zap className="w-3 h-3" />
                {streamingStatus || "Streaming response..."}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Settings Modal */}
      <SettingsModal isOpen={isSettingsOpen} onClose={handleSettingsClose} />
    </>
  );
};
