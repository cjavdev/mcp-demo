"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const node_crypto_1 = require("node:crypto");
const mcp_js_1 = require("@modelcontextprotocol/sdk/server/mcp.js");
const streamableHttp_js_1 = require("@modelcontextprotocol/sdk/server/streamableHttp.js");
const types_js_1 = require("@modelcontextprotocol/sdk/types.js");
const zod_1 = require("zod");
const app = (0, express_1.default)();
app.use(express_1.default.json());
// Configure CORS for browser clients (latest requirements)
app.use((0, cors_1.default)({
    origin: process.env.NODE_ENV === 'production'
        ? ['https://mcp.demo.cjav.dev', 'https://www.mcp.demo.cjav.dev']
        : '*',
    exposedHeaders: ['Mcp-Session-Id'], // Required for browser clients
    allowedHeaders: ['Content-Type', 'mcp-session-id'],
    methods: ['GET', 'POST', 'DELETE']
}));
// Session management for stateful connections
const transports = {};
// Create and configure MCP server
function createMcpServer() {
    const server = new mcp_js_1.McpServer({
        name: "production-mcp-server",
        version: "1.0.0"
    }, {
        // Enable notification debouncing for better performance
        debouncedNotificationMethods: [
            'notifications/tools/list_changed',
            'notifications/resources/list_changed',
            'notifications/prompts/list_changed'
        ]
    });
    // Add production-ready API tool
    server.registerTool("fetch-data", {
        title: "External API Fetcher",
        description: "Fetch data from external APIs with error handling",
        inputSchema: {
            url: zod_1.z.string().url().describe("API endpoint URL"),
            method: zod_1.z.enum(["GET", "POST", "PUT", "DELETE"]).default("GET"),
            headers: zod_1.z.record(zod_1.z.string()).optional().describe("HTTP headers"),
            body: zod_1.z.string().optional().describe("Request body (JSON string)")
        }
    }, (_a) => __awaiter(this, [_a], void 0, function* ({ url, method, headers = {}, body }) {
        try {
            const response = yield fetch(url, {
                method,
                headers: Object.assign({ 'Content-Type': 'application/json' }, headers),
                body: body ? body : undefined
            });
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            const data = yield response.text();
            return {
                content: [{
                        type: "text",
                        text: `Status: ${response.status}\nResponse: ${data}`
                    }]
            };
        }
        catch (error) {
            return {
                content: [{
                        type: "text",
                        text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
                    }],
                isError: true
            };
        }
    }));
    // Add LLM sampling tool (latest feature)
    server.registerTool("summarize-content", {
        title: "Content Summarizer",
        description: "Summarize text content using LLM sampling",
        inputSchema: {
            content: zod_1.z.string().describe("Content to summarize"),
            length: zod_1.z.enum(["brief", "detailed", "bullet-points"]).default("brief")
        }
    }, (_a) => __awaiter(this, [_a], void 0, function* ({ content, length }) {
        try {
            const promptMap = {
                brief: "Provide a brief 2-3 sentence summary of this content:",
                detailed: "Provide a comprehensive summary with key points and details:",
                "bullet-points": "Summarize this content as bullet points with main ideas:"
            };
            const response = yield server.server.createMessage({
                messages: [{
                        role: "user",
                        content: {
                            type: "text",
                            text: `${promptMap[length]}\n\n${content}`
                        }
                    }],
                maxTokens: length === "detailed" ? 800 : 400
            });
            return {
                content: [{
                        type: "text",
                        text: response.content.type === "text"
                            ? response.content.text
                            : "Unable to generate summary"
                    }]
            };
        }
        catch (error) {
            return {
                content: [{
                        type: "text",
                        text: `Summarization failed: ${error instanceof Error ? error.message : 'Unknown error'}`
                    }],
                isError: true
            };
        }
    }));
    return server;
}
// Handle POST requests (client-to-server communication)
app.post('/mcp', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const sessionId = req.headers['mcp-session-id'];
    let transport;
    try {
        if (sessionId && transports[sessionId]) {
            // Reuse existing transport
            transport = transports[sessionId];
        }
        else if (!sessionId && (0, types_js_1.isInitializeRequest)(req.body)) {
            // New initialization request
            transport = new streamableHttp_js_1.StreamableHTTPServerTransport({
                sessionIdGenerator: () => (0, node_crypto_1.randomUUID)(),
                onsessioninitialized: (sessionId) => {
                    transports[sessionId] = transport;
                    console.log(`📱 New session initialized: ${sessionId}`);
                },
                // Enable DNS rebinding protection for security
                enableDnsRebindingProtection: process.env.NODE_ENV === 'production',
                allowedHosts: process.env.NODE_ENV === 'production'
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
            yield server.connect(transport);
        }
        else {
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
        yield transport.handleRequest(req, res, req.body);
    }
    catch (error) {
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
}));
// Handle GET requests (server-to-client notifications via SSE)
app.get('/mcp', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const sessionId = req.headers['mcp-session-id'];
    if (!sessionId || !transports[sessionId]) {
        res.status(400).send('Invalid or missing session ID');
        return;
    }
    const transport = transports[sessionId];
    yield transport.handleRequest(req, res);
}));
// Handle DELETE requests (session termination)
app.delete('/mcp', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const sessionId = req.headers['mcp-session-id'];
    if (!sessionId || !transports[sessionId]) {
        res.status(400).send('Invalid or missing session ID');
        return;
    }
    const transport = transports[sessionId];
    yield transport.handleRequest(req, res);
}));
// Health check endpoint
app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        activeSessions: Object.keys(transports).length,
        version: '1.0.0'
    });
});
// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🌐 Streamable HTTP MCP Server running on port ${PORT}`);
    console.log(`📊 Health check: http://localhost:${PORT}/health`);
    console.log(`🔗 MCP endpoint: http://localhost:${PORT}/mcp`);
    console.log(`🛡️ DNS protection: ${process.env.NODE_ENV === 'production' ? 'enabled' : 'disabled'}`);
});
// Graceful shutdown
process.on('SIGTERM', () => __awaiter(void 0, void 0, void 0, function* () {
    console.log('\n🛑 Received SIGTERM, shutting down gracefully...');
    // Close all active transports
    yield Promise.all(Object.values(transports).map(transport => transport.close()));
    process.exit(0);
}));
