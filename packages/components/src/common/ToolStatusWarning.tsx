import React from "react";

export interface ToolStatusWarningProps {
  disabledToolsCount: number;
}

export const ToolStatusWarning: React.FC<ToolStatusWarningProps> = ({
  disabledToolsCount,
}) => {
  return (
    <div className="flex-shrink-0 bg-blue-50 dark:bg-blue-900/20 border-b border-blue-200 dark:border-blue-800 px-6 py-2">
      <div className="flex items-center gap-2 text-sm text-blue-800 dark:text-blue-200">
        <div className="w-4 h-4 bg-blue-400 rounded-full flex items-center justify-center">
          <span className="text-xs text-blue-900">i</span>
        </div>
        <span>
          {disabledToolsCount} tool
          {disabledToolsCount === 1 ? " is" : "s are"} disabled and wont be used
          in conversations
        </span>
      </div>
    </div>
  );
};
