/* eslint-disable jsx-a11y/no-static-element-interactions */
/* eslint-disable jsx-a11y/click-events-have-key-events */
import React from "react";
import { LucideIcon } from "lucide-react";
import { Tool } from "@mcpconnect/schemas";

export interface ToolItemProps extends Tool {
  icon?: LucideIcon;
  onClick?: () => void;
}

export const ToolItem: React.FC<ToolItemProps> = ({
  name,
  description,
  icon: Icon,
  onClick,
}) => (
  <div
    onClick={onClick}
    className="p-3 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer transition-colors bg-white dark:bg-gray-800"
  >
    <div className="flex items-center gap-3">
      {Icon && (
        <div className="w-8 h-8 bg-orange-100 dark:bg-orange-900/30 rounded-md flex items-center justify-center">
          <Icon className="w-4 h-4 text-orange-600 dark:text-orange-400" />
        </div>
      )}
      <div className="flex-1">
        <div className="font-medium text-sm text-gray-900 dark:text-white">
          {name}
        </div>
        <div className="text-xs text-gray-500 dark:text-gray-400">
          {description}
        </div>
      </div>
    </div>
  </div>
);
