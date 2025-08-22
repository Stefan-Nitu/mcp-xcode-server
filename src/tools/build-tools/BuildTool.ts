import { z } from 'zod';
import { Platform } from '../../types.js';
import { createModuleLogger } from '../../logger.js';
import { safePathSchema, platformSchema, configurationSchema } from '../validators.js';
import { XcodeProjectBuilder } from './XcodeProjectBuilder.js';
import { SPMPackageBuilder } from './SPMPackageBuilder.js';

const logger = createModuleLogger('BuildTool');

export const buildSchema = z.object({
  projectPath: safePathSchema,
  scheme: z.string().optional(),
  platform: platformSchema.optional().default(Platform.iOS),
  deviceId: z.string().optional(),
  configuration: configurationSchema
});

export type BuildArgs = z.infer<typeof buildSchema>;

// Interface for testing
export interface IBuildTool {
  execute(args: any): Promise<any>;
  getToolDefinition(): any;
}

/**
 * Facade tool that delegates to appropriate build tool based on project type
 */
export class BuildTool implements IBuildTool {
  private xcodeProjectBuilder: XcodeProjectBuilder;
  private spmPackageBuilder: SPMPackageBuilder;
  
  constructor(
    xcodeProjectBuilder?: XcodeProjectBuilder,
    spmPackageBuilder?: SPMPackageBuilder
  ) {
    this.xcodeProjectBuilder = xcodeProjectBuilder || new XcodeProjectBuilder();
    this.spmPackageBuilder = spmPackageBuilder || new SPMPackageBuilder();
  }

  getToolDefinition() {
    return {
      name: 'build',
      description: 'Build an Xcode project, workspace, or Swift package',
      inputSchema: {
        type: 'object',
        properties: {
          projectPath: {
            type: 'string',
            description: 'Path to .xcodeproj/.xcworkspace file or Package.swift file'
          },
          scheme: {
            type: 'string',
            description: 'Xcode scheme to build (required for .xcodeproj/.xcworkspace, optional for Package.swift)'
          },
          platform: {
            type: 'string',
            description: 'Target platform (iOS, macOS, tvOS, watchOS, visionOS)',
            default: 'iOS',
            enum: ['iOS', 'macOS', 'tvOS', 'watchOS', 'visionOS']
          },
          deviceId: {
            type: 'string',
            description: 'Device UDID or name (optional - omit for generic build without booting simulator, specify to build for this device)'
          },
          configuration: {
            type: 'string',
            description: 'Build configuration (e.g., Debug, Release, Beta, Staging)',
            default: 'Debug'
          }
        },
        required: ['projectPath']
      }
    };
  }

  async execute(args: any) {
    const validated = buildSchema.parse(args);
    const { projectPath } = validated;
    
    logger.info({ projectPath, args }, 'Determining project type');
    
    // Determine which tool to use based on project path
    if (projectPath.endsWith('Package.swift')) {
      logger.info('Detected SPM package, delegating to SPMPackageBuilder');
      return this.spmPackageBuilder.execute(validated);
    } else if (projectPath.endsWith('.xcodeproj') || projectPath.endsWith('.xcworkspace')) {
      logger.info('Detected Xcode project/workspace, delegating to XcodeProjectBuilder');
      return this.xcodeProjectBuilder.execute(validated);
    } else {
      // Default to Xcode project builder for backward compatibility
      logger.info('Unknown project type, defaulting to XcodeProjectBuilder');
      return this.xcodeProjectBuilder.execute(validated);
    }
  }
}