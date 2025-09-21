import { ToolExecution } from "@mcpconnect/schemas";

// Demo tool executions for onboarding
export const createDemoExecutions = (): ToolExecution[] => [
  {
    id: "demo-1",
    tool: "repo_browse",
    status: "success",
    duration: 850,
    timestamp: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
    request: {
      tool: "repo_browse",
      arguments: {
        path: "/src/components",
        recursive: true,
      },
      timestamp: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
    },
    response: {
      success: true,
      result: {
        files: [
          { name: "Header.tsx", type: "file", size: 2048 },
          { name: "Sidebar.tsx", type: "file", size: 3421 },
          { name: "ChatInterface.tsx", type: "file", size: 8192 },
        ],
        total_files: 12,
        total_directories: 3,
      },
      timestamp: new Date(Date.now() - 5 * 60 * 1000 + 850).toISOString(),
    },
  },
  {
    id: "demo-2",
    tool: "list_issues",
    status: "success",
    duration: 1200,
    timestamp: new Date(Date.now() - 3 * 60 * 1000).toISOString(),
    request: {
      tool: "list_issues",
      arguments: {
        repository: "mcpconnect/ui",
        state: "open",
        labels: ["bug", "enhancement"],
      },
      timestamp: new Date(Date.now() - 3 * 60 * 1000).toISOString(),
    },
    response: {
      success: true,
      result: {
        issues: [
          {
            id: 42,
            title: "Dark mode toggle not persisting",
            state: "open",
            labels: ["bug", "ui"],
            created_at: "2024-01-15T10:30:00Z",
          },
          {
            id: 38,
            title: "Add keyboard shortcuts for chat navigation",
            state: "open",
            labels: ["enhancement", "ux"],
            created_at: "2024-01-12T14:22:00Z",
          },
        ],
        total_count: 7,
      },
      timestamp: new Date(Date.now() - 3 * 60 * 1000 + 1200).toISOString(),
    },
  },
  {
    id: "demo-3",
    tool: "create_pr",
    status: "error",
    duration: 2100,
    timestamp: new Date(Date.now() - 1 * 60 * 1000).toISOString(),
    request: {
      tool: "create_pr",
      arguments: {
        title: "Fix dark mode persistence issue",
        body: "This PR addresses the bug where dark mode setting was not being saved to localStorage properly.",
        head: "fix/dark-mode-persistence",
        base: "main",
      },
      timestamp: new Date(Date.now() - 1 * 60 * 1000).toISOString(),
    },
    error:
      "Authentication failed: insufficient permissions to create pull request. User needs 'write' access to the repository.",
  },
  {
    id: "demo-4",
    tool: "web_search",
    status: "pending",
    timestamp: new Date().toISOString(),
    request: {
      tool: "web_search",
      arguments: {
        query: "React TypeScript best practices 2024",
        max_results: 5,
      },
      timestamp: new Date().toISOString(),
    },
  },
];
