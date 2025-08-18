import { z } from 'zod';
import { XcodeBuilder } from '../xcodeBuilder.js';
import { Platform } from '../types.js';
import { createModuleLogger } from '../logger.js';
import { safePathSchema, platformSchema, configurationSchema } from './validators.js';

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
  constructor(
    private xcodeBuilder: XcodeBuilder | typeof XcodeBuilder = XcodeBuilder
  ) {}

  getToolDefinition() {
    return {
      name: 'clean_build',
      description: 'Clean build artifacts, DerivedData, or test results',
      inputSchema: {
        type: 'object',
        properties: {
          projectPath: {
            type: 'string',
            description: 'Path to the Xcode project or workspace (optional for DerivedData-only cleaning)'
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
            description: 'What to clean: build (xcodebuild clean), derivedData, testResults, or all',
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
    const { projectPath, scheme, platform, configuration, cleanTarget, derivedDataPath } = validated;
    
    logger.info({ projectPath, cleanTarget, derivedDataPath }, 'Cleaning build artifacts');
    
    // Use static method if XcodeBuilder is the class, or instance method if it's an instance
    const cleanMethod = typeof this.xcodeBuilder === 'function' 
      ? this.xcodeBuilder.cleanProject
      : this.xcodeBuilder.cleanProjectInstance;
      
    const result = await cleanMethod.call(this.xcodeBuilder, {
      projectPath,
      scheme,
      platform,
      configuration,
      cleanTarget,
      derivedDataPath
    });
    
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(result)
        }
      ]
    };
  }
}