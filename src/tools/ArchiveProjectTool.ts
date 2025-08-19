import { z } from 'zod';
import { XcodeBuilder } from '../xcodeBuilder.js';
import { Platform } from '../types.js';
import { createModuleLogger } from '../logger.js';
import { safePathSchema, platformSchema } from './validators.js';
import { XcodeBuilderAdapter } from './XcodeBuilderAdapter.js';

const logger = createModuleLogger('ArchiveProjectTool');

// Validation schema
export const archiveProjectSchema = z.object({
  projectPath: safePathSchema,
  scheme: z.string(),
  platform: platformSchema.optional().default(Platform.iOS),
  configuration: z.enum(['Debug', 'Release']).default('Release'),
  archivePath: z.string().optional()
});

export type ArchiveProjectArgs = z.infer<typeof archiveProjectSchema>;

// Interface for testing
export interface IArchiveProjectTool {
  execute(args: any): Promise<any>;
  getToolDefinition(): any;
}

export class ArchiveProjectTool implements IArchiveProjectTool {
  private adapter: XcodeBuilderAdapter;
  
  constructor(
    xcodeBuilder: XcodeBuilder | typeof XcodeBuilder = XcodeBuilder
  ) {
    this.adapter = new XcodeBuilderAdapter(xcodeBuilder);
  }

  getToolDefinition() {
    return {
      name: 'archive_project',
      description: 'Archive an Xcode project for distribution',
      inputSchema: {
        type: 'object',
        properties: {
          projectPath: {
            type: 'string',
            description: 'Path to the Xcode project or workspace'
          },
          scheme: {
            type: 'string',
            description: 'Xcode scheme to archive'
          },
          platform: {
            type: 'string',
            description: 'Target platform (iOS, macOS, tvOS, watchOS, visionOS)',
            default: 'iOS',
            enum: ['iOS', 'macOS', 'tvOS', 'watchOS', 'visionOS']
          },
          configuration: {
            type: 'string',
            description: 'Build configuration (Debug/Release)',
            default: 'Release',
            enum: ['Debug', 'Release']
          },
          archivePath: {
            type: 'string',
            description: 'Path where the archive should be created (optional)'
          }
        },
        required: ['projectPath', 'scheme']
      }
    };
  }

  async execute(args: any) {
    const validated = archiveProjectSchema.parse(args);
    const { projectPath, scheme, platform, configuration, archivePath } = validated;
    
    logger.info({ projectPath, scheme, platform, configuration, archivePath }, 'Archiving project');
    
    const resultPath = await this.adapter.archiveProject(
      projectPath,
      scheme,
      platform,
      configuration,
      archivePath
    );
    
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            success: true,
            message: `Successfully archived ${scheme}`,
            archivePath: resultPath,
            platform,
            configuration
          }, null, 2)
        }
      ]
    };
  }
}