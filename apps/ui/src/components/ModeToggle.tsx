import { MessageSquare, Server } from "lucide-react";

interface ModeToggleProps {
  activeMode: string;
  onModeChange: (mode: string) => void;
}

export const ModeToggle = ({ activeMode, onModeChange }: ModeToggleProps) => (
  <div className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-3 transition-colors">
    <div className="flex gap-1">
      <button
        onClick={() => onModeChange("chat")}
        className={`px-4 py-2 text-sm font-medium rounded-md transition-colors flex items-center gap-2 ${
          activeMode === "chat"
            ? "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300"
            : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700"
        }`}
      >
        <MessageSquare className="w-4 h-4" />
        Chat Interface
      </button>
      <button
        onClick={() => onModeChange("tools")}
        className={`px-4 py-2 text-sm font-medium rounded-md transition-colors flex items-center gap-2 ${
          activeMode === "tools"
            ? "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300"
            : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700"
        }`}
      >
        <Server className="w-4 h-4" />
        Tool Mode
      </button>
    </div>
  </div>
);
