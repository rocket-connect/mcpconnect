import { ThemeToggle } from "@mcpconnect/components";
import { useTheme } from "../contexts/ThemeContext";
import { Server, Settings, Github } from "lucide-react";
import { useState } from "react";
import { SettingsModal } from "./SettingsModal";

export const Header = () => {
  const { theme, toggleTheme } = useTheme();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  return (
    <>
      <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4 transition-colors">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3">
              {/* MCPConnect Logo/Brand */}
              <div className="w-8 h-8 bg-gradient-to-br from-[#24BEE1] to-[#8F1AFE] rounded-md flex items-center justify-center">
                <Server className="w-5 h-5 text-white" />
              </div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">
                MCP Connect
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <a
              href="https://github.com/rocket-connect/mcpconnect"
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
              title="View on GitHub"
            >
              <Github className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            </a>
            <ThemeToggle theme={theme} onToggle={toggleTheme} />
            <button
              onClick={() => setIsSettingsOpen(true)}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
              title="Settings"
            >
              <Settings className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            </button>
          </div>
        </div>
      </header>

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />
    </>
  );
};
