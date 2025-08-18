import { z } from 'zod';
import { XcodeBuilder } from '../xcodeBuilder.js';
import { Platform } from '../types.js';
import { createModuleLogger } from '../logger.js';
import { safePathSchema, platformSchema, configurationSchema } from './validators.js';
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
  constructor(
    private xcodeBuilder: XcodeBuilder | typeof XcodeBuilder = XcodeBuilder
  ) {}

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
    const validated = runProjectSchema.parse(args);
    const { projectPath, scheme, platform, deviceId, configuration } = validated;
    
    logger.info({ projectPath, scheme, platform, configuration }, 'Building and running project');
    
    // Use static method if XcodeBuilder is the class, or instance method if it's an instance
    const buildMethod = typeof this.xcodeBuilder === 'function' 
      ? this.xcodeBuilder.buildProject
      : this.xcodeBuilder.buildProjectInstance;
      
    const result = await buildMethod.call(this.xcodeBuilder, {
      projectPath,
      scheme,
      platform,
      deviceId,
      configuration,
      installApp: true  // Build and install
    });
    
    return {
      content: [
        {
          type: 'text',
          text: `Successfully built and ran project: ${scheme || path.basename(projectPath)}
Platform: ${platform}
App installed at: ${result.appPath || 'N/A'}`
        }
      ]
    };
  }
}