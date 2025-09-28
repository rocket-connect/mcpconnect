import React from "react";
import { ExternalLink } from "lucide-react";

export interface ChatEmptyStateDisplayProps {
  type: "noConnection" | "loading" | "empty";
  connectionName?: string;
  loadingMessage?: string;
  children?: React.ReactNode; // For EmptyState component
}

export const ChatEmptyStateDisplay: React.FC<ChatEmptyStateDisplayProps> = ({
  type,
  loadingMessage = "Loading...",
  children,
}) => {
  if (type === "noConnection") {
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

  if (type === "loading") {
    return (
      <div className="flex-1 flex items-center justify-center bg-white dark:bg-gray-950 transition-colors">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">{loadingMessage}</p>
        </div>
      </div>
    );
  }

  // For "empty" type, render the children (EmptyState component)
  return (
    <div className="max-w-4xl mx-auto px-6 py-8 min-h-full">{children}</div>
  );
};
