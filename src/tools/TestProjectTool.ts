import { z } from 'zod';
import { XcodeBuilder } from '../xcodeBuilder.js';
import { Platform } from '../types.js';
import { createModuleLogger } from '../logger.js';
import { safePathSchema, platformSchema, configurationSchema } from './validators.js';

const logger = createModuleLogger('TestProjectTool');

export const testProjectSchema = z.object({
  projectPath: safePathSchema,
  scheme: z.string().optional(),
  platform: platformSchema.optional().default(Platform.iOS),
  deviceId: z.string().optional(),
  configuration: configurationSchema,
  testTarget: z.string().optional(),
  testFilter: z.string().optional(),
  parallelTesting: z.boolean().optional().default(false)
});

export type TestProjectArgs = z.infer<typeof testProjectSchema>;

// Interface for testing
export interface ITestProjectTool {
  execute(args: any): Promise<any>;
  getToolDefinition(): any;
}

export class TestProjectTool implements ITestProjectTool {
  constructor(
    private xcodeBuilder: XcodeBuilder | typeof XcodeBuilder = XcodeBuilder
  ) {}

  getToolDefinition() {
    return {
      name: 'test_project',
      description: 'Run tests for an Apple platform project',
      inputSchema: {
        type: 'object',
        properties: {
          projectPath: {
            type: 'string',
            description: 'Path to the Xcode project or workspace'
          },
          scheme: {
            type: 'string',
            description: 'Xcode scheme to test'
          },
          platform: {
            type: 'string',
            description: 'Target platform (iOS, macOS, tvOS, watchOS, visionOS)',
            default: 'iOS',
            enum: ['iOS', 'macOS', 'tvOS', 'watchOS', 'visionOS']
          },
          testTarget: {
            type: 'string',
            description: 'Specific test target to run (e.g., "MyAppTests" or "MyAppUITests")'
          },
          deviceId: {
            type: 'string',
            description: 'Device UDID or name (for simulator platforms)'
          },
          configuration: {
            type: 'string',
            description: 'Build configuration (Debug/Release)',
            default: 'Debug',
            enum: ['Debug', 'Release']
          },
          testFilter: {
            type: 'string',
            description: 'Filter for specific test classes or methods'
          }
        },
        required: ['projectPath']
      }
    };
  }

  async execute(args: any) {
    const validated = testProjectSchema.parse(args);
    const { 
      projectPath, 
      scheme, 
      platform, 
      testTarget,
      deviceId, 
      configuration,
      testFilter,
      parallelTesting
    } = validated;
    
    logger.info({ projectPath, scheme, platform, testTarget }, 'Running tests');
    
    // Use static method if XcodeBuilder is the class, or instance method if it's an instance
    const testMethod = typeof this.xcodeBuilder === 'function' 
      ? this.xcodeBuilder.testProject
      : this.xcodeBuilder.testProjectInstance;
      
    const result = await testMethod.call(this.xcodeBuilder, {
      projectPath,
      scheme,
      platform,
      deviceId,
      configuration,
      testTarget,
      testFilter,
      parallelTesting
    });
    
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            success: result.success,
            summary: `Tests ${result.success ? 'passed' : 'failed'}. ${result.testCount || 0} tests executed, ${result.failureCount || 0} failures`,
            platform,
            configuration,
            testTarget: testTarget || 'all tests in scheme',
            output: result.output
          }, null, 2)
        }
      ]
    };
  }
}