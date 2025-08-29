import { z } from 'zod';
import { createModuleLogger } from '../../logger.js';
import { safePathSchema } from '../validators.js';
import { Xcode } from '../../utils/projects/Xcode.js';
import { XcodeProject } from '../../utils/projects/XcodeProject.js';

const logger = createModuleLogger('GetProjectInfoTool');

// Validation schema
export const getProjectInfoSchema = z.object({
  projectPath: safePathSchema
});

export type GetProjectInfoArgs = z.infer<typeof getProjectInfoSchema>;

// Interface for testing
export interface IGetProjectInfoTool {
  execute(args: any): Promise<any>;
  getToolDefinition(): any;
}

export class GetProjectInfoTool implements IGetProjectInfoTool {
  private xcode: Xcode;
  
  constructor(xcode?: Xcode) {
    this.xcode = xcode || new Xcode();
  }

  getToolDefinition() {
    return {
      name: 'get_project_info',
      description: 'Get comprehensive information about an Xcode project (name, schemes, targets, configurations)',
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
    const validated = getProjectInfoSchema.parse(args);
    const { projectPath } = validated;
    
    logger.info({ projectPath }, 'Getting project info');
    
    try {
      // Open the project
      const project = await this.xcode.open(projectPath);
      
      // Ensure it's an Xcode project
      if (!(project instanceof XcodeProject)) {
        throw new Error('Not an Xcode project or workspace');
      }
      
      // Get project info
      const info = await project.getProjectInfo();
      
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              projectPath,
              projectType: projectPath.endsWith('.xcworkspace') ? 'Workspace' : 'Project',
              ...info
            }, null, 2)
          }
        ]
      };
    } catch (error: any) {
      logger.error({ error, projectPath }, 'Failed to get project info');
      
      return {
        content: [
          {
            type: 'text',
            text: `Failed to get project info: ${error.message}`
          }
        ]
      };
    }
  }
}