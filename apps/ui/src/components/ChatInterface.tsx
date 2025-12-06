/* eslint-disable react-hooks/exhaustive-deps */
import { ChatMessage as ChatMessageType } from "@mcpconnect/schemas";
import { useParams, useNavigate } from "react-router-dom";
import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useStorage } from "../contexts/StorageContext";
import { useInspector } from "../contexts/InspectorProvider";
import { ModelService, LLMSettings } from "../services/modelService";
import { ChatService } from "../services/chatService";
import { SettingsModal } from "./SettingsModal";
import { ChatExportButton } from "./ChatExportButton";
import { nanoid } from "nanoid";
import {
  ChatTabs,
  ChatMessageComponent,
  StreamingMessage,
  ApiWarning,
  ToolStatusWarning,
  ChatInput,
  EmptyState,
  ChatWarningBanner,
  ChatHeaderInfo,
  ChatEmptyStateDisplay,
  ChatTokenUsageBanner,
} from "@mcpconnect/components";
import { useChatConversationWarnings } from "../hooks/useChatConversationWarnings";
import { useChatStreaming } from "../hooks/useChatStreaming";
import { useChatConversationManager } from "../hooks/useChatConversationManager";
import { useNeo4jSync } from "../hooks/useNeo4jSync";
import { createToolSelectionProvider } from "../services/mcpRagService";
import type {
  ToolSelectionProvider,
  ToolSelectionCallbacks,
} from "@mcpconnect/schemas";

interface ChatInterfaceProps {
  expandedToolCall?: boolean;
}

// Update the preserveMessageOrder function in ChatInterface.tsx

const preserveMessageOrder = (
  messages: ChatMessageType[]
): ChatMessageType[] => {
  if (!messages || messages.length === 0) return [];

  // First, filter out any truly empty messages
  const validMessages = messages.filter(msg => {
    // Keep messages that have content OR are tool execution messages
    return (
      (msg.message && msg.message.trim()) ||
      msg.toolExecution ||
      msg.executingTool ||
      msg.isExecuting
    );
  });

  // Sort by messageOrder if available, then by timestamp, then by array index
  const sortedMessages = validMessages.sort((a, b) => {
    // Primary sort: messageOrder
    if (a.messageOrder !== undefined && b.messageOrder !== undefined) {
      return a.messageOrder - b.messageOrder;
    }

    // Secondary sort: timestamp
    if (a.timestamp && b.timestamp) {
      const timeA = new Date(a.timestamp).getTime();
      const timeB = new Date(b.timestamp).getTime();
      if (timeA !== timeB) {
        return timeA - timeB;
      }
    }

    // Tertiary sort: array index (preserve original order if no other sorting available)
    const indexA = validMessages.indexOf(a);
    const indexB = validMessages.indexOf(b);
    return indexA - indexB;
  });

  // Assign proper message orders if missing (for backward compatibility)
  sortedMessages.forEach((msg, index) => {
    if (msg.messageOrder === undefined) {
      msg.messageOrder = index;
    }

    // Ensure partial flag is properly set
    if (msg.isPartial === undefined) {
      msg.isPartial = false;
    }
  });

  return sortedMessages;
};

export const ChatInterface = (_args: ChatInterfaceProps) => {
  const { connectionId, chatId } = useParams();
  const navigate = useNavigate();
  const {
    connections,
    systemTools,
    conversations,
    updateConversations,
    refreshAll,
    getAllEnabledTools,
    getEnabledTools,
    getEnabledSystemTools,
    isToolEnabled,
    isSystemToolEnabled,
    onToolStateChange,
    onSystemToolStateChange,
    deleteChatWithCleanup,
    clearAllChatsWithCleanup,
  } = useStorage();
  const { expandedToolCall: inspectorExpandedTool, syncToolCallState } =
    useInspector();

  // Local state for UI interactions
  const [messageInput, setMessageInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [streamingEnabled] = useState(true);
  const [llmSettings, setLlmSettings] = useState<LLMSettings | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isLoadingSettings, setIsLoadingSettings] = useState(true);
  const [settingsPreSelectedConnectionId, setSettingsPreSelectedConnectionId] =
    useState<string | undefined>(undefined);

  // Reactive tool state - forces re-render when tool enablement changes
  const [, setToolStateVersion] = useState(0);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Get the current connection and conversation using chat ID
  const currentConnection = connections.find(conn => conn.id === connectionId);
  const currentConversation =
    chatId && chatId !== "new"
      ? (conversations[connectionId || ""] || []).find(
          conv => conv.id === chatId
        )
      : (conversations[connectionId || ""] || [])[0];

  // In the component, replace the current messages loading with:
  const currentMessages = useMemo(
    () => preserveMessageOrder(currentConversation?.messages || []),
    [currentConversation?.messages]
  );

  // Get last used tools from the most recent user message with semantic search data
  const lastUsedTools = useMemo(() => {
    // Find the most recent user message with semantic search results
    const messagesWithSearch = currentMessages
      .filter(msg => msg.isUser && msg.semanticSearch?.relevantTools?.length)
      .reverse();

    if (messagesWithSearch.length > 0) {
      return messagesWithSearch[0].semanticSearch?.relevantTools || [];
    }
    return [];
  }, [currentMessages]);

  // Initialize hooks
  const { getWarnings, confirmLongConversation, confirmManyTools } =
    useChatConversationWarnings();

  // Neo4j semantic search sync state
  const { isVectorized: hasVectorSearch } = useNeo4jSync(connectionId);

  // IMPORTANT: When saving messages, preserve order
  const updateConversationMessages = useCallback(
    async (messages: ChatMessageType[]) => {
      if (!connectionId || !currentConversation) return;

      // Ensure message order is preserved before saving
      const orderedMessages = messages.map((msg, index) => ({
        ...msg,
        messageOrder: msg.messageOrder ?? index,
      }));

      const updatedConversation = {
        ...currentConversation,
        messages: orderedMessages,
        updatedAt: new Date(),
      };

      const connectionConversations = conversations[connectionId] || [];
      const updatedConnectionConversations = connectionConversations.map(
        conv =>
          conv.id === currentConversation.id ? updatedConversation : conv
      );

      const allConversations = {
        ...conversations,
        [connectionId]: updatedConnectionConversations,
      };

      await updateConversations(allConversations);
    },
    [connectionId, currentConversation, conversations, updateConversations]
  );

  const {
    streamingState,
    updateRefs,
    resetStreamingState,
    startStreaming,
    handleStreamingEvent,
    setIsStreaming,
    resetTokenUsage,
    initializeTokenUsageForStreaming,
  } = useChatStreaming(updateConversationMessages, refreshAll);

  const {
    connectionConversations,
    isCreatingChat,
    setIsCreatingChat,
    handleNewChat,
    handleDeleteChat,
    handleClearAllChats,
    handleTabClick,
  } = useChatConversationManager(
    connectionId,
    conversations,
    updateConversations,
    deleteChatWithCleanup,
    clearAllChatsWithCleanup,
    refreshAll,
    currentConnection
  );

  // Tool navigation handler
  const handleToolNavigate = useCallback(
    (toolId: string, args?: Record<string, any>) => {
      if (!connectionId) return;

      // Create URL with encoded parameters
      const searchParams = new URLSearchParams();

      if (args && Object.keys(args).length > 0) {
        // Encode each argument as a URL parameter
        Object.entries(args).forEach(([key, value]) => {
          try {
            // JSON stringify and encode the value to preserve type information
            const encodedValue = encodeURIComponent(JSON.stringify(value));
            searchParams.set(key, encodedValue);
          } catch (error) {
            // Fallback to string if JSON stringify fails
            console.warn(`Failed to encode argument ${key}:`, error);
            searchParams.set(key, encodeURIComponent(String(value)));
          }
        });
      }

      // Navigate with or without query parameters
      const baseUrl = `/connections/${connectionId}/tools/${toolId}`;
      const finalUrl = searchParams.toString()
        ? `${baseUrl}?${searchParams.toString()}`
        : baseUrl;

      navigate(finalUrl);
    },
    [connectionId, navigate]
  );

  // Update streaming refs
  useEffect(() => {
    updateRefs(conversations, connectionId, chatId);
  }, [conversations, connectionId, chatId, updateRefs]);

  // Reset streaming token usage when connection or chat changes
  useEffect(() => {
    resetTokenUsage();
  }, [connectionId, chatId, resetTokenUsage]);

  // Derive token usage for display - saved conversation data is the source of truth
  // We only show streaming state tokens when actively streaming in the CURRENT chat
  // Token usage is scoped to each specific connection/chat - never show cross-chat tokens
  //
  // Extract the specific conversation's token usage here for proper dependency tracking.
  // This ensures React re-computes when the specific chat's data changes.
  const currentChatTokenUsage = useMemo(() => {
    if (!connectionId || !chatId || chatId === "new") {
      return { tokenUsage: undefined, messageCount: 0 };
    }
    const connectionConvos = conversations[connectionId] || [];
    const matchingConvo = connectionConvos.find(c => c.id === chatId);
    return {
      tokenUsage: matchingConvo?.tokenUsage,
      messageCount: matchingConvo?.messages?.length || 0,
    };
  }, [conversations, connectionId, chatId]);

  // Check if streaming is happening for THIS specific chat
  // This prevents token bleeding between chats when switching tabs
  const isStreamingForCurrentChat =
    streamingState.isStreaming &&
    streamingState.streamingForConnectionId === connectionId &&
    streamingState.streamingForChatId === chatId;

  const displayTokenUsage = useMemo(() => {
    // Must have valid connection and chat
    if (!connectionId || !chatId || chatId === "new") {
      return {
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
        scopedMessageCount: 0,
      };
    }

    const savedUsage = currentChatTokenUsage.tokenUsage;
    const savedTokens = savedUsage?.totalTokens || 0;
    const scopedMessageCount = currentChatTokenUsage.messageCount;

    // If no messages in this chat, don't show any token usage
    if (scopedMessageCount === 0) {
      return {
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
        scopedMessageCount: 0,
      };
    }

    // ONLY use streaming state when actively streaming for THIS SPECIFIC chat
    // The streaming state tracks which connectionId/chatId it belongs to
    // This prevents stale values from showing when switching between chats
    if (
      isStreamingForCurrentChat &&
      streamingState.tokenUsage.totalTokens > 0
    ) {
      return {
        promptTokens: streamingState.tokenUsage.promptTokens,
        completionTokens: streamingState.tokenUsage.completionTokens,
        totalTokens: streamingState.tokenUsage.totalTokens,
        scopedMessageCount,
      };
    }

    // Not streaming for this chat - use ONLY saved conversation data
    // This is the authoritative source when not actively streaming
    if (savedTokens > 0) {
      return {
        promptTokens: savedUsage!.promptTokens,
        completionTokens: savedUsage!.completionTokens,
        totalTokens: savedUsage!.totalTokens,
        scopedMessageCount,
      };
    }

    return {
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
      scopedMessageCount,
    };
  }, [
    connectionId,
    chatId,
    currentChatTokenUsage,
    isStreamingForCurrentChat,
    streamingState.tokenUsage.promptTokens,
    streamingState.tokenUsage.completionTokens,
    streamingState.tokenUsage.totalTokens,
  ]);

  // Save token usage to conversation when streaming completes with new tokens
  useEffect(() => {
    if (
      !connectionId ||
      !chatId ||
      chatId === "new" ||
      !currentConversation ||
      streamingState.tokenUsage.totalTokens === 0
    )
      return;

    // CRITICAL: Only save tokens if they actually belong to THIS chat
    // This prevents token bleeding when switching between chats
    // The streaming state tracks which chat the tokens were accumulated for
    if (
      streamingState.streamingForConnectionId !== connectionId ||
      streamingState.streamingForChatId !== chatId
    ) {
      return;
    }

    // Only save if token usage has actually changed from what's saved
    const savedUsage = currentConversation.tokenUsage;
    const currentUsage = streamingState.tokenUsage;

    if (savedUsage?.totalTokens === currentUsage.totalTokens) return;

    const updatedConversation = {
      ...currentConversation,
      tokenUsage: {
        promptTokens: currentUsage.promptTokens,
        completionTokens: currentUsage.completionTokens,
        totalTokens: currentUsage.totalTokens,
        lastUpdated: currentUsage.lastUpdated || new Date(),
      },
      updatedAt: new Date(),
    };

    const connectionConvos = conversations[connectionId] || [];
    const updatedConnectionConversations = connectionConvos.map(conv =>
      conv.id === currentConversation.id ? updatedConversation : conv
    );

    const allConversations = {
      ...conversations,
      [connectionId]: updatedConnectionConversations,
    };

    updateConversations(allConversations);
  }, [
    streamingState.tokenUsage.totalTokens,
    streamingState.streamingForConnectionId,
    streamingState.streamingForChatId,
    connectionId,
    chatId,
    currentConversation,
    conversations,
    updateConversations,
  ]);

  // Get enabled tools reactively - this will update when toolStateVersion changes
  const enabledConnectionTools = connectionId
    ? getEnabledTools(connectionId)
    : [];
  const enabledSystemTools = getEnabledSystemTools();

  // Calculate tool counts
  const totalEnabledToolsCount =
    enabledConnectionTools.length + enabledSystemTools.length;
  const totalDisabledToolsCount =
    (connectionId
      ? // eslint-disable-next-line react-hooks/rules-of-hooks
        (useStorage().tools[connectionId] || []).length -
        enabledConnectionTools.length
      : 0) +
    (systemTools.length - enabledSystemTools.length);

  // Load LLM settings on mount
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

  // Listen for tool state changes
  useEffect(() => {
    const cleanups: (() => void)[] = [];

    if (connectionId) {
      const mcpCleanup = onToolStateChange(changedConnectionId => {
        if (changedConnectionId === connectionId) {
          setToolStateVersion(prev => prev + 1);
        }
      });
      cleanups.push(mcpCleanup);
    }

    const systemCleanup = onSystemToolStateChange(() => {
      setToolStateVersion(prev => prev + 1);
    });
    cleanups.push(systemCleanup);

    return () => {
      cleanups.forEach(cleanup => cleanup());
    };
  }, [connectionId, onToolStateChange, onSystemToolStateChange]);

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
  }, [
    conversations,
    streamingState.currentStreamingContent,
    streamingState.streamingToolMessages,
  ]);

  // Cleanup abort controller on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

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

  // Use inspector's expanded state
  const isToolCallExpanded = (messageId: string) => {
    return inspectorExpandedTool === messageId;
  };

  const handleToolCallExpand = (messageId: string, _toolName?: string) => {
    const isCurrentlyExpanded = isToolCallExpanded(messageId);
    syncToolCallState(messageId, !isCurrentlyExpanded);
  };

  // Send message with warnings and validations
  const handleSendMessage = async () => {
    if (
      !messageInput.trim() ||
      !llmSettings?.apiKey ||
      !connectionId ||
      !currentConversation ||
      !currentConnection ||
      isLoading ||
      streamingState.isStreaming
    ) {
      if (!llmSettings?.apiKey) {
        console.warn(
          "No API key configured. Please configure AI provider settings."
        );
      }
      return;
    }

    const allCurrentEnabledTools = getAllEnabledTools(connectionId);

    // Check warnings
    const warnings = getWarnings(
      currentMessages,
      allCurrentEnabledTools.length,
      !llmSettings?.apiKey,
      hasVectorSearch
    );

    if (warnings.showLongConversationWarning) {
      if (!confirmLongConversation(currentMessages)) return;
    }

    if (warnings.showManyToolsWarning) {
      const toolNames = allCurrentEnabledTools.map(t => t.name);
      if (!confirmManyTools(toolNames)) return;
    }

    abortControllerRef.current = new AbortController();

    try {
      setIsLoading(true);
      setIsStreaming(streamingEnabled);

      // Initialize token usage with saved conversation values before streaming
      // This ensures accumulation works correctly for existing conversations
      initializeTokenUsageForStreaming(currentConversation.tokenUsage);

      startStreaming();

      const originalMessage = messageInput.trim();
      setMessageInput("");

      // Create user message immediately and add it to the conversation
      const userMessage: ChatMessageType = {
        id: nanoid(),
        message: originalMessage,
        isUser: true,
        timestamp: new Date(),
        isExecuting: false,
        isPartial: false,
      };

      const messagesWithUser = [...currentMessages, userMessage];
      await updateConversationMessages(messagesWithUser);

      // Create tool selection provider and callbacks if vector search is enabled
      let toolSelectionProvider: ToolSelectionProvider | undefined;
      let toolSelectionCallbacks: ToolSelectionCallbacks | undefined;
      let searchId: string | null = null;
      let searchStartTime: number | null = null;

      if (hasVectorSearch && connectionId) {
        const provider = createToolSelectionProvider({
          maxTools: 10,
          connectionId,
        });
        if (provider) {
          toolSelectionProvider = provider;
          searchId = nanoid();

          // Create callbacks that emit semantic search events
          toolSelectionCallbacks = {
            onSelectionStart: async _event => {
              searchStartTime = Date.now();
              await handleStreamingEvent({
                type: "semantic_search_start",
                data: {
                  semanticSearchId: searchId!,
                },
              });
            },
            onSelectionComplete: async event => {
              const searchDuration =
                Date.now() - (searchStartTime || Date.now());

              // Convert scores Map to array of {name, score}
              const relevantTools = event.result.tools.map((tool: any) => ({
                name: tool.name,
                score: event.result.scores?.get(tool.name) ?? 0,
              }));

              await handleStreamingEvent({
                type: "semantic_search_end",
                data: {
                  relevantTools,
                  searchDuration,
                },
              });

              // Update user message with semantic search results
              const userMessageWithSearch: ChatMessageType = {
                ...userMessage,
                semanticSearch: {
                  searchId: searchId!,
                  relevantTools,
                  totalTools: event.totalCount,
                  duration: searchDuration,
                },
              };

              // Update the conversation with semantic search attached to user message
              await updateConversationMessages([
                ...currentMessages,
                userMessageWithSearch,
              ]);

              // Store semantic search as a tool execution in the network inspector
              const searchExecution = {
                id: searchId!,
                tool: "semantic_tool_search",
                status: "success" as const,
                duration: searchDuration,
                timestamp: new Date().toISOString(),
                chatId: chatId,
                request: {
                  tool: "semantic_tool_search",
                  arguments: {
                    query: originalMessage,
                    totalTools: event.totalCount,
                  },
                  timestamp: new Date(
                    searchStartTime || Date.now()
                  ).toISOString(),
                },
                response: {
                  success: true,
                  result: {
                    relevantTools,
                    toolsFound: event.selectedCount,
                    contextReduction: `${Math.round((1 - event.selectedCount / event.totalCount) * 100)}%`,
                  },
                  timestamp: new Date().toISOString(),
                },
              };

              await ChatService.storeToolExecution(
                connectionId,
                searchExecution
              );
            },
            onSelectionError: async event => {
              console.error(
                "[ChatInterface] Semantic search error:",
                event.error
              );
              // If fallback is happening, we don't need to do anything special
              // The streaming handler will use all tools
            },
            onSelectionFallback: async event => {
              console.warn(
                "[ChatInterface] Semantic search fallback:",
                event.reason
              );
              // End the semantic search with empty results to indicate fallback
              await handleStreamingEvent({
                type: "semantic_search_end",
                data: {
                  relevantTools: [],
                  searchDuration: Date.now() - (searchStartTime || Date.now()),
                },
              });
            },
          };
        }
      }

      const chatContext = {
        connection: currentConnection,
        tools: allCurrentEnabledTools,
        llmSettings,
        toolSelectionProvider,
        toolSelectionOptions: {
          maxTools: 10,
          includeHistory: true,
          fallbackToAll: true,
        },
        toolSelectionCallbacks,
      };

      if (!ChatService.validateChatContext(chatContext)) {
        throw new Error("Invalid chat context");
      }

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
        // Non-streaming implementation
        const thinkingMessage = ChatService.createThinkingMessage();
        const messagesWithThinking = [...messagesWithUser, thinkingMessage];
        await updateConversationMessages(messagesWithThinking);

        const response = await ChatService.sendMessage(
          originalMessage,
          chatContext,
          conversationMessages
        );

        let finalMessages = [...messagesWithUser];

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
        isPartial: false,
      };

      resetStreamingState();
      const errorMessages = [...currentMessages, errorMessage];
      await updateConversationMessages(errorMessages);
    } finally {
      setIsLoading(false);
      setIsStreaming(false);
      abortControllerRef.current = null;
    }
  };

  // Show connection selector if no connection selected
  if (!connectionId) {
    return <ChatEmptyStateDisplay type="noConnection" />;
  }

  // Show loading if creating chat or loading settings
  if (isCreatingChat || isLoadingSettings) {
    const loadingMessage = isCreatingChat
      ? "Setting up your chat..."
      : "Loading settings...";
    return (
      <ChatEmptyStateDisplay type="loading" loadingMessage={loadingMessage} />
    );
  }

  const showApiWarning = !llmSettings?.apiKey;

  // Get warnings for display
  const warnings = getWarnings(
    currentMessages,
    totalEnabledToolsCount,
    showApiWarning,
    hasVectorSearch
  );

  // Create display messages array that includes streaming messages
  const displayMessages = [
    ...currentMessages,
    ...streamingState.streamingToolMessages,
  ];

  return (
    <>
      <div className="flex flex-col h-full bg-white dark:bg-gray-950 transition-colors">
        {/* Fixed Header with Connection Info and Export Button */}
        <ChatHeaderInfo
          connection={currentConnection!}
          messageCount={currentMessages.length}
          totalEnabledToolsCount={totalEnabledToolsCount}
          totalDisabledToolsCount={totalDisabledToolsCount}
          showApiWarning={showApiWarning}
        >
          {currentConversation && currentMessages.length > 0 && (
            <ChatExportButton
              conversation={currentConversation}
              connectionName={currentConnection?.name || "Unknown Connection"}
              disabled={isLoading || streamingState.isStreaming}
              className="ml-4"
            />
          )}
        </ChatHeaderInfo>

        {/* Fixed Chat Tabs */}
        {connectionConversations.length > 0 && (
          <ChatTabs
            conversations={connectionConversations}
            currentChatId={chatId}
            onTabClick={handleTabClick}
            onDeleteChat={handleDeleteChat}
            onNewChat={() => handleNewChat()}
            onClearAllChats={handleClearAllChats}
            isLoading={isLoading}
            isStreaming={streamingState.isStreaming}
          />
        )}

        {/* Fixed API Key Warning */}
        {showApiWarning && (
          <ApiWarning onConfigure={() => setIsSettingsOpen(true)} />
        )}

        {/* Warning Banners */}
        {warnings.showLongConversationWarning && (
          <ChatWarningBanner
            type="longConversation"
            messageCount={warnings.messageCount}
            charCount={warnings.charCount}
          />
        )}

        {warnings.showManyToolsWarning && (
          <ChatWarningBanner
            type="manyTools"
            toolCount={warnings.toolCount}
            hasVectorSearch={hasVectorSearch}
            onEnableRag={
              !hasVectorSearch && connectionId
                ? () => {
                    setSettingsPreSelectedConnectionId(connectionId);
                    setIsSettingsOpen(true);
                  }
                : undefined
            }
          />
        )}

        {/* Tool Status Warning - only show when MCP RAG is NOT enabled */}
        {totalDisabledToolsCount > 0 &&
          !showApiWarning &&
          !warnings.showLongConversationWarning &&
          !warnings.showManyToolsWarning &&
          !hasVectorSearch && (
            <ToolStatusWarning disabledToolsCount={totalDisabledToolsCount} />
          )}

        {/* Scrollable Messages Container */}
        <div className="flex-1 overflow-y-auto min-h-0">
          <div className="h-full">
            {displayMessages.length === 0 &&
            !streamingState.currentStreamingContent ? (
              <ChatEmptyStateDisplay type="empty">
                <EmptyState
                  showApiWarning={showApiWarning}
                  connectionName={currentConnection?.name}
                  enabledToolsCount={totalEnabledToolsCount}
                  disabledToolsCount={totalDisabledToolsCount}
                  streamingEnabled={streamingEnabled}
                  onConfigure={() => setIsSettingsOpen(true)}
                />
              </ChatEmptyStateDisplay>
            ) : (
              <div className="max-w-4xl mx-auto px-6 py-8 min-h-full">
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
                          onToolNavigate={handleToolNavigate}
                          isToolEnabled={(toolName: string) => {
                            if (
                              systemTools.some(tool => tool.name === toolName)
                            ) {
                              return isSystemToolEnabled(toolName);
                            }
                            return connectionId
                              ? isToolEnabled(connectionId, toolName)
                              : true;
                          }}
                        />
                      ))}

                  {/* Show streaming message if active (but not during semantic search) */}
                  {(streamingState.isStreaming ||
                    streamingState.currentStreamingContent ||
                    streamingState.streamingStatus) &&
                    !streamingState.semanticSearch.isSearching && (
                      <StreamingMessage
                        content={streamingState.currentStreamingContent}
                        status={streamingState.streamingStatus}
                      />
                    )}

                  <div ref={messagesEndRef} />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Token Usage Banner - above input */}
        {/* Key forces remount when chat changes to ensure fresh token display */}
        <ChatTokenUsageBanner
          key={`token-banner-${connectionId}-${chatId}`}
          promptTokens={displayTokenUsage.promptTokens}
          completionTokens={displayTokenUsage.completionTokens}
          totalTokens={displayTokenUsage.totalTokens}
          messageCount={displayTokenUsage.scopedMessageCount}
          connectionId={connectionId}
          chatId={chatId}
        />

        {/* Fixed Input */}
        <ChatInput
          value={messageInput}
          onChange={setMessageInput}
          onSend={handleSendMessage}
          disabled={showApiWarning || isLoading || streamingState.isStreaming}
          connectionName={currentConnection?.name}
          enabledToolsCount={totalEnabledToolsCount}
          disabledToolsCount={totalDisabledToolsCount}
          streamingEnabled={streamingEnabled}
          isConnected={currentConnection?.isConnected}
          isLoading={isLoading}
          isStreaming={streamingState.isStreaming}
          streamingStatus={streamingState.streamingStatus}
          semanticSearch={{
            isSearching: streamingState.semanticSearch.isSearching,
            relevantToolsCount:
              streamingState.semanticSearch.relevantTools.length,
            totalTools: totalEnabledToolsCount,
            searchDuration: streamingState.semanticSearch.searchDuration,
          }}
          lastUsedTools={lastUsedTools}
        />
      </div>

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => {
          handleSettingsClose();
          setSettingsPreSelectedConnectionId(undefined);
        }}
        preSelectedConnectionId={settingsPreSelectedConnectionId}
      />
    </>
  );
};
