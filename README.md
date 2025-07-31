# Star Wars MCP Server

A Model Context Protocol (MCP) server that provides access to Star Wars information from the Star Wars API (SWAPI). This server can be deployed to Render and used by MCP-compatible AI assistants and clients.

## Features

- **Star Wars Information**: Access comprehensive data about films, characters, planets, starships, vehicles, and species
- **HTTP Transport**: Supports web-based MCP clients through HTTP transport
- **CORS Support**: Configured for browser-based clients
- **Health Monitoring**: Built-in health check endpoint
- **Production Ready**: Optimized for deployment on Render

## Local Development

### Prerequisites

- [Bun](https://bun.sh/) >= 1.0.0

### Setup

1. Clone the repository:

```bash
git clone https://github.com/cjavdev/mcp-demo.git
cd mcp-demo
```

2. Install dependencies:

```bash
bun install
```

3. Review and customize environment variables:

The repository includes:

- **`.env.example`** - Template showing all available environment variables
- **`.env`** - Pre-configured for local development

You can customize `.env` for your specific needs if required.

4. Start the development server:

```bash
bun dev
```

The server will start on `http://localhost:3000` with the following endpoints:

- **MCP Endpoint**: `http://localhost:3000/mcp`
- **Health Check**: `http://localhost:3000/health`

### Testing with MCP Inspector

To verify your local MCP server is working correctly, you can use the official MCP Inspector tool:

1. **Start your local server** (if not already running):

```bash
bun dev
```

2. **Run the MCP Inspector** in a new terminal:

```bash
npx @modelcontextprotocol/inspector http://localhost:3000/mcp
```

3. **Test the server capabilities**:

   - The inspector will open in your default browser
   - You'll see the server's available tools, resources, and prompts
   - Test the `star-wars-info` tool with different parameters:
     - Resource: `films`, `people`, `planets`, etc.
     - Try with and without ID or search parameters
   - Verify all functionality works as expected

4. **Expected functionality**:
   - ✅ Server should initialize and show capabilities
   - ✅ Star Wars tool should return formatted data
   - ✅ Error handling should work gracefully
   - ✅ Session management should be stable

**Troubleshooting**:

- If the inspector can't connect, verify the server is running on port 3000
- Check the server logs for any error messages
- Ensure no firewall is blocking the connection

## Environment Variables

The MCP server supports the following environment variables:

### `ALLOWED_DOMAINS`

- **Description**: Comma-separated list of domains for CORS and DNS rebinding protection
- **Default**: `mcp.demo.cjav.dev`
- **Usage**: Set this to your custom domains when deploying to production
- **Example**: `ALLOWED_DOMAINS=your-custom-domain.com,another-domain.com`

### `NODE_ENV`

- **Description**: Application environment
- **Values**: `development` or `production`
- **Default**: `development`
- **Usage**: Set to `production` for production deployments

### `PORT`

- **Description**: Server port
- **Default**: `3000`
- **Usage**: Automatically set by Render, but can be overridden for local development

### Setting Environment Variables

#### Local Development

The project uses `.env` files for local environment configuration. The repository includes:

- **`.env`** - Ready-to-use local development configuration
- **`.env.example`** - Template showing all available options

To customize your local environment, simply edit the `.env` file:

```bash
# Environment Configuration
NODE_ENV=development
PORT=3000
ALLOWED_DOMAINS=localhost:3000,127.0.0.1:3000
LOG_LEVEL=info
```

#### Render Dashboard

1. Go to your service in the Render dashboard
2. Navigate to "Environment" tab
3. Add environment variables:
   - `NODE_ENV`: `production`
   - `ALLOWED_DOMAINS`: `your-custom-domain.com,api.your-domain.com`

#### Render YAML

Add to your `render.yaml`:

```yaml
envVars:
  - key: NODE_ENV
    value: production
  - key: ALLOWED_DOMAINS
    value: your-custom-domain.com,api.your-domain.com
```

## Deploying to Render

### Using the Render Dashboard

1. **Fork/Clone the Repository**: Ensure you have this code in a Git repository that Render can access.

2. **Create a New Web Service**:

   - Go to [Render Dashboard](https://dashboard.render.com)
   - Click "New +" → "Web Service"
   - Connect your GitHub/GitLab repository
   - Select this repository

3. **Configure the Service**:

   - **Name**: `mcp-demo` (or your preferred name)
   - **Runtime**: `Node`
   - **Build Command**: `bun install`
   - **Start Command**: `bun start`
   - **Plan**: `Starter` (or higher based on your needs)

4. **Set Environment Variables**:

   - `NODE_ENV`: `production`
   - `ALLOWED_DOMAINS`: Comma-separated list of your custom domains (optional, defaults to `mcp.demo.cjav.dev`)

5. **Deploy**: Click "Create Web Service"

### Using the Render YAML (Recommended)

This repository includes a `render.yaml` file for infrastructure-as-code deployment:

1. **Connect Repository to Render**:

   - Go to [Render Dashboard](https://dashboard.render.com)
   - Click "New +" → "Blueprint"
   - Connect your repository
   - Render will automatically detect the `render.yaml` file

2. **Review Configuration**: The YAML defines:

   - Web service with Starter plan
   - Bun build and start commands
   - Production environment variables (`NODE_ENV`, `ALLOWED_DOMAINS`)
   - Optional custom domain configuration

3. **Deploy**: Click "Apply" to deploy

### Using Render CLI

If you have the [Render CLI](https://render.com/docs/cli) installed:

```bash
# Deploy using the render.yaml
render services create
```

## Configuring MCP Clients

Once deployed to Render, your MCP server will be accessible via HTTP. Here's how to configure various MCP clients:

### Getting Your Server URL

After deployment, your server will be available at:

- **Render URL**: `https://your-service-name.onrender.com`
- **Custom Domain** (if configured): `https://mcp.demo.cjav.dev`

The MCP endpoint will be: `https://your-service-name.onrender.com/mcp`

### Claude Desktop Configuration

Add to your Claude Desktop configuration (`~/Library/Application Support/Claude/claude_desktop_config.json` on macOS):

```json
{
  "mcpServers": {
    "starwars": {
      "command": "npx",
      "args": [
        "@modelcontextprotocol/server-fetch",
        "https://your-service-name.onrender.com/mcp"
      ]
    }
  }
}
```

### Cline (VS Code Extension) Configuration

In your Cline settings, add the MCP server:

```json
{
  "mcp.servers": [
    {
      "name": "starwars",
      "transport": {
        "type": "http",
        "baseUrl": "https://your-service-name.onrender.com/mcp"
      }
    }
  ]
}
```

### Generic HTTP MCP Client

For any MCP client that supports HTTP transport:

```json
{
  "transport": {
    "type": "http",
    "baseUrl": "https://your-service-name.onrender.com/mcp"
  }
}
```

### Browser-based Clients

This server supports CORS for browser-based clients. Simply connect to:

```
https://your-service-name.onrender.com/mcp
```

## Available Tools

The server provides one main tool:

### `star-wars-info`

Get information about Star Wars films, characters, planets, starships, vehicles, and species.

**Parameters:**

- `resource` (required): Type of resource - "films", "people", "planets", "species", "starships", or "vehicles"
- `id` (optional): Specific ID to fetch (if omitted, returns all items)
- `search` (optional): Search term to filter results

**Examples:**

- Get all films: `{"resource": "films"}`
- Get specific character: `{"resource": "people", "id": "1"}`
- Search for planets: `{"resource": "planets", "search": "Tatooine"}`

## Monitoring and Health Checks

### Health Check Endpoint

The server provides a health check at `/health`:

```bash
curl https://your-service-name.onrender.com/health
```

Response:

```json
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "activeSessions": 0,
  "version": "1.0.0"
}
```

### Logs

Monitor your deployment through the Render dashboard:

1. Go to your service in the Render dashboard
2. Click on "Logs" to view real-time application logs
3. Monitor for any connection issues or errors

## Troubleshooting

### Common Issues

1. **CORS Errors**: Ensure your client origin is included in the CORS configuration if you're using a browser-based client.

2. **Connection Timeouts**: Render's free tier may experience cold starts. Consider upgrading to a paid plan for better performance.

3. **Environment Variables**: Make sure `NODE_ENV=production` is set in your Render service configuration.

### Debug Mode

For local debugging, you can enable verbose logging by modifying the server or adding debug environment variables.

## Development Scripts

- `bun dev` - Start HTTP MCP server with hot reload
- `bun start` - Start HTTP MCP server (production)
- `bun lint` - Run ESLint
- `bun lint:fix` - Fix ESLint errors automatically
- `bun type-check` - Run TypeScript type checking
- `bun build` - Build HTTP server for production
- `bun clean` - Clean build artifacts

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test locally
5. Submit a pull request

## License

MIT License - see LICENSE file for details.
