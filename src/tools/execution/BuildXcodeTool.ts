import { z } from 'zod';
import { Platform } from '../../types.js';
import { createModuleLogger } from '../../logger.js';
import { safePathSchema, platformSchema, configurationSchema } from '../validators.js';
import { existsSync } from 'fs';
import path from 'path';
import { PlatformHandler } from '../../platformHandler.js';
import { Devices } from '../../utils/devices/Devices.js';
import { config } from '../../config.js';
import { Xcode } from '../../utils/projects/Xcode.js';
import { XcodeProject } from '../../utils/projects/XcodeProject.js';
import { execAsync } from '../../utils.js';
import { handleXcodeError } from '../../utils/errors/index.js';

const logger = createModuleLogger('BuildXcodeTool');

export const buildXcodeSchema = z.object({
  projectPath: safePathSchema,
  scheme: z.string({ required_error: 'Scheme is required' }).min(1, 'Scheme cannot be empty'),
  platform: platformSchema.optional().default(Platform.iOS),
  deviceId: z.string().optional(),
  configuration: configurationSchema
});

export type BuildXcodeArgs = z.infer<typeof buildXcodeSchema>;

/**
 * Build Xcode Tool - builds Xcode projects and workspaces
 */
export class BuildXcodeTool {
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
      name: 'build_xcode',
      description: 'Build an Xcode project or workspace',
      inputSchema: {
        type: 'object',
        properties: {
          projectPath: {
            type: 'string',
            description: 'Path to .xcodeproj or .xcworkspace file'
          },
          scheme: {
            type: 'string',
            description: 'Xcode scheme to build'
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
            description: 'Build configuration (e.g., Debug, Release, Beta, Staging)',
            default: 'Debug'
          }
        },
        required: ['projectPath', 'scheme']
      }
    };
  }

  async execute(args: any) {
    const validated = buildXcodeSchema.parse(args);
    const { projectPath, scheme, platform, deviceId, configuration } = validated;
    
    logger.info({ projectPath, scheme, platform, configuration }, 'Building Xcode project');
    
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
      
      // Boot simulator if needed
      let bootedDeviceId = deviceId;
      if (deviceId && PlatformHandler.needsSimulator(platform)) {
        const device = await this.devices.find(deviceId);
        if (!device) {
          throw new Error(`Device not found: ${deviceId}`);
        }
        await device.ensureBooted();
        bootedDeviceId = device.id;
      }
      
      // Use config to get DerivedData path
      const derivedDataPath = config.getDerivedDataPath(projectPath);
      
      logger.info({ projectPath, derivedDataPath }, 'Build will use DerivedData location');
      
      // Build the project using XcodeProject
      const buildResult = await project.buildProject({
        scheme,
        configuration,
        platform,
        deviceId: bootedDeviceId,
        derivedDataPath
      });
      
      if (!buildResult.success) {
        // Create error with output for handler to parse
        const error: any = new Error(buildResult.output);
        error.logPath = buildResult.logPath;
        throw error;
      }
      
      // Try to find the built app (if not already found)
      let appPath = buildResult.appPath;
      if (!appPath) {
        try {
          // Look for the app in the DerivedData folder we specified
          const { stdout: findOutput } = await execAsync(
            `find "${derivedDataPath}" -name "*.app" -type d | head -1`
          );
          appPath = findOutput.trim() || undefined;
          
          if (appPath) {
            logger.info({ appPath }, 'Found app at path');
            
            // Verify the app actually exists
            if (!existsSync(appPath)) {
              logger.error({ appPath }, 'App path does not exist!');
              appPath = undefined;
            }
          } else {
            logger.warn({ derivedDataPath }, 'No app found in DerivedData');
          }
        } catch (error: any) {
          logger.error({ error: error.message, derivedDataPath }, 'Error finding app path');
        }
      }
      
      // Check if the configuration actually worked by looking at the build path
      // If the app is in a folder named after the configuration, it worked
      let actualConfiguration = configuration;
      let configNote = '';
      
      if (appPath && !appPath.toLowerCase().includes(configuration.toLowerCase())) {
        // The app wasn't built in the expected configuration directory
        // This means Xcode fell back to Release
        actualConfiguration = 'Release';
        configNote = ` - ${configuration} configuration was not found`;
      }
      
      const icon = buildResult.logPath ? '✅' : '✅';
      return {
        content: [
          {
            type: 'text',
            text: `${icon} Build succeeded: ${scheme || path.basename(projectPath)}

Platform: ${platform}
Configuration: ${actualConfiguration}${configNote}
App path: ${appPath || 'N/A'}${buildResult.logPath ? `

📁 Full logs saved to: ${buildResult.logPath}` : ''}`
          }
        ]
      };
    } catch (error: any) {
      logger.error({ error, projectPath, scheme, platform }, 'Build failed');
      
      // Use unified error handler
      return handleXcodeError(error, { platform, configuration, scheme: scheme || 'default' });
    }
  }
}