/* eslint-disable jsx-a11y/no-static-element-interactions */
/* eslint-disable jsx-a11y/click-events-have-key-events */
import React from "react";
import { LucideIcon } from "lucide-react";
import { Tool } from "@mcpconnect/schemas";

export interface ToolItemProps extends Tool {
  icon?: LucideIcon;
  onClick?: () => void;
  isSelected?: boolean; // Add selection state prop
}

export const ToolItem: React.FC<ToolItemProps> = ({
  name,
  description,
  icon: Icon,
  onClick,
  isSelected = false, // Default to false
}) => (
  <div
    onClick={onClick}
    className={`p-3 border rounded-lg cursor-pointer transition-colors ${
      isSelected
        ? "bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800" // Selected styles
        : "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700" // Default styles
    }`}
  >
    <div className="flex items-center gap-3">
      {Icon && (
        <div
          className={`w-8 h-8 rounded-md flex items-center justify-center ${
            isSelected
              ? "bg-blue-100 dark:bg-blue-900/40" // Selected icon background
              : "bg-orange-100 dark:bg-orange-900/30" // Default icon background
          }`}
        >
          <Icon
            className={`w-4 h-4 ${
              isSelected
                ? "text-blue-600 dark:text-blue-400" // Selected icon color
                : "text-orange-600 dark:text-orange-400" // Default icon color
            }`}
          />
        </div>
      )}
      <div className="flex-1">
        <div
          className={`font-medium text-sm ${
            isSelected
              ? "text-blue-900 dark:text-blue-100" // Selected text color
              : "text-gray-900 dark:text-white" // Default text color
          }`}
        >
          {name}
        </div>
        <div
          className={`text-xs ${
            isSelected
              ? "text-blue-600 dark:text-blue-300" // Selected description color
              : "text-gray-500 dark:text-gray-400" // Default description color
          }`}
        >
          {description}
        </div>
      </div>
    </div>
  </div>
);
