import { useState, useRef, useCallback } from "react";
import { ChatMessage as ChatMessageType } from "@mcpconnect/schemas";
import { SSEEvent } from "../services/chatService";
import { nanoid } from "nanoid";

export interface SemanticSearchState {
  isSearching: boolean;
  searchId: string | null;
  relevantTools: Array<{ name: string; score: number }>;
  searchDuration: number | null;
  startTime: number | null;
}

export interface StreamingState {
  isStreaming: boolean;
  currentStreamingContent: string;
  streamingStatus: string;
  streamingToolMessages: ChatMessageType[];
  streamingContext: {
    hasPartialMessage: boolean;
    partialMessageId: string | null;
    toolExecutionMessageIds: string[];
  };
  semanticSearch: SemanticSearchState;
}

export const useChatStreaming = (
  updateConversationMessages: (messages: ChatMessageType[]) => Promise<void>,
  refreshAll: () => Promise<void>
) => {
  const [isStreaming, setIsStreaming] = useState(false);
  const [currentStreamingContent, setCurrentStreamingContent] = useState("");
  const [streamingStatus, setStreamingStatus] = useState<string>("");
  const [streamingToolMessages, setStreamingToolMessages] = useState<
    ChatMessageType[]
  >([]);
  const [streamingContext, setStreamingContext] = useState<{
    hasPartialMessage: boolean;
    partialMessageId: string | null;
    toolExecutionMessageIds: string[];
  }>({
    hasPartialMessage: false,
    partialMessageId: null,
    toolExecutionMessageIds: [],
  });

  const [semanticSearch, setSemanticSearch] = useState<SemanticSearchState>({
    isSearching: false,
    searchId: null,
    relevantTools: [],
    searchDuration: null,
    startTime: null,
  });

  const streamingMessageRef = useRef<string>("");
  const conversationsRef = useRef<any>({});
  const connectionIdRef = useRef<string | undefined>();
  const chatIdRef = useRef<string | undefined>();

  // Update refs
  const updateRefs = useCallback(
    (conversations: any, connectionId?: string, chatId?: string) => {
      conversationsRef.current = conversations;
      connectionIdRef.current = connectionId;
      chatIdRef.current = chatId;
    },
    []
  );

  const resetStreamingState = useCallback(() => {
    setIsStreaming(false);
    setCurrentStreamingContent("");
    setStreamingStatus("");
    setStreamingToolMessages([]);
    setStreamingContext({
      hasPartialMessage: false,
      partialMessageId: null,
      toolExecutionMessageIds: [],
    });
    setSemanticSearch({
      isSearching: false,
      searchId: null,
      relevantTools: [],
      searchDuration: null,
      startTime: null,
    });
    streamingMessageRef.current = "";
  }, []);

  const startStreaming = useCallback(() => {
    setIsStreaming(true);
    setCurrentStreamingContent("");
    setStreamingStatus("");
    setStreamingToolMessages([]);
    streamingMessageRef.current = "";
    setStreamingContext({
      hasPartialMessage: false,
      partialMessageId: null,
      toolExecutionMessageIds: [],
    });
    setSemanticSearch({
      isSearching: false,
      searchId: null,
      relevantTools: [],
      searchDuration: null,
      startTime: null,
    });
  }, []);

  const handleStreamingEvent = useCallback(
    async (event: SSEEvent) => {
      switch (event.type) {
        case "thinking":
          setStreamingStatus("Your LLM is thinking...");
          setCurrentStreamingContent("");
          setStreamingContext({
            hasPartialMessage: false,
            partialMessageId: null,
            toolExecutionMessageIds: [],
          });
          break;

        case "token":
          if (event.data?.delta) {
            streamingMessageRef.current += event.data.delta;
            setCurrentStreamingContent(streamingMessageRef.current);
            setStreamingStatus("Streaming response...");
          }
          break;

        case "assistant_partial":
          if (event.data?.content) {
            // Clear token streaming when partial message arrives
            setCurrentStreamingContent("");
            streamingMessageRef.current = "";

            const partialMessageId = event.data.partialMessageId || nanoid();

            // Store the context but DON'T save the message yet
            // We'll let the message_complete event handle saving all messages in order
            setStreamingContext({
              hasPartialMessage: true,
              partialMessageId: partialMessageId,
              toolExecutionMessageIds: [],
            });

            // Show the content to the user immediately for better UX
            setCurrentStreamingContent(event.data.content);
          }
          break;

        case "tool_start":
          if (event.data?.toolName) {
            const toolMessageId = nanoid();
            const toolMessage: ChatMessageType = {
              id: toolMessageId,
              message: "",
              isUser: false,
              isPartial: false,
              isExecuting: true,
              executingTool: event.data.toolName,
              timestamp: new Date(),
              messageOrder: event.data.messageOrder,
            };

            setStreamingContext(prev => ({
              ...prev,
              toolExecutionMessageIds: [
                ...prev.toolExecutionMessageIds,
                toolMessageId,
              ],
            }));

            setStreamingToolMessages(prev => [...prev, toolMessage]);
            setStreamingStatus(`Executing ${event.data.toolName}...`);
          }
          break;

        case "tool_end":
          if (event.data?.toolName) {
            // Update the tool message to show completion in the UI
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
                    messageOrder: event?.data?.messageOrder,
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

            // Don't save individual tool messages here - let message_complete handle all saving
          }
          await refreshAll();
          break;

        case "message_complete":
          setCurrentStreamingContent("");
          setStreamingStatus("");
          streamingMessageRef.current = "";
          // Clear semantic search state when message completes
          setSemanticSearch({
            isSearching: false,
            searchId: null,
            relevantTools: [],
            searchDuration: null,
            startTime: null,
          });

          if (event.data?.assistantMessage) {
            const currentConversationId = connectionIdRef.current;
            const currentChatId = chatIdRef.current;
            const currentConversations = conversationsRef.current;

            if (!currentConversationId || !currentChatId) return;

            const latestConversations =
              currentConversations[currentConversationId] || [];
            const latestConversation = latestConversations.find(
              (conv: any) => conv.id === currentChatId
            );
            const latestMessages = latestConversation?.messages || [];

            let finalMessages = [...latestMessages];

            // Add the assistant message
            finalMessages.push(event.data.assistantMessage);

            // Add any tool execution messages
            if (
              event.data.toolExecutionMessages &&
              event.data.toolExecutionMessages.length > 0
            ) {
              finalMessages.push(...event.data.toolExecutionMessages);
            }

            // NEW: Add the final assistant message if present
            if (event.data.finalAssistantMessage) {
              finalMessages.push(event.data.finalAssistantMessage);
            }

            // Clear streaming state
            setStreamingToolMessages([]);
            setStreamingContext({
              hasPartialMessage: false,
              partialMessageId: null,
              toolExecutionMessageIds: [],
            });

            await updateConversationMessages(finalMessages);
            await refreshAll();
          }
          break;

        case "semantic_search_start":
          setSemanticSearch({
            isSearching: true,
            searchId: event.data?.semanticSearchId || nanoid(),
            relevantTools: [],
            searchDuration: null,
            startTime: Date.now(),
          });
          setStreamingStatus("Searching for relevant tools...");
          break;

        case "semantic_search_end":
          setSemanticSearch(prev => ({
            ...prev,
            isSearching: false,
            relevantTools: event.data?.relevantTools || [],
            searchDuration:
              event.data?.searchDuration ||
              (prev.startTime ? Date.now() - prev.startTime : null),
          }));
          setStreamingStatus("");
          break;

        case "error": {
          console.error("Streaming error:", event.data?.error);
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
            isPartial: false,
          };

          const currentConversationId = connectionIdRef.current;
          const currentChatId = chatIdRef.current;
          const currentConversations = conversationsRef.current;

          if (currentConversationId && currentChatId) {
            const latestConversations =
              currentConversations[currentConversationId] || [];
            const latestConversation = latestConversations.find(
              (conv: any) => conv.id === currentChatId
            );
            const latestMessages = latestConversation?.messages || [];

            const finalMessages = [...latestMessages, errorMessage];
            await updateConversationMessages(finalMessages);
          }

          setStreamingToolMessages([]);
          setStreamingContext({
            hasPartialMessage: false,
            partialMessageId: null,
            toolExecutionMessageIds: [],
          });
          setSemanticSearch({
            isSearching: false,
            searchId: null,
            relevantTools: [],
            searchDuration: null,
            startTime: null,
          });
          break;
        }
      }
    },
    [refreshAll, updateConversationMessages]
  );

  const streamingState: StreamingState = {
    isStreaming,
    currentStreamingContent,
    streamingStatus,
    streamingToolMessages,
    streamingContext,
    semanticSearch,
  };

  return {
    streamingState,
    streamingMessageRef,
    updateRefs,
    resetStreamingState,
    startStreaming,
    handleStreamingEvent,
    setIsStreaming,
  };
};
