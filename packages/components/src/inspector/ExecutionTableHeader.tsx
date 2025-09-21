import React from "react";

export const ExecutionTableHeader: React.FC = () => {
  return (
    <div className="bg-gray-100 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-3 py-2 flex-shrink-0">
      <div className="grid grid-cols-12 gap-2 text-xs font-medium text-gray-600 dark:text-gray-400">
        <div className="col-span-6 flex items-center gap-1">
          <span>Tool</span>
        </div>
        <div className="col-span-2 text-center">Status</div>
        <div className="col-span-2 text-center">Time</div>
        <div className="col-span-2 text-center">Duration</div>
      </div>
    </div>
  );
};
