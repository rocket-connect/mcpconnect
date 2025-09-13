# MCPConnect

Build and debug Model Context Protocol integrations with a browser-based interface that connects directly to your MCP servers.

```bash
npx mcpconnect
```

## Get Started

**Local development**

```bash
npx mcpconnect
```

Opens MCPConnect at `http://localhost:3000`

**Embed in your app**

```bash
npm install @mcpconnect/express
```

```javascript
import express from "express";
import { mcpConnect } from "@mcpconnect/express";

const app = express();
app.use("/mcp", mcpConnect());
```

**Deploy to your infrastructure**

```bash
git clone https://github.com/rocket-connect/mcpconnect
cd mcpconnect
docker build -t mcpconnect .
docker run -p 3000:3000 mcpconnect
```

## What It Does

MCPConnect runs entirely in your browser using official MCP libraries to connect to any MCP server - authenticated or not. Test tools, explore resources, and debug protocol messages without server-side dependencies.

**Direct Protocol Connection**  
WebSocket, HTTP, or stdio transport using standard MCP protocols

**Visual Testing Interface**  
Interactive forms for tool execution and resource exploration

**Bring Your Own LLM**  
Connect OpenAI, Anthropic, Google, or local model APIs for conversational experiences

**Composable React Components**  
Build complete chat interfaces by combining modular pieces

## Building Chat Experiences

Compose MCPConnect components to create conversational interfaces:

```bash
npm install @mcpconnect/components
```

```javascript
import {
  MCPProvider,
  ChatInterface,
  ToolExecutor,
  ResourceProvider,
  LLMProvider,
} from "@mcpconnect/components";

function App() {
  return (
    <LLMProvider apiKey={process.env.OPENAI_API_KEY} provider="openai">
      <MCPProvider
        servers={[
          { url: "ws://localhost:8080", name: "Database Tools" },
          { url: "ws://localhost:8081", name: "File System" },
        ]}
      >
        <ChatInterface>
          <ToolExecutor />
          <ResourceProvider />
        </ChatInterface>
      </MCPProvider>
    </LLMProvider>
  );
}
```

## LLM Integration

MCPConnect supports standard model providers with your own API keys:

**Supported Models**

- OpenAI (GPT-4, GPT-3.5)
- Anthropic (Claude 3.5 Sonnet, Claude 3)
- Google (Gemini Pro, Gemini Flash)
- Local models (Ollama, LM Studio, OpenAI-compatible endpoints)

```javascript
const config = {
  provider: "openai",
  apiKey: "your-key",
  model: "gpt-4",
  baseUrl: "https://api.openai.com/v1", // Optional for custom endpoints
};
```

The LLM integration enables natural language responses using MCP tool results, intelligent tool suggestions, and conversational context across tool executions.

## Development Workflow

Use MCPConnect to iterate on MCP server implementations:

1. **Start your MCP server** on any port
2. **Run `npx mcpconnect`** to launch the interface
3. **Test tools visually** with real-time validation
4. **Debug protocol messages** with the built-in inspector
5. **Monitor performance** and error rates

**Development Features**

- Schema validation with instant feedback
- Raw MCP message inspection
- Request/response timing analysis
- Mock data generation for testing

## Custom Component Assembly

Build specialized debugging or testing interfaces:

```javascript
import {
  ServerExplorer,
  ToolInvoker,
  ResourceViewer,
  MessageLog,
} from "@mcpconnect/components";

function CustomDebugger() {
  return (
    <div className="debug-layout">
      <ServerExplorer />
      <div className="main-panel">
        <ToolInvoker />
        <ResourceViewer />
      </div>
      <MessageLog />
    </div>
  );
}
```

## Authentication Support

Connect to secured MCP servers with standard authentication:

```javascript
const serverConfig = {
  url: "wss://api.example.com/mcp",
  headers: {
    Authorization: "Bearer your-token",
    "X-API-Key": "your-api-key",
  },
};
```

## Local Models

Use local or self-hosted models with OpenAI-compatible APIs:

```javascript
const localConfig = {
  provider: "openai",
  baseUrl: "http://localhost:1234/v1", // LM Studio endpoint
  apiKey: "not-required",
  model: "local-llama-model",
};
```

## Self-Hosting

Deploy MCPConnect in your own infrastructure:

```bash
git clone https://github.com/rocket-connect/mcpconnect
cd mcpconnect
docker build -t mcpconnect .
docker run -p 3000:3000 mcpconnect
```

Or build and deploy the static assets to any hosting platform.

## Use Cases

**MCP Server Development**  
Visual testing and debugging for rapid iteration

**Conversational AI Applications**  
Pre-built components for chat interfaces with MCP integration

**API Exploration**  
Interactive documentation and testing for MCP servers

**Team Development**  
Shared development environment with configuration export/import

---

**Open Source**  
MIT License - contribute on [GitHub](https://github.com/rocket-connect/mcpconnect)

Built by [rconnect.tech](https://rconnect.tech) – connecting people through open source
