import express, { Request, Response } from "express";
import cors from "cors";
import { randomUUID } from "crypto";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";

const app = express();
app.use(express.json());

// Environment configuration
const env = {
  ALLOWED_DOMAINS: process.env.NODE_ENV === 'production'
    ? (process.env.ALLOWED_DOMAINS?.split(',').map(d => d.trim()) || [])
    : ['localhost:3000', '127.0.0.1:3000']
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

function createMcpServer(): McpServer {
  const server = new McpServer(
    {
      name: "math-mcp-server",
      version: "1.0.0"
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

  server.registerTool("multiply",
    {
      title: "Multiplication Tool",
      description: "Multiply two numbers",
      inputSchema: { a: z.number(), b: z.number() }
    },
    async ({ a, b }) => ({
      content: [{ type: "text", text: String(a * b) }]
    })
  );

  return server;
}

// Initialze and start session connect requests
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
        },
        enableDnsRebindingProtection: process.env.NODE_ENV === 'production',
        allowedHosts: env.ALLOWED_DOMAINS
      });

      // Clean up transport when closed
      transport.onclose = () => {
        if (transport.sessionId) {
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
  const sessionId = req.headers['mcp-session-id'] as string | undefined;

  if (!sessionId || !transports[sessionId]) {
    res.status(400).send('Invalid or missing session ID');
    return;
  }

  const transport = transports[sessionId];
  await transport.handleRequest(req, res);
});


// Bakcwards compatability for legacy SSE endpoint
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
const sseTransports: { [sessionId: string]: SSEServerTransport } = {};

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
  res.send('This is a demo MCP server. Use `/mcp` for Streamable HTTP.');
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
const PORT = parseInt(process.env.PORT || '3000', 10);
app.listen(PORT, () => {
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
  console.log(`🔗 Streamable HTTP MCP endpoint: http://localhost:${PORT}/mcp`);
  console.log(`🔗 MCP endpoint: http://localhost:${PORT}/sse`);
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