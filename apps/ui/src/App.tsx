import { useState } from "react";
import { RequestInspector, MCPLayout } from "@mcpconnect/components";
import { Database, Code, Server, FileText, BarChart3 } from "lucide-react";

import {
  Header,
  Sidebar,
  ChatInterface,
  ToolInterface,
  ModeToggle,
} from "./components";

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
        <div className="p-4 bg-gray-50 dark:bg-gray-800 transition-colors">
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
