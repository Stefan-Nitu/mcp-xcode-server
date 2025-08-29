import { z } from 'zod';
import { createModuleLogger } from '../../logger.js';
import { safePathSchema } from '../validators.js';
import { Xcode } from '../../utils/projects/Xcode.js';
import { XcodeProject } from '../../utils/projects/XcodeProject.js';

const logger = createModuleLogger('ListTargetsTool');

// Validation schema
export const listTargetsSchema = z.object({
  projectPath: safePathSchema
});

export type ListTargetsArgs = z.infer<typeof listTargetsSchema>;

// Interface for testing
export interface IListTargetsTool {
  execute(args: any): Promise<any>;
  getToolDefinition(): any;
}

export class ListTargetsTool implements IListTargetsTool {
  private xcode: Xcode;
  
  constructor(xcode?: Xcode) {
    this.xcode = xcode || new Xcode();
  }

  getToolDefinition() {
    return {
      name: 'list_targets',
      description: 'List all targets in an Xcode project',
      inputSchema: {
        type: 'object',
        properties: {
          projectPath: {
            type: 'string',
            description: 'Path to the Xcode project or workspace'
          }
        },
        required: ['projectPath']
      }
    };
  }

  async execute(args: any) {
    const validated = listTargetsSchema.parse(args);
    const { projectPath } = validated;
    
    logger.info({ projectPath }, 'Listing targets');
    
    try {
      // Open the project
      const project = await this.xcode.open(projectPath);
      
      // Ensure it's an Xcode project
      if (!(project instanceof XcodeProject)) {
        throw new Error('Not an Xcode project or workspace');
      }
      
      // Get targets
      const targets = await project.getTargets();
      
      if (!targets || targets.length === 0) {
        return {
          content: [
            {
              type: 'text',
              text: 'No targets found in the project'
            }
          ]
        };
      }
      
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              projectPath,
              targets,
              count: targets.length
            }, null, 2)
          }
        ]
      };
    } catch (error: any) {
      logger.error({ error, projectPath }, 'Failed to list targets');
      
      return {
        content: [
          {
            type: 'text',
            text: `Failed to list targets: ${error.message}`
          }
        ]
      };
    }
  }
}