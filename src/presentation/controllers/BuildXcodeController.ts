import { z } from 'zod';
import { BuildProjectUseCase } from '../../application/use-cases/BuildProjectUseCase.js';
import { BuildRequest } from '../../domain/value-objects/BuildRequest.js';
import { BuildResult } from '../../domain/entities/BuildResult.js';
import { Platform } from '../../domain/value-objects/Platform.js';
import { DeviceManager } from '../../application/services/DeviceManager.js';
import { ConfigProvider } from '../../infrastructure/adapters/ConfigProvider.js';
import pino from 'pino';

const logger = pino({ name: 'BuildXcodeController' });

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

// Zod schema for input validation
const buildXcodeSchema = z.object({
  projectPath: z.string().min(1, 'Project path is required'),
  scheme: z.string().min(1, 'Scheme is required'),
  platform: z.enum(['iOS', 'macOS', 'tvOS', 'watchOS', 'visionOS']).default('iOS'),
  deviceId: z.string().optional(),
  configuration: z.string().default('Debug'),
  derivedDataPath: z.string().optional()
});

export type BuildXcodeArgs = z.infer<typeof buildXcodeSchema>;

export class BuildXcodeController {
  constructor(
    private buildUseCase: BuildProjectUseCase,
    private deviceManager: DeviceManager,
    private configProvider: ConfigProvider
  ) {}
  
  async handle(args: unknown): Promise<BuildResult> {
    // 1. Validate input
    const validated = this.validateInput(args);
    
    const { projectPath, scheme, platform, deviceId, configuration } = validated;
    logger.info({ projectPath, scheme, platform, configuration }, 'Handling build request');
    
    try {
      // 2. Prepare device if needed
      const preparedDeviceId = await this.deviceManager.prepareDevice(
        deviceId, 
        platform as Platform
      );
      
      // 3. Create domain request
      const request = this.createBuildRequest(validated, preparedDeviceId);
      
      // 4. Execute use case and return result
      return await this.buildUseCase.execute(request);
      
    } catch (error: any) {
      // Log and re-throw for proper error handling upstream
      logger.error({ error, projectPath, scheme, platform }, 'Build controller error');
      throw error;
    }
  }
  
  private validateInput(args: unknown): BuildXcodeArgs {
    try {
      return buildXcodeSchema.parse(args);
    } catch (error: any) {
      logger.warn({ error, args }, 'Invalid input');
      throw new Error(`Invalid arguments: ${error.message}`);
    }
  }
  
  private createBuildRequest(
    validated: BuildXcodeArgs, 
    deviceId?: string
  ): BuildRequest {
    try {
      const request = new BuildRequest({
        projectPath: validated.projectPath,
        scheme: validated.scheme,
        configuration: validated.configuration,
        platform: validated.platform as Platform,
        deviceId,
        derivedDataPath: validated.derivedDataPath
      });
      
      // If no derivedDataPath provided, get from config
      if (!validated.derivedDataPath) {
        const derivedDataPath = this.configProvider.getDerivedDataPath(validated.projectPath);
        return request.withDerivedDataPath(derivedDataPath);
      }
      
      return request;
    } catch (error: any) {
      logger.error({ error, projectPath: validated.projectPath }, 'Failed to create build request');
      throw new Error(`Invalid project: ${error.message}`);
    }
  }
}