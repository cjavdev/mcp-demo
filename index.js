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
Object.defineProperty(exports, "__esModule", { value: true });
const mcp_js_1 = require("@modelcontextprotocol/sdk/server/mcp.js");
const stdio_js_1 = require("@modelcontextprotocol/sdk/server/stdio.js");
const zod_1 = require("zod");
const completable_js_1 = require("@modelcontextprotocol/sdk/server/completable.js");
// Create MCP server with latest configuration
const server = new mcp_js_1.McpServer({
    name: "modern-demo-server",
    version: "1.0.0"
});
// 1. RESOURCES - Latest approach with ResourceTemplate and titles
server.registerResource("user-profile", new mcp_js_1.ResourceTemplate("users://{userId}/profile", {
    list: undefined,
    complete: {
        // Context-aware completion for userId
        userId: (value, context) => {
            const suggestions = ["user123", "user456", "admin789"];
            return suggestions.filter(id => id.startsWith(value));
        }
    }
}), {
    title: "User Profile Resource", // New title field for better UI
    description: "Get user profile information",
    mimeType: "application/json"
}, (uri_1, _a) => __awaiter(void 0, [uri_1, _a], void 0, function* (uri, { userId }) {
    // Simulate fetching user data
    const userData = {
        id: userId,
        name: `User ${userId}`,
        email: `${userId}@example.com`,
        created: new Date().toISOString()
    };
    return {
        contents: [{
                uri: uri.href,
                text: JSON.stringify(userData, null, 2),
                mimeType: "application/json"
            }]
    };
}));
// Static resource example
server.registerResource("app-config", "config://app/settings", {
    title: "Application Configuration",
    description: "Current application settings",
    mimeType: "application/json"
}, (uri) => __awaiter(void 0, void 0, void 0, function* () {
    return ({
        contents: [{
                uri: uri.href,
                text: JSON.stringify({
                    version: "1.0.0",
                    environment: "development",
                    features: ["auth", "logging", "metrics"]
                }, null, 2),
                mimeType: "application/json"
            }]
    });
}));
// 2. TOOLS - Modern approach with comprehensive examples
server.registerTool("calculate-metrics", {
    title: "Performance Metrics Calculator",
    description: "Calculate various performance metrics",
    inputSchema: {
        values: zod_1.z.array(zod_1.z.number()).describe("Array of numeric values"),
        metricType: zod_1.z.enum(["mean", "median", "stddev", "percentile"]).describe("Type of metric to calculate"),
        percentile: zod_1.z.number().optional().describe("Percentile value (0-100) if metricType is percentile")
    }
}, (_a) => __awaiter(void 0, [_a], void 0, function* ({ values, metricType, percentile }) {
    let result;
    switch (metricType) {
        case "mean":
            result = values.reduce((sum, val) => sum + val, 0) / values.length;
            break;
        case "median":
            const sorted = [...values].sort((a, b) => a - b);
            const mid = Math.floor(sorted.length / 2);
            result = sorted.length % 2 === 0
                ? (sorted[mid - 1] + sorted[mid]) / 2
                : sorted[mid];
            break;
        case "stddev":
            const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
            const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
            result = Math.sqrt(variance);
            break;
        case "percentile":
            if (!percentile)
                throw new Error("Percentile value required");
            const sortedValues = [...values].sort((a, b) => a - b);
            const index = (percentile / 100) * (sortedValues.length - 1);
            result = sortedValues[Math.round(index)];
            break;
        default:
            throw new Error(`Unknown metric type: ${metricType}`);
    }
    return {
        content: [{
                type: "text",
                text: `${metricType.toUpperCase()}: ${result.toFixed(4)}`
            }]
    };
}));
// Tool that returns ResourceLinks (latest pattern)
server.registerTool("list-files", {
    title: "File System Explorer",
    description: "List files in a directory with metadata",
    inputSchema: {
        directory: zod_1.z.string().describe("Directory path to explore"),
        pattern: zod_1.z.string().optional().describe("File pattern to match")
    }
}, (_a) => __awaiter(void 0, [_a], void 0, function* ({ directory, pattern = "*" }) {
    // Simulate file system exploration
    const mockFiles = [
        { name: "README.md", size: 1024, type: "markdown" },
        { name: "package.json", size: 512, type: "json" },
        { name: "src/index.ts", size: 2048, type: "typescript" }
    ];
    const filteredFiles = pattern === "*"
        ? mockFiles
        : mockFiles.filter(f => f.name.includes(pattern));
    return {
        content: [
            {
                type: "text",
                text: `Found ${filteredFiles.length} files in ${directory}:`
            },
            ...filteredFiles.map(file => ({
                type: "resource_link",
                uri: `file://${directory}/${file.name}`,
                name: file.name,
                mimeType: file.type === "markdown" ? "text/markdown" :
                    file.type === "json" ? "application/json" :
                        file.type === "typescript" ? "text/typescript" : "text/plain",
                description: `${file.type} file (${file.size} bytes)`
            }))
        ]
    };
}));
// 3. PROMPTS - Latest approach with context-aware completions
server.registerPrompt("code-review", {
    title: "Code Review Assistant",
    description: "Generate comprehensive code review feedback",
    argsSchema: {
        language: (0, completable_js_1.completable)(zod_1.z.string(), (value) => {
            const languages = ["typescript", "javascript", "python", "java", "go", "rust"];
            return languages.filter(lang => lang.startsWith(value.toLowerCase()));
        }),
        reviewType: (0, completable_js_1.completable)(zod_1.z.enum(["security", "performance", "style", "logic"]), (value) => {
            return ["security", "performance", "style", "logic"].filter(type => type.startsWith(value.toLowerCase()));
        }),
        code: zod_1.z.string().describe("Code to review")
    }
}, ({ language, reviewType, code }) => ({
    messages: [{
            role: "user",
            content: {
                type: "text",
                text: `Please provide a ${reviewType} review for this ${language} code:

\`\`\`${language}
${code}
\`\`\`

Focus on:
- ${reviewType} best practices
- Potential improvements
- Specific recommendations
- Code quality metrics`
            }
        }]
}));
// Advanced prompt with department-based completions
server.registerPrompt("team-standup", {
    title: "Team Standup Generator",
    description: "Generate standup meeting prompts for different teams",
    argsSchema: {
        department: (0, completable_js_1.completable)(zod_1.z.string(), (value) => {
            return ["engineering", "design", "product", "marketing", "sales"]
                .filter(dept => dept.startsWith(value.toLowerCase()));
        }),
        teamMember: (0, completable_js_1.completable)(zod_1.z.string(), (value, context) => {
            var _a;
            const department = (_a = context === null || context === void 0 ? void 0 : context.arguments) === null || _a === void 0 ? void 0 : _a["department"];
            const teamMembers = {
                engineering: ["Alice", "Bob", "Charlie", "Diana"],
                design: ["Eva", "Frank", "Grace"],
                product: ["Henry", "Iris", "Jack"],
                marketing: ["Kate", "Liam", "Maya"],
                sales: ["Nathan", "Olivia", "Paul"]
            };
            const members = teamMembers[department] || ["Guest"];
            return members.filter(name => name.toLowerCase().startsWith(value.toLowerCase()));
        }),
        sprintGoal: zod_1.z.string().describe("Current sprint goal")
    }
}, ({ department, teamMember, sprintGoal }) => ({
    messages: [{
            role: "assistant",
            content: {
                type: "text",
                text: `Good morning ${teamMember}! Let's start our ${department} team standup.

Sprint Goal: "${sprintGoal}"

Please share:
1. What did you accomplish yesterday?
2. What are you working on today?
3. Any blockers or concerns?
4. How does your work align with our sprint goal?

Focus areas for ${department}:
${department === 'engineering' ? '- Code reviews, technical debt, architecture decisions' :
                    department === 'design' ? '- User research, design systems, prototypes' :
                        department === 'product' ? '- Feature specifications, user feedback, roadmap planning' :
                            department === 'marketing' ? '- Campaign performance, content creation, lead generation' :
                                '- Pipeline updates, customer meetings, deal progress'}`
            }
        }]
}));
// 4. SERVER LIFECYCLE with latest error handling
function startServer() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            console.log("🚀 Starting Modern MCP Server...");
            const transport = new stdio_js_1.StdioServerTransport();
            yield server.connect(transport);
            console.log("✅ MCP Server connected and ready!");
            console.log("📋 Available capabilities:");
            console.log("   - Resources: user-profile, app-config");
            console.log("   - Tools: calculate-metrics, list-files");
            console.log("   - Prompts: code-review, team-standup");
        }
        catch (error) {
            console.error("❌ Failed to start MCP server:", error);
            process.exit(1);
        }
    });
}
// Handle graceful shutdown
process.on('SIGINT', () => __awaiter(void 0, void 0, void 0, function* () {
    console.log("\n🛑 Shutting down MCP server...");
    yield server.close();
    process.exit(0);
}));
process.on('SIGTERM', () => __awaiter(void 0, void 0, void 0, function* () {
    console.log("\n🛑 Shutting down MCP server...");
    yield server.close();
    process.exit(0);
}));
// Start the server
startServer().catch(console.error);
