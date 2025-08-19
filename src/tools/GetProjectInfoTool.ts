import { z } from 'zod';
import { XcodeBuilder } from '../xcodeBuilder.js';
import { createModuleLogger } from '../logger.js';
import { safePathSchema } from './validators.js';
import { XcodeBuilderAdapter } from './XcodeBuilderAdapter.js';

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
  private adapter: XcodeBuilderAdapter;
  
  constructor(
    xcodeBuilder: XcodeBuilder | typeof XcodeBuilder = XcodeBuilder
  ) {
    this.adapter = new XcodeBuilderAdapter(xcodeBuilder);
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
    
    const info = await this.adapter.getProjectInfo(projectPath);
    
    if (!info) {
      return {
        content: [
          {
            type: 'text',
            text: 'Could not retrieve project information'
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
            projectType: projectPath.endsWith('.xcworkspace') ? 'Workspace' : 'Project',
            ...info
          }, null, 2)
        }
      ]
    };
  }
}