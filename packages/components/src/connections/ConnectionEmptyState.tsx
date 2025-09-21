import React from "react";
import { Plus, ExternalLink } from "lucide-react";

export interface ConnectionEmptyStateProps {
  onCreateConnection: () => void;
  showGithubLink?: boolean;
  title?: string;
  description?: string;
  buttonText?: string;
  githubUrl?: string;
}

export const ConnectionEmptyState: React.FC<ConnectionEmptyStateProps> = ({
  onCreateConnection,
  showGithubLink = true,
  title = "No connections yet",
  description = "Create your first MCP connection to start using external tools with AI assistants",
  buttonText = "Create Connection",
  githubUrl = "https://github.com/rocket-connect/mcpconnect",
}) => {
  return (
    <div className="text-center py-12">
      <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-lg mx-auto mb-4 flex items-center justify-center">
        <ExternalLink className="w-8 h-8 text-gray-400" />
      </div>
      <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
        {title}
      </h3>
      <p className="text-gray-600 dark:text-gray-400 mb-6">{description}</p>
      <button
        onClick={onCreateConnection}
        className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
      >
        <Plus className="w-5 h-5" />
        {buttonText}
      </button>
      {showGithubLink && (
        <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Support this project on Github{" "}
            <a
              href={githubUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 dark:text-blue-400 hover:underline"
            >
              github.com/rocket-connect/mcpconnect
            </a>
          </p>
        </div>
      )}
    </div>
  );
};
