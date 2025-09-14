import { useState } from "react";
import {
  NetworkInspector,
  MCPLayout,
  type ToolExecution,
} from "@mcpconnect/components";
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

  // Updated to match the NetworkInspector's expected data format
  const toolExecutions: ToolExecution[] = [
    {
      id: "1",
      tool: "query_database",
      status: "success",
      duration: 142,
      timestamp: "10:30:47",
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
    },
    {
      id: "2",
      tool: "get_schema",
      status: "success",
      duration: 89,
      timestamp: "10:29:15",
      request: {
        tool: "get_schema",
        arguments: { table: "users" },
        timestamp: "2025-01-15T10:29:13Z",
      },
      response: {
        success: true,
        result: {
          columns: [
            { name: "id", type: "INTEGER", nullable: false },
            { name: "email", type: "VARCHAR", nullable: false },
            { name: "created_at", type: "TIMESTAMP", nullable: false },
          ],
        },
        timestamp: "2025-01-15T10:29:15Z",
      },
    },
    {
      id: "3",
      tool: "backup_data",
      status: "error",
      duration: 2341,
      timestamp: "10:25:32",
      request: {
        tool: "backup_data",
        arguments: { format: "sql", compress: true },
        timestamp: "2025-01-15T10:25:30Z",
      },
      error: "Permission denied: insufficient privileges for backup operation",
    },
    {
      id: "4",
      tool: "query_database",
      status: "pending",
      timestamp: "10:30:50",
      request: {
        tool: "query_database",
        arguments: {
          query:
            "SELECT * FROM orders WHERE status = 'pending' ORDER BY created_at DESC LIMIT 10",
        },
        timestamp: "2025-01-15T10:30:50Z",
      },
    },
  ];

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
        <div className="p-4 bg-gray-50 dark:bg-gray-800 transition-colors h-full">
          <NetworkInspector executions={toolExecutions} />
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
