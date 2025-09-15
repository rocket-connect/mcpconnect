// apps/ui/src/components/ChatInterface.tsx - Fixed auto-chat creation and LLM prompting
import { Button } from "@mcpconnect/components";
import { ChatMessage as ChatMessageType } from "@mcpconnect/schemas";
import { useParams, useNavigate } from "react-router-dom";
import { Send, ExternalLink, Plus, Loader, X, Settings } from "lucide-react";
import { useState, useRef, useEffect, useCallback } from "react";
import { useStorage } from "../contexts/StorageContext";
import { useInspector } from "../contexts/InspectorProvider";
import { ModelService, LLMSettings } from "../services/modelService";
import { MCPIntrospectionService } from "../services/mcpIntrospectionService";
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
    toolExecutions,
    refreshAll,
  } = useStorage();
  const { expandedToolCall: inspectorExpandedTool, syncToolCallState } =
    useInspector();

  // Local state for UI interactions
  const [messageInput, setMessageInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [llmSettings, setLlmSettings] = useState<LLMSettings | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isCreatingChat, setIsCreatingChat] = useState(false);
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
  const connectionConversations = connectionId
    ? conversations[connectionId] || []
    : [];

  // Find conversation by ID instead of index
  const currentConversation =
    chatId && chatId !== "new"
      ? connectionConversations.find(conv => conv.id === chatId)
      : connectionConversations[0];

  const currentMessages = currentConversation?.messages || [];
  const connectionTools = connectionId ? tools[connectionId] || [] : [];

  // Auto-create chat for new connections or when chatId is "new"
  useEffect(() => {
    const createInitialChatIfNeeded = async () => {
      if (!connectionId || isCreatingChat) return;

      // If chatId is "new" or no conversations exist for this connection
      if (chatId === "new" || connectionConversations.length === 0) {
        setIsCreatingChat(true);
        try {
          await handleNewChat(true); // true = isAutoCreated
        } catch (error) {
          console.error("Failed to auto-create chat:", error);
        } finally {
          setIsCreatingChat(false);
        }
      }
    };

    createInitialChatIfNeeded();
  }, [connectionId, chatId, connectionConversations.length, isCreatingChat]);

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

        // Navigate to the new chat
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
          // Create a new chat if we just deleted the last one
          await handleNewChat();
        }
      }
    } catch (error) {
      console.error("Failed to delete chat:", error);
    }
  };

  // Execute MCP tool
  const executeTool = async (
    toolName: string,
    toolArgs: Record<string, any>
  ): Promise<any> => {
    if (!currentConnection) {
      throw new Error("No connection available");
    }

    try {
      console.log(`Executing tool ${toolName} with args:`, toolArgs);

      const result = await MCPIntrospectionService.executeTool(
        currentConnection,
        toolName,
        toolArgs
      );

      return result;
    } catch (error) {
      console.error(`Tool execution failed for ${toolName}:`, error);
      throw error;
    }
  };

  // FIXED: Proper tool execution storage update
  const updateToolExecutionInStorage = async (execution: any) => {
    if (!connectionId) return;

    try {
      // Get current executions
      const currentExecutions = toolExecutions[connectionId] || [];

      // Update or add the execution
      const existingIndex = currentExecutions.findIndex(
        exec => exec.id === execution.id
      );
      let updatedExecutions;

      if (existingIndex !== -1) {
        // Update existing execution
        updatedExecutions = [...currentExecutions];
        updatedExecutions[existingIndex] = {
          ...updatedExecutions[existingIndex],
          ...execution,
        };
      } else {
        // Add new execution
        updatedExecutions = [...currentExecutions, execution];
      }

      // Update in localStorage with proper structure
      const toolExecutionsData = {
        ...toolExecutions,
        [connectionId]: updatedExecutions,
      };

      localStorage.setItem(
        "mcpconnect:toolExecutions",
        JSON.stringify({
          key: "toolExecutions",
          value: toolExecutionsData,
          metadata: {
            createdAt: new Date(),
            updatedAt: new Date(),
            size: JSON.stringify(toolExecutionsData).length,
            type: "object",
          },
        })
      );

      // FIXED: Force refresh of all data to sync state
      await refreshAll();
    } catch (error) {
      console.error("Failed to update tool execution:", error);
    }
  };

  // FIXED: Enhanced Claude API call with proper tool execution tracking
  const callClaudeWithTools = async (
    messages: ChatMessageType[]
  ): Promise<{ response: string; toolExecutions: ChatMessageType[] }> => {
    if (!llmSettings) throw new Error("No LLM settings configured");

    // Convert messages to Claude format - filter out tool execution messages for API
    const claudeMessages = messages
      .filter(
        msg =>
          msg.message &&
          msg.message.trim() &&
          !msg.executingTool &&
          !msg.toolExecution
      )
      .map(msg => ({
        role: msg.isUser ? "user" : ("assistant" as const),
        content: msg.message || "",
      }));

    // Convert available tools to Claude format
    const claudeTools = connectionTools.map(tool => ({
      name: tool.name,
      description: tool.description,
      input_schema: tool.inputSchema || {
        type: "object",
        properties: {},
        required: [],
      },
    }));

    const requestBody = {
      model: llmSettings.model,
      max_tokens: llmSettings.maxTokens,
      temperature: llmSettings.temperature,
      messages: claudeMessages,
      ...(claudeTools.length > 0 && { tools: claudeTools }),
    };

    console.log("Sending request to Claude with tools:", {
      messageCount: claudeMessages.length,
      toolCount: claudeTools.length,
    });

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "anthropic-version": "2023-06-01",
        "anthropic-dangerous-direct-browser-access": "true",
        "x-api-key": llmSettings.apiKey,
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `API request failed: ${response.status} ${response.statusText}: ${errorText}`
      );
    }

    const data = await response.json();
    console.log("Claude response:", data);

    const toolExecutionMessages: ChatMessageType[] = [];

    // Handle tool use
    if (data.content) {
      let responseText = "";
      const toolResults: any[] = [];

      for (const content of data.content) {
        if (content.type === "text") {
          responseText += content.text;
        } else if (content.type === "tool_use") {
          // Execute the tool
          const toolName = content.name;
          const toolArgs = content.input;
          const toolCallId = content.id;
          const executionId = nanoid();

          console.log(`Claude wants to use tool: ${toolName}`, toolArgs);

          // FIXED: Create complete tool execution entry for storage
          const baseExecution = {
            id: executionId,
            tool: toolName,
            status: "pending" as const,
            duration: 0,
            timestamp: new Date().toLocaleTimeString(),
            request: {
              tool: toolName,
              arguments: toolArgs,
              timestamp: new Date().toISOString(),
            },
          };

          try {
            // Create tool execution message
            const toolMessage: ChatMessageType = {
              id: executionId,
              isUser: false,
              executingTool: toolName,
              timestamp: new Date(),
              toolExecution: {
                toolName,
                status: "pending",
              },
              isExecuting: true,
            };

            toolExecutionMessages.push(toolMessage);

            // FIXED: Store the execution immediately with pending status
            await updateToolExecutionInStorage(baseExecution);

            const startTime = Date.now();

            // Execute the tool
            const toolResult = await executeTool(toolName, toolArgs);
            const endTime = Date.now();
            const duration = endTime - startTime;

            // Extract the actual result text from MCP response
            let resultText = "";
            if (toolResult?.content?.[0]?.text) {
              try {
                const parsedResult = JSON.parse(toolResult.content[0].text);
                resultText = JSON.stringify(parsedResult, null, 2);
              } catch {
                resultText = toolResult.content[0].text;
              }
            } else {
              resultText = JSON.stringify(toolResult, null, 2);
            }

            // FIXED: Update with complete success execution data
            const successExecution = {
              ...baseExecution,
              status: "success" as const,
              duration,
              response: {
                success: true,
                result: toolResult,
                timestamp: new Date().toISOString(),
              },
            };

            await updateToolExecutionInStorage(successExecution);

            // Update the tool execution message with results
            const completedToolMessage: ChatMessageType = {
              ...toolMessage,
              toolExecution: {
                toolName,
                status: "success",
                result: toolResult,
              },
              isExecuting: false,
            };

            // Replace in the executions array
            const execIndex = toolExecutionMessages.findIndex(
              msg => msg.id === executionId
            );
            if (execIndex !== -1) {
              toolExecutionMessages[execIndex] = completedToolMessage;
            }

            // Add tool result in the correct format for Anthropic
            toolResults.push({
              tool_use_id: toolCallId,
              type: "tool_result",
              content: resultText,
            });
          } catch (error) {
            console.error(`Tool execution failed:`, error);
            const endTime = Date.now();

            // FIXED: Store error execution
            const errorExecution = {
              ...baseExecution,
              status: "error" as const,
              duration: endTime - Date.now(),
              error: error instanceof Error ? error.message : String(error),
            };

            await updateToolExecutionInStorage(errorExecution);

            // Create error message
            const errorMessage: ChatMessageType = {
              id: executionId,
              isUser: false,
              executingTool: toolName,
              timestamp: new Date(),
              toolExecution: {
                toolName,
                status: "error",
                error: error instanceof Error ? error.message : String(error),
              },
              isExecuting: false,
            };

            // Replace in executions array
            const execIndex = toolExecutionMessages.findIndex(
              msg => msg.id === executionId
            );
            if (execIndex !== -1) {
              toolExecutionMessages[execIndex] = errorMessage;
            } else {
              toolExecutionMessages.push(errorMessage);
            }

            toolResults.push({
              tool_use_id: toolCallId,
              type: "tool_result",
              content: `Error: ${error instanceof Error ? error.message : String(error)}`,
            });
          }
        }
      }

      // If tools were used, send results back to Claude
      if (toolResults.length > 0) {
        console.log("Sending tool results back to Claude:", toolResults);

        const followUpMessages = [
          ...claudeMessages,
          {
            role: "assistant" as const,
            content: data.content,
          },
          {
            role: "user" as const,
            content: toolResults,
          },
        ];

        try {
          const followUpResponse = await fetch(
            "https://api.anthropic.com/v1/messages",
            {
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
                messages: followUpMessages,
                tools: claudeTools,
              }),
            }
          );

          if (followUpResponse.ok) {
            const followUpData = await followUpResponse.json();
            responseText =
              followUpData.content?.[0]?.text ||
              responseText ||
              "Tool executed successfully.";
          } else {
            const errorText = await followUpResponse.text();
            console.error("Follow-up request failed:", errorText);
            responseText =
              responseText ||
              "Tool executed, but failed to get follow-up response.";
          }
        } catch (followUpError) {
          console.error("Follow-up request error:", followUpError);
          responseText = responseText || "Tool executed successfully.";
        }
      }

      return {
        response: responseText || "Tool executed successfully.",
        toolExecutions: toolExecutionMessages,
      };
    }

    return {
      response: "No response received",
      toolExecutions: [],
    };
  };

  // FIXED: Enhanced message sending with proper state management
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

      // Create assistant thinking message with unique ID
      const thinkingMessageId = nanoid();
      const thinkingMessage: ChatMessageType = {
        id: thinkingMessageId,
        message: "",
        isUser: false,
        timestamp: new Date(),
        isExecuting: true,
      };

      const messagesWithThinking = [...updatedMessages, thinkingMessage];
      await updateConversationMessages(messagesWithThinking);

      // Call Claude with tool support - pass only the actual conversation messages
      const conversationMessages = updatedMessages.filter(
        m => m.message && !m.isExecuting
      );
      const { response, toolExecutions } =
        await callClaudeWithTools(conversationMessages);

      // FIXED: Remove thinking message and build final message array
      let finalMessages = [...updatedMessages]; // Start with user message only

      // Add all tool execution messages (safely check if array exists)
      if (
        toolExecutions &&
        Array.isArray(toolExecutions) &&
        toolExecutions.length > 0
      ) {
        finalMessages = [...finalMessages, ...toolExecutions];
      }

      // Add final assistant response (not the thinking message)
      const assistantMessage: ChatMessageType = {
        id: nanoid(), // New ID for the actual response
        message: response,
        isUser: false,
        timestamp: new Date(),
        isExecuting: false,
      };

      finalMessages.push(assistantMessage);

      // Save all messages at once - this removes the thinking message
      await updateConversationMessages(finalMessages);
    } catch (error) {
      console.error("Failed to send message:", error);

      // FIXED: Replace thinking message with error, don't add to existing messages
      const errorMessage: ChatMessageType = {
        id: nanoid(),
        message:
          "Sorry, I encountered an error. Please check your API settings and try again.",
        isUser: false,
        timestamp: new Date(),
        isExecuting: false,
      };

      // Remove any thinking messages and add error
      const cleanMessages = [...currentMessages, userMessage];
      const errorMessages = [...cleanMessages, errorMessage];
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

    const updatedConnectionConversations = connectionConversations.map(conv =>
      conv.id === currentConversation.id ? updatedConversation : conv
    );

    const allConversations = {
      ...conversations,
      [connectionId]: updatedConnectionConversations,
    };

    await updateConversations(allConversations);
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

    // FIXED: Don't render messages that are just thinking without content
    if (message.isExecuting && !message.message && !hasToolExecution) {
      return null; // Skip empty thinking messages
    }

    return (
      <div className="group relative">
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
                      : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 text-gray-500"
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

  // Show loading if creating chat
  if (isCreatingChat) {
    return (
      <div className="flex-1 flex items-center justify-center bg-white dark:bg-gray-950 transition-colors">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">
            Setting up your chat...
          </p>
        </div>
      </div>
    );
  }

  // Show API key warning if not configured
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
                <span>{connectionTools.length} tools available</span>
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

            {/* Settings button for quick LLM config */}
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

        {/* Scrollable Messages Container - This is the key fix */}
        <div className="flex-1 overflow-y-auto min-h-0">
          <div className="h-full">
            <div className="max-w-4xl mx-auto px-6 py-8 min-h-full">
              {currentMessages.length === 0 ? (
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
                        : `Start chatting with Claude about ${currentConnection?.name}. ${connectionTools.length} tools are available.`}
                    </p>
                    {showApiWarning && (
                      <button
                        onClick={() => setIsSettingsOpen(true)}
                        className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                      >
                        Configure Claude
                      </button>
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
                      ) // Filter out empty thinking messages
                      .map((msg, index) => (
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
                      ? `Message Claude about ${currentConnection.name}... (${connectionTools.length} tools available)`
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

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => {
          setIsSettingsOpen(false);
          // Reload LLM settings after modal closes
          const settings = ModelService.loadSettings();
          setLlmSettings(settings);
        }}
      />
    </>
  );
};
