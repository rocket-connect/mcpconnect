import React from "react";
import { Plus, X, Trash2 } from "lucide-react";
import { ChatConversation } from "@mcpconnect/schemas";

export interface ChatTabsProps {
  conversations: ChatConversation[];
  currentChatId?: string;
  onTabClick: (chatId: string) => void;
  onDeleteChat: (chatId: string, event?: React.MouseEvent) => void;
  onNewChat: () => void;
  onClearAllChats: () => void;
  isLoading: boolean;
  isStreaming: boolean;
}

export const ChatTabs: React.FC<ChatTabsProps> = ({
  conversations,
  currentChatId,
  onTabClick,
  onDeleteChat,
  onNewChat,
  onClearAllChats,
  isLoading,
  isStreaming,
}) => {
  return (
    <div className="flex-shrink-0 border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900">
      <div className="flex items-center justify-between px-6">
        <div className="flex overflow-x-auto scrollbar-hide">
          {conversations.map(conv => {
            const isActive = currentChatId === conv.id;
            return (
              <div key={conv.id} className="relative flex-shrink-0 group">
                <button
                  onClick={() => onTabClick(conv.id)}
                  className={`flex items-center px-4 py-3 pr-8 text-sm font-medium border-b-2 transition-colors ${
                    isActive
                      ? "border-blue-500 text-blue-600 dark:text-blue-400 bg-white dark:bg-gray-950"
                      : "border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600"
                  }`}
                >
                  <span className="truncate max-w-28">{conv.title}</span>
                  <span className="ml-2 text-xs opacity-60">
                    ({conv.messages.length})
                  </span>
                </button>

                {conversations.length > 1 && (
                  <button
                    onClick={e => onDeleteChat(conv.id, e)}
                    className={`absolute top-1.5 right-2 p-1 rounded transition-all duration-200 ${
                      isActive
                        ? "opacity-60 group-hover:opacity-100 text-gray-600 dark:text-gray-300 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30"
                        : "opacity-40 group-hover:opacity-100 text-gray-400 dark:text-gray-500 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30"
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

        <div className="flex items-center gap-2 flex-shrink-0 ml-4">
          {conversations.length > 1 && (
            <button
              onClick={onClearAllChats}
              className="flex items-center gap-1 p-2 text-gray-600 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
              title={`Clear all ${conversations.length} chats`}
              disabled={isLoading || isStreaming}
            >
              <Trash2 className="w-4 h-4" />
              <span className="text-xs font-medium">Clear All</span>
            </button>
          )}

          <button
            onClick={onNewChat}
            className="flex items-center gap-1 p-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
            title="Create new chat"
            disabled={isLoading || isStreaming}
          >
            <Plus className="w-4 h-4" />
            <span className="text-xs font-medium">New</span>
          </button>
        </div>
      </div>
    </div>
  );
};
