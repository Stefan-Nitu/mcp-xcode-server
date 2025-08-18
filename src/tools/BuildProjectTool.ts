import { z } from 'zod';
import { XcodeBuilder } from '../xcodeBuilder.js';
import { Platform } from '../types.js';
import { createModuleLogger } from '../logger.js';
import { safePathSchema, platformSchema, configurationSchema } from './validators.js';
import { XcodeBuilderAdapter } from './XcodeBuilderAdapter.js';
import path from 'path';

const logger = createModuleLogger('BuildProjectTool');

export const buildProjectSchema = z.object({
  projectPath: safePathSchema,
  scheme: z.string().optional(),
  platform: platformSchema.optional().default(Platform.iOS),
  deviceId: z.string().optional(),
  configuration: configurationSchema
});

export type BuildProjectArgs = z.infer<typeof buildProjectSchema>;

// Interface for testing
export interface IBuildProjectTool {
  execute(args: any): Promise<any>;
  getToolDefinition(): any;
}

export class BuildProjectTool implements IBuildProjectTool {
  private adapter: XcodeBuilderAdapter;
  
  constructor(
    xcodeBuilder: XcodeBuilder | typeof XcodeBuilder = XcodeBuilder
  ) {
    this.adapter = new XcodeBuilderAdapter(xcodeBuilder);
  }

  getToolDefinition() {
    return {
      name: 'build_project',
      description: 'Build an Apple platform project (without running)',
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
    const validated = buildProjectSchema.parse(args);
    const { projectPath, scheme, platform, deviceId, configuration } = validated;
    
    logger.info({ projectPath, scheme, platform, configuration }, 'Building project');
    
    const result = await this.adapter.buildProject({
      projectPath,
      scheme,
      platform,
      deviceId,
      configuration,
      installApp: false  // Build only, don't install
    });
    
    return {
      content: [
        {
          type: 'text',
          text: `Successfully built project: ${scheme || path.basename(projectPath)}
Platform: ${platform}
Configuration: ${configuration}
App path: ${result.appPath || 'N/A'}`
        }
      ]
    };
  }
}