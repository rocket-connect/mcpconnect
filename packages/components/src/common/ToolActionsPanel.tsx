import React from "react";
import { CheckCircle, XCircle, MoreHorizontal } from "lucide-react";

export interface ToolActionsPanelProps {
  enabledCount: number;
  totalCount: number;
  filteredCount: number;
  onEnableAll: () => void;
  onDisableAll: () => void;
  onToggleFiltered: () => void;
  isDemoMode?: boolean;
}

export const ToolActionsPanel: React.FC<ToolActionsPanelProps> = ({
  totalCount,
  filteredCount,
  onEnableAll,
  onDisableAll,
  onToggleFiltered,
  isDemoMode = false,
}) => {
  return (
    <div
      className={`mb-3 p-2.5 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 ${isDemoMode ? "opacity-60" : ""}`}
    >
      <div className="flex gap-1.5 mb-2">
        <button
          onClick={onEnableAll}
          disabled={isDemoMode}
          className="flex items-center gap-1 px-2 py-1 text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded hover:bg-green-200 dark:hover:bg-green-800/50 transition-colors disabled:cursor-not-allowed"
        >
          <CheckCircle className="w-3 h-3" />
          All
        </button>
        <button
          onClick={onDisableAll}
          disabled={isDemoMode}
          className="flex items-center gap-1 px-2 py-1 text-xs bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded hover:bg-red-200 dark:hover:bg-red-800/50 transition-colors disabled:cursor-not-allowed"
        >
          <XCircle className="w-3 h-3" />
          None
        </button>
        {filteredCount < totalCount && (
          <button
            onClick={onToggleFiltered}
            disabled={isDemoMode}
            className="flex items-center gap-1 px-2 py-1 text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded hover:bg-blue-200 dark:hover:bg-blue-800/50 transition-colors disabled:cursor-not-allowed"
          >
            <MoreHorizontal className="w-3 h-3" />
            Toggle
          </button>
        )}
      </div>
      <div className="text-xs text-gray-500 dark:text-gray-400">
        {isDemoMode
          ? "Demo tools (create connection to enable)"
          : "Disabled tools won't be used in chats"}
      </div>
    </div>
  );
};
