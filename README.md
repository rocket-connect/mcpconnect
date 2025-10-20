# MCP Connect

<div align="center">
  <picture>
    <source srcset="./docs/mcpconnect-github-ui-dark.png" media="(prefers-color-scheme: dark)">
    <img src="./docs/mcpconnect-github-ui-light.png" width="90%" alt="MCP Connect Interface Overview" />
  </picture>
  <p><a href="https://mcp.rconnect.tech" target="_blank" rel="noopener noreferrer">mcp.rconnect.tech</a></p>
</div>

Browser-based development environment for debugging and testing Model Context Protocol (MCP) servers.

**Integration Guides:**

- → [How to connect to the Supabase MCP server](https://www.rconnect.tech/blog/how-to-mcp-connect-supabase)
- → [How to connect to the GitHub MCP server](https://www.rconnect.tech/blog/how-to-mcp-connect-github)
- → [How to connect to the Neo4j MCP server](https://www.rconnect.tech/blog/how-to-mcp-connect-neo4j)

## Quick Start

```bash
npx @mcpconnect/cli@latest
```

Opens browser!

## What It Does

- **Connect** to any MCP server (HTTP, WebSocket, SSE)
- **Test** tools with Claude or OpenAI models
- **Debug** with protocol inspection
- **Control** which tools are enabled to save tokens
- **Export** conversations in JSON/Markdown

**Good for developers:**

- Iterate quickly on tool development
- Execute tools manually from tool page
- Test changes without restarting clients

## Setup

### 1. Start MCP Connect

```bash
# One-time use
npx @mcpconnect/cli@latest

# Or install globally
npm install -g @mcpconnect/cli@latest
mcpconnect
```

### 2. Add Connection

- Click **+ New Connection**
- Enter your MCP server URL
- Test and save

### 3. Configure AI Provider

- Click **Settings** (⚙️)
- Configure endpoint, model, and API token
- Test and save

### 4. Start Testing

Enable tools in sidebar, then chat with your AI model.

## Key Features

| Feature                | Description                                           |
| ---------------------- | ----------------------------------------------------- |
| **Tool Management**    | Enable/disable individual tools to reduce token usage |
| **Protocol Inspector** | View raw MCP requests and responses                   |
| **Multi-Connection**   | Manage multiple MCP servers simultaneously            |
| **Export**             | Save conversations as JSON, Markdown, or text         |
| **Local Storage**      | All data stays in your browser                        |
| **Zero Config**        | No signup, no external dependencies                   |

## Browser Support

Requires modern browser with:

- ES2020+ JavaScript
- WebSocket API
- Server-Sent Events
- localStorage (10MB+)

## Development

```bash
git clone https://github.com/rocket-connect/mcpconnect.git
cd mcpconnect
pnpm install
pnpm run dev
```

## License

MIT - see [LICENSE](LICENSE)

<div align="center">
  <p>Built by <a href="https://rconnect.tech">rconnect.tech</a></p>
</div>
