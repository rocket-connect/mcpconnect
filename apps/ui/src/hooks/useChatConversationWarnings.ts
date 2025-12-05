import { useCallback } from "react";
import { ChatMessage } from "@mcpconnect/schemas";

export interface ConversationWarnings {
  showLongConversationWarning: boolean;
  showManyToolsWarning: boolean;
  messageCount: number;
  charCount: number;
  toolCount: number;
}

export const useChatConversationWarnings = () => {
  // Function to estimate character count of conversation
  const getConversationCharCount = useCallback((messages: ChatMessage[]) => {
    return messages.reduce((count, msg) => {
      const messageText = msg.message || "";
      const toolText = msg.toolExecution?.result
        ? JSON.stringify(msg.toolExecution.result)
        : "";
      return count + messageText.length + toolText.length;
    }, 0);
  }, []);

  // Check if conversation is long
  const isConversationLong = useCallback(
    (messages: ChatMessage[]) => {
      const charCount = getConversationCharCount(messages);
      const messageCount = messages.length;

      // Warning if more than 5 messages OR more than 20,000 characters
      return messageCount > 5 || charCount > 20000;
    },
    [getConversationCharCount]
  );

  // Show confirmation dialog for long conversation
  const confirmLongConversation = useCallback(
    (messages: ChatMessage[]) => {
      const charCount = getConversationCharCount(messages);
      const messageCount = messages.length;

      return confirm(
        `⚠️ Long Conversation Warning\n\n` +
          `This conversation has ${messageCount} messages with approximately ${charCount.toLocaleString()} characters.\n\n` +
          `Sending this message will use a significant number of tokens and may result in higher API costs.\n\n` +
          `Do you want to continue?\n\n` +
          `Tip: Consider starting a new chat for better performance and lower costs.`
      );
    },
    [getConversationCharCount]
  );

  // Show confirmation dialog for many tools
  const confirmManyTools = useCallback((toolNames: string[]) => {
    const toolNamesStr = toolNames.join(", ");

    return confirm(
      `🛠️ Many Tools Available Warning\n\n` +
        `You have ${toolNames.length} tools enabled:\n${toolNamesStr}\n\n` +
        `The AI may choose to use multiple tools, which could:\n` +
        `• Take longer to process\n` +
        `• Use more API tokens\n` +
        `• Increase costs\n\n` +
        `Do you want to proceed with this message?\n\n` +
        `Tip: You can disable some tools in the sidebar if not needed.`
    );
  }, []);

  // Get warnings status
  const getWarnings = useCallback(
    (
      messages: ChatMessage[],
      toolCount: number,
      showApiWarning: boolean,
      hasVectorSearch?: boolean
    ): ConversationWarnings => {
      const messageCount = messages.length;
      const charCount = getConversationCharCount(messages);
      const longConversation = isConversationLong(messages);

      return {
        showLongConversationWarning: longConversation && !showApiWarning,
        // Don't show many tools warning if vector search (RAG) is enabled
        showManyToolsWarning:
          toolCount > 5 &&
          !showApiWarning &&
          !longConversation &&
          !hasVectorSearch,
        messageCount,
        charCount,
        toolCount,
      };
    },
    [getConversationCharCount, isConversationLong]
  );

  return {
    getConversationCharCount,
    isConversationLong,
    confirmLongConversation,
    confirmManyTools,
    getWarnings,
  };
};
