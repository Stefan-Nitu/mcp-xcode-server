import { z } from 'zod';
import { createModuleLogger } from '../logger.js';
import { safePathSchema } from '../commonSchemas.js';
import { Xcode } from '../utils/projects/Xcode.js';
import { SwiftPackage } from '../utils/projects/SwiftPackage.js';
import { handleSwiftPackageError } from '../utils/errors/index.js';
import path from 'path';

const logger = createModuleLogger('TestSwiftPackageTool');

export const testSwiftPackageSchema = z.object({
  packagePath: safePathSchema,
  filter: z.string().optional(),
  configuration: z.enum(['Debug', 'Release']).default('Debug')
});

export type TestSwiftPackageArgs = z.infer<typeof testSwiftPackageSchema>;

/**
 * Test Swift Package Tool - runs tests for Swift packages
 */
export class TestSwiftPackageTool {
  private xcode: Xcode;

  constructor(xcode?: Xcode) {
    this.xcode = xcode || new Xcode();
  }

  getToolDefinition() {
    return {
      name: 'test_swift_package',
      description: 'Run tests for a Swift Package Manager package',
      inputSchema: {
        type: 'object',
        properties: {
          packagePath: {
            type: 'string',
            description: 'Path to Package.swift or package directory'
          },
          filter: {
            type: 'string',
            description: 'Filter for specific tests (e.g., "MyPackageTests.UserTests" for a class, "MyPackageTests.UserTests/testLogin" for a method)'
          },
          configuration: {
            type: 'string',
            description: 'Build configuration (Debug or Release)',
            enum: ['Debug', 'Release'],
            default: 'Debug'
          }
        },
        required: ['packagePath']
      }
    };
  }

  async execute(args: any) {
    const validated = testSwiftPackageSchema.parse(args);
    const { packagePath, filter, configuration } = validated;
    
    logger.info({ packagePath, filter, configuration }, 'Running Swift package tests');
    
    try {
      // Open the package using Xcode utility, expecting Swift package specifically
      const project = await this.xcode.open(packagePath, 'swift-package');
      
      // This check is now redundant since we're using 'swift-package' mode,
      // but keep it for extra safety
      if (!(project instanceof SwiftPackage)) {
        throw new Error(`No Package.swift found at: ${packagePath}`);
      }
      
      // Run tests using SwiftPackage
      const testResult = await project.test({
        filter,
        configuration
      });
      
      // Check if tests failed due to compile/build errors
      if (testResult.compileErrors || testResult.buildErrors) {
        const error: any = new Error('Test build failed');
        error.compileErrors = testResult.compileErrors;
        error.buildErrors = testResult.buildErrors;
        error.logPath = testResult.logPath;
        return handleSwiftPackageError(error, {
          configuration,
          target: filter
        });
      }
      
      if (!testResult.success && testResult.failed === 0 && testResult.passed === 0) {
        // Other non-test failures (configuration errors, etc) - extract error message from output
        const output = testResult.output || '';
        let errorMessage = '❌ Test execution failed';
        
        // Try to extract the actual error message
        if (output.includes('error:')) {
          const errorMatch = output.match(/error:\s*(.+?)(?:\n|$)/);
          if (errorMatch) {
            errorMessage = `❌ Test execution failed: ${errorMatch[1]}`;
          }
        }
        
        return {
          content: [
            {
              type: 'text',
              text: `${errorMessage}\n\nPackage: ${path.basename(project.path)}\nConfiguration: ${configuration}\n\n📁 Full logs saved to: ${testResult.logPath}`
            }
          ]
        };
      }
      
      // Format the results
      const icon = testResult.success ? '✅' : '❌';
      const summary = `${icon} Tests ${testResult.success ? 'passed' : 'failed'}: ${testResult.passed} passed, ${testResult.failed} failed`;
      
      const failingTestsList = testResult.failingTests && testResult.failingTests.length > 0 
        ? `\n\n**Failing tests:**\n${testResult.failingTests.map(t => `• ${t.identifier}\n  ${t.reason}`).join('\n\n')}`
        : '';
      
      return {
        content: [
          {
            type: 'text',
            text: `${summary}${failingTestsList}\n\nPackage: ${path.basename(project.path)}\nConfiguration: ${configuration}\n${filter ? `Filter: ${filter}\n` : ''}\n📁 Full logs saved to: ${testResult.logPath}`
          }
        ]
      };
    } catch (error: any) {
      logger.error({ error, packagePath }, 'Swift package tests failed');
      
      // Use Swift Package error handler
      return handleSwiftPackageError(error, {
        configuration,
        target: filter // filter is like "MyPackageTests.UserTests" which is effectively the target
      });
    }
  }
}