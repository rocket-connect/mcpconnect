import React from "react";
import { Database, Sparkles } from "lucide-react";

export interface InspectorHeaderProps {
  showDemoData: boolean;
  filteredExecutionsCount: number;
  totalExecutionsCount: number;
  searchQuery: string;
}

export const InspectorHeader: React.FC<InspectorHeaderProps> = ({
  showDemoData,
  filteredExecutionsCount,
  totalExecutionsCount,
  searchQuery,
}) => {
  return (
    <div className="border-b border-gray-200 dark:border-gray-700 px-4 py-3 flex items-center justify-between bg-white dark:bg-gray-900">
      <div className="flex items-center gap-2">
        <Database className="w-4 h-4 text-gray-600 dark:text-gray-400" />
        <h3 className="font-semibold text-sm text-gray-900 dark:text-gray-100">
          Request Inspector
        </h3>
      </div>
      <div className="flex items-center gap-2">
        {showDemoData && (
          <div className="flex items-center gap-1 px-2 py-1 bg-blue-50 dark:bg-blue-900/20 rounded border border-blue-200 dark:border-blue-800">
            <Sparkles className="w-3 h-3 text-blue-600 dark:text-blue-400" />
            <span className="text-xs font-medium text-blue-700 dark:text-blue-300">
              Demo
            </span>
          </div>
        )}
        <div className="text-xs text-gray-500 dark:text-gray-400">
          {filteredExecutionsCount} of {totalExecutionsCount} requests
          {searchQuery && filteredExecutionsCount !== totalExecutionsCount && (
            <span className="ml-1 text-blue-600 dark:text-blue-400">
              (filtered)
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
