# MCP Demo Server

A demonstration [Model Context Protocol (MCP)](https://modelcontextprotocol.io/) server built with TypeScript and Bun. This server provides a simple math tool that can add two numbers together, showcasing how to implement MCP tools and handle HTTP-based MCP communication.

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/your-username/mcp-demo)

## Features

- **MCP Tool Implementation**: Simple addition tool demonstrating MCP tool registration
- **HTTP Transport**: Uses streamable HTTP transport for MCP communication
- **Session Management**: Handles multiple concurrent MCP sessions
- **Security**: CORS protection and optional token authentication
- **Health Monitoring**: Built-in health check endpoint
- **Production Ready**: Configured for deployment with proper environment variables

## Quick Start

### Prerequisites

- [Bun](https://bun.sh/) >= 1.0.0
- Node.js (for development)

### Local Development

1. **Clone the repository**

   ```bash
   git clone <repository-url>
   cd mcp-demo
   ```

2. **Install dependencies**

   ```bash
   bun install
   ```

3. **Start the development server**

   ```bash
   bun run dev
   ```

4. **Test the server**
   ```bash
   curl http://localhost:3000/health
   ```

The server will be running at `http://localhost:3000` with the MCP endpoint at `/mcp`.

## API Endpoints

### MCP Endpoint

- **POST/GET `/mcp`** - Main MCP communication endpoint
  - Handles MCP protocol messages
  - Manages session initialization and tool calls
  - Requires `mcp-session-id` header for existing sessions

### Health Check

- **GET `/health`** - Server health status
  - Returns server status and active session count
  - Used for monitoring and load balancer health checks

## Available Tools

### Add Tool

Adds two numbers together.

**Parameters:**

- `a` (number): First number
- `b` (number): Second number

**Returns:** The sum of `a + b`

## Environment Variables

| Variable          | Description                                      | Default       | Required   |
| ----------------- | ------------------------------------------------ | ------------- | ---------- |
| `PORT`            | Server port                                      | `3000`        | No         |
| `NODE_ENV`        | Environment mode                                 | `development` | No         |
| `ALLOWED_DOMAINS` | Comma-separated list of allowed domains for CORS | -             | Production |
| `SERVER_TOKEN`    | Bearer token for authentication                  | -             | Production |

## Deployment

### Deploy to Render

Click the deploy button above or manually deploy:

1. Fork this repository
2. Connect your Render account to GitHub
3. Create a new Web Service
4. Set the following:
   - **Build Command**: `bun install`
   - **Start Command**: `bun run start`
   - **Environment Variables**: Set `NODE_ENV=production` and other required vars

### Manual Deployment

1. **Build the project**

   ```bash
   bun run build
   ```

2. **Set environment variables**

   ```bash
   export NODE_ENV=production
   export ALLOWED_DOMAINS=your-domain.com
   export SERVER_TOKEN=your-secure-token
   ```

3. **Start the server**
   ```bash
   bun run start
   ```

## Development

### Scripts

- `bun run dev` - Start development server with file watching
- `bun run build` - Build the project
- `bun run start` - Start production server
- `bun run clean` - Remove build artifacts

### Project Structure

```
mcp-demo/
├── src/
│   └── server.ts          # Main server implementation
├── package.json           # Dependencies and scripts
├── tsconfig.json         # TypeScript configuration
├── render.yaml           # Render deployment configuration
└── README.md             # This file
```

## MCP Protocol

This server implements the Model Context Protocol, which allows AI assistants to connect to external tools and data sources. The server:

1. **Registers Tools**: Defines available tools with schemas
2. **Handles Sessions**: Manages multiple concurrent client connections
3. **Processes Requests**: Executes tool calls and returns results
4. **Maintains State**: Keeps session state for ongoing conversations

For more information about MCP, visit [modelcontextprotocol.io](https://modelcontextprotocol.io/).

## Security

- **CORS Protection**: Configurable allowed origins
- **Token Authentication**: Optional bearer token auth for production
- **DNS Rebinding Protection**: Enabled in production mode
- **Input Validation**: Zod schema validation for tool parameters

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test locally
5. Submit a pull request

## License

MIT License - see LICENSE file for details.

## Support

For questions or issues:

- Check the [MCP Documentation](https://modelcontextprotocol.io/docs)
- Open an issue in this repository
- Review the server logs for debugging information
