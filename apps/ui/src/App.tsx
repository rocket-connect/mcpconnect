// apps/ui/src/App.tsx
import { useState } from "react";
import { NetworkInspector, MCPLayout } from "@mcpconnect/components";
import { Tool } from "@mcpconnect/schemas";
import {
  Header,
  Sidebar,
  ChatInterface,
  ToolInterface,
  ModeToggle,
} from "./components";
import { useStorage } from "./contexts/StorageContext";

function App() {
  const [activeMode, setActiveMode] = useState<"chat" | "tools">("chat");
  const [selectedTool, setSelectedTool] = useState<Tool | null>(null);

  const {
    connections,
    tools,
    resources,
    chatMessages,
    toolExecutions,
    isLoading,
    error,
  } = useStorage();

  const handleToolSelect = (tool: Tool) => {
    setSelectedTool(tool);
  };

  const handleModeChange = (mode: "chat" | "tools" | "inspector" | "split") => {
    if (mode === "chat" || mode === "tools") {
      setActiveMode(mode);
    }
  };

  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 transition-colors">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">
            Loading MCPConnect...
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 transition-colors">
        <div className="text-center max-w-md mx-auto p-6">
          <div className="text-red-500 mb-4">
            <svg
              className="w-12 h-12 mx-auto"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
              />
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            Storage Error
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-4">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            Reload App
          </button>
        </div>
      </div>
    );
  }

  return (
    <MCPLayout
      header={<Header />}
      sidebar={
        <Sidebar
          connections={connections}
          tools={tools}
          resources={resources}
          onToolSelect={handleToolSelect}
        />
      }
      inspector={
        <div className="p-4 bg-gray-50 dark:bg-gray-800 transition-colors h-full">
          <NetworkInspector executions={toolExecutions} />
        </div>
      }
    >
      <ModeToggle activeMode={activeMode} onModeChange={handleModeChange} />

      {activeMode === "chat" ? (
        <ChatInterface chatMessages={chatMessages} />
      ) : (
        <ToolInterface selectedTool={selectedTool} />
      )}
    </MCPLayout>
  );
}

export default App;
