# @mcpconnect/cli

Command-line interface for MCPConnect - quickly start a server with UI for debugging MCP integrations.

## Quick Start

```bash
npx mcpconnect
```

This will:

1. Start the MCPConnect server on `http://localhost:3001`
2. Automatically open your browser to the UI
3. Serve the full MCPConnect interface

## Usage

### Default Command

```bash
# Start server on default port 3001
npx mcpconnect

# Start on specific port
npx mcpconnect 8080

# Start with options
npx mcpconnect --host 0.0.0.0 --no-open
```

### Explicit Start Command

```bash
# Start with explicit command
npx mcpconnect start

# With options
npx mcpconnect start --port 8080 --host 0.0.0.0
```

## Options

- `-p, --port <port>` - Port to run server on (default: 3001)
- `-h, --host <host>` - Host to bind server to (default: localhost)
- `--no-open` - Don't automatically open browser
- `--no-cors` - Disable CORS middleware
- `--no-helmet` - Disable security headers

## Examples

```bash
# Basic usage
npx mcpconnect

# Custom port and host
npx mcpconnect --port 8080 --host 0.0.0.0

# Don't open browser automatically
npx mcpconnect --no-open

# Development mode (disable security features)
npx mcpconnect --no-helmet --no-cors
```

## Programmatic Usage

You can also use the CLI functions programmatically:

```typescript
import { startServer } from "@mcpconnect/cli";

const { url } = await startServer({
  port: 3001,
  host: "localhost",
  cors: true,
  helmet: true,
});

console.log(`Server running at ${url}`);
```

## Development

```bash
# Clone and setup
git clone https://github.com/rocket-connect/mcpconnect
cd mcpconnect
pnpm install

# Build all packages
pnpm build

# Test CLI locally
pnpm start
```
