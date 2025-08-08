import express, { Request, Response } from "express";
import cors from "cors";
import { randomUUID } from "crypto";
import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";

const app = express();
app.use(express.json());

// --- Security: CORS + optional token auth
const allowedOrigins = (process.env.ALLOWED_DOMAINS ?? "")
  .split(",")
  .map(d => d.trim())
  .filter(Boolean)
  .flatMap(d => [`https://${d}`, `http://${d}`]);

app.use(cors({
  origin: process.env.NODE_ENV === "production" ? allowedOrigins : true,
  exposedHeaders: ["Mcp-Session-Id"],
  allowedHeaders: ["Content-Type", "mcp-session-id", "authorization"],
  methods: ["GET", "POST", "DELETE"]
}));

app.use((req, res, next) => {
  if (process.env.NODE_ENV !== "production") return next();
  if (req.get("Authorization") === `Bearer ${process.env.SERVER_TOKEN}`) return next();
  res.status(401).send("Unauthorized");
});

// --- MCP session management
const transports: Record<string, StreamableHTTPServerTransport> = {};

function createMcpServer(): McpServer {
  const server = new McpServer({ name: "math-mcp-server", version: "1.0.0" });
  server.registerTool(
    "add",
    {
      title: "Add two numbers",
      description: "Returns a + b",
      inputSchema: { a: z.number(), b: z.number() }
    },
    async ({ a, b }) => ({ content: [{ type: "text", text: String(a + b) }] })
  );
  return server;
}

// --- POST /mcp: initialize or send message
app.post("/mcp", async (req: Request, res: Response) => {
  const sid = req.headers["mcp-session-id"] as string | undefined;
  let transport = sid ? transports[sid] : undefined;

  try {
    if (!transport) {
      if (!isInitializeRequest(req.body)) {
        return res.status(400).json({ jsonrpc: "2.0", id: null, error: { code: -32000, message: "Expected initialize" } });
      }
      transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: randomUUID,
        onsessioninitialized: (sessionId) => {
          transports[sessionId] = transport!;
        },
        enableDnsRebindingProtection: process.env.NODE_ENV === "production",
        allowedHosts: allowedOrigins.map(u => new URL(u).host)
      });
      transport.onclose = () => { if (transport?.sessionId) delete transports[transport.sessionId]; };
      await createMcpServer().connect(transport);
    }
    await transport.handleRequest(req, res, req.body);
  } catch {
    if (!res.headersSent) res.status(500).json({ jsonrpc: "2.0", id: null, error: { code: -32603, message: "Internal server error" } });
  }
});

// --- GET /mcp: refresh an open stream
app.get("/mcp", async (req, res) => {
  const sid = req.headers["mcp-session-id"] as string | undefined;
  const transport = sid ? transports[sid] : undefined;
  if (!transport) {
    return res.status(400).json({ jsonrpc: "2.0", id: null, error: { code: -32000, message: "Unknown session" } });
  }
  await transport.handleRequest(req, res);
});

// --- Health check
app.get("/health", (_req, res) => {
  res.json({ status: "healthy", activeSessions: Object.keys(transports).length });
});

const PORT = Number(process.env.PORT ?? 3000);
app.listen(PORT, () => console.log(`🔗 SHTTP MCP endpoint: http://localhost:${PORT}/mcp`));
