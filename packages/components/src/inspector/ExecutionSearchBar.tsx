import React from "react";
import { Search, X } from "lucide-react";

export interface ExecutionSearchBarProps {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  showDemoData: boolean;
}

export const ExecutionSearchBar: React.FC<ExecutionSearchBarProps> = ({
  searchQuery,
  setSearchQuery,
  showDemoData,
}) => {
  return (
    <div className="px-3 py-2 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <Search className="h-3.5 w-3.5 text-gray-400" />
        </div>
        <input
          type="text"
          placeholder="Search tool executions..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          disabled={showDemoData}
          className="block w-full pl-9 pr-8 py-1.5 text-xs border border-gray-200 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder:text-gray-500 dark:placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-transparent transition-colors disabled:cursor-not-allowed"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery("")}
            className="absolute inset-y-0 right-0 pr-2 flex items-center"
            type="button"
          >
            <X className="h-3 w-3 text-gray-400 hover:text-gray-600 transition-colors" />
          </button>
        )}
      </div>
    </div>
  );
};
