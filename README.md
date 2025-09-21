# MCP Connect

<div align="center">
  <picture>
    <source srcset="./docs/mcpconnect-github-ui-dark.png" media="(prefers-color-scheme: dark)">
    <img src="./docs/mcpconnect-github-ui-light.png" width="90%" alt="MCP Connect Interface Overview" />
  </picture>
  <p><a href="https://mcp.rconnect.tech" target="_blank" rel="noopener noreferrer">mcp.rconnect.tech</a></p>
</div>

A browser-based development tool for testing, debugging, and building Model Context Protocol (MCP) integrations. MCP Connect provides a visual interface for connecting to MCP servers, managing tools, and testing AI interactions.

## What is MCP Connect?

MCP Connect is a developer workbench that simplifies working with the Model Context Protocol. It acts as a bridge between MCP servers and AI language models, allowing you to:

- Connect to MCP servers via HTTP, WebSocket, or Server-Sent Events
- Test and debug MCP tools in a visual interface
- Chat with AI models while using MCP tools
- Inspect tool executions and protocol communications
- Manage multiple MCP connections and conversations

Think of it as a development environment for MCP, similar to how Postman is used for REST APIs.

## Quick Start

Get started in under 30 seconds:

```bash
npx @mcpconnect/cli
```

This command starts the MCP Connect server and opens your browser to the interface. No installation required.

## How It Works

MCP Connect consists of three main components:

### 1. Connection Management

- Configure connections to MCP servers
- Support for multiple transport protocols (HTTP, WebSocket, SSE)
- Handle authentication (Bearer tokens, API keys, Basic auth)
- Auto-discovery of available tools and resources

### 2. Visual Tool Testing

- Browse available MCP tools in a sidebar
- Enable/disable tools for specific conversations
- Execute tools individually or through AI chat
- Inspect tool inputs, outputs, and execution details

### 3. AI Integration

- Connect your AI provider (Anthropic Claude, OpenAI)
- Chat with AI models that can use your MCP tools
- Stream responses in real-time
- Track tool usage across conversations

## Installation Options

### CLI (Recommended)

```bash
# Run once without installation
npx @mcpconnect/cli

# Or install globally
npm install -g @mcpconnect/cli
mcpconnect
```

### Programmatic Usage

```javascript
import { startServer } from "@mcpconnect/server";

const { url } = await startServer({
  port: 3001,
  host: "localhost",
});

console.log(`MCP Connect running at ${url}`);
```

## Architecture

MCP Connect is built as a modular TypeScript monorepo:

- **@mcpconnect/cli** - Command-line interface for quick setup
- **@mcpconnect/server** - Express server with integrated UI
- **@mcpconnect/ui** - React frontend application
- **@mcpconnect/components** - Reusable UI components
- **@mcpconnect/adapter-ai-sdk** - AI provider integration layer
- **@mcpconnect/adapter-localstorage** - Browser storage adapter
- **@mcpconnect/schemas** - TypeScript type definitions

All data is stored locally in your browser using localStorage, with no external dependencies or data transmission.

## Configuration

### MCP Server Connection

1. Click "Add Connection" in the interface
2. Enter your MCP server URL (supports http://, https://, ws://, wss://)
3. Configure authentication if required
4. Test the connection to verify tools are discoverable

### AI Provider Setup

1. Open Settings from the header
2. Add your AI provider API key
3. Select your preferred model and adjust parameters
4. Test the API key to ensure connectivity

## Browser Compatibility

MCP Connect works in modern browsers that support:

- ES2020+ JavaScript features
- WebSocket API
- Server-Sent Events
- localStorage API
- Fetch API

Tested browsers: Chrome 90+, Firefox 88+, Safari 14+, Edge 90+

## Security

- All data stored locally in browser localStorage
- No external data transmission except to configured MCP servers and AI providers
- HTTPS/WSS recommended for production MCP server connections
- API keys stored locally and never transmitted to MCP Connect servers

## Performance

- Optimized bundle size with code splitting
- Lazy loading of UI components
- Efficient local storage with compression options
- Streaming support for real-time AI responses

## Troubleshooting

### Connection Issues

- Verify MCP server URL is accessible
- Check CORS configuration on MCP server
- Ensure proper authentication credentials
- Test with HTTP before trying WebSocket/SSE

### Tool Execution Problems

- Confirm tools are enabled in the sidebar
- Check tool parameters match MCP server expectations
- Review inspector panel for detailed execution logs
- Verify AI provider API key is configured correctly

## Contributing

We welcome contributions to MCP Connect:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

Please ensure your code follows the existing patterns and includes appropriate tests.

## License

MIT License - see [LICENSE](LICENSE) file for details.

## Support

- GitHub Issues: [Report bugs and request features](https://github.com/rocket-connect/mcpconnect/issues)
- Documentation: Available in the repository wiki
- Community: Join discussions in GitHub Discussions

Built by [rconnect.tech](https://rconnect.tech) - Advancing AI integration tools for developers.
