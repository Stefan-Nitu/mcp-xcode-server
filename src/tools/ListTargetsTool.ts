import { z } from 'zod';
import { XcodeBuilder } from '../xcodeBuilder.js';
import { createModuleLogger } from '../logger.js';
import { safePathSchema } from './validators.js';
import { XcodeBuilderAdapter } from './XcodeBuilderAdapter.js';

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
  private adapter: XcodeBuilderAdapter;
  
  constructor(
    xcodeBuilder: XcodeBuilder | typeof XcodeBuilder = XcodeBuilder
  ) {
    this.adapter = new XcodeBuilderAdapter(xcodeBuilder);
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
    
    const targets = await this.adapter.listTargets(projectPath);
    
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
  }
}