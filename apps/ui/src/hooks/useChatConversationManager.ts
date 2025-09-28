import { useState, useCallback } from "react";
import { nanoid } from "nanoid";
import { ChatConversation, Connection } from "@mcpconnect/schemas";
import { useNavigate } from "react-router-dom";

export const useChatConversationManager = (
  connectionId: string | undefined,
  conversations: Record<string, ChatConversation[]>,
  updateConversations: (
    conversations: Record<string, ChatConversation[]>
  ) => Promise<void>,
  deleteChatWithCleanup: (
    connectionId: string,
    chatId: string
  ) => Promise<void>,
  clearAllChatsWithCleanup: (connectionId: string) => Promise<void>,
  refreshAll: () => Promise<void>,
  currentConnection: Connection | undefined
) => {
  const navigate = useNavigate();
  const [isCreatingChat, setIsCreatingChat] = useState(false);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const connectionConversations = connectionId
    ? conversations[connectionId] || []
    : [];

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

  const handleDeleteChat = useCallback(
    async (chatToDeleteId: string, event?: React.MouseEvent) => {
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
        await deleteChatWithCleanup(connectionId, chatToDeleteId);

        // Navigate to another chat if we deleted the current one
        const currentChatId = window.location.pathname.split("/").pop();
        if (currentChatId === chatToDeleteId) {
          const remainingChats = connectionConversations.filter(
            conv => conv.id !== chatToDeleteId
          );

          if (remainingChats.length > 0) {
            navigate(
              `/connections/${connectionId}/chat/${remainingChats[0].id}`
            );
          } else {
            await handleNewChat();
          }
        }
      } catch (error) {
        console.error("Failed to delete chat:", error);
        alert("Failed to delete chat. Please try again.");
      }
    },
    [
      connectionId,
      connectionConversations,
      deleteChatWithCleanup,
      navigate,
      handleNewChat,
    ]
  );

  const handleClearAllChats = useCallback(async () => {
    if (!connectionId) return;

    const confirmed = confirm(
      `Are you sure you want to delete all ${connectionConversations.length} chat conversations? This action cannot be undone.`
    );
    if (!confirmed) return;

    try {
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

      navigate(`/connections/${connectionId}/chat/${newChatId}`, {
        replace: true,
      });

      await refreshAll();
    } catch (error) {
      console.error("Failed to clear all chats:", error);
      alert("Failed to clear all chats. Please try again.");
    }
  }, [
    connectionId,
    connectionConversations.length,
    clearAllChatsWithCleanup,
    currentConnection?.name,
    conversations,
    updateConversations,
    navigate,
    refreshAll,
  ]);

  const handleTabClick = useCallback(
    (selectedChatId: string) => {
      if (connectionId) {
        navigate(`/connections/${connectionId}/chat/${selectedChatId}`);
      }
    },
    [connectionId, navigate]
  );

  return {
    connectionConversations,
    isCreatingChat,
    setIsCreatingChat,
    handleNewChat,
    handleDeleteChat,
    handleClearAllChats,
    handleTabClick,
  };
};
