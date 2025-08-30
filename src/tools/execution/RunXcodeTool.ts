import { z } from 'zod';
import { Platform } from '../../types.js';
import { createModuleLogger } from '../../logger.js';
import { safePathSchema, platformSchema, configurationSchema } from '../validators.js';
import { PlatformHandler } from '../../platformHandler.js';
import { Devices } from '../../utils/devices/Devices.js';
import { Xcode } from '../../utils/projects/Xcode.js';
import { XcodeProject } from '../../utils/projects/XcodeProject.js';
import { config } from '../../config.js';
import { execAsync } from '../../utils.js';
import { existsSync } from 'fs';
import path from 'path';
import { formatCompileErrors } from '../../utils/errorFormatting.js';
import { formatBuildErrors, parseBuildErrors } from '../../utils/buildErrorParsing.js';

const logger = createModuleLogger('RunXcodeTool');

export const runXcodeSchema = z.object({
  projectPath: safePathSchema,
  scheme: z.string({ required_error: 'Scheme is required' }).min(1, 'Scheme cannot be empty'),
  platform: platformSchema.optional().default(Platform.iOS),
  deviceId: z.string().optional(),
  configuration: configurationSchema
});

export type RunXcodeArgs = z.infer<typeof runXcodeSchema>;

/**
 * Run Xcode Tool - builds and runs Xcode projects
 * Based on validated RunProjectTool but for Xcode projects only
 */
export class RunXcodeTool {
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
      name: 'run_xcode',
      description: 'Build and run an Xcode project or workspace',
      inputSchema: {
        type: 'object',
        properties: {
          projectPath: {
            type: 'string',
            description: 'Path to .xcodeproj or .xcworkspace file'
          },
          scheme: {
            type: 'string',
            description: 'Xcode scheme to build and run'
          },
          platform: {
            type: 'string',
            description: 'Target platform',
            enum: ['iOS', 'macOS', 'tvOS', 'watchOS', 'visionOS'],
            default: 'iOS'
          },
          deviceId: {
            type: 'string',
            description: 'Device UDID or name (for simulator platforms)'
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
    const validated = runXcodeSchema.parse(args);
    const { projectPath, scheme, platform, deviceId, configuration } = validated;
    
    logger.info({ projectPath, scheme, platform, configuration }, 'Building and running Xcode project');
    
    try {
      // Check if project exists
      if (!existsSync(projectPath)) {
        throw new Error(`Project path does not exist: ${projectPath}`);
      }
      
      // Open the project using Xcode utility
      const project = await this.xcode.open(projectPath);
      
      // Ensure it's an Xcode project, not a Swift package
      if (!(project instanceof XcodeProject)) {
        throw new Error('Not an Xcode project or workspace');
      }
      
      // Step 1: Find and boot simulator if needed
      let device = null;
      let bootedDeviceId = deviceId;
      let deviceDisplayName = deviceId || 'N/A';
      
      if (PlatformHandler.needsSimulator(platform)) {
        if (deviceId) {
          // Find specific device
          device = await this.devices.find(deviceId);
          if (!device) {
            throw new Error(`Device not found: ${deviceId}`);
          }
        } else {
          // Find any available device for the platform
          device = await this.devices.findForPlatform(platform);
          if (!device) {
            throw new Error(`No simulator found for platform: ${platform}`);
          }
        }
        
        // Ensure the device is booted
        await device.ensureBooted();
        bootedDeviceId = device.id;
        deviceDisplayName = device.name;
        logger.debug({ deviceId: device.id, name: device.name }, 'Simulator ready');
      }
      
      // Step 2: Build the project using XcodeProject
      logger.info('Building project...');
      
      // Use config to get DerivedData path
      const derivedDataPath = config.getDerivedDataPath(projectPath);
      
      let buildResult;
      try {
        buildResult = await project.buildProject({
          scheme,
          configuration,
          platform,
          deviceId: bootedDeviceId,
          derivedDataPath
        });
      } catch (buildError: any) {
        // Check if we have compile errors in the error object
        if (buildError.compileErrors && buildError.compileErrors.length > 0) {
          const { summary, errorList } = formatCompileErrors(buildError.compileErrors);
          
          return {
            content: [
              {
                type: 'text',
                text: `${summary}\n${errorList}\n\nPlatform: ${platform}\nConfiguration: ${configuration}\nScheme: ${scheme}\n\n📁 Full logs saved to: ${buildError.logPath}`
              }
            ]
          };
        }
        
        // Check if we have other build errors (scheme, signing, provisioning, etc.)
        if (buildError.buildErrors && buildError.buildErrors.length > 0) {
          const buildErrorText = formatBuildErrors(buildError.buildErrors);
          
          return {
            content: [
              {
                type: 'text',
                text: `${buildErrorText}\n\nPlatform: ${platform}\nConfiguration: ${configuration}\nScheme: ${scheme}\n\n📁 Full logs saved to: ${buildError.logPath}`
              }
            ]
          };
        }
        
        // Re-throw if not a handled error type
        throw buildError;
      }
      
      // Get the app path from build result or find it
      let appPath = buildResult.appPath;
      if (!appPath) {
        try {
          const { stdout: findOutput } = await execAsync(
            `find "${derivedDataPath}" -name "*.app" -type d | head -1`
          );
          appPath = findOutput.trim() || undefined;
          
          if (appPath && !existsSync(appPath)) {
            appPath = undefined;
          }
        } catch (error: any) {
          logger.error({ error: error.message }, 'Error finding app path');
        }
      }
      
      if (!appPath) {
        logger.error({ buildResult }, 'Could not find app path');
        throw new Error('Build succeeded but could not find app path');
      }
      
      // Step 3: Install and/or run the app
      if (PlatformHandler.needsSimulator(platform) && device) {
        // For simulator platforms, install the app
        logger.info({ appPath, deviceId: device.id }, 'Installing app on simulator...');
        await device.install(appPath);
        
        // Extract bundle ID from app and launch it
        try {
          const bundleId = await device.getBundleId(appPath);
          
          if (bundleId) {
            logger.info({ bundleId, deviceId: device.id }, 'Launching app on simulator...');
            
            // Small delay to ensure installation is complete
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            // Launch the app
            const pid = await device.launch(bundleId);
            logger.info({ pid }, 'App launched with PID');
            
            // Open the Simulator app (handles test environment)
            await device.open();
            
            // Set appearance (may fail on older Xcode versions)
            await device.setAppearance('light');
          }
        } catch (error: any) {
          logger.warn({ error: error.message }, 'Failed to launch app, but installation succeeded');
        }
      } else if (platform === Platform.macOS) {
        // For macOS, launch the built app
        logger.info({ appPath }, 'Launching macOS app...');
        try {
          const absolutePath = path.resolve(appPath);
          logger.debug({ absolutePath }, 'Launching app with absolute path');
          await execAsync(`open "${absolutePath}"`);
          logger.info({ appPath: absolutePath }, 'macOS app launched successfully');
        } catch (error: any) {
          logger.error({ error: error.message, appPath }, 'Failed to launch macOS app');
        }
      } else {
        logger.info({ appPath, platform }, 'App built successfully');
      }
      
      return {
        content: [
          {
            type: 'text',
            text: `Successfully built and ran project: ${scheme || path.basename(projectPath)}
Platform: ${platform}
Configuration: ${configuration}
Device: ${deviceDisplayName}
App path: ${appPath}
Status: App installed and launched`
          }
        ]
      };
    } catch (error: any) {
      logger.error({ error, projectPath }, 'Failed to run project');
      
      return {
        content: [
          {
            type: 'text',
            text: `Run failed: ${error.message}`
          }
        ]
      };
    }
  }
}