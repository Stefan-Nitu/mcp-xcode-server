import { z } from 'zod';
import { Platform } from '../../types.js';
import { createModuleLogger } from '../../logger.js';
import { safePathSchema, configurationSchema, platformSchema } from '../validators.js';
import { execAsync } from '../../utils.js';
import { existsSync } from 'fs';
import path from 'path';
import { SimulatorManager } from '../../simulatorManager.js';
import { PlatformHandler } from '../../platformHandler.js';

const logger = createModuleLogger('BuildSPMPackageXcodebuildTool');

export const buildSPMPackageXcodebuildSchema = z.object({
  projectPath: safePathSchema,
  scheme: z.string().optional(),
  platform: platformSchema.optional().default(Platform.iOS),
  deviceId: z.string().optional(),
  configuration: configurationSchema
});

export type BuildSPMPackageXcodebuildArgs = z.infer<typeof buildSPMPackageXcodebuildSchema>;

export interface IBuildSPMPackageXcodebuildTool {
  execute(args: any): Promise<any>;
}

export class BuildSPMPackageXcodebuildTool implements IBuildSPMPackageXcodebuildTool {
  async execute(args: any) {
    const validated = buildSPMPackageXcodebuildSchema.parse(args);
    const { projectPath, scheme, platform, deviceId, configuration } = validated;
    
    logger.info({ projectPath, scheme, platform, configuration }, 'Building SPM package with xcodebuild');
    
    try {
      // Determine the actual package directory
      let packageDir: string;
      if (projectPath.endsWith('Package.swift')) {
        packageDir = path.dirname(projectPath);
      } else {
        packageDir = projectPath;
      }
      
      // Check if Package.swift exists
      const packageFile = path.join(packageDir, 'Package.swift');
      if (!existsSync(packageFile)) {
        throw new Error(`No Package.swift found at: ${packageDir}`);
      }
      
      // Ensure simulator is booted if platform needs it
      let bootedDevice = '';
      if (PlatformHandler.needsSimulator(platform)) {
        bootedDevice = await SimulatorManager.ensureSimulatorBooted(platform, deviceId);
      }
      
      // Build command using xcodebuild
      let command = 'xcodebuild';
      
      // Add scheme (required for xcodebuild with SPM)
      const schemeName = scheme || path.basename(packageDir);
      command += ` -scheme "${schemeName}"`;
      
      // Add destination
      const destination = PlatformHandler.getDestination(platform, bootedDevice || deviceId);
      command += ` -destination '${destination}'`;
      
      // Add configuration
      command += ` -configuration "${configuration}"`;
      
      // Add derived data path
      command += ' -derivedDataPath ./DerivedData';
      
      // Add build action
      command += ' build';
      
      logger.debug({ command, cwd: packageDir }, 'Build command');
      
      const { stdout } = await execAsync(command, { 
        cwd: packageDir,
        maxBuffer: 10 * 1024 * 1024 // 10MB buffer
      });
      
      return {
        content: [
          {
            type: 'text',
            text: `Build succeeded: ${schemeName}
Platform: ${platform}
Configuration: ${configuration}`
          }
        ]
      };
    } catch (error: any) {
      logger.error({ error, projectPath, scheme }, 'SPM iOS build failed');
      
      const errorMessage = error.message || 'Unknown build error';
      const buildOutput = error.stdout || error.stderr || '';
      
      let responseText: string;
      if (buildOutput && buildOutput.includes('xcodebuild')) {
        responseText = buildOutput;
      } else {
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