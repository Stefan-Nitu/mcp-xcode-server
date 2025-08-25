import { z } from 'zod';
import { createModuleLogger } from '../logger.js';
import { safePathSchema } from './validators.js';
import { Xcode } from '../utils/projects/Xcode.js';
import { SwiftPackage } from '../utils/projects/SwiftPackage.js';
import { XcodeError, XcodeErrorType } from '../utils/projects/XcodeErrors.js';
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
      // Open the package using Xcode utility
      const project = await this.xcode.open(packagePath);
      
      // Ensure it's a Swift package, not an Xcode project
      if (!(project instanceof SwiftPackage)) {
        throw new Error(`No Package.swift found at: ${packagePath}`);
      }
      
      // Run tests using SwiftPackage
      const testResult = await project.test({
        filter,
        configuration
      });
      
      if (!testResult.success && testResult.failed === 0 && testResult.passed === 0) {
        // Build or setup error, not test failures
        throw new Error(testResult.output);
      }
      
      // Format the results
      const summary = `Tests ${testResult.success ? 'passed' : 'failed'}: ${testResult.passed} passed, ${testResult.failed} failed`;
      const failingTestsList = testResult.failingTests && testResult.failingTests.length > 0 
        ? `\nFailing tests:\n${testResult.failingTests.map(t => `  - ${t}`).join('\n')}`
        : '';
      
      // Extract just the relevant test results from output
      const lines = testResult.output.split('\n');
      const relevantLines: string[] = [];
      let inTestResults = false;
      
      for (const line of lines) {
        // Capture test suite results and failures
        if (line.includes('Test Suite') || 
            line.includes('Test Case') ||
            line.includes('failed') ||
            line.includes('passed') ||
            line.includes('** TEST EXECUTE') ||
            line.includes('error:') ||
            line.includes('Testing failed:') ||
            line.includes('Testing cancelled') ||
            (inTestResults && line.trim())) {
          relevantLines.push(line);
          if (line.includes('Test Suite')) {
            inTestResults = true;
          }
        }
      }
      
      // Limit output to last 100 lines if still too long
      const outputLines = relevantLines.slice(-100);
      const truncated = relevantLines.length > 100;
      
      return {
        content: [
          {
            type: 'text',
            text: `${summary}${failingTestsList}
Package: ${path.basename(project.path)}
Configuration: ${configuration}
${filter ? `Filter: ${filter}` : 'All tests'}

Test Results:
${truncated ? '... (output truncated)\n' : ''}${outputLines.join('\n')}`
          }
        ]
      };
    } catch (error: any) {
      logger.error({ error, packagePath }, 'Swift package tests failed');
      
      // Handle XcodeError with context-specific message
      let errorMessage = error.message || 'Unknown test error';
      if (error instanceof XcodeError && error.type === XcodeErrorType.ProjectNotFound) {
        errorMessage = `No Package.swift found at: ${error.path}`;
      }
      
      return {
        content: [
          {
            type: 'text',
            text: `Test execution failed: ${errorMessage}`
          }
        ]
      };
    }
  }
}