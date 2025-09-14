import { useState } from "react";
import { NetworkInspector, MCPLayout } from "@mcpconnect/components";
import { 
  ToolExecution, 
  Tool, 
  Resource, 
  Connection, 
  ChatMessage 
} from "@mcpconnect/schemas";
import {
  Header,
  Sidebar,
  ChatInterface,
  ToolInterface,
  ModeToggle,
} from "./components";

function App() {
  const [activeMode, setActiveMode] = useState<"chat" | "tools">("chat");
  const [selectedTool, setSelectedTool] = useState<Tool | null>(null);

  // Mock data using proper schema types with all required properties
  const connections: Connection[] = [
    {
      name: "Database Server",
      url: "ws://localhost:8080",
      isActive: true,
      isConnected: true,
      retryAttempts: 3,
      authType: "none",
    },
    {
      name: "File System",
      url: "ws://localhost:8081",
      isActive: false,
      isConnected: false,
      retryAttempts: 3,
      authType: "none",
    },
    {
      name: "Email API",
      url: "https://api.email.com",
      isActive: false,
      isConnected: false,
      retryAttempts: 3,
      authType: "bearer",
    },
  ];

  const tools: Tool[] = [
    {
      name: "query_database",
      description: "Execute SQL queries on database",
      deprecated: false,
      parameters: [
        {
          name: "query",
          type: "string",
          description: "SQL query to execute",
          required: true,
        },
        {
          name: "timeout",
          type: "number",
          description: "Query timeout in milliseconds",
          required: false,
          default: 5000,
        },
      ],
      category: "database",
      tags: ["sql", "query"],
    },
    {
      name: "get_schema",
      description: "Get database schema information",
      deprecated: false,
      parameters: [
        {
          name: "table",
          type: "string",
          description: "Table name to get schema for",
          required: false,
        },
      ],
      category: "database",
      tags: ["schema", "metadata"],
    },
    {
      name: "backup_data",
      description: "Create database backup",
      deprecated: false,
      parameters: [
        {
          name: "format",
          type: "string",
          description: "Backup format (sql, json)",
          required: false,
          default: "sql",
        },
        {
          name: "compress",
          type: "boolean",
          description: "Whether to compress the backup",
          required: false,
          default: false,
        },
      ],
      category: "database",
      tags: ["backup", "export"],
    },
  ];

  const resources: Resource[] = [
    {
      name: "tables",
      description: "Available database tables",
      type: "table",
      uri: "mcp://database/tables",
      mimeType: "application/json",
      permissions: {
        read: true,
        write: false,
        delete: false,
      },
      tags: ["database", "schema"],
    },
    {
      name: "stats",
      description: "Database performance statistics",
      type: "stats",
      uri: "mcp://database/stats",
      mimeType: "application/json",
      permissions: {
        read: true,
        write: false,
        delete: false,
      },
      tags: ["performance", "monitoring"],
    },
  ];

  const chatMessages: ChatMessage[] = [
    {
      id: "1",
      message: "Can you query the database for all users created this month?",
      isUser: true,
      isExecuting: false,
      timestamp: new Date("2025-01-15T10:30:00Z"),
    },
    {
      id: "2",
      message:
        "I'll query the database for users created this month. Let me execute that query for you...",
      isUser: false,
      isExecuting: false,
      timestamp: new Date("2025-01-15T10:30:01Z"),
    },
    {
      id: "3",
      isUser: false,
      isExecuting: true,
      executingTool: "query_database",
      timestamp: new Date("2025-01-15T10:30:02Z"),
      toolExecution: {
        toolName: "query_database",
        status: "pending",
      },
    },
    {
      id: "4",
      message:
        "Found 47 users created this month. The query returned: SELECT COUNT(*) FROM users WHERE created_at >= ... Result: 47 users",
      isUser: false,
      isExecuting: false,
      timestamp: new Date("2025-01-15T10:30:47Z"),
      toolExecution: {
        toolName: "query_database",
        status: "success",
        result: {
          count: 47,
          execution_time: 142,
        },
      },
    },
  ];

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

  const handleToolSelect = (tool: Tool) => {
    setSelectedTool(tool);
  };

  const handleModeChange = (mode: "chat" | "tools" | "inspector" | "split") => {
    if (mode === "chat" || mode === "tools") {
      setActiveMode(mode);
    }
  };

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