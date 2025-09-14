import { ChatMessage, Button } from "@mcpconnect/components";
import { ChatMessage as ChatMessageType } from "@mcpconnect/schemas";
import { Play } from "lucide-react";

interface ChatInterfaceProps {
  chatMessages: ChatMessageType[];
}

export const ChatInterface = ({ chatMessages }: ChatInterfaceProps) => (
  <div className="flex-1 flex flex-col bg-white dark:bg-gray-900 transition-colors">
    <div className="flex-1 overflow-y-auto p-6">
      <div className="max-w-2xl mx-auto">
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            Query Interface
          </h2>
          <div className="text-sm text-blue-600 dark:text-blue-400 font-medium">
            3 tools available
          </div>
        </div>

        <div className="space-y-4">
          {chatMessages.map((msg) => (
            <ChatMessage key={msg.id || `msg-${Math.random()}`} {...msg} />
          ))}
        </div>
      </div>
    </div>

    <div className="border-t border-gray-200 dark:border-gray-700 p-4 bg-gray-50 dark:bg-gray-800 transition-colors">
      <div className="max-w-2xl mx-auto">
        <div className="flex gap-3">
          <input
            type="text"
            placeholder="Type a message..."
            className="flex-1 px-4 py-2 border border-gray-200 dark:border-gray-600 rounded-lg 
                     bg-white dark:bg-gray-700
                     text-gray-900 dark:text-white
                     placeholder:text-gray-500 dark:placeholder:text-gray-400
                     focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                     transition-colors"
          />
          <Button>
            <Play className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  </div>
);