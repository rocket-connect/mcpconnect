import { useState } from "react";
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useParams,
} from "react-router-dom";
import { MCPLayout } from "@mcpconnect/components";
import { Resource } from "@mcpconnect/schemas";
import {
  Header,
  Sidebar,
  ChatInterface,
  ConnectionView,
  ResourceView,
} from "./components";
import { useStorage } from "./contexts/StorageContext";
import { InspectorProvider, InspectorUI } from "./contexts/InspectorProvider";

function AppContent() {
  const [selectedResource] = useState<Resource | null>(null);

  const { connections, resources, conversations, isLoading, error } =
    useStorage();

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

  // Helper components
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
      // No chat exists - let ChatInterface handle creating one
      return <Navigate to={`/connections/${connectionId}/chat/new`} replace />;
    }
  };

  return (
    <InspectorProvider>
      <MCPLayout
        header={<Header />}
        sidebar={<Sidebar connections={connections} resources={resources} />}
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
            path="/connections/:connectionId"
            element={<ConnectionChatRedirect />}
          />

          {/* Basic connection chat redirect */}
          <Route
            path="/connections/:connectionId/chat"
            element={<ConnectionChatRedirect />}
          />

          {/* Specific chat within a connection */}
          <Route
            path="/connections/:connectionId/chat/:chatId"
            element={<ChatInterface />}
          />

          {/* Tool execution within a specific chat */}
          <Route
            path="/connections/:connectionId/chat/:chatId/tools/:toolId"
            element={<ChatInterface expandedToolCall={true} />}
          />

          {/* Connection-specific resources routes */}
          <Route
            path="/connections/:connectionId/resources"
            element={<ResourceView selectedResource={selectedResource} />}
          />
          <Route
            path="/connections/:connectionId/resources/:resourceId"
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
