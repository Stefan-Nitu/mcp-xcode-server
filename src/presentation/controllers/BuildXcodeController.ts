import { z } from 'zod';
import { BuildProjectUseCase } from '../../application/use-cases/BuildProjectUseCase.js';
import { BuildRequest } from '../../domain/value-objects/BuildRequest.js';
import { BuildDestination } from '../../domain/value-objects/BuildDestination.js';
import { BuildXcodePresenter } from '../presenters/BuildXcodePresenter.js';
import { PlatformDetector } from '../../domain/services/PlatformDetector.js';
import { ConfigProviderAdapter } from '../../infrastructure/adapters/ConfigProviderAdapter.js';
import { createModuleLogger } from '../../logger.js';
import {
  projectPathSchema,
  schemeSchema,
  buildDestinationSchema,
  configurationSchema,
  derivedDataPathSchema
} from '../validation/ToolInputValidators.js';
import { MCPResponse } from '../interfaces/MCPResponse.js';
import { MCPController } from '../interfaces/MCPController.js';

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

// Compose the validation schema from reusable validators
const buildXcodeSchema = z.object({
  projectPath: projectPathSchema,
  scheme: schemeSchema,
  destination: buildDestinationSchema,
  configuration: configurationSchema,
  derivedDataPath: derivedDataPathSchema
});

export type BuildXcodeArgs = z.infer<typeof buildXcodeSchema>;

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
      // 1. Validate input
      const validated = buildXcodeSchema.parse(args) as BuildXcodeArgs;
      
      // 2. Create domain request
      const request = this.createBuildRequest(validated);
      
      // 3. Execute use case
      const result = await this.buildUseCase.execute(request);
      
      // 4. Extract metadata for presentation
      const platform = PlatformDetector.fromDestination(validated.destination as BuildDestination);
      
      const metadata = {
        scheme: validated.scheme,
        platform,
        configuration: validated.configuration || 'Debug'
      };
      
      // 5. Present the result
      return this.presenter.present(result, metadata);
      
    } catch (error: any) {
      // Handle all errors uniformly
      return this.presenter.presentError(error);
    }
  }
  
  private createBuildRequest(
    validated: BuildXcodeArgs
  ): BuildRequest {
    try {
      // Get derived data path - use provided value or get from config
      const derivedDataPath = validated.derivedDataPath || 
        this.configProvider.getDerivedDataPath(validated.projectPath);
      
      const request = BuildRequest.create(
        validated.projectPath,
        validated.scheme,
        validated.destination as BuildDestination,
        validated.configuration,
        derivedDataPath
      );
      
      return request;
    } catch (error: any) {
      logger.error({ error, projectPath: validated.projectPath }, 'Failed to create build request');
      // Pass the raw error to the presenter for formatting
      throw error;
    }
  }
}