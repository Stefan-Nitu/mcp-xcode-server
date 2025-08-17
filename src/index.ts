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
        }
      ]
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case 'list_simulators':
            return await this.listSimulators(args);
          
          case 'boot_simulator':
            return await this.bootSimulator(args);
          
          case 'shutdown_simulator':
            return await this.shutdownSimulator(args);
          
          case 'build_project':
            return await this.buildProject(args);
          
          case 'run_project':
            return await this.runProject(args);
          
          case 'test_project':
            return await this.testProject(args);
          
          case 'test_spm_module':
            return await this.testSPMModule(args);
          
          case 'install_app':
            return await this.installApp(args);
          
          case 'uninstall_app':
            return await this.uninstallApp(args);
          
          case 'view_simulator_screen':
            return await this.viewSimulatorScreen(args);
          
          case 'get_device_logs':
            return await this.getDeviceLogs(args);
          
          default:
            throw new Error(`Unknown tool: ${name}`);
        }
      } catch (error) {
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
    const { showAll = false, platform } = args;
    
    const platformEnum = platform ? PlatformHandler.parsePlatformFromString(platform) : undefined;
    const devices = await SimulatorManager.listSimulators(showAll, platformEnum);
    
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
    const { deviceId } = args;
    
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
    const { deviceId } = args;
    
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
    const { projectPath, scheme, platform = 'iOS', deviceId, configuration = 'Debug' } = args;
    
    const platformEnum = PlatformHandler.parsePlatformFromString(platform);
    
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
    const { projectPath, scheme, platform = 'iOS', deviceId, configuration = 'Debug' } = args;
    
    const platformEnum = PlatformHandler.parsePlatformFromString(platform);
    
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
    const { 
      projectPath, 
      scheme, 
      platform = 'iOS', 
      testTarget,
      deviceId, 
      configuration = 'Debug',
      testFilter
    } = args;
    
    const platformEnum = PlatformHandler.parsePlatformFromString(platform);
    
    const result = await XcodeBuilder.testProject({
      projectPath,
      scheme,
      platform: platformEnum,
      deviceId,
      configuration,
      testTarget,
      testFilter
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
    const { packagePath, platform = 'macOS', testFilter, osVersion } = args;
    
    const platformEnum = PlatformHandler.parsePlatformFromString(platform);
    
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
    const { appPath, deviceId } = args;
    
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
    const { bundleId, deviceId } = args;
    
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
    const { deviceId } = args;
    
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
    const { deviceId, predicate, last = '5m' } = args;
    
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

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('Apple Simulator MCP server running');
  }
}

const server = new AppleSimulatorServer();
server.run().catch(console.error);