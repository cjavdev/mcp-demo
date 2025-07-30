import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { completable } from "@modelcontextprotocol/sdk/server/completable.js";

// Create MCP server with latest configuration
const server = new McpServer({
  name: "modern-demo-server",
  version: "1.0.0"
});

// 1. RESOURCES - Latest approach with ResourceTemplate and titles
server.registerResource(
  "user-profile",
  new ResourceTemplate("users://{userId}/profile", {
    list: undefined,
    complete: {
      // Context-aware completion for userId
      userId: (value, context) => {
        const suggestions = ["user123", "user456", "admin789"];
        return suggestions.filter(id => id.startsWith(value));
      }
    }
  }),
  {
    title: "User Profile Resource", // New title field for better UI
    description: "Get user profile information",
    mimeType: "application/json"
  },
  async (uri, { userId }) => {
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
  }
);

// Static resource example
server.registerResource(
  "app-config",
  "config://app/settings",
  {
    title: "Application Configuration",
    description: "Current application settings",
    mimeType: "application/json"
  },
  async (uri) => ({
    contents: [{
      uri: uri.href,
      text: JSON.stringify({
        version: "1.0.0",
        environment: "development",
        features: ["auth", "logging", "metrics"]
      }, null, 2),
      mimeType: "application/json"
    }]
  })
);

// 2. TOOLS - Modern approach with comprehensive examples
server.registerTool(
  "calculate-metrics",
  {
    title: "Performance Metrics Calculator",
    description: "Calculate various performance metrics",
    inputSchema: {
      values: z.array(z.number()).describe("Array of numeric values"),
      metricType: z.enum(["mean", "median", "stddev", "percentile"]).describe("Type of metric to calculate"),
      percentile: z.number().optional().describe("Percentile value (0-100) if metricType is percentile")
    }
  },
  async ({ values, metricType, percentile }) => {
    let result: number;

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
        if (!percentile) throw new Error("Percentile value required");
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
  }
);

// Tool that returns ResourceLinks (latest pattern)
server.registerTool(
  "list-files",
  {
    title: "File System Explorer",
    description: "List files in a directory with metadata",
    inputSchema: {
      directory: z.string().describe("Directory path to explore"),
      pattern: z.string().optional().describe("File pattern to match")
    }
  },
  async ({ directory, pattern = "*" }) => {
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
          type: "resource_link" as const,
          uri: `file://${directory}/${file.name}`,
          name: file.name,
          mimeType: file.type === "markdown" ? "text/markdown" :
                   file.type === "json" ? "application/json" :
                   file.type === "typescript" ? "text/typescript" : "text/plain",
          description: `${file.type} file (${file.size} bytes)`
        }))
      ]
    };
  }
);

// 3. PROMPTS - Latest approach with context-aware completions
server.registerPrompt(
  "code-review",
  {
    title: "Code Review Assistant",
    description: "Generate comprehensive code review feedback",
    argsSchema: {
      language: completable(z.string(), (value) => {
        const languages = ["typescript", "javascript", "python", "java", "go", "rust"];
        return languages.filter(lang => lang.startsWith(value.toLowerCase()));
      }),
      reviewType: completable(z.enum(["security", "performance", "style", "logic"]), (value) => {
        const reviewTypes = ["security", "performance", "style", "logic"] as const;
        return reviewTypes.filter(type =>
          type.startsWith(value.toLowerCase())
        ) as ("security" | "performance" | "style" | "logic")[];
      }),
      code: z.string().describe("Code to review")
    }
  },
  ({ language, reviewType, code }) => ({
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
  })
);

// Advanced prompt with department-based completions
server.registerPrompt(
  "team-standup",
  {
    title: "Team Standup Generator",
    description: "Generate standup meeting prompts for different teams",
    argsSchema: {
      department: completable(z.string(), (value) => {
        return ["engineering", "design", "product", "marketing", "sales"]
          .filter(dept => dept.startsWith(value.toLowerCase()));
      }),
      teamMember: completable(z.string(), (value, context) => {
        const department = context?.arguments?.["department"];
        const teamMembers: Record<string, string[]> = {
          engineering: ["Alice", "Bob", "Charlie", "Diana"],
          design: ["Eva", "Frank", "Grace"],
          product: ["Henry", "Iris", "Jack"],
          marketing: ["Kate", "Liam", "Maya"],
          sales: ["Nathan", "Olivia", "Paul"]
        };

        const members = teamMembers[department as string] || ["Guest"];
        return members.filter(name =>
          name.toLowerCase().startsWith(value.toLowerCase())
        );
      }),
      sprintGoal: z.string().describe("Current sprint goal")
    }
  },
  ({ department, teamMember, sprintGoal }) => ({
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
  })
);

// 4. SERVER LIFECYCLE with latest error handling
async function startServer() {
  try {
    console.log("🚀 Starting Modern MCP Server...");

    const transport = new StdioServerTransport();
    await server.connect(transport);

    console.log("✅ MCP Server connected and ready!");
    console.log("📋 Available capabilities:");
    console.log("   - Resources: user-profile, app-config");
    console.log("   - Tools: calculate-metrics, list-files");
    console.log("   - Prompts: code-review, team-standup");

  } catch (error) {
    console.error("❌ Failed to start MCP server:", error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log("\n🛑 Shutting down MCP server...");
  await server.close();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log("\n🛑 Shutting down MCP server...");
  await server.close();
  process.exit(0);
});

// Start the server
startServer().catch(console.error);