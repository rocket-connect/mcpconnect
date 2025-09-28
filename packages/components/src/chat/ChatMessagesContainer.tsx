import React from "react";
import { ChatMessage as ChatMessageType } from "@mcpconnect/schemas";

export interface ChatMessagesContainerProps {
  messages: ChatMessageType[];
  connectionId?: string;
  isToolCallExpanded: (messageId: string) => boolean;
  onToolCallExpand: (messageId: string, toolName?: string) => void;
  isToolEnabled: (toolName: string) => boolean;
  children?: React.ReactNode; // For streaming message component
  messagesEndRef?: React.RefObject<HTMLDivElement>;
}

export const ChatMessagesContainer: React.FC<ChatMessagesContainerProps> = ({
  messages,
  children,
  messagesEndRef,
}) => {
  return (
    <div className="flex-1 overflow-y-auto min-h-0">
      <div className="h-full">
        <div className="max-w-4xl mx-auto px-6 py-8 min-h-full">
          <div className="space-y-6">
            {Array.isArray(messages) &&
              messages
                .filter(
                  msg =>
                    !(
                      msg.isExecuting &&
                      !msg.message &&
                      !msg.executingTool &&
                      !msg.toolExecution
                    )
                )
                .map((msg, index) => {
                  // Dynamic import or render the ChatMessageComponent
                  // This would need to be imported in the actual implementation
                  return (
                    <div key={msg.id || `msg-${index}`}>
                      {/* ChatMessageComponent would be rendered here */}
                      {/* We can't import it here due to circular dependencies */}
                      {/* This will be handled in the main ChatInterface */}
                    </div>
                  );
                })}

            {children}

            <div ref={messagesEndRef} />
          </div>
        </div>
      </div>
    </div>
  );
};
