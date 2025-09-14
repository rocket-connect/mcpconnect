// apps/ui/src/App.tsx - Updated routing for chat IDs
import { useState } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { MCPLayout } from "@mcpconnect/components";
import { Tool, Resource } from "@mcpconnect/schemas";
import {
  Header,
  Sidebar,
  ChatInterface,
  ToolInterface,
  ConnectionView,
  ResourceView,
} from "./components";
import { useStorage } from "./contexts/StorageContext";
import { InspectorProvider, InspectorUI } from "./contexts/InspectorProvider";

function AppContent() {
  const [selectedTool, setSelectedTool] = useState<Tool | null>(null);
  const [selectedResource, setSelectedResource] = useState<Resource | null>(
    null
  );

  const { connections, tools, resources, conversations, isLoading, error } =
    useStorage();

  const handleToolSelect = (tool: Tool) => {
    setSelectedTool(tool);
  };

  const handleResourceSelect = (resource: Resource) => {
    setSelectedResource(resource);
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

  // Helper component to redirect to first chat ID
  const ConnectionChatRedirect = ({
    connectionId,
  }: {
    connectionId: string;
  }) => {
    const connectionChats = conversations[connectionId] || [];
    const firstChatId = connectionChats[0]?.id;

    if (firstChatId) {
      return (
        <Navigate
          to={`/connections/${connectionId}/chat/${firstChatId}`}
          replace
        />
      );
    } else {
      return <Navigate to={`/connections/${connectionId}`} replace />;
    }
  };

  return (
    <InspectorProvider>
      <MCPLayout
        header={<Header />}
        sidebar={
          <Sidebar
            connections={connections}
            tools={tools}
            resources={resources}
            onToolSelect={handleToolSelect}
            onResourceSelect={handleResourceSelect}
            selectedTool={selectedTool}
          />
        }
        inspector={<InspectorUI />}
      >
        <Routes>
          {/* Default redirect to connections */}
          <Route path="/" element={<Navigate to="/connections" replace />} />

          {/* Connections overview */}
          <Route
            path="/connections"
            element={<ConnectionView connections={connections} />}
          />

          {/* Connection detail redirect to first chat */}
          <Route
            path="/connections/:id"
            element={
              <ConnectionChatRedirect
                connectionId={window.location.pathname.split("/")[2]}
              />
            }
          />

          {/* Basic connection chat redirect to first chat */}
          <Route
            path="/connections/:id/chat"
            element={
              <ConnectionChatRedirect
                connectionId={window.location.pathname.split("/")[2]}
              />
            }
          />

          {/* Specific chat within a connection - NOW USING CHAT IDs */}
          <Route
            path="/connections/:id/chat/:chatId"
            element={<ChatInterface />}
          />

          {/* Tool execution within a specific chat - NOW USING CHAT IDs */}
          <Route
            path="/connections/:id/chat/:chatId/tools/:toolId"
            element={<ChatInterface expandedToolCall={true} />}
          />

          {/* Connection-specific tools routes */}
          <Route
            path="/connections/:id/tools"
            element={<ToolInterface selectedTool={selectedTool} />}
          />
          <Route
            path="/connections/:id/tools/:toolName"
            element={<ToolInterface selectedTool={selectedTool} />}
          />

          {/* Connection-specific resources routes */}
          <Route
            path="/connections/:id/resources"
            element={<ResourceView selectedResource={selectedResource} />}
          />
          <Route
            path="/connections/:id/resources/:resourceId"
            element={<ResourceView selectedResource={selectedResource} />}
          />

          {/* Global tool routes */}
          <Route
            path="/tools"
            element={<ToolInterface selectedTool={selectedTool} />}
          />
          <Route
            path="/tools/:toolName"
            element={<ToolInterface selectedTool={selectedTool} />}
          />

          {/* Global resources routes */}
          <Route
            path="/resources"
            element={<ResourceView selectedResource={selectedResource} />}
          />
          <Route
            path="/resources/:id"
            element={<ResourceView selectedResource={selectedResource} />}
          />

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/connections" replace />} />
        </Routes>
      </MCPLayout>
    </InspectorProvider>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  );
}

export default App;
