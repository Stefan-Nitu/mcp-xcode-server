import { z } from 'zod';
import { Platform } from '../types.js';
import { createModuleLogger } from '../logger.js';
import { safePathSchema, platformSchema, configurationSchema } from './validators.js';
import { existsSync } from 'fs';
import { Devices } from '../utils/devices/Devices.js';
import { Xcode } from '../utils/projects/Xcode.js';
import { XcodeProject } from '../utils/projects/XcodeProject.js';
import { PlatformHandler } from '../platformHandler.js';

const logger = createModuleLogger('TestXcodeTool');

export const testXcodeSchema = z.object({
  projectPath: safePathSchema,
  scheme: z.string(),
  platform: platformSchema.optional().default(Platform.iOS),
  deviceId: z.string().optional(),
  configuration: configurationSchema,
  testTarget: z.string().optional(),
  testFilter: z.string().optional()
});

export type TestXcodeArgs = z.infer<typeof testXcodeSchema>;

/**
 * Test Xcode Tool - runs tests for Xcode projects and workspaces
 */
export class TestXcodeTool {
  private devices: Devices;
  private xcode: Xcode;

  constructor(
    devices?: Devices,
    xcode?: Xcode
  ) {
    this.devices = devices || new Devices();
    this.xcode = xcode || new Xcode();
  }

  getToolDefinition() {
    return {
      name: 'test_xcode',
      description: 'Run tests for an Xcode project or workspace',
      inputSchema: {
        type: 'object',
        properties: {
          projectPath: {
            type: 'string',
            description: 'Path to .xcodeproj or .xcworkspace file'
          },
          scheme: {
            type: 'string',
            description: 'Xcode scheme to test'
          },
          platform: {
            type: 'string',
            description: 'Target platform',
            enum: ['iOS', 'macOS', 'tvOS', 'watchOS', 'visionOS'],
            default: 'iOS'
          },
          deviceId: {
            type: 'string',
            description: 'Device UDID or name (optional, uses generic device if not specified)'
          },
          configuration: {
            type: 'string',
            description: 'Build configuration (Debug or Release)',
            default: 'Debug'
          },
          testTarget: {
            type: 'string',
            description: 'Specific test target to run (e.g., "MyAppTests" or "MyAppUITests")'
          },
          testFilter: {
            type: 'string',
            description: 'Filter for specific test classes or methods (e.g., "MyAppTests/UserTests" for a class, "MyAppTests/UserTests/testLogin" for a method)'
          }
        },
        required: ['projectPath', 'scheme']
      }
    };
  }

  async execute(args: any) {
    const validated = testXcodeSchema.parse(args);
    const { projectPath, scheme, platform, deviceId, configuration, testTarget, testFilter } = validated;
    
    logger.info({ projectPath, scheme, platform, configuration, testTarget }, 'Running Xcode tests');
    
    try {
      // Check if project exists
      if (!existsSync(projectPath)) {
        throw new Error(`Project path does not exist: ${projectPath}`);
      }
      
      // Open the project using Xcode utility (auto-detects type)
      const project = await this.xcode.open(projectPath);
      
      // Ensure it's an Xcode project, not a Swift package
      if (!(project instanceof XcodeProject)) {
        throw new Error('Not an Xcode project or workspace');
      }
      
      // Boot simulator if needed (tests always need a real simulator, not generic)
      let bootedDeviceId = deviceId;
      if (PlatformHandler.needsSimulator(platform)) {
        if (deviceId) {
          // User specified a device
          const device = await this.devices.find(deviceId);
          if (!device) {
            throw new Error(`Device not found: ${deviceId}`);
          }
          await device.ensureBooted();
          bootedDeviceId = device.id;
        } else {
          // No device specified, find one for the platform
          const device = await this.devices.findForPlatform(platform);
          if (!device) {
            throw new Error(`No available simulator for platform: ${platform}`);
          }
          await device.ensureBooted();
          bootedDeviceId = device.id;
          logger.info({ deviceId: device.id, deviceName: device.name }, 'Using auto-selected device for tests');
        }
      }
      
      // Run tests using XcodeProject
      const testResult = await project.test({
        scheme,
        configuration,
        platform,
        deviceId: bootedDeviceId,
        testTarget,
        testFilter
      });
      
      if (!testResult.success && testResult.failed === 0 && testResult.passed === 0) {
        // Build or setup error, not test failures
        throw new Error(testResult.output);
      }
      
      // Format the results
      const summary = `Tests ${testResult.success ? 'passed' : 'failed'}: ${testResult.passed} passed, ${testResult.failed} failed`;
      
      return {
        content: [
          {
            type: 'text',
            text: `${summary}
Platform: ${platform}
Configuration: ${configuration}
${testTarget ? `Test Target: ${testTarget}` : 'All tests in scheme'}
${testFilter ? `Filter: ${testFilter}` : ''}

Full output:
${testResult.output}`
          }
        ]
      };
    } catch (error: any) {
      logger.error({ error, projectPath, scheme, platform }, 'Tests failed');
      
      // Return error with full output if available
      const errorMessage = error.message || 'Unknown test error';
      const output = error.stdout || error.stderr || '';
      
      return {
        content: [
          {
            type: 'text',
            text: `Test execution failed: ${errorMessage}${output ? `\n\n${output}` : ''}`
          }
        ]
      };
    }
  }
}