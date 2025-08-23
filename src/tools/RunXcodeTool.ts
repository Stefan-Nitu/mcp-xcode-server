import { z } from 'zod';
import { Platform } from '../types.js';
import { createModuleLogger } from '../logger.js';
import { safePathSchema, platformSchema, configurationSchema } from './validators.js';
import { BuildXcodeTool } from './BuildXcodeTool.js';
import { InstallAppTool } from './InstallAppTool.js';
import { SimulatorManager } from '../simulatorManager.js';
import { PlatformHandler } from '../platformHandler.js';
import { execAsync } from '../utils.js';
import path from 'path';

const logger = createModuleLogger('RunXcodeTool');

export const runXcodeSchema = z.object({
  projectPath: safePathSchema,
  scheme: z.string().optional(),
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
  private buildTool: BuildXcodeTool;
  private installAppTool: InstallAppTool;
  
  constructor(
    buildTool?: BuildXcodeTool,
    installAppTool?: InstallAppTool
  ) {
    this.buildTool = buildTool || new BuildXcodeTool();
    this.installAppTool = installAppTool || new InstallAppTool();
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
        required: ['projectPath']
      }
    };
  }

  async execute(args: any) {
    const validated = runXcodeSchema.parse(args);
    const { projectPath, scheme, platform, deviceId, configuration } = validated;
    
    logger.info({ projectPath, scheme, platform, configuration }, 'Building and running Xcode project');
    
    try {
      // Step 1: Ensure simulator is booted if needed
      let bootedDevice = deviceId;
      if (PlatformHandler.needsSimulator(platform)) {
        bootedDevice = await SimulatorManager.ensureSimulatorBooted(platform, deviceId);
        logger.debug({ bootedDevice }, 'Simulator booted');
      }
      
      // Step 2: Build the project with the specific device
      logger.info('Building project...');
      const buildResult = await this.buildTool.execute({
        projectPath,
        scheme,
        platform,
        deviceId: bootedDevice,
        configuration
      });
      
      // Extract app path from build result
      const buildText = (buildResult.content[0] as any).text;
      const appPathMatch = buildText.match(/App path: (.+)$/m);
      const appPath = appPathMatch ? appPathMatch[1].trim() : null;
      
      if (!appPath || appPath === 'N/A') {
        throw new Error('Build succeeded but could not find app path');
      }
      
      // Step 3: Install and/or run the app
      if (PlatformHandler.needsSimulator(platform)) {
        // For simulator platforms, install the app (which also launches it)
        logger.info({ appPath, deviceId: bootedDevice }, 'Installing app on simulator...');
        await this.installAppTool.execute({
          appPath,
          deviceId: bootedDevice
        });
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
Device: ${bootedDevice || 'N/A'}
App installed at: ${appPath}`
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