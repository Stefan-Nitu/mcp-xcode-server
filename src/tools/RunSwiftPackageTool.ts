import { z } from 'zod';
import { createModuleLogger } from '../logger.js';
import { safePathSchema } from './validators.js';
import { execAsync } from '../utils.js';
import { existsSync } from 'fs';
import path from 'path';

const logger = createModuleLogger('RunSwiftPackageTool');

// Schema for running Swift packages
export const runSwiftPackageSchema = z.object({
  packagePath: safePathSchema,
  executable: z.string().optional(), // The executable product to run
  configuration: z.enum(['Debug', 'Release']).default('Debug'),
  arguments: z.array(z.string()).optional() // Arguments to pass to the executable
});

export type RunSwiftPackageArgs = z.infer<typeof runSwiftPackageSchema>;

export interface IRunSwiftPackageTool {
  execute(args: any): Promise<any>;
  getToolDefinition(): any;
}

/**
 * Run Swift Package executable tool
 * Uses `swift run` to build and execute Swift package executables
 */
export class RunSwiftPackageTool implements IRunSwiftPackageTool {
  getToolDefinition() {
    return {
      name: 'run_swift_package',
      description: 'Build and run a Swift Package Manager executable',
      inputSchema: {
        type: 'object',
        properties: {
          packagePath: {
            type: 'string',
            description: 'Path to Package.swift or package directory'
          },
          executable: {
            type: 'string',
            description: 'The executable product to run (optional, uses default if not specified)'
          },
          configuration: {
            type: 'string',
            description: 'Build configuration (Debug or Release)',
            enum: ['Debug', 'Release'],
            default: 'Debug'
          },
          arguments: {
            type: 'array',
            items: { type: 'string' },
            description: 'Arguments to pass to the executable'
          }
        },
        required: ['packagePath']
      }
    };
  }

  async execute(args: any) {
    const validated = runSwiftPackageSchema.parse(args);
    const { packagePath, executable, configuration, arguments: execArgs } = validated;
    
    logger.info({ packagePath, executable, configuration, arguments: execArgs }, 'Running Swift package');
    
    try {
      // Determine the actual package directory
      let packageDir: string;
      if (packagePath.endsWith('Package.swift')) {
        packageDir = path.dirname(packagePath);
      } else {
        packageDir = packagePath;
      }
      
      // Check if Package.swift exists
      const packageFile = path.join(packageDir, 'Package.swift');
      if (!existsSync(packageFile)) {
        throw new Error(`Error: No Package.swift found at: ${packageDir}`);
      }
      
      // Build command using swift run
      let command = `swift run --package-path "${packageDir}"`;
      
      // Add configuration
      if (configuration === 'Release') {
        command += ' -c release';
      } else {
        command += ' -c debug';
      }
      
      // Add executable name if specified
      if (executable) {
        command += ` "${executable}"`;
      }
      
      // Add arguments if provided
      if (execArgs && execArgs.length > 0) {
        command += ' ' + execArgs.map(arg => `"${arg}"`).join(' ');
      }
      
      logger.debug({ command }, 'Run command');
      
      // Execute the command and capture output
      const { stdout, stderr } = await execAsync(command, { 
        maxBuffer: 10 * 1024 * 1024 // 10MB buffer
      });
      
      // Combine stdout and stderr for complete output
      const output = stdout + (stderr ? '\n' + stderr : '');
      
      // Success response
      return {
        content: [
          {
            type: 'text',
            text: `Execution completed: ${executable || 'default executable'}\nConfiguration: ${configuration}\n\nOutput:\n${output}`
          }
        ]
      };
    } catch (error: any) {
      logger.error({ error, packagePath }, 'Swift package run failed');
      
      const errorMessage = error.message || 'Unknown run error';
      // Combine both stdout and stderr to get full output from the executable
      const stdout = error.stdout || '';
      const stderr = error.stderr || '';
      const output = stdout + (stderr ? (stdout ? '\n' : '') + stderr : '');
      
      let responseText: string;
      if (output) {
        // If there's output, show it (could be from the executable itself)
        responseText = output;
      } else {
        responseText = `Run failed: ${errorMessage}`;
      }
      
      return {
        content: [
          {
            type: 'text',
            text: responseText
          }
        ]
      };
    }
  }
}