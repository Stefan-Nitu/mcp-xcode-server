import { z } from 'zod';
import { Platform } from '../../types.js';
import { createModuleLogger } from '../../logger.js';
import { safePathSchema, platformSchema, configurationSchema } from '../validators.js';
import { SPMSwiftBuilder } from './SPMSwiftBuilder.js';
import { SPMXcodeProjectBuilder } from './SPMXcodeProjectBuilder.js';

const logger = createModuleLogger('SPMPackageBuilder');

export const buildSPMPackageSchema = z.object({
  projectPath: safePathSchema,  // Use projectPath for consistency with facade
  scheme: z.string().optional(),
  platform: platformSchema.optional().default(Platform.macOS),
  deviceId: z.string().optional(),
  configuration: configurationSchema
});

export type BuildSPMPackageArgs = z.infer<typeof buildSPMPackageSchema>;

/**
 * Router that delegates to platform-specific SPM builders
 */
export class SPMPackageBuilder {
  private swiftBuilder?: SPMSwiftBuilder;
  private xcodeProjectBuilder?: SPMXcodeProjectBuilder;
  
  constructor(
    swiftBuilder?: SPMSwiftBuilder,
    xcodeProjectBuilder?: SPMXcodeProjectBuilder
  ) {
    this.swiftBuilder = swiftBuilder;
    this.xcodeProjectBuilder = xcodeProjectBuilder;
  }
  
  private getSwiftBuilder(): SPMSwiftBuilder {
    if (!this.swiftBuilder) {
      this.swiftBuilder = new SPMSwiftBuilder();
    }
    return this.swiftBuilder;
  }
  
  private getXcodeProjectBuilder(): SPMXcodeProjectBuilder {
    if (!this.xcodeProjectBuilder) {
      this.xcodeProjectBuilder = new SPMXcodeProjectBuilder();
    }
    return this.xcodeProjectBuilder;
  }


  async execute(args: any) {
    const validated = buildSPMPackageSchema.parse(args);
    const { platform } = validated;
    
    logger.info({ platform, projectPath: validated.projectPath }, 'Routing SPM build to platform-specific tool');
    
    // Route to appropriate platform-specific tool
    switch (platform) {
      case Platform.macOS:
        return this.getSwiftBuilder().execute(validated);
      
      case Platform.iOS:
      case Platform.tvOS:
      case Platform.watchOS:
      case Platform.visionOS:
        // All non-macOS platforms require xcodebuild with simulators
        return this.getXcodeProjectBuilder().execute(validated);
      
      default:
        return {
          content: [
            {
              type: 'text',
              text: `Unsupported platform for SPM build: ${platform}`
            }
          ]
        };
    }
  }
}