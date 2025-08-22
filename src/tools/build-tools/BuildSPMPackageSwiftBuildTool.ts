import { z } from 'zod';
import { Platform } from '../../types.js';
import { createModuleLogger } from '../../logger.js';
import { safePathSchema, configurationSchema } from '../validators.js';
import { execAsync } from '../../utils.js';
import { existsSync } from 'fs';
import path from 'path';

const logger = createModuleLogger('BuildSPMPackageSwiftBuildTool');

export const buildSPMPackageSwiftBuildSchema = z.object({
  projectPath: safePathSchema,
  scheme: z.string().optional(),
  configuration: configurationSchema
});

export type BuildSPMPackageSwiftBuildArgs = z.infer<typeof buildSPMPackageSwiftBuildSchema>;

export interface IBuildSPMPackageSwiftBuildTool {
  execute(args: any): Promise<any>;
}

export class BuildSPMPackageSwiftBuildTool implements IBuildSPMPackageSwiftBuildTool {
  async execute(args: any) {
    const validated = buildSPMPackageSwiftBuildSchema.parse(args);
    const { projectPath, configuration } = validated;
    
    logger.info({ projectPath, configuration }, 'Building SPM package for macOS');
    
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
      
      // Build command for macOS using swift build
      let command = `swift build --package-path "${packageDir}"`;
      
      // Add configuration
      if (configuration === 'Release') {
        command += ' -c release';
      } else {
        command += ' -c debug';
      }
      
      logger.debug({ command }, 'Build command');
      
      const { stdout } = await execAsync(command, { 
        maxBuffer: 10 * 1024 * 1024 // 10MB buffer
      });
      
      return {
        content: [
          {
            type: 'text',
            text: `Build succeeded: ${path.basename(packageDir)}
Platform: macOS
Configuration: ${configuration}`
          }
        ]
      };
    } catch (error: any) {
      logger.error({ error, projectPath }, 'SPM macOS build failed');
      
      const errorMessage = error.message || 'Unknown build error';
      const buildOutput = error.stdout || error.stderr || '';
      
      let responseText: string;
      if (buildOutput) {
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