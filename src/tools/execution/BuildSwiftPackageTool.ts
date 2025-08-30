import { z } from 'zod';
import { createModuleLogger } from '../../logger.js';
import { safePathSchema } from '../validators.js';
import { Xcode } from '../../utils/projects/Xcode.js';
import { SwiftPackage } from '../../utils/projects/SwiftPackage.js';
import { XcodeError, XcodeErrorType } from '../../utils/projects/XcodeErrors.js';
import { handleSwiftPackageError } from '../../utils/errors/index.js';
import path from 'path';

const logger = createModuleLogger('BuildSwiftPackageTool');

// Schema based on validated SPMSwiftBuilder with added target/product support
// SPM only supports debug and release configurations
export const buildSwiftPackageSchema = z.object({
  packagePath: safePathSchema,
  target: z.string().optional(),
  product: z.string().optional(),
  configuration: z.enum(['Debug', 'Release']).default('Debug')
});

export type BuildSwiftPackageArgs = z.infer<typeof buildSwiftPackageSchema>;

export interface IBuildSwiftPackageTool {
  execute(args: any): Promise<any>;
  getToolDefinition(): any;
}

/**
 * Build Swift Package tool - based on validated SPMSwiftBuilder
 * Extends it with target/product support
 */
export class BuildSwiftPackageTool implements IBuildSwiftPackageTool {
  private xcode: Xcode;
  
  constructor(xcode?: Xcode) {
    this.xcode = xcode || new Xcode();
  }
  getToolDefinition() {
    return {
      name: 'build_swift_package',
      description: 'Build a Swift Package Manager package',
      inputSchema: {
        type: 'object',
        properties: {
          packagePath: {
            type: 'string',
            description: 'Path to Package.swift or package directory'
          },
          target: {
            type: 'string',
            description: 'Build specific target (optional)'
          },
          product: {
            type: 'string',
            description: 'Build specific product (optional)'
          },
          configuration: {
            type: 'string',
            description: 'Build configuration (Debug or Release only - SPM limitation)',
            enum: ['Debug', 'Release'],
            default: 'Debug'
          }
        },
        required: ['packagePath']
      }
    };
  }

  async execute(args: any) {
    const validated = buildSwiftPackageSchema.parse(args);
    const { packagePath, target, product, configuration } = validated;
    
    logger.info({ packagePath, target, product, configuration }, 'Building Swift package');
    
    try {
      // Open the package using Xcode utility
      const project = await this.xcode.open(packagePath);
      
      // Ensure it's a Swift package, not an Xcode project
      if (!(project instanceof SwiftPackage)) {
        throw new Error(`No Package.swift found at: ${packagePath}`);
      }
      
      // Build the package using SwiftPackage
      const buildResult = await project.buildPackage({
        configuration,
        target,
        product
      });
      
      if (!buildResult.success) {
        throw new Error(buildResult.output);
      }
      
      // Success response with log path
      const icon = '✅';
      return {
        content: [
          {
            type: 'text',
            text: `${icon} Build succeeded: ${path.basename(project.path)}
Configuration: ${configuration}${target ? `\nTarget: ${target}` : ''}${product ? `\nProduct: ${product}` : ''}${buildResult.logPath ? `\n\n📁 Full logs saved to: ${buildResult.logPath}` : ''}`
          }
        ]
      };
    } catch (error: any) {
      logger.error({ error, packagePath }, 'Swift package build failed');
      
      // Use Swift Package error handler
      return handleSwiftPackageError(error, {
        configuration,
        target,
        product
      });
    }
  }
}