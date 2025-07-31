import express, { Request, Response } from "express";
import cors from "cors";
// Bun-compatible UUID generation
const randomUUID = () => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";

const app = express();
app.use(express.json());

// Configure CORS for browser clients (latest requirements)
app.use(cors({
  origin: ((globalThis as any).Bun?.env?.NODE_ENV || (globalThis as any).process?.env?.NODE_ENV) === 'production'
    ? ['https://mcp.demo.cjav.dev']
    : '*',
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
      name: "production-mcp-server",
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

  // // Add production-ready API tool
  // server.registerTool(
  //   "fetch-data",
  //   {
  //     title: "External API Fetcher",
  //     description: "Fetch data from external APIs with error handling",
  //     inputSchema: {
  //       url: z.string().url().describe("API endpoint URL"),
  //       method: z.enum(["GET", "POST", "PUT", "DELETE"]).default("GET"),
  //       headers: z.record(z.string()).optional().describe("HTTP headers"),
  //       body: z.string().optional().describe("Request body (JSON string)")
  //     }
  //   },
  //   async ({ url, method, headers = {}, body }) => {
  //     try {
  //       const response = await fetch(url, {
  //         method,
  //         headers: {
  //           'Content-Type': 'application/json',
  //           ...headers
  //         },
  //         body: body ? body : undefined
  //       });

  //       if (!response.ok) {
  //         throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  //       }

  //       const data = await response.text();

  //       return {
  //         content: [{
  //           type: "text",
  //           text: `Status: ${response.status}\nResponse: ${data}`
  //         }]
  //       };
  //     } catch (error) {
  //       return {
  //         content: [{
  //           type: "text",
  //           text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
  //         }],
  //         isError: true
  //       };
  //     }
  //   }
  // );

  // // Add LLM sampling tool (latest feature)
  // server.registerTool(
  //   "summarize-content",
  //   {
  //     title: "Content Summarizer",
  //     description: "Summarize text content using LLM sampling",
  //     inputSchema: {
  //       content: z.string().describe("Content to summarize"),
  //       length: z.enum(["brief", "detailed", "bullet-points"]).default("brief")
  //     }
  //   },
  //   async ({ content, length }) => {
  //     try {
  //       const promptMap = {
  //         brief: "Provide a brief 2-3 sentence summary of this content:",
  //         detailed: "Provide a comprehensive summary with key points and details:",
  //         "bullet-points": "Summarize this content as bullet points with main ideas:"
  //       };

  //       const response = await server.server.createMessage({
  //         messages: [{
  //           role: "user",
  //           content: {
  //             type: "text",
  //             text: `${promptMap[length]}\n\n${content}`
  //           }
  //         }],
  //         maxTokens: length === "detailed" ? 800 : 400
  //       });

  //       return {
  //         content: [{
  //           type: "text",
  //           text: response.content.type === "text"
  //             ? response.content.text
  //             : "Unable to generate summary"
  //         }]
  //       };
  //     } catch (error) {
  //       return {
  //         content: [{
  //           type: "text",
  //           text: `Summarization failed: ${error instanceof Error ? error.message : 'Unknown error'}`
  //         }],
  //         isError: true
  //       };
  //     }
  //   }
  // );

  // Add Star Wars API tool
  server.registerTool(
    "star-wars-info",
    {
      title: "Star Wars Information",
      description: "Get information about Star Wars films, characters, planets, starships, vehicles, and species from SWAPI",
      inputSchema: {
        resource: z.enum(["films", "people", "planets", "species", "starships", "vehicles"]).describe("Type of Star Wars resource to query"),
        id: z.number().optional().describe("Specific ID to get individual resource (omit to get all)"),
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
          formattedData = `Found ${data.count} results for ${resource}:\n\n`;
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

// Handle POST requests (client-to-server communication)
app.post('/mcp', async (req: Request, res: Response) => {
  const sessionId = req.headers['mcp-session-id'] as string | undefined;
  let transport: StreamableHTTPServerTransport;

  try {
    if (sessionId && transports[sessionId]) {
      // Reuse existing transport
      transport = transports[sessionId];
    } else if (!sessionId && isInitializeRequest(req.body)) {
      // New initialization request
      transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
        onsessioninitialized: (sessionId) => {
          transports[sessionId] = transport;
          console.log(`📱 New session initialized: ${sessionId}`);
        },
        // Enable DNS rebinding protection for security
          enableDnsRebindingProtection: ((globalThis as any).Bun?.env?.NODE_ENV || (globalThis as any).process?.env?.NODE_ENV) === 'production',
  allowedHosts: ((globalThis as any).Bun?.env?.NODE_ENV || (globalThis as any).process?.env?.NODE_ENV) === 'production'
          ? ['yourdomain.com', 'www.yourdomain.com']
          : ['127.0.0.1', 'localhost']
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

// Handle GET requests (server-to-client notifications via SSE)
app.get('/mcp', async (req: Request, res: Response) => {
  const sessionId = req.headers['mcp-session-id'] as string | undefined;

  if (!sessionId || !transports[sessionId]) {
    res.status(400).send('Invalid or missing session ID');
    return;
  }

  const transport = transports[sessionId];
  await transport.handleRequest(req, res);
});

// Handle DELETE requests (session termination)
app.delete('/mcp', async (req: Request, res: Response) => {
  const sessionId = req.headers['mcp-session-id'] as string | undefined;

  if (!sessionId || !transports[sessionId]) {
    res.status(400).send('Invalid or missing session ID');
    return;
  }

  const transport = transports[sessionId];
  await transport.handleRequest(req, res);
});

// Health check endpoint
app.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    activeSessions: Object.keys(transports).length,
    version: '1.0.0'
  });
});

// Start server
const PORT = ((globalThis as any).Bun?.env?.PORT || (globalThis as any).process?.env?.PORT) || 3000;
app.listen(PORT, () => {
  console.log(`🌐 Streamable HTTP MCP Server running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
  console.log(`🔗 MCP endpoint: http://localhost:${PORT}/mcp`);
  console.log(`🛡️ DNS protection: ${((globalThis as any).Bun?.env?.NODE_ENV || (globalThis as any).process?.env?.NODE_ENV) === 'production' ? 'enabled' : 'disabled'}`);
});

// Graceful shutdown - works in both Node.js and Bun
const gracefulShutdown = async () => {
  console.log('\n🛑 Shutting down gracefully...');
  // Close all active transports
  await Promise.all(Object.values(transports).map(transport => transport.close()));
  if ((globalThis as any).process) {
    (globalThis as any).process.exit(0);
  }
};

if ((globalThis as any).process) {
  (globalThis as any).process.on('SIGTERM', gracefulShutdown);
}