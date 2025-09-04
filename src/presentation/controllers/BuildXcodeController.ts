import { z } from 'zod';
import { BuildProjectUseCase } from '../../application/use-cases/BuildProjectUseCase.js';
import { BuildRequest } from '../../domain/value-objects/BuildRequest.js';
import { BuildResult } from '../../domain/entities/BuildResult.js';
import { BuildDestination } from '../../domain/value-objects/BuildDestination.js';
import { ConfigProvider } from '../../infrastructure/adapters/ConfigProvider.js';
import { createModuleLogger } from '../../logger.js';
import {
  projectPathSchema,
  schemeSchema,
  buildDestinationSchema,
  configurationSchema,
  derivedDataPathSchema
} from '../validation/ToolInputValidators.js';

const logger = createModuleLogger('BuildXcodeController');

/**
 * Controller for build operations
 * 
 * Single Responsibility: Orchestrate the build process
 * - Validate input
 * - Prepare environment (devices)
 * - Create domain objects
 * - Execute use case
 * - Return domain result
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

export class BuildXcodeController {
  constructor(
    private buildUseCase: BuildProjectUseCase,
    private configProvider: ConfigProvider
  ) {}
  
  async handle(args: unknown): Promise<BuildResult> {
    // 1. Validate input
    const validated = this.validateInput(args);
    
    const { projectPath, scheme, destination, configuration } = validated;
    logger.info({ projectPath, scheme, destination, configuration }, 'Handling build request');
    
    try {
      // 2. Create domain request
      const request = this.createBuildRequest(validated);
      
      // 3. Execute use case and return result
      return await this.buildUseCase.execute(request);
      
    } catch (error: any) {
      // Log and re-throw for proper error handling upstream
      logger.error({ error, projectPath, scheme, destination }, 'Build controller error');
      throw error;
    }
  }
  
  private validateInput(args: unknown): BuildXcodeArgs {
    try {
      return buildXcodeSchema.parse(args);
    } catch (error: any) {
      logger.warn({ error, args }, 'Invalid input');
      // Pass the raw error to the presenter for formatting
      throw error;
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
        BuildDestination[validated.destination as keyof typeof BuildDestination],
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