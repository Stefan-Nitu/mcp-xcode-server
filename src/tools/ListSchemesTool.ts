import { z } from 'zod';
import { XcodeBuilder } from '../xcodeBuilder.js';
import { createModuleLogger } from '../logger.js';
import { safePathSchema } from './validators.js';
import { XcodeBuilderAdapter } from './XcodeBuilderAdapter.js';

const logger = createModuleLogger('ListSchemesTool');

// Validation schema
export const listSchemesSchema = z.object({
  projectPath: safePathSchema,
  shared: z.boolean().optional().default(true)
});

export type ListSchemesArgs = z.infer<typeof listSchemesSchema>;

// Interface for testing
export interface IListSchemesTool {
  execute(args: any): Promise<any>;
  getToolDefinition(): any;
}

export class ListSchemesTool implements IListSchemesTool {
  private adapter: XcodeBuilderAdapter;
  
  constructor(
    xcodeBuilder: XcodeBuilder | typeof XcodeBuilder = XcodeBuilder
  ) {
    this.adapter = new XcodeBuilderAdapter(xcodeBuilder);
  }

  getToolDefinition() {
    return {
      name: 'list_schemes',
      description: 'List all available schemes in an Xcode project or workspace',
      inputSchema: {
        type: 'object',
        properties: {
          projectPath: {
            type: 'string',
            description: 'Path to the Xcode project or workspace'
          },
          shared: {
            type: 'boolean',
            description: 'Include shared schemes (default: true)',
            default: true
          }
        },
        required: ['projectPath']
      }
    };
  }

  async execute(args: any) {
    const validated = listSchemesSchema.parse(args);
    const { projectPath, shared } = validated;
    
    logger.info({ projectPath, shared }, 'Listing schemes');
    
    const schemes = await this.adapter.listSchemes(projectPath, shared);
    
    if (!schemes || schemes.length === 0) {
      return {
        content: [
          {
            type: 'text',
            text: 'No schemes found in the project'
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
            schemes,
            count: schemes.length
          }, null, 2)
        }
      ]
    };
  }
}