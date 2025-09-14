import { useState } from "react";
import {
  ConnectionItem,
  ToolItem,
  ResourceItem,
  ChatMessage,
  ConnectionStatus,
  RequestInspector,
  MCPLayout,
  Button,
} from "@mcpconnect/components";
import {
  Server,
  Database,
  MessageSquare,
  Settings,
  Play,
  Code,
  FileText,
  BarChart3,
} from "lucide-react";

// Header component
const Header = () => (
  <header className="bg-white border-b border-gray-200 px-6 py-4">
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-4">
        <h1 className="text-xl font-bold text-gray-900">MCPConnect</h1>
        <ConnectionStatus isConnected={true} />
      </div>
      <div className="flex items-center gap-2">
        <button className="p-2 hover:bg-gray-100 rounded-md">
          <Settings className="w-5 h-5 text-gray-600" />
        </button>
      </div>
    </div>
  </header>
);

// Sidebar component
const Sidebar = ({
  connections,
  tools,
  resources,
  onToolSelect,
}: {
  connections: any[];
  tools: any[];
  resources: any[];
  onToolSelect: (tool: any) => void;
}) => (
  <div className="p-4">
    {/* Connections */}
    <div className="mb-6">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-semibold text-gray-900">Connections</h2>
        <button className="text-blue-600 hover:text-blue-700 text-sm">
          + Add Connection
        </button>
      </div>
      <div className="space-y-2">
        {connections.map((conn, idx) => (
          <ConnectionItem key={idx} {...conn} />
        ))}
      </div>
    </div>

    {/* Tools */}
    <div className="mb-6">
      <h2 className="font-semibold text-gray-900 mb-3">
        Tools ({tools.length})
      </h2>
      <div className="space-y-2">
        {tools.map((tool, idx) => (
          <ToolItem key={idx} {...tool} onClick={() => onToolSelect(tool)} />
        ))}
      </div>
    </div>

    {/* Resources */}
    <div>
      <h2 className="font-semibold text-gray-900 mb-3">
        Resources ({resources.length})
      </h2>
      <div className="space-y-2">
        {resources.map((resource, idx) => (
          <ResourceItem key={idx} {...resource} />
        ))}
      </div>
    </div>
  </div>
);

// Main content area for chat mode
const ChatInterface = ({ chatMessages }: { chatMessages: any[] }) => (
  <div className="flex-1 flex flex-col">
    <div className="flex-1 overflow-y-auto p-6">
      <div className="max-w-2xl mx-auto">
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-2">
            Query Interface
          </h2>
          <div className="text-sm text-blue-600">3 tools available</div>
        </div>

        <div className="space-y-4">
          {chatMessages.map((msg, idx) => (
            <ChatMessage key={idx} {...msg} />
          ))}
        </div>
      </div>
    </div>

    <div className="border-t border-gray-200 p-4">
      <div className="max-w-2xl mx-auto">
        <div className="flex gap-3">
          <input
            type="text"
            placeholder="Type a message..."
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <Button>
            <Play className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  </div>
);

// Tool mode interface
const ToolInterface = ({ selectedTool }: { selectedTool: any }) => (
  <div className="flex-1 overflow-y-auto p-6">
    <div className="max-w-2xl mx-auto">
      {selectedTool ? (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            {selectedTool.name}
          </h2>
          <p className="text-gray-600 mb-6">{selectedTool.description}</p>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Query
              </label>
              <textarea
                rows={4}
                placeholder="SELECT COUNT(*) FROM users WHERE created_at >= NOW() - INTERVAL '1 month'"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Timeout (ms)
              </label>
              <input
                type="number"
                defaultValue="5000"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <Button className="w-full">
              <Play className="w-4 h-4 mr-2" />
              Run Tool
            </Button>
          </div>
        </div>
      ) : (
        <div className="text-center py-12">
          <Server className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            Select a Tool
          </h3>
          <p className="text-gray-600">
            Choose a tool from the sidebar to get started
          </p>
        </div>
      )}
    </div>
  </div>
);

// Mode toggle component
const ModeToggle = ({
  activeMode,
  onModeChange,
}: {
  activeMode: string;
  onModeChange: (mode: string) => void;
}) => (
  <div className="bg-white border-b border-gray-200 px-6 py-3">
    <div className="flex gap-1">
      <button
        onClick={() => onModeChange("chat")}
        className={`px-4 py-2 text-sm font-medium rounded-md transition-colors flex items-center gap-2 ${
          activeMode === "chat"
            ? "bg-blue-100 text-blue-700"
            : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
        }`}
      >
        <MessageSquare className="w-4 h-4" />
        Chat Interface
      </button>
      <button
        onClick={() => onModeChange("tools")}
        className={`px-4 py-2 text-sm font-medium rounded-md transition-colors flex items-center gap-2 ${
          activeMode === "tools"
            ? "bg-blue-100 text-blue-700"
            : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
        }`}
      >
        <Server className="w-4 h-4" />
        Tool Mode
      </button>
    </div>
  </div>
);

function App() {
  const [activeMode, setActiveMode] = useState("chat");
  const [selectedTool, setSelectedTool] = useState(null);

  // Mock data
  const connections = [
    {
      name: "Database Server",
      url: "ws://localhost:8080",
      isActive: true,
      isConnected: true,
    },
    {
      name: "File System",
      url: "ws://localhost:8081",
      isActive: false,
      isConnected: false,
    },
    {
      name: "Email API",
      url: "https://api.email.com",
      isActive: false,
      isConnected: false,
    },
  ];

  const tools = [
    {
      name: "query_database",
      description: "Execute SQL queries on database",
      icon: Database,
    },
    {
      name: "get_schema",
      description: "Get database schema information",
      icon: Code,
    },
    {
      name: "backup_data",
      description: "Create database backup",
      icon: Server,
    },
  ];

  const resources = [
    {
      name: "tables",
      description: "Available database tables",
      type: "table",
      icon: FileText,
    },
    {
      name: "stats",
      description: "Database performance statistics",
      type: "stats",
      icon: BarChart3,
    },
  ];

  const chatMessages = [
    {
      message: "Can you query the database for all users created this month?",
      isUser: true,
    },
    {
      message:
        "I'll query the database for users created this month. Let me execute that query for you...",
      isUser: false,
    },
    { isExecuting: true, executingTool: "query_database" },
    {
      message:
        "Found 47 users created this month. The query returned: SELECT COUNT(*) FROM users WHERE created_at >= ... Result: 47 users",
      isUser: false,
    },
  ];

  const executionData = {
    tool: "query_database",
    duration: "142ms",
    success: true,
    request: {
      tool: "query_database",
      arguments: {
        query:
          "SELECT COUNT(*) FROM users WHERE created_at >= NOW() - INTERVAL '1 month'",
        timeout: 5000,
      },
      timestamp: "2025-01-15T10:30:45Z",
    },
    response: {
      success: true,
      result: {
        count: 47,
        execution_time: 142,
      },
      timestamp: "2025-01-15T10:30:47Z",
    },
    metrics: {
      responseTime: "142ms",
      dataSize: "3.2KB",
      successRate: "98.2%",
    },
  };

  return (
    <MCPLayout
      header={<Header />}
      sidebar={
        <Sidebar
          connections={connections}
          tools={tools}
          resources={resources}
          onToolSelect={setSelectedTool}
        />
      }
      inspector={
        <div className="p-4">
          <RequestInspector execution={executionData} />
        </div>
      }
    >
      <ModeToggle activeMode={activeMode} onModeChange={setActiveMode} />

      {activeMode === "chat" ? (
        <ChatInterface chatMessages={chatMessages} />
      ) : (
        <ToolInterface selectedTool={selectedTool} />
      )}
    </MCPLayout>
  );
}

export default App;
