/* eslint-disable @typescript-eslint/no-explicit-any */
// packages/components/src/MCPLayout.tsx
import React, { ReactNode, useState, useEffect } from "react";
import { ChevronLeft, ChevronRight, PanelLeft, Database } from "lucide-react";

export interface MCPLayoutProps {
  children?: ReactNode;
  sidebar?: ReactNode;
  inspector?: ReactNode;
  header?: ReactNode;
}

const STORAGE_KEYS = {
  SIDEBAR_COLLAPSED: "mcpconnect-sidebar-collapsed",
  INSPECTOR_COLLAPSED: "mcpconnect-inspector-collapsed",
};

export const MCPLayout: React.FC<MCPLayoutProps> = ({
  children,
  sidebar,
  inspector,
  header,
}) => {
  // State for collapsed panels with localStorage persistence
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.SIDEBAR_COLLAPSED);
      return stored ? JSON.parse(stored) : false;
    } catch {
      return false;
    }
  });

  const [isInspectorCollapsed, setIsInspectorCollapsed] = useState(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.INSPECTOR_COLLAPSED);
      return stored ? JSON.parse(stored) : false;
    } catch {
      return false;
    }
  });

  // Persist sidebar collapsed state
  useEffect(() => {
    try {
      localStorage.setItem(
        STORAGE_KEYS.SIDEBAR_COLLAPSED,
        JSON.stringify(isSidebarCollapsed)
      );
    } catch (error) {
      console.warn("Failed to save sidebar collapsed state:", error);
    }
  }, [isSidebarCollapsed]);

  // Persist inspector collapsed state
  useEffect(() => {
    try {
      localStorage.setItem(
        STORAGE_KEYS.INSPECTOR_COLLAPSED,
        JSON.stringify(isInspectorCollapsed)
      );
    } catch (error) {
      console.warn("Failed to save inspector collapsed state:", error);
    }
  }, [isInspectorCollapsed]);

  const toggleSidebar = () => {
    setIsSidebarCollapsed((prev: any) => !prev);
  };

  const toggleInspector = () => {
    setIsInspectorCollapsed((prev: any) => !prev);
  };

  return (
    <div className="h-screen bg-gray-50 dark:bg-gray-950 flex flex-col transition-colors">
      {header}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Sidebar Section */}
        {sidebar && (
          <>
            {/* Full Sidebar */}
            <div
              className={`flex-shrink-0 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 overflow-y-auto transition-all duration-300 ease-in-out ${
                isSidebarCollapsed ? "w-0" : "w-80"
              }`}
            >
              {!isSidebarCollapsed && (
                <div className="w-80 h-full flex flex-col">
                  {/* Sidebar Header with Collapse Button */}
                  <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
                    <span className="text-sm font-medium text-gray-900 dark:text-white">
                      Navigation
                    </span>
                    <button
                      onClick={toggleSidebar}
                      className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
                      title="Hide sidebar"
                    >
                      <ChevronLeft className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                    </button>
                  </div>
                  {/* Sidebar Content */}
                  <div className="flex-1 overflow-y-auto">{sidebar}</div>
                </div>
              )}
            </div>

            {/* Collapsed Sidebar Bar */}
            {isSidebarCollapsed && (
              <div className="w-10 flex-shrink-0 bg-gray-100 dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col">
                <div className="flex-1 flex flex-col items-center justify-center space-y-6">
                  <div className="p-2 text-gray-500 dark:text-gray-400">
                    <PanelLeft className="w-5 h-5" />
                  </div>
                  <button
                    onClick={toggleSidebar}
                    className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-md transition-colors group"
                    title="Show sidebar"
                  >
                    <ChevronRight className="w-4 h-4 text-gray-600 dark:text-gray-400 group-hover:text-gray-800 dark:group-hover:text-gray-200" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}

        {/* Main Content */}
        <div className="flex-1 flex flex-col bg-white dark:bg-gray-950 overflow-hidden">
          {children}
        </div>

        {/* Inspector Section */}
        {inspector && (
          <>
            {/* Collapsed Inspector Bar */}
            {isInspectorCollapsed && (
              <div className="w-10 flex-shrink-0 bg-gray-100 dark:bg-gray-800 border-l border-gray-200 dark:border-gray-700 flex flex-col">
                <div className="flex-1 flex flex-col items-center justify-center space-y-6">
                  <div className="p-2 text-gray-500 dark:text-gray-400">
                    <Database className="w-5 h-5" />
                  </div>
                  <button
                    onClick={toggleInspector}
                    className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-md transition-colors group"
                    title="Show inspector"
                  >
                    <ChevronLeft className="w-4 h-4 text-gray-600 dark:text-gray-400 group-hover:text-gray-800 dark:group-hover:text-gray-200" />
                  </button>
                </div>
              </div>
            )}

            {/* Full Inspector */}
            <div
              className={`flex-shrink-0 border-l border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-y-auto transition-all duration-300 ease-in-out ${
                isInspectorCollapsed ? "w-0" : "w-[500px]"
              }`}
            >
              {!isInspectorCollapsed && (
                <div className="w-[500px] h-full flex flex-col">
                  {/* Inspector Header with Collapse Button */}
                  <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
                    <button
                      onClick={toggleInspector}
                      className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
                      title="Hide inspector"
                    >
                      <ChevronRight className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                    </button>
                    <span className="text-sm font-medium text-gray-900 dark:text-white">
                      Inspector
                    </span>
                  </div>
                  {/* Inspector Content */}
                  <div className="flex-1 overflow-y-auto">{inspector}</div>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};
