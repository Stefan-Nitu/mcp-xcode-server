import { z } from 'zod';
import { XcodeBuilder } from '../xcodeBuilder.js';
import { Platform } from '../types.js';
import { createModuleLogger } from '../logger.js';
import { safePathSchema, platformSchema } from './validators.js';
import { XcodeBuilderAdapter } from './XcodeBuilderAdapter.js';

const logger = createModuleLogger('TestSPMModuleTool');

// Validation schema
export const testSPMModuleSchema = z.object({
  packagePath: safePathSchema,
  platform: platformSchema.optional().default(Platform.macOS),
  testFilter: z.string().optional(),
  osVersion: z.string()
    .regex(/^\d+\.\d+$/, { message: 'OS version must be in format: 17.2' })
    .optional()
});

export type TestSPMModuleArgs = z.infer<typeof testSPMModuleSchema>;

// Interface for testing
export interface ITestSPMModuleTool {
  execute(args: any): Promise<any>;
  getToolDefinition(): any;
}

export class TestSPMModuleTool implements ITestSPMModuleTool {
  private adapter: XcodeBuilderAdapter;
  
  constructor(
    xcodeBuilder: XcodeBuilder | typeof XcodeBuilder = XcodeBuilder
  ) {
    this.adapter = new XcodeBuilderAdapter(xcodeBuilder);
  }

  getToolDefinition() {
    return {
      name: 'test_spm_module',
      description: 'Test a Swift Package Manager module',
      inputSchema: {
        type: 'object',
        properties: {
          packagePath: {
            type: 'string',
            description: 'Path to the Swift package'
          },
          platform: {
            type: 'string',
            description: 'Target platform (iOS, macOS, tvOS, watchOS)',
            default: 'macOS',
            enum: ['iOS', 'macOS', 'tvOS', 'watchOS']
          },
          testFilter: {
            type: 'string',
            description: 'Filter for specific tests (optional)'
          },
          osVersion: {
            type: 'string',
            description: 'OS version for testing (e.g., 17.2)'
          }
        },
        required: ['packagePath']
      }
    };
  }

  async execute(args: any) {
    const validated = testSPMModuleSchema.parse(args);
    const { packagePath, platform, testFilter, osVersion } = validated;
    
    logger.info({ packagePath, platform, testFilter, osVersion }, 'Testing SPM module');
    
    const result = await this.adapter.testSPMModule(
      packagePath,
      platform,
      testFilter,
      osVersion
    );
    
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            success: result.success,
            summary: `Tests ${result.success ? 'passed' : 'failed'}. ${result.testCount || 0} tests run, ${result.failureCount || 0} failures`,
            platform,
            output: result.output
          }, null, 2)
        }
      ]
    };
  }
}