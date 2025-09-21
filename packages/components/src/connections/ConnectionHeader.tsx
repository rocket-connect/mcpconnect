import React from "react";
import { Plus } from "lucide-react";

export interface ConnectionHeaderProps {
  title?: string;
  description?: string;
  buttonText?: string;
  onCreateConnection: () => void;
  connectionCount?: number;
}

export const ConnectionHeader: React.FC<ConnectionHeaderProps> = ({
  title = "MCP Connections",
  description = "Connect to Model Context Protocol servers to extend your LLM's capabilities",
  buttonText = "Add Connection",
  onCreateConnection,
  connectionCount = 0,
}) => {
  return (
    <div className="flex items-center justify-between mb-8">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          {title}
          {connectionCount > 0 && (
            <span className="ml-2 text-sm font-normal text-gray-500 dark:text-gray-400">
              ({connectionCount})
            </span>
          )}
        </h2>
        <p className="text-gray-600 dark:text-gray-400">{description}</p>
      </div>
      <button
        onClick={onCreateConnection}
        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
      >
        <Plus className="w-4 h-4" />
        {buttonText}
      </button>
    </div>
  );
};
