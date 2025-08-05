import express, { Request, Response } from "express";
import cors from "cors";
import { randomUUID } from "crypto";
import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";

const app = express();
app.use(express.json());

// Environment configuration
const env = {
  ALLOWED_DOMAINS: process.env.NODE_ENV === 'production'
    ? (process.env.ALLOWED_DOMAINS?.split(',').map(d => d.trim()) || [])
    : ['localhost:3000', '127.0.0.1:3000', '6eb2dca05ce6.ngrok-free.app:3000']
};

// Configure CORS for browser clients (latest requirements)
const getAllowedOrigins = () => {
  if (process.env.NODE_ENV !== 'production') return '*';

  const origins: string[] = [];
  env.ALLOWED_DOMAINS.forEach(domain => {
    origins.push(`https://${domain}`, `http://${domain}`);
  });
  return origins;
};

app.use(cors({
  origin: getAllowedOrigins(),
  exposedHeaders: ['Mcp-Session-Id'], // Required for browser clients
  allowedHeaders: ['Content-Type', 'mcp-session-id'],
  methods: ['GET', 'POST', 'DELETE']
}));

// Session management for stateful connections
const transports: { [sessionId: string]: StreamableHTTPServerTransport } = {};

// Create and configure MCP server
function createMcpServer(): McpServer {
  const server = new McpServer(
    {
      name: "starwars-mcp-server",
      version: "1.0.0"
    },
    {
      // Enable notification debouncing for better performance
      debouncedNotificationMethods: [
        'notifications/tools/list_changed',
        'notifications/resources/list_changed',
        'notifications/prompts/list_changed'
      ]
    }
  );

  server.registerTool("add",
    {
      title: "Addition Tool",
      description: "Add two numbers",
      inputSchema: { a: z.number(), b: z.number() }
    },
    async ({ a, b }) => ({
      content: [{ type: "text", text: String(a + b) }]
    })
  );

  server.registerResource(
    "greeting",
    new ResourceTemplate("greeting://{name}", { list: undefined }),
    {
      title: "Greeting Resource",      // Display name for UI
      description: "Dynamic greeting generator"
    },
    async (uri, { name }) => ({
      contents: [{
        uri: uri.href,
        text: `Hello, ${name}!`
      }]
    })
  );

  server.registerPrompt(
    "review-code",
    {
      title: "Code Review",
      description: "Review code for best practices and potential issues",
      argsSchema: { code: z.string() }
    },
    ({ code }) => ({
      messages: [{
        role: "user",
        content: {
          type: "text",
          text: `Please review this code:\n\n${code}`
        }
      }]
    })
  );

  // 1. SEARCH TOOL (for discovery)
  server.registerTool(
    "search-star-wars",
    {
      title: "Search Star Wars",
      description: "Search for Star Wars films, characters, planets, starships, vehicles, and species",
      inputSchema: {
        resource: z.enum(["films", "people", "planets", "species", "starships", "vehicles"]).describe("Type of Star Wars resource to search"),
        query: z.string().describe("Search term to filter results by name")
      }
    },
    async ({ resource, query }) => {
      try {
        const url = `https://swapi.info/api/${resource}?search=${encodeURIComponent(query)}`;
        const response = await fetch(url);

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json() as any;

        if (data.results && data.results.length > 0) {
          const results = data.results.map((item: any) => {
            const id = item.url.split('/').filter(Boolean).pop();
            return {
              name: item.name || item.title,
              id: id,
              uri: `starwars://${resource}/${id}`
            };
          });

          return {
            content: [{
              type: "text",
              text: `Found ${results.length} results:\n\n` +
                    results.map((r: any) => `• ${r.name} (${r.uri})`).join('\n')
            }]
          };
        } else {
          return {
            content: [{
              type: "text",
              text: `No results found for "${query}" in ${resource}`
            }]
          };
        }
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: `Error searching: ${error instanceof Error ? error.message : 'Unknown error'}`
          }],
          isError: true
        };
      }
    }
  );

  // 2. RESOURCES (for individual data access)
  const resourceTypes = ["films", "people", "planets", "species", "starships", "vehicles"];

  resourceTypes.forEach(resourceType => {
    server.registerResource(
      `starwars-${resourceType}`,
            new ResourceTemplate(`starwars://${resourceType}/{id}`, {
        list: undefined  // Use search tool for discovery instead
      }),
      {
        title: `Star Wars ${resourceType.charAt(0).toUpperCase() + resourceType.slice(1)}`,
        description: `Individual Star Wars ${resourceType} data from SWAPI`
      },
      async (uri, { id }) => {
        console.log(`API Call to SWAPI ${resourceType} ${id}`);
        try {
          const response = await fetch(`https://swapi.info/api/${resourceType}/${id}`);

          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }

          const data = await response.json();

          // Return the raw data as JSON for programmatic access
          // and a formatted text version for human readability
          return {
            contents: [
              {
                uri: uri.href,
                mimeType: "application/json",
                text: JSON.stringify(data, null, 2)
              },
              {
                uri: uri.href,
                mimeType: "text/plain",
                text: formatStarWarsData(data, resourceType)
              }
            ]
          };
        } catch (error) {
          console.log({ error });
          throw new Error(`Failed to fetch ${resourceType} ${id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }
    );
  });

  // Helper function to format the data nicely
  function formatStarWarsData(data: any, resourceType: string): string {
    let formatted = `${resourceType.charAt(0).toUpperCase() + resourceType.slice(1)} Information:\n\n`;
    formatted += `Name: ${data.name || data.title}\n`;

    // Add relevant fields based on resource type
    const fieldMappings: { [key: string]: string[] } = {
      films: ['episode_id', 'director', 'producer', 'release_date', 'opening_crawl'],
      people: ['birth_year', 'height', 'mass', 'hair_color', 'eye_color', 'gender'],
      planets: ['diameter', 'climate', 'terrain', 'population'],
      species: ['classification', 'designation', 'average_height', 'language'],
      starships: ['model', 'manufacturer', 'cost_in_credits', 'length', 'crew', 'passengers'],
      vehicles: ['model', 'manufacturer', 'cost_in_credits', 'length', 'crew', 'passengers']
    };

    const fields = fieldMappings[resourceType] || [];
    fields.forEach(field => {
      if (data[field]) {
        const label = field.split('_').map(word =>
          word.charAt(0).toUpperCase() + word.slice(1)
        ).join(' ');
        formatted += `${label}: ${data[field]}\n`;
      }
    });

    if (data.opening_crawl) {
      formatted += `\nOpening Crawl:\n${data.opening_crawl}\n`;
    }

    return formatted;
  }

  return server;
}

// Initialze and start session connect requests
app.post('/mcp', async (req: Request, res: Response) => {
  console.log("POST Request received at /mcp");
  console.log(JSON.stringify(req.body, null, 2));
  console.log(req.headers);
  const sessionId = req.headers['mcp-session-id'] as string | undefined;
  let transport: StreamableHTTPServerTransport;

  try {
    if (sessionId && transports[sessionId]) {
      console.log(`Reusing existing transport: ${sessionId}`);
      // Reuse existing transport
      transport = transports[sessionId];
    } else if (!sessionId && isInitializeRequest(req.body)) {
      console.log("New initialization request");
      // New initialization request
      transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
        onsessioninitialized: (sessionId) => {
          transports[sessionId] = transport;
          console.log(`📱 New session initialized: ${sessionId}`);
        },
        enableDnsRebindingProtection: process.env.NODE_ENV === 'production',
        allowedHosts: env.ALLOWED_DOMAINS
      });

      // Clean up transport when closed
      transport.onclose = () => {
        if (transport.sessionId) {
          console.log(`🗑️ Session closed: ${transport.sessionId}`);
          delete transports[transport.sessionId];
        }
      };

      const server = createMcpServer();
      await server.connect(transport);
    } else {
      res.status(400).json({
        jsonrpc: '2.0',
        error: {
          code: -32000,
          message: 'Bad Request: No valid session ID provided',
        },
        id: null,
      });
      return;
    }

    await transport.handleRequest(req, res, req.body);
  } catch (error) {
    console.error('❌ Error handling MCP request:', error);
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: '2.0',
        error: {
          code: -32603,
          message: 'Internal server error',
        },
        id: null,
      });
    }
  }
});

// Reconnect requests for existing sessions
app.get('/mcp', async (req: Request, res: Response) => {
  console.log("GET Request received at /mcp");
  const sessionId = req.headers['mcp-session-id'] as string | undefined;

  if (!sessionId || !transports[sessionId]) {
    res.status(400).send('Invalid or missing session ID');
    return;
  }

  const transport = transports[sessionId];
  await transport.handleRequest(req, res);
});

// Disconnect requests for existing sessions
app.delete('/mcp', async (req: Request, res: Response) => {
  console.log("DELETE Request received at /mcp");
  const sessionId = req.headers['mcp-session-id'] as string | undefined;

  if (!sessionId || !transports[sessionId]) {
    res.status(400).send('Invalid or missing session ID');
    return;
  }

  const transport = transports[sessionId];
  await transport.handleRequest(req, res);
});

const sseTransports: { [sessionId: string]: SSEServerTransport } = {};
// Legacy SSE endpoint for older clients
app.get('/sse', async (req, res) => {
  // Create SSE transport for legacy clients
  const transport = new SSEServerTransport('/messages', res);
  sseTransports[transport.sessionId] = transport;

  res.on("close", () => {
    delete sseTransports[transport.sessionId];
  });

  const server = createMcpServer();
  await server.connect(transport);
});

// Legacy message endpoint for older clients
app.post('/messages', async (req, res) => {
  const sessionId = req.query.sessionId as string;
  const transport = sseTransports[sessionId];
  if (transport) {
    await transport.handlePostMessage(req, res, req.body);
  } else {
    res.status(400).send('No transport found for sessionId');
  }
});

app.get('/', (req: Request, res: Response) => {
  console.log("GET Request received at /");
  res.send('This is a demo MCP server. Use `/mcp` for Streamable HTTP.');
});

// Health check endpoint
app.get('/health', (req: Request, res: Response) => {
  console.log("Request received at /health");
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    activeSessions: Object.keys(transports).length,
    version: '1.0.0'
  });
});

// Start server
const PORT = parseInt(process.env.PORT || '3000', 10);
app.listen(PORT, () => {
  console.log(`🌐 Streamable HTTP MCP Server running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
  console.log(`🔗 MCP endpoint: http://localhost:${PORT}/mcp`);
  console.log(`🛡️ DNS protection: ${process.env.NODE_ENV === 'production' ? 'enabled' : 'disabled'}`);
  console.log(`🔒 Allowed domains: ${process.env.ALLOWED_DOMAINS?.split(',').map(d => d.trim()).join(', ')}`);
});

const gracefulShutdown = async () => {
  console.log('\n🛑 Shutting down gracefully...');
  // Close all active transports
  await Promise.all(Object.values(transports).map(transport => transport.close()));
  process.exit(0);
};

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);