import { z } from 'zod';
import { Platform } from '../../types.js';
import { createModuleLogger } from '../../logger.js';
import { safePathSchema, platformSchema } from '../application/validators/commonSchemas.js';
import { XcodeProject } from '../../utils/projects/XcodeProject.js';
import { existsSync } from 'fs';

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
  constructor() {}

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
    
    try {
      // Check if project exists
      if (!existsSync(projectPath)) {
        throw new Error(`Project path does not exist: ${projectPath}`);
      }
      
      // Determine project type
      const isWorkspace = projectPath.endsWith('.xcworkspace');
      const projectType = isWorkspace ? 'workspace' : 'project';
      
      // Create XcodeProject instance
      const xcodeProject = new XcodeProject(projectPath, projectType);
      
      // Archive the project
      const result = await xcodeProject.archiveProject({
        scheme,
        configuration,
        platform,
        archivePath
      });
      
      if (!result.success) {
        throw new Error('Archive failed');
      }
      
      logger.info({ archivePath: result.archivePath }, 'Archive succeeded');
      
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: true,
              message: `Successfully archived ${scheme}`,
              archivePath: result.archivePath,
              platform,
              configuration
            }, null, 2)
          }
        ]
      };
    } catch (error: any) {
      logger.error({ error: error.message, projectPath }, 'Archive failed');
      
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: false,
              message: `Archive failed: ${error.message}`
            }, null, 2)
          }
        ]
      };
    }
  }
}