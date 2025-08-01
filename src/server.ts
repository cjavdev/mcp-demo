import express, { Request, Response } from "express";
// import cors from "cors";
import { randomUUID } from "crypto";
import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";

const app = express();
app.use(express.json());

// Environment configuration
const env = {
//   NODE_ENV: process.env.NODE_ENV || 'development',
//   PORT: process.env.PORT || '3000',
  ALLOWED_DOMAINS: process.env.NODE_ENV === 'production'
    ? (process.env.ALLOWED_DOMAINS?.split(',').map(d => d.trim()) || [])
    : ['localhost:3000', '127.0.0.1:3000']
};

// // Configure CORS for browser clients (latest requirements)
// const getAllowedOrigins = () => {
//   if (env.NODE_ENV !== 'production') return '*';

//   const origins: string[] = [];
//   env.ALLOWED_DOMAINS.forEach(domain => {
//     origins.push(`https://${domain}`, `http://${domain}`);
//   });
//   return origins;
// };

// app.use(cors({
//   origin: getAllowedOrigins(),
//   exposedHeaders: ['Mcp-Session-Id'], // Required for browser clients
//   allowedHeaders: ['Content-Type', 'mcp-session-id'],
//   methods: ['GET', 'POST', 'DELETE']
// }));

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

  // Add Star Wars API tool
  server.registerTool(
    "star-wars-info",
    {
      title: "Star Wars Information",
      description: "Get information about Star Wars films, characters, planets, starships, vehicles, and species from SWAPI",
      inputSchema: {
        resource: z.enum(["films", "people", "planets", "species", "starships", "vehicles"]).describe("Type of Star Wars resource to query. Required."),
        id: z.number().optional().describe("Specific integer ID to get individual resource (omit to get all)"),
        search: z.string().optional().describe("Search term to filter results by name")
      }
    },
    async ({ resource, id, search }) => {
      try {
        let url = `https://swapi.info/api/${resource}`;

        if (id) {
          url += `/${id}`;
        } else if (search) {
          url += `?search=${encodeURIComponent(search)}`;
        }

        const response = await fetch(url);

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json() as any;

        // Format the response nicely
        let formattedData: string;

        if (data.results) {
          // Multiple results
          formattedData = `Found ${data.count} StarWars results for ${resource}:\n\n`;
          data.results.forEach((item: any, index: number) => {
            formattedData += `${index + 1}. ${item.name || item.title}\n`;
            if (item.episode_id) formattedData += `   Episode: ${item.episode_id}\n`;
            if (item.birth_year) formattedData += `   Birth Year: ${item.birth_year}\n`;
            if (item.climate) formattedData += `   Climate: ${item.climate}\n`;
            if (item.model) formattedData += `   Model: ${item.model}\n`;
            if (item.classification) formattedData += `   Classification: ${item.classification}\n`;
            formattedData += '\n';
          });
        } else {
          // Single result
          formattedData = `${resource.charAt(0).toUpperCase() + resource.slice(1)} Information:\n\n`;
          formattedData += `Name: ${data.name || data.title}\n`;

          // Add relevant fields based on resource type
          if (data.episode_id) formattedData += `Episode: ${data.episode_id}\n`;
          if (data.director) formattedData += `Director: ${data.director}\n`;
          if (data.release_date) formattedData += `Release Date: ${data.release_date}\n`;
          if (data.birth_year) formattedData += `Birth Year: ${data.birth_year}\n`;
          if (data.height) formattedData += `Height: ${data.height}cm\n`;
          if (data.mass) formattedData += `Mass: ${data.mass}kg\n`;
          if (data.hair_color) formattedData += `Hair Color: ${data.hair_color}\n`;
          if (data.eye_color) formattedData += `Eye Color: ${data.eye_color}\n`;
          if (data.gender) formattedData += `Gender: ${data.gender}\n`;
          if (data.diameter) formattedData += `Diameter: ${data.diameter}km\n`;
          if (data.climate) formattedData += `Climate: ${data.climate}\n`;
          if (data.terrain) formattedData += `Terrain: ${data.terrain}\n`;
          if (data.population) formattedData += `Population: ${data.population}\n`;
          if (data.model) formattedData += `Model: ${data.model}\n`;
          if (data.manufacturer) formattedData += `Manufacturer: ${data.manufacturer}\n`;
          if (data.cost_in_credits) formattedData += `Cost: ${data.cost_in_credits} credits\n`;
          if (data.length) formattedData += `Length: ${data.length}m\n`;
          if (data.crew) formattedData += `Crew: ${data.crew}\n`;
          if (data.passengers) formattedData += `Passengers: ${data.passengers}\n`;
          if (data.classification) formattedData += `Classification: ${data.classification}\n`;
          if (data.designation) formattedData += `Designation: ${data.designation}\n`;
          if (data.average_height) formattedData += `Average Height: ${data.average_height}cm\n`;
          if (data.language) formattedData += `Language: ${data.language}\n`;
          if (data.opening_crawl) formattedData += `\nOpening Crawl:\n${data.opening_crawl}\n`;
        }

        return {
          content: [{
            type: "text",
            text: formattedData
          }]
        };
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: `Error fetching Star Wars data: ${error instanceof Error ? error.message : 'Unknown error'}`
          }],
          isError: true
        };
      }
    }
  );

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