import { z } from 'zod';
import { Platform } from '../types.js';
import { createModuleLogger } from '../logger.js';
import { safePathSchema, platformSchema, configurationSchema } from './validators.js';
import { BuildTool } from './build-tools/BuildTool.js';
import { InstallAppTool } from './InstallAppTool.js';
import { SimulatorManager } from '../simulatorManager.js';
import { PlatformHandler } from '../platformHandler.js';
import { execAsync } from '../utils.js';
import path from 'path';

const logger = createModuleLogger('RunProjectTool');

export const runProjectSchema = z.object({
  projectPath: safePathSchema,
  scheme: z.string().optional(),
  platform: platformSchema.optional().default(Platform.iOS),
  deviceId: z.string().optional(),
  configuration: configurationSchema
});

export type RunProjectArgs = z.infer<typeof runProjectSchema>;

// Interface for testing
export interface IRunProjectTool {
  execute(args: any): Promise<any>;
  getToolDefinition(): any;
}

export class RunProjectTool implements IRunProjectTool {
  private buildTool: BuildTool;
  private installAppTool: InstallAppTool;
  
  constructor(
    buildTool?: BuildTool,
    installAppTool?: InstallAppTool
  ) {
    this.buildTool = buildTool || new BuildTool();
    this.installAppTool = installAppTool || new InstallAppTool();
  }

  getToolDefinition() {
    return {
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
            description: 'Xcode scheme to build (required for .xcodeproj/.xcworkspace)'
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
            description: 'Build configuration (e.g., Debug, Release, Beta, Staging)',
            default: 'Debug'
          }
        },
        required: ['projectPath']
      }
    };
  }

  async execute(args: any) {
    const validated = runProjectSchema.parse(args);
    const { projectPath, scheme, platform, deviceId, configuration } = validated;
    
    logger.info({ projectPath, scheme, platform, configuration }, 'Building and running project');
    
    // Step 1: Ensure simulator is booted if needed
    let bootedDevice = deviceId;
    if (PlatformHandler.needsSimulator(platform)) {
      bootedDevice = await SimulatorManager.ensureSimulatorBooted(platform, deviceId);
      logger.debug({ bootedDevice }, 'Simulator booted');
    }
    
    // Step 2: Build the project with the specific device (for optimal caching)
    logger.info('Building project...');
    const buildResult = await this.buildTool.execute({
      projectPath,
      scheme,
      platform,
      deviceId: bootedDevice,  // Build for the specific device for caching
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
      // For macOS, launch the built app using the same approach as SimulatorManager
      logger.info({ appPath }, 'Launching macOS app...');
      try {
        // Use absolute path
        const absolutePath = path.resolve(appPath);
        logger.debug({ absolutePath }, 'Launching app with absolute path');
        
        // Use execAsync (promisified exec) just like SimulatorManager does
        await execAsync(`open "${absolutePath}"`);
        logger.info({ appPath: absolutePath }, 'macOS app launched successfully');
      } catch (error: any) {
        logger.error({ error: error.message, appPath }, 'Failed to launch macOS app');
        // Don't fail the whole operation if launch fails
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
Device: ${bootedDevice}
App installed at: ${appPath}`
        }
      ]
    };
  }
}