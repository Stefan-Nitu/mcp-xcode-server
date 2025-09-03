import { BuildXcodeController } from '../presentation/controllers/BuildXcodeController.js';
import { BuildXcodePresenter } from '../presentation/presenters/BuildXcodePresenter.js';

/**
 * MCP Tool for building Xcode projects
 * 
 * Single Responsibility: MCP protocol interface
 * - Define tool metadata (name, description)
 * - Define input schema for MCP
 * - Delegate to controller and presenter
 */

export class BuildXcodeTool {
  name = 'build_xcode';
  description = 'Build an Xcode project or workspace';
  
  constructor(
    private controller: BuildXcodeController,
    private presenter: BuildXcodePresenter
  ) {}
  
  getToolDefinition() {
    return {
      name: this.name,
      description: this.description,
      inputSchema: this.inputSchema
    };
  }
  
  get inputSchema() {
    return {
      type: 'object' as const,
      properties: {
        projectPath: {
          type: 'string',
          description: 'Path to the Xcode project or workspace'
        },
        scheme: {
          type: 'string',
          description: 'Xcode scheme to build'
        },
        platform: {
          type: 'string',
          enum: ['iOS', 'macOS', 'tvOS', 'watchOS', 'visionOS'],
          description: 'Target platform',
          default: 'iOS'
        },
        deviceId: {
          type: 'string',
          description: 'Device UDID or name (optional, uses generic device if not specified)'
        },
        configuration: {
          type: 'string',
          description: 'Build configuration (e.g., Debug, Release)',
          default: 'Debug'
        },
        derivedDataPath: {
          type: 'string',
          description: 'Custom derived data path (optional)'
        }
      },
      required: ['projectPath', 'scheme']
    };
  }
  
  async execute(args: any) {
    try {
      // Controller handles the business logic and returns BuildResult
      const result = await this.controller.handle(args);
      
      // Extract metadata from args for presentation
      // Safe to access these as controller would have validated them
      const metadata = {
        scheme: args.scheme,
        platform: args.platform || 'iOS',
        configuration: args.configuration || 'Debug'
      };
      
      // Presenter formats the result for MCP
      return this.presenter.present(result, metadata);
      
    } catch (error: any) {
      // Handle exceptions (validation errors, etc.)
      return this.presenter.presentError(error);
    }
  }
}