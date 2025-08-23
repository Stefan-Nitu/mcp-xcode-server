import { XcodeProjectBuilder } from './build-tools/XcodeProjectBuilder.js';

/**
 * Build Xcode Tool - builds Xcode projects and workspaces
 * Wraps the validated XcodeProjectBuilder
 */
export class BuildXcodeTool {
  private builder: XcodeProjectBuilder;

  constructor(builder?: XcodeProjectBuilder) {
    this.builder = builder || new XcodeProjectBuilder();
  }

  getToolDefinition() {
    return {
      name: 'build_xcode',
      description: 'Build an Xcode project or workspace',
      inputSchema: {
        type: 'object',
        properties: {
          projectPath: {
            type: 'string',
            description: 'Path to .xcodeproj or .xcworkspace file'
          },
          scheme: {
            type: 'string',
            description: 'Xcode scheme to build (optional, uses default if not specified)'
          },
          platform: {
            type: 'string',
            description: 'Target platform',
            enum: ['iOS', 'macOS', 'tvOS', 'watchOS', 'visionOS'],
            default: 'iOS'
          },
          deviceId: {
            type: 'string',
            description: 'Device UDID or name (optional, uses generic device if not specified)'
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
    // Delegate to the validated XcodeProjectBuilder
    return this.builder.execute(args);
  }
}