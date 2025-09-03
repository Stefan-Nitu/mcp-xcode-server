import { z } from 'zod';
import { existsSync, rmSync } from 'fs';
import { join, dirname, basename } from 'path';
import { Platform } from '../../types.js';
import { createModuleLogger } from '../../logger.js';
import { safePathSchema, platformSchema, configurationSchema } from '../application/validators/commonSchemas.js';
import { execAsync } from '../../utils.js';

const logger = createModuleLogger('CleanBuildTool');

export const cleanBuildSchema = z.object({
  projectPath: safePathSchema.optional(),
  scheme: z.string().optional(),
  platform: platformSchema.optional().default(Platform.iOS),
  configuration: configurationSchema,
  cleanTarget: z.enum(['build', 'derivedData', 'testResults', 'all']).optional().default('build'),
  derivedDataPath: z.string().optional().default('./DerivedData')
});

export type CleanBuildArgs = z.infer<typeof cleanBuildSchema>;

// Interface for testing
export interface ICleanBuildTool {
  execute(args: any): Promise<any>;
  getToolDefinition(): any;
}

export class CleanBuildTool implements ICleanBuildTool {
  getToolDefinition() {
    return {
      name: 'clean_build',
      description: 'Clean build artifacts, DerivedData, or test results',
      inputSchema: {
        type: 'object',
        properties: {
          projectPath: {
            type: 'string',
            description: 'Path to the Xcode project, workspace, or Package.swift (optional for DerivedData-only cleaning)'
          },
          scheme: {
            type: 'string',
            description: 'Xcode scheme (optional)'
          },
          platform: {
            type: 'string',
            description: 'Target platform (iOS, macOS, tvOS, watchOS, visionOS)',
            enum: ['iOS', 'macOS', 'tvOS', 'watchOS', 'visionOS'],
            default: 'iOS'
          },
          configuration: {
            type: 'string',
            description: 'Build configuration (Debug/Release)',
            enum: ['Debug', 'Release'],
            default: 'Debug'
          },
          cleanTarget: {
            type: 'string',
            description: 'What to clean: build (xcodebuild clean or .build), derivedData, testResults, or all',
            enum: ['build', 'derivedData', 'testResults', 'all'],
            default: 'build'
          },
          derivedDataPath: {
            type: 'string',
            description: 'Path to DerivedData folder',
            default: './DerivedData'
          }
        }
      }
    };
  }

  async execute(args: any) {
    const validated = cleanBuildSchema.parse(args);
    const { projectPath, scheme, configuration, cleanTarget, derivedDataPath } = validated;
    
    logger.info({ projectPath, cleanTarget, derivedDataPath }, 'Cleaning build artifacts');
    
    const messages: string[] = [];
    
    try {
      // Handle build cleaning
      if (this.shouldCleanBuild(cleanTarget)) {
        const buildMessages = await this.cleanBuildArtifacts(projectPath, scheme, configuration, cleanTarget);
        messages.push(...buildMessages);
      }
      
      // Handle DerivedData/test results cleaning
      if (this.shouldCleanDerivedData(cleanTarget)) {
        const derivedDataMessages = await this.cleanDerivedDataArtifacts(derivedDataPath, cleanTarget);
        messages.push(...derivedDataMessages);
      }
      
      return this.successResponse(messages);
      
    } catch (error: any) {
      logger.error({ error, projectPath, cleanTarget }, 'Failed to clean project');
      return this.errorResponse(`Failed to clean project: ${error.message}`);
    }
  }

  private shouldCleanBuild(cleanTarget: string): boolean {
    return cleanTarget === 'build' || cleanTarget === 'all';
  }

  private shouldCleanDerivedData(cleanTarget: string): boolean {
    return cleanTarget === 'derivedData' || cleanTarget === 'testResults' || cleanTarget === 'all';
  }

  private async cleanBuildArtifacts(
    projectPath: string | undefined,
    scheme: string | undefined,
    configuration: string,
    cleanTarget: string
  ): Promise<string[]> {
    const messages: string[] = [];
    
    if (!projectPath || !existsSync(projectPath)) {
      if (cleanTarget === 'build') {
        throw new Error('Project path required for cleaning build folder');
      }
      return messages;
    }
    
    // Handle Swift packages
    if (projectPath.endsWith('Package.swift')) {
      return this.cleanSwiftPackageBuild(projectPath);
    }
    
    // Handle Xcode projects/workspaces
    return this.cleanXcodeBuild(projectPath, scheme, configuration);
  }

  private async cleanSwiftPackageBuild(packagePath: string): Promise<string[]> {
    const messages: string[] = [];
    const packageDir = dirname(packagePath);
    const buildDir = join(packageDir, '.build');
    
    if (!existsSync(buildDir)) {
      messages.push('No .build directory to clean');
      return messages;
    }
    
    rmSync(buildDir, { recursive: true, force: true });
    messages.push(`Removed .build directory for ${basename(packageDir)}`);
    logger.info({ path: buildDir }, 'Removed SPM .build directory');
    
    return messages;
  }

  private async cleanXcodeBuild(
    projectPath: string,
    scheme: string | undefined,
    configuration: string
  ): Promise<string[]> {
    const messages: string[] = [];
    const isWorkspace = projectPath.endsWith('.xcworkspace');
    const projectFlag = isWorkspace ? '-workspace' : '-project';
    
    let command = `xcodebuild clean ${projectFlag} "${projectPath}"`;
    
    if (scheme) {
      command += ` -scheme "${scheme}"`;
    }
    
    command += ` -configuration "${configuration}"`;
    
    logger.info({ projectPath, scheme, configuration }, 'Cleaning build folder');
    
    try {
      await execAsync(command);
      messages.push(`Cleaned build folder for ${scheme || basename(projectPath)}`);
    } catch (error: any) {
      logger.warn({ error, projectPath }, 'Failed to clean build folder');
      messages.push(`Warning: Could not clean build folder: ${error.message}`);
    }
    
    return messages;
  }

  private async cleanDerivedDataArtifacts(
    derivedDataPath: string,
    cleanTarget: string
  ): Promise<string[]> {
    const messages: string[] = [];
    
    if (!existsSync(derivedDataPath)) {
      messages.push(`No DerivedData found at ${derivedDataPath}`);
      return messages;
    }
    
    // Clean only test results
    if (cleanTarget === 'testResults') {
      return this.cleanTestResults(derivedDataPath);
    }
    
    // Clean entire DerivedData
    rmSync(derivedDataPath, { recursive: true, force: true });
    messages.push(`Removed DerivedData at ${derivedDataPath}`);
    logger.info({ path: derivedDataPath }, 'Removed DerivedData');
    
    return messages;
  }

  private cleanTestResults(derivedDataPath: string): string[] {
    const messages: string[] = [];
    const testLogsPath = join(derivedDataPath, 'Logs', 'Test');
    
    if (!existsSync(testLogsPath)) {
      messages.push('No test results to clear');
      return messages;
    }
    
    rmSync(testLogsPath, { recursive: true, force: true });
    messages.push('Cleared test results');
    logger.info({ path: testLogsPath }, 'Cleared test results');
    
    return messages;
  }

  private successResponse(messages: string[]): any {
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            success: true,
            message: messages.length > 0 ? messages.join('. ') : 'Nothing to clean'
          })
        }
      ]
    };
  }

  private errorResponse(message: string): any {
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            success: false,
            message
          })
        }
      ]
    };
  }
}