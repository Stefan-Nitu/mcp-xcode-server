import { z } from 'zod';
import { Platform } from '../types.js';
import { createModuleLogger } from '../logger.js';
import { safePathSchema, platformSchema, configurationSchema } from './validators.js';
import { BuildSPMPackageSwiftBuildTool } from './build-spm/BuildSPMPackageSwiftBuildTool.js';
import { BuildSPMPackageXcodebuildTool } from './build-spm/BuildSPMPackageXcodebuildTool.js';

const logger = createModuleLogger('BuildSPMPackageTool');

export const buildSPMPackageSchema = z.object({
  projectPath: safePathSchema,  // Use projectPath for consistency with facade
  scheme: z.string().optional(),
  platform: platformSchema.optional().default(Platform.macOS),
  deviceId: z.string().optional(),
  configuration: configurationSchema
});

export type BuildSPMPackageArgs = z.infer<typeof buildSPMPackageSchema>;

export interface IBuildSPMPackageTool {
  execute(args: any): Promise<any>;
  getToolDefinition(): any;
}

/**
 * Router tool that delegates to platform-specific SPM build tools
 */
export class BuildSPMPackageTool implements IBuildSPMPackageTool {
  private swiftBuildTool?: BuildSPMPackageSwiftBuildTool;
  private xcodebuildTool?: BuildSPMPackageXcodebuildTool;
  
  constructor(
    swiftBuildTool?: BuildSPMPackageSwiftBuildTool,
    xcodebuildTool?: BuildSPMPackageXcodebuildTool
  ) {
    this.swiftBuildTool = swiftBuildTool;
    this.xcodebuildTool = xcodebuildTool;
  }
  
  private getSwiftBuildTool(): BuildSPMPackageSwiftBuildTool {
    if (!this.swiftBuildTool) {
      this.swiftBuildTool = new BuildSPMPackageSwiftBuildTool();
    }
    return this.swiftBuildTool;
  }
  
  private getXcodebuildTool(): BuildSPMPackageXcodebuildTool {
    if (!this.xcodebuildTool) {
      this.xcodebuildTool = new BuildSPMPackageXcodebuildTool();
    }
    return this.xcodebuildTool;
  }

  getToolDefinition() {
    return {
      name: 'build_spm_package',
      description: 'Build a Swift Package Manager package',
      inputSchema: {
        type: 'object',
        properties: {
          projectPath: {
            type: 'string',
            description: 'Path to the Package.swift file or package directory'
          },
          scheme: {
            type: 'string',
            description: 'Scheme to build (usually the package name)'
          },
          platform: {
            type: 'string',
            description: 'Target platform (iOS, macOS, tvOS, watchOS)',
            default: 'macOS',
            enum: ['iOS', 'macOS', 'tvOS', 'watchOS', 'visionOS']
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
          }
        },
        required: ['projectPath']
      }
    };
  }

  async execute(args: any) {
    const validated = buildSPMPackageSchema.parse(args);
    const { platform } = validated;
    
    logger.info({ platform, projectPath: validated.projectPath }, 'Routing SPM build to platform-specific tool');
    
    // Route to appropriate platform-specific tool
    switch (platform) {
      case Platform.macOS:
        return this.getSwiftBuildTool().execute(validated);
      
      case Platform.iOS:
      case Platform.tvOS:
      case Platform.watchOS:
      case Platform.visionOS:
        // All non-macOS platforms require xcodebuild with simulators
        return this.getXcodebuildTool().execute(validated);
      
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