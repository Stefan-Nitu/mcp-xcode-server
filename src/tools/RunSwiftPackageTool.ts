import { z } from 'zod';
import { createModuleLogger } from '../../logger.js';
import { safePathSchema } from '../application/validators/commonSchemas.js';
import { Xcode } from '../../utils/projects/Xcode.js';
import { SwiftPackage } from '../../utils/projects/SwiftPackage.js';
import { XcodeError, XcodeErrorType } from '../../utils/projects/XcodeErrors.js';
import { handleSwiftPackageError } from '../../utils/errors/index.js';
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
  private xcode: Xcode;
  
  constructor(xcode?: Xcode) {
    this.xcode = xcode || new Xcode();
  }
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
      // Open the package using Xcode utility, expecting Swift package specifically
      const project = await this.xcode.open(packagePath, 'swift-package');
      
      // This check is now redundant since we're using 'swift-package' mode,
      // but keep it for extra safety
      if (!(project instanceof SwiftPackage)) {
        throw new Error(`No Package.swift found at: ${packagePath}`);
      }
      
      // Run the package using SwiftPackage
      const runResult = await project.run({
        executable,
        configuration,
        arguments: execArgs
      });
      
      if (!runResult.success) {
        // Create error with attached metadata
        const error: any = new Error(runResult.output);
        error.compileErrors = runResult.compileErrors;
        error.buildErrors = runResult.buildErrors;
        error.logPath = runResult.logPath;
        throw error;
      }
      
      // Success response with log path
      const icon = '✅';
      return {
        content: [
          {
            type: 'text',
            text: `${icon} Execution completed: ${executable || 'default executable'}
Configuration: ${configuration}

Output:
${runResult.output}${runResult.logPath ? `\n\n📁 Full logs saved to: ${runResult.logPath}` : ''}`
          }
        ]
      };
    } catch (error: any) {
      logger.error({ error, packagePath }, 'Swift package run failed');
      
      // Use Swift Package error handler
      return handleSwiftPackageError(error, {
        configuration,
        executable
      });
    }
  }
}