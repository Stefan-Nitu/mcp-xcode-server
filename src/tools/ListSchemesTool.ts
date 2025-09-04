import { z } from 'zod';
import { exec } from 'child_process';
import { promisify } from 'util';
import { createModuleLogger } from '../logger.js';
import { safePathSchema } from '../commonSchemas.js';

const logger = createModuleLogger('ListSchemesTool');
const execAsync = promisify(exec);

// Validation schema
export const listSchemesSchema = z.object({
  projectPath: safePathSchema
});

export type ListSchemesArgs = z.infer<typeof listSchemesSchema>;

// Interface for testing
export interface IListSchemesTool {
  execute(args: any): Promise<any>;
  getToolDefinition(): any;
}

export class ListSchemesTool implements IListSchemesTool {
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
          }
        },
        required: ['projectPath']
      }
    };
  }

  async execute(args: any) {
    const validated = listSchemesSchema.parse(args);
    const { projectPath } = validated;
    
    logger.info({ projectPath }, 'Listing schemes');
    
    try {
      // Determine if it's a workspace or project
      const isWorkspace = projectPath.endsWith('.xcworkspace');
      const flag = isWorkspace ? '-workspace' : '-project';
      
      // Run xcodebuild -list to get schemes
      const command = `xcodebuild -list ${flag} "${projectPath}"`;
      logger.debug({ command }, 'Running xcodebuild command');
      
      const { stdout } = await execAsync(command, { 
        maxBuffer: 1024 * 1024 // 1MB buffer
      });
      
      // Parse the output to extract schemes
      const schemes = this.parseSchemes(stdout);
      
      logger.info({ schemes: schemes.length }, 'Found schemes');
      
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(schemes)
          }
        ]
      };
    } catch (error: any) {
      logger.error({ error: error.message, projectPath }, 'Failed to list schemes');
      
      // Return error response
      return {
        content: [
          {
            type: 'text',
            text: `Error: Failed to list schemes - ${error.message}`
          }
        ]
      };
    }
  }

  private parseSchemes(output: string): string[] {
    const schemes: string[] = [];
    const lines = output.split('\n');
    let inSchemesSection = false;
    
    for (const line of lines) {
      const trimmedLine = line.trim();
      
      // Check if we're entering the Schemes section
      if (trimmedLine === 'Schemes:') {
        inSchemesSection = true;
        continue;
      }
      
      // If we're in the schemes section and hit an empty line, stop
      if (inSchemesSection && trimmedLine === '') {
        break;
      }
      
      // If we're in the schemes section, add the scheme
      if (inSchemesSection && trimmedLine) {
        schemes.push(trimmedLine);
      }
    }
    
    return schemes;
  }
}