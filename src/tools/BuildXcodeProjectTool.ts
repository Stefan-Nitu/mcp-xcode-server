import { z } from 'zod';
import { Platform } from '../types.js';
import { createModuleLogger } from '../logger.js';
import { safePathSchema, platformSchema, configurationSchema } from './validators.js';
import { execAsync } from '../utils.js';
import { existsSync } from 'fs';
import path from 'path';
import { SimulatorManager } from '../simulatorManager.js';
import { PlatformHandler } from '../platformHandler.js';

const logger = createModuleLogger('BuildXcodeProjectTool');

export const buildXcodeProjectSchema = z.object({
  projectPath: safePathSchema,
  scheme: z.string().optional(),
  platform: platformSchema.optional().default(Platform.iOS),
  deviceId: z.string().optional(),
  configuration: configurationSchema
});

export type BuildXcodeProjectArgs = z.infer<typeof buildXcodeProjectSchema>;

export interface IBuildXcodeProjectTool {
  execute(args: any): Promise<any>;
  getToolDefinition(): any;
}

export class BuildXcodeProjectTool implements IBuildXcodeProjectTool {

  getToolDefinition() {
    return {
      name: 'build_xcode_project',
      description: 'Build an Xcode project or workspace',
      inputSchema: {
        type: 'object',
        properties: {
          projectPath: {
            type: 'string',
            description: 'Path to the Xcode project (.xcodeproj) or workspace (.xcworkspace)'
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
    };
  }

  async execute(args: any) {
    const validated = buildXcodeProjectSchema.parse(args);
    const { projectPath, scheme, platform, deviceId, configuration } = validated;
    
    logger.info({ projectPath, scheme, platform, configuration }, 'Building Xcode project');
    
    try {
      // Check if project exists
      if (!existsSync(projectPath)) {
        throw new Error(`Project path does not exist: ${projectPath}`);
      }
      
      // Ensure simulator is booted if platform needs it
      let bootedDevice = '';
      if (PlatformHandler.needsSimulator(platform)) {
        bootedDevice = await SimulatorManager.ensureSimulatorBooted(platform, deviceId);
      }
      
      // Build command using xcodebuild
      const isWorkspace = projectPath.endsWith('.xcworkspace');
      const projectFlag = isWorkspace ? '-workspace' : '-project';
      
      let command = `xcodebuild ${projectFlag} "${projectPath}"`;
      
      // Add scheme if provided
      if (scheme) {
        command += ` -scheme "${scheme}"`;
      }
      
      // Add configuration
      command += ` -configuration "${configuration}"`;
      
      // Add destination
      const destination = PlatformHandler.getDestination(platform, bootedDevice || deviceId);
      command += ` -destination '${destination}'`;
      
      // Add derived data path
      command += ' -derivedDataPath ./DerivedData';
      
      // Add build action
      command += ' build';
      
      logger.debug({ command }, 'Build command');
      
      const { stdout } = await execAsync(command, { 
        maxBuffer: 10 * 1024 * 1024 // 10MB buffer
      });
      
      // Try to find the built app
      let appPath: string | null = null;
      try {
        const { stdout: findOutput } = await execAsync(
          'find "./DerivedData" -name "*.app" -type d | head -1'
        );
        appPath = findOutput.trim() || null;
      } catch {
        // Ignore errors finding app path
      }
      
      return {
        content: [
          {
            type: 'text',
            text: `Build succeeded: ${scheme || path.basename(projectPath)}
Platform: ${platform}
Configuration: ${configuration}
App path: ${appPath || 'N/A'}`
          }
        ]
      };
    } catch (error: any) {
      logger.error({ error, projectPath, scheme, platform }, 'Build failed');
      
      const errorMessage = error.message || 'Unknown build error';
      const buildOutput = error.stdout || error.stderr || '';
      
      let responseText: string;
      if (buildOutput && buildOutput.includes('xcodebuild')) {
        // Return the actual build output - it has all the context developers need
        responseText = buildOutput;
      } else {
        // Fallback to just the error message if no build output available
        responseText = `Build failed: ${errorMessage}`;
      }
      
      return {
        content: [
          {
            type: 'text',
            text: responseText
          }
        ]
      };
    }
  }
}