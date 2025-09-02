import { z } from 'zod';
import { Platform } from '../../types.js';
import { createModuleLogger } from '../../logger.js';
import { safePathSchema, platformSchema, configurationSchema } from '../validators.js';
import { Devices } from '../../utils/devices/Devices.js';
import { Xcode } from '../../utils/projects/Xcode.js';
import { XcodeProject } from '../../utils/projects/XcodeProject.js';
import { PlatformInfo } from '../../domain/value-objects/PlatformInfo.js';
import { handleXcodeError } from '../../utils/errors/index.js';

const logger = createModuleLogger('TestXcodeTool');

export const testXcodeSchema = z.object({
  projectPath: safePathSchema,
  scheme: z.string({ required_error: 'Scheme is required' }).min(1, 'Scheme cannot be empty'),
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
      // Open the project using Xcode utility, expecting Xcode project specifically
      const project = await this.xcode.open(projectPath, 'xcode');
      
      // Ensure it's an Xcode project, not a Swift package
      if (!(project instanceof XcodeProject)) {
        throw new Error('Not an Xcode project or workspace');
      }
      
      // Boot simulator if needed (tests always need a real simulator, not generic)
      let bootedDeviceId = deviceId;
      let device = null;
      
      const platformInfo = PlatformInfo.fromPlatform(platform);
      if (platformInfo.requiresSimulator()) {
        if (deviceId) {
          // User specified a device
          device = await this.devices.find(deviceId);
          if (!device) {
            throw new Error(`Device not found: ${deviceId}`);
          }
          await device.ensureBooted();
          bootedDeviceId = device.id;
        } else {
          // No device specified, find one for the platform
          device = await this.devices.findForPlatform(platform);
          if (!device) {
            throw new Error(`No available simulator for platform: ${platform}`);
          }
          await device.ensureBooted();
          bootedDeviceId = device.id;
          logger.info({ deviceId: device.id, deviceName: device.name }, 'Using auto-selected device for tests');
        }
        
        // Open the Simulator app (handles test environment)
        await device.open();
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
      
      // Check if tests failed due to compile/build errors
      if (testResult.compileErrors || testResult.buildErrors) {
        const error: any = new Error('Test build failed');
        error.compileErrors = testResult.compileErrors;
        error.buildErrors = testResult.buildErrors;
        error.logPath = testResult.logPath;
        return handleXcodeError(error, { platform, configuration, scheme });
      }
      
      if (!testResult.success && testResult.failed === 0 && testResult.passed === 0) {
        // Other non-test failures (scheme errors, etc)
        return {
          content: [
            {
              type: 'text',
              text: `❌ Test execution failed (see logs for details)\n\nPlatform: ${platform}\nConfiguration: ${configuration}\nScheme: ${scheme}\n\n📁 Full logs saved to: ${testResult.logPath}`
            }
          ]
        };
      }
      
      // Format the results
      const icon = testResult.success ? '✅' : '❌';
      const summary = `${icon} Tests ${testResult.success ? 'passed' : 'failed'}: ${testResult.passed} passed, ${testResult.failed} failed`;
      
      const failingTestsList = testResult.failingTests && testResult.failingTests.length > 0 
        ? `\n\n**Failing tests:**\n${testResult.failingTests.map(t => `• ${t.identifier}\n  ${t.reason}`).join('\n\n')}`
        : '';
      
      return {
        content: [
          {
            type: 'text',
            text: `${summary}${failingTestsList}\n\nPlatform: ${platform}\nConfiguration: ${configuration}\n${testTarget ? `Test Target: ${testTarget}\n` : ''}${testFilter ? `Filter: ${testFilter}\n` : ''}\n📁 Full logs saved to: ${testResult.logPath}`
          }
        ]
      };
    } catch (error: any) {
      logger.error({ error, projectPath, scheme, platform }, 'Tests failed');
      
      // Use unified error handler
      return handleXcodeError(error, { platform, configuration, scheme });
    }
  }
}