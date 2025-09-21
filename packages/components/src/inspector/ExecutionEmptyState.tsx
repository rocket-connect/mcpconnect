import React from "react";
import { Search } from "lucide-react";

export interface ExecutionEmptyStateProps {
  searchQuery: string;
  displayExecutionsLength: number;
  showDemoData: boolean;
  emptyStateSubtitle: string;
  onClearSearch: () => void;
}

export const ExecutionEmptyState: React.FC<ExecutionEmptyStateProps> = ({
  searchQuery,
  displayExecutionsLength,
  showDemoData,
  emptyStateSubtitle,
  onClearSearch,
}) => {
  return (
    <div className="flex items-center justify-center h-32 text-gray-500 dark:text-gray-400">
      <div className="text-center">
        <Search className="w-8 h-8 mx-auto mb-2 opacity-30" />
        <p className="text-xs">
          {searchQuery
            ? `No executions match "${searchQuery}"`
            : displayExecutionsLength === 0
              ? showDemoData
                ? "Demo tool executions will appear here"
                : emptyStateSubtitle
              : "No executions to display"}
        </p>
        {searchQuery && (
          <button
            onClick={onClearSearch}
            className="mt-2 text-xs text-blue-600 dark:text-blue-400 hover:underline"
            type="button"
          >
            Clear search
          </button>
        )}
      </div>
    </div>
  );
};
