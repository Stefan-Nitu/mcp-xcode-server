import { z } from 'zod';
import { createModuleLogger } from '../logger.js';
import { safePathSchema } from './validators.js';
import { execAsync } from '../utils.js';
import { existsSync } from 'fs';
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
      // Determine the actual package directory (from SPMSwiftBuilder)
      let packageDir: string;
      if (packagePath.endsWith('Package.swift')) {
        packageDir = path.dirname(packagePath);
      } else {
        packageDir = packagePath;
      }
      
      // Check if Package.swift exists (from SPMSwiftBuilder)
      const packageFile = path.join(packageDir, 'Package.swift');
      if (!existsSync(packageFile)) {
        throw new Error(`No Package.swift found at: ${packageDir}`);
      }
      
      // Build command for macOS using swift build (from SPMSwiftBuilder)
      let command = `swift build --package-path "${packageDir}"`;
      
      // Add configuration (from SPMSwiftBuilder logic)
      if (configuration === 'Release') {
        command += ' -c release';
      } else {
        command += ' -c debug';
      }
      
      // NEW: Add target if specified
      if (target) {
        command += ` --target "${target}"`;
      }
      
      // NEW: Add product if specified
      if (product) {
        command += ` --product "${product}"`;
      }
      
      logger.debug({ command }, 'Build command');
      
      await execAsync(command, { 
        maxBuffer: 10 * 1024 * 1024 // 10MB buffer (from SPMSwiftBuilder)
      });
      
      // Success response (adapted from SPMSwiftBuilder)
      return {
        content: [
          {
            type: 'text',
            text: `Build succeeded: ${path.basename(packageDir)}
Configuration: ${configuration}${target ? `\nTarget: ${target}` : ''}${product ? `\nProduct: ${product}` : ''}`
          }
        ]
      };
    } catch (error: any) {
      // Error handling (from SPMSwiftBuilder)
      logger.error({ error, packagePath }, 'Swift package build failed');
      
      const errorMessage = error.message || 'Unknown build error';
      // Prefer stderr for errors, as stdout might contain "Building for debugging..."
      const buildOutput = error.stderr || error.stdout || '';
      
      let responseText: string;
      if (buildOutput) {
        responseText = buildOutput;
      } else {
        responseText = `Build failed: ${errorMessage}`;
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