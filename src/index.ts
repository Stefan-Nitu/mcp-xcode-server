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
import { ZodError } from 'zod';
import { logger, logToolExecution, logError } from './logger.js';

// Import all tool classes
import {
  ListSimulatorsTool,
  BootSimulatorTool,
  ShutdownSimulatorTool,
  ViewSimulatorScreenTool,
  BuildProjectTool,
  RunProjectTool,
  TestProjectTool,
  TestSPMModuleTool,
  CleanBuildTool,
  ArchiveProjectTool,
  ExportIPATool,
  ListSchemesTool,
  GetBuildSettingsTool,
  GetProjectInfoTool,
  ListTargetsTool,
  InstallAppTool,
  UninstallAppTool,
  GetDeviceLogsTool,
  ManageDependenciesTool
} from './tools/index.js';

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
      new ListSimulatorsTool(),
      new BootSimulatorTool(),
      new ShutdownSimulatorTool(),
      new ViewSimulatorScreenTool(),
      // Build and test
      new BuildProjectTool(),
      new RunProjectTool(),
      new TestProjectTool(),
      new TestSPMModuleTool(),
      new CleanBuildTool(),
      // Archive and export
      new ArchiveProjectTool(),
      new ExportIPATool(),
      // Project info and schemes
      new ListSchemesTool(),
      new GetBuildSettingsTool(),
      new GetProjectInfoTool(),
      new ListTargetsTool(),
      // App management
      new InstallAppTool(),
      new UninstallAppTool(),
      // Device logs
      new GetDeviceLogsTool(),
      // Advanced project management
      new ManageDependenciesTool()
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
      } catch (error) {
        if (error instanceof ZodError) {
          logger.warn({ tool: name, errors: error.errors }, 'Validation failed');
          return {
            content: [
              {
                type: 'text',
                text: `Validation error: ${error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')}`
              }
            ]
          };
        }
        
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
process.on('SIGTERM', () => {
  logger.info('Received SIGTERM, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('Received SIGINT, shutting down gracefully');
  process.exit(0);
});

server.run().catch((error) => {
  logger.fatal({ error }, 'Failed to start MCP server');
  process.exit(1);
});