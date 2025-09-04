import { BuildXcodeController } from '../presentation/controllers/BuildXcodeController.js';
import { BuildXcodePresenter } from '../presentation/presenters/BuildXcodePresenter.js';
import { Platform } from '../domain/value-objects/Platform.js';

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
        destination: {
          type: 'string',
          enum: ['iOSSimulator', 'iOSDevice', 'iOSSimulatorUniversal', 
                 'macOS', 'macOSUniversal', 
                 'tvOSSimulator', 'tvOSDevice', 'tvOSSimulatorUniversal',
                 'watchOSSimulator', 'watchOSDevice', 'watchOSSimulatorUniversal',
                 'visionOSSimulator', 'visionOSDevice', 'visionOSSimulatorUniversal'],
          description: 'Build destination - Simulator: current architecture only (fast). Device: physical device. SimulatorUniversal: all architectures (slower but compatible)',
          default: 'iOSSimulator'
        },
        configuration: {
          type: 'string',
          description: 'Build configuration (e.g., Debug, Release, Beta, or any custom configuration)',
          default: 'Debug'
        },
        derivedDataPath: {
          type: 'string',
          description: 'Custom derived data path (optional)'
        }
      },
      required: ['projectPath', 'scheme', 'destination']
    };
  }
  
  async execute(args: any) {
    try {
      // Controller handles the business logic and returns BuildResult
      const result = await this.controller.handle(args);
      
      // Extract metadata from args for presentation
      // Safe to access these as controller would have validated them
      // Extract platform from destination (e.g., 'iOSSimulator' -> 'iOS')
      const destinationStr = args.destination || 'iOSSimulator';
      let platform: Platform;
      if (destinationStr.startsWith('iOS')) {
        platform = Platform.iOS;
      } else if (destinationStr.startsWith('macOS')) {
        platform = Platform.macOS;
      } else if (destinationStr.startsWith('tvOS')) {
        platform = Platform.tvOS;
      } else if (destinationStr.startsWith('watchOS')) {
        platform = Platform.watchOS;
      } else if (destinationStr.startsWith('visionOS')) {
        platform = Platform.visionOS;
      } else {
        platform = Platform.iOS; // Default fallback
      }
      
      const metadata = {
        scheme: args.scheme,
        platform: platform,
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