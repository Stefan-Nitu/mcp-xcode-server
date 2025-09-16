#!/usr/bin/env node

/**
 * MCP Xcode Server
 * Provides tools for building, running, and testing Apple platform projects
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { logger, logToolExecution, logError } from './logger.js';

// Import all tool classes
// import {
//   ListSimulatorsTool,
//   BootSimulatorTool,
//   ShutdownSimulatorTool,
//   ViewSimulatorScreenTool,
//   BuildSwiftPackageTool,
//   RunSwiftPackageTool,
//   RunXcodeTool,
//   TestXcodeTool,
//   TestSwiftPackageTool,
//   CleanBuildTool,
//   ArchiveProjectTool,
//   ExportIPATool,
//   ListSchemesTool,
//   GetBuildSettingsTool,
//   GetProjectInfoTool,
//   ListTargetsTool,
//   InstallAppTool,
//   UninstallAppTool,
//   GetDeviceLogsTool,
//   ManageDependenciesTool
// } from './tools/index.js';

// Import factories for Clean Architecture controllers
import {
  BootSimulatorControllerFactory,
  ShutdownSimulatorControllerFactory,
  ListSimulatorsControllerFactory
} from './features/simulator/index.js';
import { BuildXcodeControllerFactory } from './features/build/index.js';
import { InstallAppControllerFactory } from './features/app-management/index.js';

type Tool = {
  execute(args: any): Promise<any>;
  getToolDefinition(): any;
};

class XcodeServer {
  private server: Server;
  private tools: Map<string, Tool>;

  constructor() {
    this.server = new Server(
      {
        name: 'mcp-xcode-server',
        version: '2.4.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    // Initialize all tools
    this.tools = new Map<string, Tool>();
    this.registerTools();
    this.setupHandlers();
  }

  private registerTools() {
    // Create instances of all tools
    const toolInstances = [
      // Simulator management
      ListSimulatorsControllerFactory.create(),
      BootSimulatorControllerFactory.create(),
      ShutdownSimulatorControllerFactory.create(),
      // new ViewSimulatorScreenTool(),
      // Build and test
      // new BuildSwiftPackageTool(),
      // new RunSwiftPackageTool(),
      BuildXcodeControllerFactory.create(),
      InstallAppControllerFactory.create(),
      // new RunXcodeTool(),
      // new TestXcodeTool(),
      // new TestSwiftPackageTool(),
      // new CleanBuildTool(),
      // Archive and export
      // new ArchiveProjectTool(),
      // new ExportIPATool(),
      // Project info and schemes
      // new ListSchemesTool(),
      // new GetBuildSettingsTool(),
      // new GetProjectInfoTool(),
      // new ListTargetsTool(),
      // App management
      // new InstallAppTool(),
      // new UninstallAppTool(),
      // Device logs
      // new GetDeviceLogsTool(),
      // Advanced project management
      // new ManageDependenciesTool()
    ];

    // Register each tool by its name
    for (const tool of toolInstances) {
      const definition = tool.getToolDefinition();
      this.tools.set(definition.name, tool);
    }

    logger.info({ toolCount: this.tools.size }, 'Tools registered');
  }

  private setupHandlers() {
    // Handle listing all available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      const tools = Array.from(this.tools.values()).map(tool => tool.getToolDefinition());
      return { tools };
    });

    // Handle tool execution
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      const startTime = Date.now();

      logger.debug({ tool: name, args }, 'Tool request received');

      try {
        const tool = this.tools.get(name);
        if (!tool) {
          throw new Error(`Unknown tool: ${name}`);
        }

        const result = await tool.execute(args);
        
        // Log successful execution
        logToolExecution(name, args, Date.now() - startTime);
        return result;
      } catch (error: any) {
        
        logError(error as Error, { tool: name, args });
        return {
          content: [
            {
              type: 'text',
              text: `Error: ${error instanceof Error ? error.message : String(error)}`
            }
          ]
        };
      }
    });
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    logger.info({ transport: 'stdio' }, 'MCP Xcode server started');
  }
}

const server = new XcodeServer();

// Handle graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('Received SIGTERM, shutting down gracefully');
  // Give logger time to flush
  await new Promise(resolve => setTimeout(resolve, 100));
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('Received SIGINT, shutting down gracefully');
  // Give logger time to flush
  await new Promise(resolve => setTimeout(resolve, 100));
  process.exit(0);
});

server.run().catch((error) => {
  logger.fatal({ error }, 'Failed to start MCP server');
  process.exit(1);
});