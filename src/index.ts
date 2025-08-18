#!/usr/bin/env node

/**
 * Apple Simulator MCP Server
 * Provides tools for building, running, and testing Apple platform projects
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import path from 'path';
import { SimulatorManager } from './simulatorManager.js';
import { XcodeBuilder } from './xcodeBuilder.js';
import { PlatformHandler } from './platformHandler.js';
import { Platform } from './types.js';
import {
  listSimulatorsSchema,
  bootSimulatorSchema,
  shutdownSimulatorSchema,
  buildProjectSchema,
  runProjectSchema,
  testProjectSchema,
  testSPMModuleSchema,
  installAppSchema,
  uninstallAppSchema,
  viewSimulatorScreenSchema,
  getDeviceLogsSchema,
  cleanBuildSchema
} from './validation.js';
import { ZodError } from 'zod';
import { logger, logToolExecution, logError } from './logger.js';

class AppleSimulatorServer {
  private server: Server;

  constructor() {
    this.server = new Server(
      {
        name: 'mcp-apple-simulator',
        version: '2.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupHandlers();
  }

  private setupHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: 'list_simulators',
          description: 'List all available Apple simulators',
          inputSchema: {
            type: 'object',
            properties: {
              showAll: {
                type: 'boolean',
                description: 'Show all simulators including unavailable ones',
                default: false
              },
              platform: {
                type: 'string',
                description: 'Filter by platform (iOS, macOS, tvOS, watchOS, visionOS)',
                enum: ['iOS', 'macOS', 'tvOS', 'watchOS', 'visionOS']
              }
            }
          }
        },
        {
          name: 'boot_simulator',
          description: 'Boot a simulator',
          inputSchema: {
            type: 'object',
            properties: {
              deviceId: {
                type: 'string',
                description: 'Device UDID or name of the simulator to boot'
              }
            },
            required: ['deviceId']
          }
        },
        {
          name: 'shutdown_simulator',
          description: 'Shutdown a simulator',
          inputSchema: {
            type: 'object',
            properties: {
              deviceId: {
                type: 'string',
                description: 'Device UDID or name of the simulator to shutdown'
              }
            },
            required: ['deviceId']
          }
        },
        {
          name: 'build_project',
          description: 'Build an Apple platform project (without running)',
          inputSchema: {
            type: 'object',
            properties: {
              projectPath: {
                type: 'string',
                description: 'Path to the Xcode project or workspace'
              },
              scheme: {
                type: 'string',
                description: 'Xcode scheme to build'
              },
              platform: {
                type: 'string',
                description: 'Target platform (iOS, macOS, tvOS, watchOS, visionOS)',
                default: 'iOS',
                enum: ['iOS', 'macOS', 'tvOS', 'watchOS', 'visionOS']
              },
              deviceId: {
                type: 'string',
                description: 'Device UDID or name (for simulator platforms)'
              },
              configuration: {
                type: 'string',
                description: 'Build configuration (Debug/Release)',
                default: 'Debug',
                enum: ['Debug', 'Release']
              }
            },
            required: ['projectPath']
          }
        },
        {
          name: 'run_project',
          description: 'Build and run an Apple platform project',
          inputSchema: {
            type: 'object',
            properties: {
              projectPath: {
                type: 'string',
                description: 'Path to the Xcode project or workspace'
              },
              scheme: {
                type: 'string',
                description: 'Xcode scheme to build'
              },
              platform: {
                type: 'string',
                description: 'Target platform (iOS, macOS, tvOS, watchOS, visionOS)',
                default: 'iOS',
                enum: ['iOS', 'macOS', 'tvOS', 'watchOS', 'visionOS']
              },
              deviceId: {
                type: 'string',
                description: 'Device UDID or name (for simulator platforms)'
              },
              configuration: {
                type: 'string',
                description: 'Build configuration (Debug/Release)',
                default: 'Debug',
                enum: ['Debug', 'Release']
              }
            },
            required: ['projectPath']
          }
        },
        {
          name: 'test_project',
          description: 'Run tests for an Apple platform project',
          inputSchema: {
            type: 'object',
            properties: {
              projectPath: {
                type: 'string',
                description: 'Path to the Xcode project or workspace'
              },
              scheme: {
                type: 'string',
                description: 'Xcode scheme to test'
              },
              platform: {
                type: 'string',
                description: 'Target platform (iOS, macOS, tvOS, watchOS, visionOS)',
                default: 'iOS',
                enum: ['iOS', 'macOS', 'tvOS', 'watchOS', 'visionOS']
              },
              testTarget: {
                type: 'string',
                description: 'Specific test target to run (e.g., "MyAppTests" or "MyAppUITests")'
              },
              deviceId: {
                type: 'string',
                description: 'Device UDID or name (for simulator platforms)'
              },
              configuration: {
                type: 'string',
                description: 'Build configuration (Debug/Release)',
                default: 'Debug',
                enum: ['Debug', 'Release']
              },
              testFilter: {
                type: 'string',
                description: 'Filter for specific test classes or methods'
              }
            },
            required: ['projectPath']
          }
        },
        {
          name: 'test_spm_module',
          description: 'Test a Swift Package Manager module',
          inputSchema: {
            type: 'object',
            properties: {
              packagePath: {
                type: 'string',
                description: 'Path to the Swift package'
              },
              platform: {
                type: 'string',
                description: 'Target platform (iOS, macOS, tvOS, watchOS)',
                default: 'macOS',
                enum: ['iOS', 'macOS', 'tvOS', 'watchOS']
              },
              testFilter: {
                type: 'string',
                description: 'Filter for specific tests (optional)'
              },
              osVersion: {
                type: 'string',
                description: 'OS version for testing (e.g., 17.2)'
              }
            },
            required: ['packagePath']
          }
        },
        {
          name: 'install_app',
          description: 'Install an app on the simulator',
          inputSchema: {
            type: 'object',
            properties: {
              appPath: {
                type: 'string',
                description: 'Path to the .app bundle'
              },
              deviceId: {
                type: 'string',
                description: 'Device UDID or name of the simulator (optional, uses booted device if not specified)'
              }
            },
            required: ['appPath']
          }
        },
        {
          name: 'uninstall_app',
          description: 'Uninstall an app from the simulator',
          inputSchema: {
            type: 'object',
            properties: {
              bundleId: {
                type: 'string',
                description: 'Bundle identifier of the app to uninstall'
              },
              deviceId: {
                type: 'string',
                description: 'Device UDID or name of the simulator (optional, uses booted device if not specified)'
              }
            },
            required: ['bundleId']
          }
        },
        {
          name: 'view_simulator_screen',
          description: 'Capture and view the current simulator screen (returns image data)',
          inputSchema: {
            type: 'object',
            properties: {
              deviceId: {
                type: 'string',
                description: 'Device UDID or name of the simulator (optional, uses booted device if not specified)'
              }
            }
          }
        },
        {
          name: 'get_device_logs',
          description: 'Get device logs from the simulator',
          inputSchema: {
            type: 'object',
            properties: {
              deviceId: {
                type: 'string',
                description: 'Device UDID or name of the simulator (optional, uses booted device if not specified)'
              },
              predicate: {
                type: 'string',
                description: 'Log filter predicate (optional)'
              },
              last: {
                type: 'string',
                description: 'Time interval for logs (e.g., "1m", "5m", "1h")',
                default: '5m'
              }
            }
          }
        },
        {
          name: 'clean_build',
          description: 'Clean build artifacts, DerivedData, or test results',
          inputSchema: {
            type: 'object',
            properties: {
              projectPath: {
                type: 'string',
                description: 'Path to the Xcode project or workspace (optional for DerivedData-only cleaning)'
              },
              scheme: {
                type: 'string',
                description: 'Xcode scheme (optional)'
              },
              platform: {
                type: 'string',
                description: 'Target platform (iOS, macOS, tvOS, watchOS, visionOS)',
                enum: ['iOS', 'macOS', 'tvOS', 'watchOS', 'visionOS'],
                default: 'iOS'
              },
              configuration: {
                type: 'string',
                description: 'Build configuration (Debug/Release)',
                enum: ['Debug', 'Release'],
                default: 'Debug'
              },
              cleanTarget: {
                type: 'string',
                description: 'What to clean: build (xcodebuild clean), derivedData, testResults, or all',
                enum: ['build', 'derivedData', 'testResults', 'all'],
                default: 'build'
              },
              derivedDataPath: {
                type: 'string',
                description: 'Path to DerivedData folder',
                default: './DerivedData'
              }
            }
          }
        }
      ]
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      const startTime = Date.now();

      logger.debug({ tool: name, args }, 'Tool request received');

      try {
        let result;
        switch (name) {
          case 'list_simulators':
            result = await this.listSimulators(args);
            break;
          
          case 'boot_simulator':
            result = await this.bootSimulator(args);
            break;
          
          case 'shutdown_simulator':
            result = await this.shutdownSimulator(args);
            break;
          
          case 'build_project':
            result = await this.buildProject(args);
            break;
          
          case 'run_project':
            result = await this.runProject(args);
            break;
          
          case 'test_project':
            result = await this.testProject(args);
            break;
          
          case 'test_spm_module':
            result = await this.testSPMModule(args);
            break;
          
          case 'install_app':
            result = await this.installApp(args);
            break;
          
          case 'uninstall_app':
            result = await this.uninstallApp(args);
            break;
          
          case 'view_simulator_screen':
            result = await this.viewSimulatorScreen(args);
            break;
          
          case 'get_device_logs':
            result = await this.getDeviceLogs(args);
            break;
          
          case 'clean_build':
            result = await this.cleanBuild(args);
            break;
          
          default:
            throw new Error(`Unknown tool: ${name}`);
        }
        
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

  private async listSimulators(args: any) {
    const validated = listSimulatorsSchema.parse(args);
    const { showAll, platform } = validated;
    
    const devices = await SimulatorManager.listSimulators(showAll, platform);
    
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(devices, null, 2)
        }
      ]
    };
  }

  private async bootSimulator(args: any) {
    const validated = bootSimulatorSchema.parse(args);
    const { deviceId } = validated;
    
    await SimulatorManager.bootSimulator(deviceId);
    
    return {
      content: [
        {
          type: 'text',
          text: `Successfully booted simulator: ${deviceId}`
        }
      ]
    };
  }

  private async shutdownSimulator(args: any) {
    const validated = shutdownSimulatorSchema.parse(args);
    const { deviceId } = validated;
    
    await SimulatorManager.shutdownSimulator(deviceId);
    
    return {
      content: [
        {
          type: 'text',
          text: `Successfully shutdown simulator: ${deviceId}`
        }
      ]
    };
  }

  private async buildProject(args: any) {
    const validated = buildProjectSchema.parse(args);
    const { projectPath, scheme, platform, deviceId, configuration } = validated;
    
    const platformEnum = platform;
    
    const result = await XcodeBuilder.buildProject({
      projectPath,
      scheme,
      platform: platformEnum,
      deviceId,
      configuration,
      installApp: false  // Build only, don't install
    });
    
    return {
      content: [
        {
          type: 'text',
          text: `Successfully built project: ${scheme || path.basename(projectPath)}
Platform: ${platform}
Configuration: ${configuration}
App path: ${result.appPath || 'N/A'}`
        }
      ]
    };
  }

  private async runProject(args: any) {
    const validated = runProjectSchema.parse(args);
    const { projectPath, scheme, platform, deviceId, configuration } = validated;
    
    const platformEnum = platform;
    
    const result = await XcodeBuilder.buildProject({
      projectPath,
      scheme,
      platform: platformEnum,
      deviceId,
      configuration,
      installApp: true  // Build and install
    });
    
    return {
      content: [
        {
          type: 'text',
          text: `Successfully built and ran project: ${scheme || path.basename(projectPath)}
Platform: ${platform}
App installed at: ${result.appPath || 'N/A'}`
        }
      ]
    };
  }

  private async testProject(args: any) {
    const validated = testProjectSchema.parse(args);
    const { 
      projectPath, 
      scheme, 
      platform, 
      testTarget,
      deviceId, 
      configuration,
      testFilter,
      parallelTesting
    } = validated;
    
    const platformEnum = platform;
    
    const result = await XcodeBuilder.testProject({
      projectPath,
      scheme,
      platform: platformEnum,
      deviceId,
      configuration,
      testTarget,
      testFilter,
      parallelTesting
    });
    
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            success: result.success,
            summary: `Tests ${result.success ? 'passed' : 'failed'}. ${result.testCount || 0} tests executed, ${result.failureCount || 0} failures`,
            platform,
            configuration,
            testTarget: testTarget || 'all tests in scheme',
            output: result.output
          }, null, 2)
        }
      ]
    };
  }

  private async testSPMModule(args: any) {
    const validated = testSPMModuleSchema.parse(args);
    const { packagePath, platform, testFilter, osVersion } = validated;
    
    const platformEnum = platform;
    
    const result = await XcodeBuilder.testSPMModule(
      packagePath,
      platformEnum,
      testFilter,
      osVersion
    );
    
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            success: result.success,
            summary: `Tests ${result.success ? 'passed' : 'failed'}. ${result.testCount || 0} tests run, ${result.failureCount || 0} failures`,
            platform,
            output: result.output
          }, null, 2)
        }
      ]
    };
  }

  private async installApp(args: any) {
    const validated = installAppSchema.parse(args);
    const { appPath, deviceId } = validated;
    
    await SimulatorManager.installApp(appPath, deviceId);
    
    return {
      content: [
        {
          type: 'text',
          text: `Successfully installed app: ${appPath}`
        }
      ]
    };
  }

  private async uninstallApp(args: any) {
    const validated = uninstallAppSchema.parse(args);
    const { bundleId, deviceId } = validated;
    
    await SimulatorManager.uninstallApp(bundleId, deviceId);
    
    return {
      content: [
        {
          type: 'text',
          text: `Successfully uninstalled app: ${bundleId}`
        }
      ]
    };
  }

  private async viewSimulatorScreen(args: any) {
    const validated = viewSimulatorScreenSchema.parse(args);
    const { deviceId } = validated;
    
    const { base64, mimeType } = await SimulatorManager.captureScreenshotData(deviceId);
    
    return {
      content: [
        {
          type: 'image',
          data: base64,
          mimeType
        }
      ]
    };
  }

  private async getDeviceLogs(args: any) {
    const validated = getDeviceLogsSchema.parse(args);
    const { deviceId, predicate, last } = validated;
    
    const logs = await SimulatorManager.getDeviceLogs(deviceId, predicate, last);
    
    return {
      content: [
        {
          type: 'text',
          text: logs
        }
      ]
    };
  }

  private async cleanBuild(args: any) {
    const validated = cleanBuildSchema.parse(args);
    const { projectPath, scheme, platform, configuration, cleanTarget, derivedDataPath } = validated;
    
    const result = await XcodeBuilder.cleanProject({
      projectPath,
      scheme,
      platform,
      configuration,
      cleanTarget,
      derivedDataPath
    });
    
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(result)
        }
      ]
    };
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    logger.info({ transport: 'stdio' }, 'Apple Simulator MCP server started');
  }
}

const server = new AppleSimulatorServer();
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