import { BuildProjectUseCase } from '../use-cases/BuildProjectUseCase.js';
import { BuildRequest } from '../domain/BuildRequest.js';
import { BuildDestination } from '../domain/BuildDestination.js';
import { BuildXcodePresenter } from '../../../presentation/presenters/BuildXcodePresenter.js';
import { PlatformDetector } from '../../../domain/services/PlatformDetector.js';
import { ConfigProviderAdapter } from '../../../shared/infrastructure/ConfigProviderAdapter.js';
import { createModuleLogger } from '../../../logger.js';
import { MCPResponse } from '../../../presentation/interfaces/MCPResponse.js';
import { MCPController } from '../../../presentation/interfaces/MCPController.js';

const logger = createModuleLogger('BuildXcodeController');

/**
 * MCP Controller for building Xcode projects
 * 
 * Dual Responsibility (per new architecture pattern):
 * 1. MCP Tool Interface:
 *    - Define tool metadata (name, description)
 *    - Define input schema for MCP
 * 2. Orchestration:
 *    - Validate input
 *    - Create domain objects
 *    - Execute use case
 *    - Present results
 */


export class BuildXcodeController implements MCPController {
  // MCP Tool metadata
  readonly name = 'build_xcode';
  readonly description = 'Build an Xcode project or workspace';
  
  constructor(
    private buildUseCase: BuildProjectUseCase,
    private presenter: BuildXcodePresenter,
    private configProvider: ConfigProviderAdapter
  ) {}
  
  // MCP Tool definition
  getToolDefinition() {
    return {
      name: this.name,
      description: this.description,
      inputSchema: this.inputSchema
    };
  }
  
  // MCP input schema
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
  
  // MCP execute method - orchestrates everything
  async execute(args: unknown): Promise<MCPResponse> {
    try {
      // 1. Cast to expected shape
      const input = args as {
        projectPath: unknown;
        scheme: unknown;
        destination: unknown;
        configuration?: unknown;
        derivedDataPath?: unknown;
      };

      // 2. Get derived data path - use provided value or get from config
      const projectPath = input.projectPath as string;
      const derivedDataPath = input.derivedDataPath ||
        this.configProvider.getDerivedDataPath(projectPath);

      // 3. Create domain request - domain objects will validate
      const request = BuildRequest.create(
        input.projectPath,
        input.scheme,
        input.destination,
        input.configuration,
        derivedDataPath
      );

      // 4. Execute use case
      const result = await this.buildUseCase.execute(request);

      // 5. Extract metadata for presentation
      const platform = PlatformDetector.fromDestination(request.destination);

      const metadata = {
        scheme: request.scheme,
        platform,
        configuration: request.configuration
      };

      // 6. Present the result
      return this.presenter.present(result, metadata);

    } catch (error: any) {
      // Handle all errors uniformly
      return this.presenter.presentError(error);
    }
  }
}
