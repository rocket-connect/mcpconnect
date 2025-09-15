import {
  Connection,
  Tool,
  Resource,
  ToolExecution,
  ChatConversation,
  ChatMessage,
} from "@mcpconnect/schemas";
import { nanoid } from "nanoid";

/**
 * Generate consistent IDs for mock data
 * Using nanoid for URL-safe, unique identifiers
 */
const generateId = (prefix?: string) => {
  const id = nanoid(10); // 10 characters for shorter IDs
  return prefix ? `${prefix}_${id}` : id;
};

// Pre-generate stable IDs for consistent referencing
const CONNECTION_IDS = {
  ecommerce: generateId("conn"),
};

const CHAT_IDS = {
  orderAnalysis: generateId("chat"),
  inventoryMgmt: generateId("chat"),
  customerService: generateId("chat"),
};

const TOOL_IDS = {
  queryOrders: generateId("tool"),
  updateInventory: generateId("tool"),
  getCustomer: generateId("tool"),
};

const TOOL_EXECUTION_IDS = {
  queryOrders1: generateId("exec"),
  getCustomer1: generateId("exec"),
  updateInventory1: generateId("exec"),
  queryOrdersError: generateId("exec"),
  getCustomerPending: generateId("exec"),
};

const MESSAGE_IDS = {
  // Order Analysis Chat
  orderAnalysis1: generateId("msg"),
  orderAnalysis2: generateId("msg"),
  orderAnalysis3: generateId("msg"),
  orderAnalysis4: generateId("msg"),
  // Inventory Management Chat
  inventory1: generateId("msg"),
  inventory2: generateId("msg"),
  inventory3: generateId("msg"),
  inventory4: generateId("msg"),
  inventory5: generateId("msg"),
  // Customer Service Chat
  customer1: generateId("msg"),
  customer2: generateId("msg"),
  customer3: generateId("msg"),
};

/**
 * Mock data for MCPConnect application
 * All IDs are generated using nanoid for consistency and safety
 */

// Single connection for testing - NOW WITH NANOID ID
export const mockConnections: Connection[] = [
  {
    id: CONNECTION_IDS.ecommerce, // Using nanoid instead of index-based approach
    name: "Demo E-commerce Database",
    url: "ws://localhost:8080",
    isActive: true,
    isConnected: true,
    retryAttempts: 3,
    authType: "none",
    timeout: 30000,
    headers: {},
    credentials: {},
  },
];

// Tools for connection by ID (not index) - NOW WITH UNIQUE TOOL IDS
export const mockTools: Record<string, Tool[]> = {
  [CONNECTION_IDS.ecommerce]: [
    {
      id: TOOL_IDS.queryOrders, // Unique tool ID
      name: "query_orders",
      description: "Execute SQL queries on order database",
      deprecated: false,
      parameters: [
        {
          name: "query",
          type: "string",
          description: "SQL query to execute",
          required: true,
        },
        {
          name: "limit",
          type: "number",
          description: "Maximum number of rows to return",
          required: false,
          default: 100,
        },
      ],
      category: "database",
      tags: ["sql", "orders", "ecommerce"],
      inputSchema: {
        type: "object",
        properties: {
          query: { type: "string" },
          limit: { type: "number" },
        },
        required: ["query"],
      },
    },
    {
      id: TOOL_IDS.updateInventory, // Unique tool ID
      name: "update_inventory",
      description: "Update product inventory levels",
      deprecated: false,
      parameters: [
        {
          name: "product_id",
          type: "string",
          description: "Product ID to update",
          required: true,
        },
        {
          name: "quantity",
          type: "number",
          description: "New quantity level",
          required: true,
        },
      ],
      category: "inventory",
      tags: ["products", "stock", "ecommerce"],
      inputSchema: {
        type: "object",
        properties: {
          product_id: { type: "string" },
          quantity: { type: "number" },
        },
        required: ["product_id", "quantity"],
      },
    },
    {
      id: TOOL_IDS.getCustomer, // Unique tool ID
      name: "get_customer_info",
      description: "Retrieve customer information by ID",
      deprecated: false,
      parameters: [
        {
          name: "customer_id",
          type: "string",
          description: "Customer ID to lookup",
          required: true,
        },
      ],
      category: "customer",
      tags: ["customer", "lookup", "profile"],
      inputSchema: {
        type: "object",
        properties: {
          customer_id: { type: "string" },
        },
        required: ["customer_id"],
      },
    },
  ],
};

// Resources for connection by ID (not index)
export const mockResources: Record<string, Resource[]> = {
  [CONNECTION_IDS.ecommerce]: [
    {
      name: "order_tables",
      description: "E-commerce database table schemas",
      type: "schema",
      uri: "mcp://database/orders/schema",
      mimeType: "application/json",
      permissions: {
        read: true,
        write: false,
        delete: false,
      },
      tags: ["database", "schema", "orders"],
    },
    {
      name: "product_catalog",
      description: "Product catalog with inventory data",
      type: "data",
      uri: "mcp://database/products/catalog",
      mimeType: "application/json",
      permissions: {
        read: true,
        write: true,
        delete: false,
      },
      tags: ["products", "inventory", "catalog"],
    },
  ],
};

// Chat messages with proper tool execution references using generated IDs
const createOrderAnalysisMessages = (): ChatMessage[] => [
  {
    id: MESSAGE_IDS.orderAnalysis1,
    message: "Show me pending orders from last week",
    isUser: true,
    timestamp: new Date("2025-01-15T10:30:00Z"),
    isExecuting: false,
  },
  {
    id: MESSAGE_IDS.orderAnalysis2,
    message: "I'll query the orders database for pending orders.",
    isUser: false,
    timestamp: new Date("2025-01-15T10:30:02Z"),
    isExecuting: false,
  },
  {
    id: TOOL_EXECUTION_IDS.queryOrders1, // This ID MUST match the ToolExecution ID
    isUser: false,
    executingTool: "query_orders",
    timestamp: new Date("2025-01-15T10:30:03Z"),
    toolExecution: {
      toolName: "query_orders",
      status: "success",
      result: {
        total_orders: 23,
        pending_payment: 15,
        processing: 5,
        ready_to_ship: 3,
        orders: [
          { id: "ORD-001", status: "pending_payment", amount: 124.99 },
          { id: "ORD-002", status: "processing", amount: 89.5 },
          { id: "ORD-003", status: "ready_to_ship", amount: 199.99 },
        ],
      },
    },
    isExecuting: false,
  },
  {
    id: MESSAGE_IDS.orderAnalysis3,
    message:
      "Found 23 pending orders: 15 awaiting payment, 5 processing, and 3 ready for shipment.",
    isUser: false,
    timestamp: new Date("2025-01-15T10:30:08Z"),
    isExecuting: false,
  },
  {
    id: MESSAGE_IDS.orderAnalysis4,
    message: "Can you show me the customer details for order ORD-001?",
    isUser: true,
    timestamp: new Date("2025-01-15T10:32:00Z"),
    isExecuting: false,
  },
  {
    id: TOOL_EXECUTION_IDS.getCustomer1, // This ID MUST match the ToolExecution ID
    isUser: false,
    executingTool: "get_customer_info",
    timestamp: new Date("2025-01-15T10:32:02Z"),
    toolExecution: {
      toolName: "get_customer_info",
      status: "success",
      result: {
        customer_id: "CUST-12345",
        name: "Alice Johnson",
        email: "alice.johnson@email.com",
        phone: "+1-555-0123",
        address: {
          street: "123 Oak Street",
          city: "San Francisco",
          state: "CA",
          zip: "94102",
        },
        order_history: 8,
        total_spent: 1247.83,
      },
    },
    isExecuting: false,
  },
];

const createInventoryMessages = (): ChatMessage[] => [
  {
    id: MESSAGE_IDS.inventory1,
    message: "Update the stock for product SKU-001 to 50 units",
    isUser: true,
    timestamp: new Date("2025-01-15T14:00:00Z"),
    isExecuting: false,
  },
  {
    id: TOOL_EXECUTION_IDS.updateInventory1, // This ID MUST match the ToolExecution ID
    isUser: false,
    executingTool: "update_inventory",
    timestamp: new Date("2025-01-15T14:00:02Z"),
    toolExecution: {
      toolName: "update_inventory",
      status: "success",
      result: {
        product_id: "SKU-001",
        old_quantity: 25,
        new_quantity: 50,
        updated_at: "2025-01-15T14:00:05Z",
        product_name: "Wireless Bluetooth Headphones",
      },
    },
    isExecuting: false,
  },
  {
    id: MESSAGE_IDS.inventory2,
    message: "Successfully updated SKU-001 inventory from 25 to 50 units.",
    isUser: false,
    timestamp: new Date("2025-01-15T14:00:06Z"),
    isExecuting: false,
  },
  {
    id: MESSAGE_IDS.inventory3,
    message:
      "Now check the current stock levels for all products with low inventory",
    isUser: true,
    timestamp: new Date("2025-01-15T14:01:00Z"),
    isExecuting: false,
  },
  {
    id: TOOL_EXECUTION_IDS.queryOrdersError, // This ID MUST match the ToolExecution ID
    isUser: false,
    executingTool: "query_orders",
    timestamp: new Date("2025-01-15T14:01:02Z"),
    toolExecution: {
      toolName: "query_orders",
      status: "error",
      error:
        "Database connection timeout after 30 seconds. Please check the database server status.",
    },
    isExecuting: false,
  },
  {
    id: MESSAGE_IDS.inventory4,
    message:
      "I encountered an error while checking inventory levels. The database connection timed out. Please try again in a moment.",
    isUser: false,
    timestamp: new Date("2025-01-15T14:01:35Z"),
    isExecuting: false,
  },
];

const createCustomerServiceMessages = (): ChatMessage[] => [
  {
    id: MESSAGE_IDS.customer1,
    message:
      "Hello! I need to look up some customer information for support tickets.",
    isUser: true,
    timestamp: new Date("2025-01-15T16:00:00Z"),
    isExecuting: false,
  },
  {
    id: MESSAGE_IDS.customer2,
    message:
      "I can help you look up customer information. What customer ID do you need to check?",
    isUser: false,
    timestamp: new Date("2025-01-15T16:00:02Z"),
    isExecuting: false,
  },
  {
    id: MESSAGE_IDS.customer3,
    message: "Please look up customer CUST-67890",
    isUser: true,
    timestamp: new Date("2025-01-15T16:15:20Z"),
    isExecuting: false,
  },
  {
    id: TOOL_EXECUTION_IDS.getCustomerPending, // This ID MUST match the ToolExecution ID
    isUser: false,
    executingTool: "get_customer_info",
    timestamp: new Date("2025-01-15T16:15:22Z"),
    toolExecution: {
      toolName: "get_customer_info",
      status: "pending",
      result: undefined,
      error: undefined,
    },
    isExecuting: true,
  },
];

// Conversations with proper structure using generated IDs - NOW KEYED BY CONNECTION ID
export const mockConversations: Record<string, ChatConversation[]> = {
  [CONNECTION_IDS.ecommerce]: [
    // Chat 0 - Order Analysis
    {
      id: CHAT_IDS.orderAnalysis,
      title: "Order Analysis",
      messages: createOrderAnalysisMessages(),
      createdAt: new Date("2025-01-15T10:30:00Z"),
      updatedAt: new Date("2025-01-15T10:32:10Z"),
    },

    // Chat 1 - Inventory Management
    {
      id: CHAT_IDS.inventoryMgmt,
      title: "Inventory Management",
      messages: createInventoryMessages(),
      createdAt: new Date("2025-01-15T14:00:00Z"),
      updatedAt: new Date("2025-01-15T14:01:35Z"),
    },

    // Chat 2 - Customer Service
    {
      id: CHAT_IDS.customerService,
      title: "Customer Service",
      messages: createCustomerServiceMessages(),
      createdAt: new Date("2025-01-15T16:00:00Z"),
      updatedAt: new Date("2025-01-15T16:15:22Z"),
    },
  ],
};

// Tool executions with IDs that EXACTLY match chat message IDs - NOW KEYED BY CONNECTION ID
export const mockToolExecutions: Record<string, ToolExecution[]> = {
  [CONNECTION_IDS.ecommerce]: [
    // Execution 1 - matches tool execution message
    {
      id: TOOL_EXECUTION_IDS.queryOrders1,
      tool: "query_orders",
      status: "success",
      duration: 5200,
      timestamp: "10:30:08",
      request: {
        tool: "query_orders",
        arguments: {
          query:
            "SELECT status, COUNT(*) as count FROM orders WHERE created_at >= NOW() - INTERVAL 1 WEEK AND status IN ('pending_payment', 'processing', 'ready_to_ship') GROUP BY status",
          limit: 100,
        },
        timestamp: "2025-01-15T10:30:03Z",
      },
      response: {
        success: true,
        result: {
          total_orders: 23,
          pending_payment: 15,
          processing: 5,
          ready_to_ship: 3,
          orders: [
            { id: "ORD-001", status: "pending_payment", amount: 124.99 },
            { id: "ORD-002", status: "processing", amount: 89.5 },
            { id: "ORD-003", status: "ready_to_ship", amount: 199.99 },
          ],
        },
        timestamp: "2025-01-15T10:30:08Z",
      },
    },

    // Execution 2 - matches customer lookup message
    {
      id: TOOL_EXECUTION_IDS.getCustomer1,
      tool: "get_customer_info",
      status: "success",
      duration: 1850,
      timestamp: "10:32:04",
      request: {
        tool: "get_customer_info",
        arguments: {
          customer_id: "CUST-12345",
        },
        timestamp: "2025-01-15T10:32:02Z",
      },
      response: {
        success: true,
        result: {
          customer_id: "CUST-12345",
          name: "Alice Johnson",
          email: "alice.johnson@email.com",
          phone: "+1-555-0123",
          address: {
            street: "123 Oak Street",
            city: "San Francisco",
            state: "CA",
            zip: "94102",
          },
          order_history: 8,
          total_spent: 1247.83,
        },
        timestamp: "2025-01-15T10:32:04Z",
      },
    },

    // Execution 3 - matches inventory update message
    {
      id: TOOL_EXECUTION_IDS.updateInventory1,
      tool: "update_inventory",
      status: "success",
      duration: 1800,
      timestamp: "14:00:05",
      request: {
        tool: "update_inventory",
        arguments: {
          product_id: "SKU-001",
          quantity: 50,
        },
        timestamp: "2025-01-15T14:00:02Z",
      },
      response: {
        success: true,
        result: {
          product_id: "SKU-001",
          old_quantity: 25,
          new_quantity: 50,
          updated_at: "2025-01-15T14:00:05Z",
          product_name: "Wireless Bluetooth Headphones",
        },
        timestamp: "2025-01-15T14:00:05Z",
      },
    },

    // Execution 4 - matches error case message
    {
      id: TOOL_EXECUTION_IDS.queryOrdersError,
      tool: "query_orders",
      status: "error",
      duration: 30000,
      timestamp: "14:01:32",
      request: {
        tool: "query_orders",
        arguments: {
          query:
            "SELECT product_id, quantity FROM inventory WHERE quantity < 10 ORDER BY quantity ASC",
          limit: 50,
        },
        timestamp: "2025-01-15T14:01:02Z",
      },
      error:
        "Database connection timeout after 30 seconds. Please check the database server status.",
    },

    // Additional execution for demonstration (pending state)
    {
      id: TOOL_EXECUTION_IDS.getCustomerPending,
      tool: "get_customer_info",
      status: "pending",
      duration: 0,
      timestamp: "16:15:22",
      request: {
        tool: "get_customer_info",
        arguments: {
          customer_id: "CUST-67890",
        },
        timestamp: "2025-01-15T16:15:22Z",
      },
    },
  ],
};

// Export ID constants for external reference if needed
export const ID_CONSTANTS = {
  CONNECTIONS: CONNECTION_IDS,
  CHATS: CHAT_IDS,
  TOOLS: TOOL_IDS,
  EXECUTIONS: TOOL_EXECUTION_IDS,
  MESSAGES: MESSAGE_IDS,
};

// Helper function to get all tool executions with proper typing
export function getAllToolExecutions(): ToolExecution[] {
  return Object.values(mockToolExecutions).flat();
}

// Helper function to get executions for a specific connection BY ID
export function getExecutionsForConnection(
  connectionId: string
): ToolExecution[] {
  return mockToolExecutions[connectionId] || [];
}

// Helper function to get executions for a specific chat BY CONNECTION ID AND CHAT ID
export function getExecutionsForChat(
  connectionId: string,
  chatId: string
): ToolExecution[] {
  const connectionExecutions = getExecutionsForConnection(connectionId);
  const conversations = mockConversations[connectionId] || [];

  // Find conversation by ID instead of index
  const currentChat = conversations.find(conv => conv.id === chatId);

  if (!currentChat) {
    return [];
  }

  const toolMessageIds = currentChat.messages
    .filter(msg => Boolean(msg.executingTool) || Boolean(msg.toolExecution))
    .map(msg => msg.id)
    .filter(Boolean) as string[];

  const matchingExecutions = connectionExecutions.filter(execution =>
    toolMessageIds.includes(execution.id)
  );

  return matchingExecutions;
}

// ENHANCED: Function to get tool by ID - NOW SEARCHES ALL CONNECTIONS
export function getToolById(
  connectionId: string,
  toolId: string
): Tool | undefined {
  const connectionTools = mockTools[connectionId] || [];
  return connectionTools.find(tool => tool.id === toolId);
}

// NEW: Function to get tool by ID globally (search all connections)
export function getToolByIdGlobal(toolId: string): Tool | undefined {
  for (const [_, connectionTools] of Object.entries(mockTools)) {
    const tool = connectionTools.find(t => t.id === toolId);
    if (tool) {
      return tool;
    }
  }
  return undefined;
}

// NEW: Function to get tool by name (for backward compatibility)
export function getToolByName(
  connectionId: string,
  toolName: string
): Tool | undefined {
  const connectionTools = mockTools[connectionId] || [];
  return connectionTools.find(tool => tool.name === toolName);
}

// NEW: Function to find which connection a tool belongs to
export function findToolConnectionId(toolId: string): string | null {
  for (const [connectionId, connectionTools] of Object.entries(mockTools)) {
    if (connectionTools.some(t => t.id === toolId)) {
      return connectionId;
    }
  }
  return null;
}

// Enhanced validation function with ID consistency checks
export function validateMockData(): boolean {
  const connectionExecutions =
    mockToolExecutions[CONNECTION_IDS.ecommerce] || [];
  const conversations = mockConversations[CONNECTION_IDS.ecommerce] || [];

  // Check that every tool execution has a corresponding chat message
  for (const execution of connectionExecutions) {
    const found = conversations.some(chat =>
      chat.messages.some(msg => msg.id === execution.id)
    );

    if (!found) {
      console.error(
        `❌ Tool execution ${execution.id} has no matching chat message`
      );
      return false;
    } else {
      console.log(`✅ Tool execution ${execution.id} has matching message`);
    }
  }

  // Check that every tool message has a corresponding execution
  for (const chat of conversations) {
    for (const message of chat.messages) {
      if (message.executingTool || message.toolExecution) {
        const found = connectionExecutions.some(exec => exec.id === message.id);
        if (!found) {
          console.error(
            `❌ Tool message ${message.id} has no matching execution`
          );
          return false;
        } else {
          console.log(`✅ Tool message ${message.id} has matching execution`);
        }
      }
    }
  }

  // Validate ID format consistency
  const allIds = [
    ...Object.values(CONNECTION_IDS),
    ...Object.values(CHAT_IDS),
    ...Object.values(TOOL_IDS),
    ...Object.values(TOOL_EXECUTION_IDS),
    ...Object.values(MESSAGE_IDS),
  ];

  const duplicateIds = allIds.filter(
    (id, index) => allIds.indexOf(id) !== index
  );
  if (duplicateIds.length > 0) {
    console.error(`❌ Duplicate IDs found: ${duplicateIds.join(", ")}`);
    return false;
  }

  console.log(`✅ All ${allIds.length} IDs are unique`);
  console.log("✅ Mock data validation passed with nanoid IDs");
  return true;
}

// Helper function to generate new IDs during development/testing
export function generateNewId(prefix?: string): string {
  return generateId(prefix);
}

// NEW: Function to get connection by ID (instead of by index)
export function getConnectionById(
  connectionId: string
): Connection | undefined {
  return mockConnections.find(conn => conn.id === connectionId);
}

// NEW: Function to find connection index by ID (for backward compatibility)
export function getConnectionIndexById(connectionId: string): number {
  return mockConnections.findIndex(conn => conn.id === connectionId);
}

// Export everything as default for easy importing
export default {
  connections: mockConnections,
  tools: mockTools,
  resources: mockResources,
  conversations: mockConversations,
  toolExecutions: mockToolExecutions,
  idConstants: ID_CONSTANTS,
  getAllToolExecutions,
  getExecutionsForConnection,
  getExecutionsForChat,
  getToolById,
  getToolByIdGlobal,
  getToolByName,
  findToolConnectionId,
  validateMockData,
  generateNewId,
  getConnectionById,
  getConnectionIndexById,
};
