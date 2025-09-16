# MCPConnect

Build and debug Model Context Protocol integrations with a browser-based interface that connects directly to your MCP servers.

<div align="center">
  <img src="./docs/mcpconnect-github-ui.png" width="80%" alt="MCPConnect Interface" />
</div>

**Live Demo**: [mcp.rconnect.tech](https://mcp.rconnect.tech)

## Quick Start

```bash
npx @mcpconnect/cli
```

Opens MCPConnect at `http://localhost:3001` with a complete debugging environment.

## What is MCPConnect?

MCPConnect is a developer-focused tool for testing and debugging Model Context Protocol (MCP) servers. It provides a visual interface to connect to MCP servers, explore their tools and resources, and interact with them through conversational AI.

**Key Features:**

- **Direct MCP Protocol Support** - WebSocket, HTTP, and SSE transport using standard MCP protocols
- **Visual Tool Testing** - Interactive forms for tool execution with real-time feedback
- **Conversational AI Integration** - Connect your own OpenAI or Anthropic API keys for chat-based interactions
- **Request Inspector** - Debug protocol messages, monitor performance, and track executions
- **Zero Configuration** - Works entirely in the browser with no server-side dependencies

## Try It Now

Visit **[mcp.rconnect.tech](https://mcp.rconnect.tech)** to use MCPConnect directly in your browser without installation. The hosted version includes:

- Full MCP server connection capabilities
- Real-time tool execution and debugging
- Request/response inspection
- Conversational AI integration (bring your own API key)
- Local storage for connection persistence

## Architecture

MCPConnect is built as a modular TypeScript monorepo with pluggable adapters:

```
packages/
├── base-adapters/          # Abstract interfaces for LLM and storage
├── adapter-ai-sdk/         # AI SDK integration (Anthropic, OpenAI)
├── adapter-localstorage/   # Browser storage implementation
├── schemas/                # Zod validation schemas
├── components/             # Reusable React components
├── cli/                    # Command-line interface
└── server/                 # Express server with UI serving

apps/
├── ui/                     # React frontend application
└── server/                 # Server application
```

## Development Workflow

MCPConnect streamlines MCP server development:

1. **Start your MCP server** on any port with any transport
2. **Run MCPConnect** to launch the debugging interface
3. **Connect and introspect** - automatically discover tools and resources
4. **Test tools visually** with form-based parameter input
5. **Debug with inspector** - view raw protocol messages and performance metrics

## Installation Options

**Online (No Installation)**
Visit [mcp.rconnect.tech](https://mcp.rconnect.tech) to use MCPConnect directly in your browser.

**CLI (Recommended for Local Development)**

```bash
npx @mcpconnect/cli
```

**Self-hosted**

```bash
git clone https://github.com/rocket-connect/mcpconnect
cd mcpconnect
pnpm install && pnpm build
pnpm start
```

## Supported Protocols

- **HTTP** - Standard request/response MCP over HTTP
- **WebSocket** - Real-time bidirectional MCP communication
- **Server-Sent Events** - Streaming MCP responses (recommended)

Authentication supported: Bearer tokens, API keys, Basic auth, custom headers.

## LLM Integration

MCPConnect supports multiple LLM providers with your own API keys:

- **Anthropic Claude** (3.5 Sonnet, 3 Opus, 3 Haiku)
- **OpenAI** (GPT-4, GPT-3.5) - via AI SDK
- **Local models** - OpenAI-compatible endpoints (Ollama, LM Studio)

Configure your API key in the settings panel to enable conversational interactions with discovered MCP tools.

## Component Library

Build custom MCP interfaces with React components:

```bash
npm install @mcpconnect/components
```

```typescript
import { MCPLayout, ToolItem, ConnectionStatus } from '@mcpconnect/components';

function CustomMCPInterface() {
  return (
    <MCPLayout
      sidebar={<ToolsList />}
      inspector={<RequestInspector />}
    >
      <ChatInterface />
    </MCPLayout>
  );
}
```

## Adapters

MCPConnect uses a pluggable adapter system:

**Storage Adapters**

- `@mcpconnect/adapter-localstorage` - Browser localStorage
- Custom storage adapters for databases, cloud storage

**LLM Adapters**

- `@mcpconnect/adapter-ai-sdk` - Vercel AI SDK integration
- Custom adapters for other LLM providers

## API

**Programmatic Usage**

```typescript
import { startServer } from "@mcpconnect/server";

const { url } = await startServer({
  port: 3001,
  cors: true,
  helmet: true,
});
```

**Testing MCP Connections**

```typescript
import { MCPService } from "@mcpconnect/adapter-ai-sdk";

const result = await MCPService.testConnection(connection);
if (result.isConnected) {
  console.log(`Found ${result.tools.length} tools`);
}
```

## Configuration

MCPConnect stores configuration in browser localStorage:

- **Connections** - MCP server endpoints and authentication
- **LLM Settings** - API keys and model preferences
- **UI State** - Theme, layout preferences
- **Tool Executions** - Request/response history for debugging

## Contributing

MCPConnect is open source under MIT license. Built with:

- **Frontend**: React, TypeScript, Tailwind CSS
- **Backend**: Node.js, Express
- **Protocol**: Model Context Protocol (MCP)
- **AI Integration**: Vercel AI SDK
- **Build**: Vite, Rollup, pnpm workspaces

```bash
git clone https://github.com/rocket-connect/mcpconnect
cd mcpconnect
pnpm install
pnpm dev
```

The development server runs the UI on `localhost:3000` with hot reload.

## License

MIT License - see [LICENSE](LICENSE) for details.

---

Built by [rconnect.tech](https://rconnect.tech) - connecting developers through open source tools.
