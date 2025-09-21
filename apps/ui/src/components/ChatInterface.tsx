/* eslint-disable react-hooks/exhaustive-deps */
import { ChatMessage as ChatMessageType } from "@mcpconnect/schemas";
import { useParams, useNavigate } from "react-router-dom";
import { ExternalLink } from "lucide-react";
import { useState, useRef, useEffect, useCallback } from "react";
import { useStorage } from "../contexts/StorageContext";
import { useInspector } from "../contexts/InspectorProvider";
import { ModelService, LLMSettings } from "../services/modelService";
import { ChatService, SSEEvent } from "../services/chatService";
import { SettingsModal } from "./SettingsModal";
import { nanoid } from "nanoid";
import {
  ChatHeader,
  ChatTabs,
  ChatMessageComponent,
  StreamingMessage,
  ApiWarning,
  ToolStatusWarning,
  ChatInput,
  EmptyState,
} from "@mcpconnect/components";

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
    onToolStateChange,
    deleteChatWithCleanup,
    clearAllChatsWithCleanup,
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

  // Track streaming state for proper message flow
  const [streamingToolMessages, setStreamingToolMessages] = useState<
    ChatMessageType[]
  >([]);

  // Refs to access latest state in callbacks
  const conversationsRef = useRef(conversations);
  const connectionIdRef = useRef(connectionId);
  const chatIdRef = useRef(chatId);

  // Update refs when state changes
  useEffect(() => {
    conversationsRef.current = conversations;
  }, [conversations]);

  useEffect(() => {
    connectionIdRef.current = connectionId;
  }, [connectionId]);

  useEffect(() => {
    chatIdRef.current = chatId;
  }, [chatId]);

  // Reactive tool state - forces re-render when tool enablement changes
  const [, setToolStateVersion] = useState(0);

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

  // Listen for tool state changes and force re-render
  useEffect(() => {
    if (!connectionId) return;

    const cleanup = onToolStateChange(changedConnectionId => {
      if (changedConnectionId === connectionId) {
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
  }, [conversations, currentStreamingContent, streamingToolMessages]);

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

  // Get enabled tools reactively - this will update when toolStateVersion changes
  const enabledConnectionTools = connectionId
    ? getEnabledTools(connectionId)
    : [];

  // Calculate disabled tools count reactively
  const disabledToolsCount =
    allConnectionTools.length - enabledConnectionTools.length;

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
  }, [
    connectionId,
    chatId,
    connectionConversations.length,
    isCreatingChat,
    handleNewChat,
  ]);

  // ENHANCED: Delete a chat conversation with proper tool execution cleanup
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
      // Use the enhanced cleanup method that properly handles tool executions
      await deleteChatWithCleanup(connectionId, chatToDeleteId);

      // Navigate to another chat if we deleted the current one
      if (chatId === chatToDeleteId) {
        const remainingChats = connectionConversations.filter(
          conv => conv.id !== chatToDeleteId
        );

        if (remainingChats.length > 0) {
          navigate(`/connections/${connectionId}/chat/${remainingChats[0].id}`);
        } else {
          await handleNewChat();
        }
      }

      console.log(
        `[ChatInterface] Successfully deleted chat ${chatToDeleteId}`
      );
    } catch (error) {
      console.error("Failed to delete chat:", error);
      alert("Failed to delete chat. Please try again.");
    }
  };

  // ENHANCED: Clear all chats for the current connection with proper tool execution cleanup
  const handleClearAllChats = async () => {
    if (!connectionId) return;

    const confirmed = confirm(
      `Are you sure you want to delete all ${connectionConversations.length} chat conversations? This action cannot be undone.`
    );
    if (!confirmed) return;

    try {
      // Use the enhanced cleanup method that properly handles tool executions
      await clearAllChatsWithCleanup(connectionId);

      // Navigate to a new chat immediately to avoid being stuck on a deleted chat
      const newChatId = nanoid();
      const chatTitle = `${currentConnection?.name || "Chat"} - Session 1`;

      const newChat = {
        id: newChatId,
        title: chatTitle,
        messages: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const finalConversations = {
        ...conversations,
        [connectionId]: [newChat],
      };

      await updateConversations(finalConversations);

      // Navigate to the new chat and replace the current URL
      navigate(`/connections/${connectionId}/chat/${newChatId}`, {
        replace: true,
      });

      // Force a refresh to ensure all components are in sync
      await refreshAll();

      console.log(
        `[ChatInterface] Successfully cleared all chats for connection ${connectionId}`
      );
    } catch (error) {
      console.error("Failed to clear all chats:", error);
      alert("Failed to clear all chats. Please try again.");
    }
  };

  // Handle streaming toggle
  const handleStreamingToggle = () => {
    if (isStreaming) {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      setIsStreaming(false);
      setCurrentStreamingContent("");
      setStreamingStatus("");
      setStreamingToolMessages([]);
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
          setStreamingStatus("Your LLM is thinking...");
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
          if (event.data?.toolName) {
            const toolMessage: ChatMessageType = {
              id: nanoid(),
              message: "",
              isUser: false,
              isExecuting: true,
              executingTool: event.data.toolName,
              timestamp: new Date(),
            };

            setStreamingToolMessages(prev => [...prev, toolMessage]);
            setStreamingStatus(`Executing ${event.data.toolName}...`);
          }
          break;

        case "tool_end":
          if (event.data?.toolName) {
            setStreamingToolMessages(prev =>
              prev.map(msg => {
                if (
                  msg.executingTool === event.data?.toolName &&
                  msg.isExecuting
                ) {
                  const toolName = event.data!.toolName!;
                  const toolExecution = event.data!.toolExecution;

                  return {
                    ...msg,
                    isExecuting: false,
                    toolExecution: toolExecution
                      ? {
                          toolName,
                          status: toolExecution.status || "success",
                          result: toolExecution.response?.result,
                          error: toolExecution.error,
                        }
                      : {
                          toolName,
                          status: "success" as const,
                        },
                  } as ChatMessageType;
                }
                return msg;
              })
            );
            setStreamingStatus(`Completed ${event.data.toolName}`);
          }
          await refreshAll();
          break;

        case "message_complete":
          // Clear streaming state first
          setCurrentStreamingContent("");
          setStreamingStatus("");
          streamingMessageRef.current = "";
          setStreamingToolMessages([]);

          if (event.data?.assistantMessage) {
            // Use refs to get latest state
            const currentConversationId = connectionIdRef.current;
            const currentChatId = chatIdRef.current;
            const currentConversations = conversationsRef.current;

            if (!currentConversationId || !currentChatId) return;

            // Get the latest conversation data
            const latestConversations =
              currentConversations[currentConversationId] || [];
            const latestConversation = latestConversations.find(
              conv => conv.id === currentChatId
            );
            const latestMessages = latestConversation?.messages || [];

            // Build final messages array
            let finalMessages = [...latestMessages];

            // Add tool execution messages if they exist
            if (
              event.data.toolExecutionMessages &&
              event.data.toolExecutionMessages.length > 0
            ) {
              finalMessages = [
                ...finalMessages,
                ...event.data.toolExecutionMessages,
              ];
            }

            // Add the final assistant message
            finalMessages.push(event.data.assistantMessage);

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

            const errorText =
              event.data?.error || "An error occurred during streaming";

            const errorMessage: ChatMessageType = {
              id: nanoid(),
              message: `Error: ${errorText}`,
              isUser: false,
              timestamp: new Date(),
              isExecuting: false,
            };

            // Use refs to get latest state
            const currentConversationId = connectionIdRef.current;
            const currentChatId = chatIdRef.current;
            const currentConversations = conversationsRef.current;

            if (currentConversationId && currentChatId) {
              const latestConversations =
                currentConversations[currentConversationId] || [];
              const latestConversation = latestConversations.find(
                conv => conv.id === currentChatId
              );
              const latestMessages = latestConversation?.messages || [];

              const finalMessages = [...latestMessages, errorMessage];
              await updateConversationMessages(finalMessages);
            }

            // Clear streaming state
            setStreamingToolMessages([]);
          }
          break;
      }
    },
    [refreshAll, updateConversationMessages] // Simplified dependencies
  );

  // Send message with fresh enabled tools
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
          "No API key configured. Please configure AI provider settings."
        );
      }
      return;
    }

    abortControllerRef.current = new AbortController();

    try {
      setIsLoading(true);
      setIsStreaming(streamingEnabled);
      setCurrentStreamingContent("");
      setStreamingStatus("");
      setStreamingToolMessages([]);
      streamingMessageRef.current = "";

      const originalMessage = messageInput.trim();
      setMessageInput("");

      // Create user message immediately and add it to the conversation
      const userMessage: ChatMessageType = {
        id: nanoid(),
        message: originalMessage,
        isUser: true,
        timestamp: new Date(),
        isExecuting: false,
      };

      // Add user message to conversation immediately for both streaming and non-streaming
      const messagesWithUser = [...currentMessages, userMessage];
      await updateConversationMessages(messagesWithUser);

      const currentEnabledTools = getEnabledTools(connectionId);

      const chatContext = {
        connection: currentConnection,
        tools: currentEnabledTools,
        llmSettings,
      };

      if (!ChatService.validateChatContext(chatContext)) {
        throw new Error("Invalid chat context");
      }

      // Use the conversation history without the new user message for the AI context
      const conversationMessages = currentMessages.filter(
        m => m.message && !m.isExecuting
      );

      if (streamingEnabled) {
        await ChatService.sendMessageWithStreaming(
          originalMessage,
          chatContext,
          conversationMessages,
          handleStreamingEvent
        );
      } else {
        // For non-streaming, handle as before but don't add user message again
        const thinkingMessage = ChatService.createThinkingMessage();
        const messagesWithThinking = [...messagesWithUser, thinkingMessage];
        await updateConversationMessages(messagesWithThinking);

        const response = await ChatService.sendMessage(
          originalMessage,
          chatContext,
          conversationMessages
        );

        let finalMessages = [...messagesWithUser]; // Start with messages that include user message

        if (response.toolExecutionMessages.length > 0) {
          finalMessages = [...finalMessages, ...response.toolExecutionMessages];

          for (const toolMsg of response.toolExecutionMessages) {
            if (toolMsg.toolExecution) {
              const now = new Date();
              const execution = {
                id: toolMsg.id || nanoid(),
                tool: toolMsg.executingTool || toolMsg.toolExecution.toolName,
                status: toolMsg.toolExecution.status,
                duration: 0,
                timestamp: now.toISOString(),
                request: {
                  tool: toolMsg.executingTool || toolMsg.toolExecution.toolName,
                  arguments: {},
                  timestamp: now.toISOString(),
                },
                ...(toolMsg.toolExecution.result
                  ? {
                      response: {
                        success: true,
                        result: toolMsg.toolExecution.result,
                        timestamp: now.toISOString(),
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

      setCurrentStreamingContent("");
      setStreamingStatus("");
      streamingMessageRef.current = "";

      // Add error message to current messages (user message should already be there)
      const errorMessages = [...currentMessages, errorMessage];
      await updateConversationMessages(errorMessages);

      // Clear streaming state
      setStreamingToolMessages([]);
    } finally {
      setIsLoading(false);
      setIsStreaming(false);
      abortControllerRef.current = null;
    }
  };

  const handleTabClick = (selectedChatId: string) => {
    navigate(`/connections/${connectionId}/chat/${selectedChatId}`);
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

  // Create display messages array that includes streaming messages
  const displayMessages = [...currentMessages, ...streamingToolMessages];

  return (
    <>
      <div className="flex flex-col h-full bg-white dark:bg-gray-950 transition-colors">
        {/* Fixed Header with Connection Info */}
        <ChatHeader
          connectionName={currentConnection?.name}
          messageCount={currentMessages.length}
          enabledToolsCount={enabledConnectionTools.length}
          disabledToolsCount={disabledToolsCount}
          isConnected={currentConnection?.isConnected}
          showApiWarning={showApiWarning}
          streamingEnabled={streamingEnabled}
          onStreamingToggle={handleStreamingToggle}
          isLoading={isLoading}
          isStreaming={isStreaming}
        />

        {/* Fixed Chat Tabs with Delete Buttons and Clear All Button */}
        {connectionConversations.length > 0 && (
          <ChatTabs
            conversations={connectionConversations}
            currentChatId={chatId}
            onTabClick={handleTabClick}
            onDeleteChat={handleDeleteChat}
            onNewChat={() => handleNewChat()}
            onClearAllChats={handleClearAllChats}
            isLoading={isLoading}
            isStreaming={isStreaming}
          />
        )}

        {/* Fixed API Key Warning */}
        {showApiWarning && (
          <ApiWarning onConfigure={() => setIsSettingsOpen(true)} />
        )}

        {/* Tool Status Warning */}
        {disabledToolsCount > 0 && !showApiWarning && (
          <ToolStatusWarning disabledToolsCount={disabledToolsCount} />
        )}

        {/* Scrollable Messages Container */}
        <div className="flex-1 overflow-y-auto min-h-0">
          <div className="h-full">
            <div className="max-w-4xl mx-auto px-6 py-8 min-h-full">
              {displayMessages.length === 0 && !currentStreamingContent ? (
                <EmptyState
                  showApiWarning={showApiWarning}
                  connectionName={currentConnection?.name}
                  enabledToolsCount={enabledConnectionTools.length}
                  disabledToolsCount={disabledToolsCount}
                  streamingEnabled={streamingEnabled}
                  onConfigure={() => setIsSettingsOpen(true)}
                />
              ) : (
                <div className="space-y-6">
                  {Array.isArray(displayMessages) &&
                    displayMessages
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
                        <ChatMessageComponent
                          key={msg.id || `msg-${index}`}
                          message={msg}
                          index={index}
                          connectionId={connectionId}
                          isExpanded={isToolCallExpanded(
                            msg.id || `msg-${index}`
                          )}
                          onToolCallExpand={handleToolCallExpand}
                          isToolEnabled={(toolName: string) =>
                            connectionId
                              ? isToolEnabled(connectionId, toolName)
                              : true
                          }
                        />
                      ))}

                  {/* Show streaming message if active */}
                  {(isStreaming ||
                    currentStreamingContent ||
                    streamingStatus) && (
                    <StreamingMessage
                      content={currentStreamingContent}
                      status={streamingStatus}
                    />
                  )}

                  <div ref={messagesEndRef} />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Fixed Input */}
        <ChatInput
          value={messageInput}
          onChange={setMessageInput}
          onSend={handleSendMessage}
          disabled={showApiWarning || isLoading || isStreaming}
          connectionName={currentConnection?.name}
          enabledToolsCount={enabledConnectionTools.length}
          disabledToolsCount={disabledToolsCount}
          streamingEnabled={streamingEnabled}
          isConnected={currentConnection?.isConnected}
          isLoading={isLoading}
          isStreaming={isStreaming}
          streamingStatus={streamingStatus}
        />
      </div>

      {/* Settings Modal */}
      <SettingsModal isOpen={isSettingsOpen} onClose={handleSettingsClose} />
    </>
  );
};
