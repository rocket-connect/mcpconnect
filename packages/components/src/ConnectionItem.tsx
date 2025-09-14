/* eslint-disable jsx-a11y/no-static-element-interactions */
/* eslint-disable jsx-a11y/click-events-have-key-events */
import React from "react";

export interface ConnectionItemProps {
  name: string;
  url: string;
  isActive?: boolean;
  isConnected?: boolean;
  onClick?: () => void;
}

export const ConnectionItem: React.FC<ConnectionItemProps> = ({
  name,
  url,
  isActive = false,
  isConnected = true,
  onClick,
}) => (
  <div
    onClick={onClick}
    className={`p-3 rounded-lg border cursor-pointer transition-colors ${
      isActive
        ? "bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800"
        : "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700"
    }`}
  >
    <div className="flex items-center gap-3">
      <div
        className={`w-3 h-3 rounded-full ${isConnected ? "bg-green-500" : "bg-gray-400"}`}
      />
      <div className="flex-1 min-w-0">
        <div className="font-medium text-sm text-gray-900 dark:text-white">
          {name}
        </div>
        <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
          {url}
        </div>
      </div>
    </div>
  </div>
);
