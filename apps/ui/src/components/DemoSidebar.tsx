import { Connection, Tool } from "@mcpconnect/schemas";
import { nanoid } from "nanoid";

// Demo connection data for onboarding
export const createDemoConnection = (): Connection => ({
  id: `demo-${nanoid()}`,
  name: "Demo MCP Server",
  url: "https://demo.mcp.rconnect.tech/api",
  connectionType: "sse",
  isActive: false,
  isConnected: true,
  authType: "none",
  credentials: {},
  headers: {},
  timeout: 30000,
  retryAttempts: 3,
});

// Demo tools to showcase functionality
export const getDemoTools = (): Tool[] => [
  {
    id: "web-search",
    name: "web_search",
    description: "Search the web for current information and news",
    category: "Web",
    tags: ["search", "web", "information"],
    deprecated: false,
    parameters: [
      {
        name: "query",
        type: "string",
        description: "Search query to execute",
        required: true,
      },
      {
        name: "max_results",
        type: "number",
        description: "Maximum number of results to return",
        required: false,
        default: 10,
      },
    ],
  },
  {
    id: "file-manager",
    name: "file_manager",
    description: "Read, write, and manage files in the workspace",
    category: "Files",
    tags: ["files", "workspace", "filesystem"],
    deprecated: false,
    parameters: [
      {
        name: "action",
        type: "string",
        description: "Action to perform (read, write, list, delete)",
        required: true,
      },
      {
        name: "path",
        type: "string",
        description: "File or directory path",
        required: true,
      },
    ],
  },
  {
    id: "database-query",
    name: "database_query",
    description: "Execute SQL queries against connected databases",
    category: "Database",
    tags: ["sql", "database", "query"],
    deprecated: false,
    parameters: [
      {
        name: "query",
        type: "string",
        description: "SQL query to execute",
        required: true,
      },
      {
        name: "database",
        type: "string",
        description: "Target database name",
        required: false,
        default: "default",
      },
    ],
  },
  {
    id: "weather-api",
    name: "get_weather",
    description: "Get current weather conditions for any location",
    category: "APIs",
    tags: ["weather", "api", "location"],
    deprecated: false,
    parameters: [
      {
        name: "location",
        type: "string",
        description: "City name or coordinates",
        required: true,
      },
      {
        name: "units",
        type: "string",
        description: "Temperature units (celsius, fahrenheit)",
        required: false,
        default: "celsius",
      },
    ],
  },
  {
    id: "email-sender",
    name: "send_email",
    description: "Send emails through configured SMTP server",
    category: "Communication",
    tags: ["email", "smtp", "messaging"],
    deprecated: false,
    parameters: [
      {
        name: "to",
        type: "string",
        description: "Recipient email address",
        required: true,
      },
      {
        name: "subject",
        type: "string",
        description: "Email subject line",
        required: true,
      },
      {
        name: "body",
        type: "string",
        description: "Email body content",
        required: true,
      },
    ],
  },
  {
    id: "code-analyzer",
    name: "analyze_code",
    description:
      "Static analysis and linting for various programming languages",
    category: "Development",
    tags: ["code", "analysis", "linting"],
    deprecated: false,
    parameters: [
      {
        name: "code",
        type: "string",
        description: "Code to analyze",
        required: true,
      },
      {
        name: "language",
        type: "string",
        description: "Programming language",
        required: true,
      },
    ],
  },
];

// Example MCP servers for quick setup
export const getExampleServers = () => [
  {
    name: "Local Development Server",
    url: "http://localhost:3000/mcp",
    type: "sse" as const,
    description: "Connect to your local MCP development server",
  },
  {
    name: "File System MCP",
    url: "ws://localhost:8080/filesystem",
    type: "websocket" as const,
    description: "Access and manage local files through MCP",
  },
  {
    name: "Database MCP",
    url: "https://api.example.com/mcp/database",
    type: "http" as const,
    description: "Query databases through MCP protocol",
  },
  {
    name: "Web Tools MCP",
    url: "https://web-tools.mcp.dev/api",
    type: "sse" as const,
    description: "Web scraping and API access tools",
  },
];

// Onboarding steps
export const getOnboardingSteps = () => [
  {
    id: "configure-llm",
    title: "Configure Your LLM",
    description: "Add your AI provider API key in settings",
    icon: "brain",
    completed: false,
  },
  {
    id: "add-connection",
    title: "Add MCP Connection",
    description: "Connect to your first MCP server",
    icon: "plus-circle",
    completed: false,
  },
  {
    id: "test-tools",
    title: "Test Tools",
    description: "Try using MCP tools in a conversation",
    icon: "settings",
    completed: false,
  },
  {
    id: "explore-inspector",
    title: "Explore Inspector",
    description: "View tool execution details in the inspector panel",
    icon: "search",
    completed: false,
  },
];

// Helper to check if this is a first-time user
export const isFirstTimeUser = (connections: Connection[]): boolean => {
  return connections.length === 0;
};

// Helper to check onboarding completion
export const getOnboardingProgress = (
  connections: Connection[],
  hasApiKey: boolean,
  conversationCount: number
) => {
  const steps = getOnboardingSteps();

  steps[0].completed = hasApiKey;
  steps[1].completed = connections.length > 0;
  steps[2].completed = conversationCount > 0;
  steps[3].completed = conversationCount > 0; // Assume they've used inspector if they've had conversations

  const completedSteps = steps.filter(step => step.completed).length;
  const totalSteps = steps.length;

  return {
    steps,
    completedSteps,
    totalSteps,
    percentage: Math.round((completedSteps / totalSteps) * 100),
    isComplete: completedSteps === totalSteps,
  };
};
