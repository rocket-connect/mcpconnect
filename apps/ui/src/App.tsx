import { useState, useEffect } from "react";
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useParams,
} from "react-router-dom";
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
import mockData from "./data/mockData";

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

  // Helper component to redirect to first chat ID using connection ID
  const ConnectionChatRedirect = () => {
    const { connectionId } = useParams<{ connectionId: string }>();

    if (!connectionId) {
      return <Navigate to="/connections" replace />;
    }

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

  // Helper component to load tool by ID within a connection context
  const ConnectionToolLoader = () => {
    const { connectionId, toolId } = useParams<{
      connectionId: string;
      toolId: string;
    }>();

    useEffect(() => {
      if (connectionId && toolId) {
        const tool = mockData.getToolById(connectionId, toolId);
        if (tool) {
          setSelectedTool(tool);
        } else {
          // If tool not found, clear selection
          setSelectedTool(null);
        }
      } else {
        // If no tool ID specified, clear selection
        setSelectedTool(null);
      }
    }, [connectionId, toolId]);

    return <ToolInterface selectedTool={selectedTool} />;
  };

  // Helper component to handle tools overview page
  const ConnectionToolsOverview = () => {
    const { connectionId } = useParams<{ connectionId: string }>();

    useEffect(() => {
      // Clear selected tool when viewing tools overview
      setSelectedTool(null);
    }, [connectionId]);

    return <ToolInterface selectedTool={null} />;
  };

  // Add debugging wrapper for routes that should have parameters
  const DebugRouteWrapper = ({ children }: { children: React.ReactNode }) => {
    return <>{children}</>;
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

          {/* Connection detail redirect to first chat using connection ID */}
          <Route
            path="/connections/:connectionId"
            element={
              <DebugRouteWrapper>
                <ConnectionChatRedirect />
              </DebugRouteWrapper>
            }
          />

          {/* Basic connection chat redirect to first chat using connection ID */}
          <Route
            path="/connections/:connectionId/chat"
            element={
              <DebugRouteWrapper>
                <ConnectionChatRedirect />
              </DebugRouteWrapper>
            }
          />

          {/* Specific chat within a connection - USING CHAT IDs */}
          <Route
            path="/connections/:connectionId/chat/:chatId"
            element={
              <DebugRouteWrapper>
                <ChatInterface />
              </DebugRouteWrapper>
            }
          />

          {/* Tool execution within a specific chat - USING CHAT IDs */}
          <Route
            path="/connections/:connectionId/chat/:chatId/tools/:toolId"
            element={
              <DebugRouteWrapper>
                <ChatInterface expandedToolCall={true} />
              </DebugRouteWrapper>
            }
          />

          {/* Connection-specific tools routes - NOW PROPERLY SCOPED TO CONNECTIONS */}
          <Route
            path="/connections/:connectionId/tools"
            element={
              <DebugRouteWrapper>
                <ConnectionToolsOverview />
              </DebugRouteWrapper>
            }
          />
          <Route
            path="/connections/:connectionId/tools/:toolId"
            element={
              <DebugRouteWrapper>
                <ConnectionToolLoader />
              </DebugRouteWrapper>
            }
          />

          {/* Connection-specific resources routes */}
          <Route
            path="/connections/:connectionId/resources"
            element={
              <DebugRouteWrapper>
                <ResourceView selectedResource={selectedResource} />
              </DebugRouteWrapper>
            }
          />
          <Route
            path="/connections/:connectionId/resources/:resourceId"
            element={
              <DebugRouteWrapper>
                <ResourceView selectedResource={selectedResource} />
              </DebugRouteWrapper>
            }
          />

          {/* Fallback - redirect any other path to connections */}
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
