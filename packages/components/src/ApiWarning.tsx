import React from "react";

export interface ApiWarningProps {
  onConfigure: () => void;
}

export const ApiWarning: React.FC<ApiWarningProps> = ({ onConfigure }) => {
  return (
    <div className="flex-shrink-0 bg-amber-50 dark:bg-amber-900/20 border-b border-amber-200 dark:border-amber-800 px-6 py-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-amber-800 dark:text-amber-200">
          <div className="w-4 h-4 bg-amber-400 rounded-full flex items-center justify-center">
            <span className="text-xs text-amber-900">!</span>
          </div>
          <span>
            Configure your AI provider API key to start using MCP tools
          </span>
        </div>
        <button
          onClick={onConfigure}
          className="text-amber-700 dark:text-amber-300 hover:text-amber-900 dark:hover:text-amber-100 text-sm font-medium"
        >
          Configure Now
        </button>
      </div>
    </div>
  );
};
