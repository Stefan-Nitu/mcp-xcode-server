import { z } from 'zod';
import { InstallAppUseCase } from '../../application/use-cases/InstallAppUseCase.js';
import { InstallRequest } from '../../domain/value-objects/InstallRequest.js';
import { InstallResult } from '../../domain/entities/InstallResult.js';
import { MCPResponse } from '../interfaces/MCPResponse.js';
import { createModuleLogger } from '../../logger.js';
import {
  appPathSchema,
  simulatorIdSchema
} from '../validation/ToolInputValidators.js';

const logger = createModuleLogger('InstallAppController');

/**
 * MCP Controller for installing apps on simulators
 * 
 * Dual Responsibility (per architecture pattern):
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
const installAppSchema = z.object({
  appPath: appPathSchema,
  simulatorId: simulatorIdSchema
});

export type InstallAppArgs = z.infer<typeof installAppSchema>;

export class InstallAppController {
  // MCP Tool metadata
  readonly name = 'install_app';
  readonly description = 'Install an app on the simulator';
  
  constructor(
    private installUseCase: InstallAppUseCase
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
        appPath: {
          type: 'string',
          description: 'Path to the .app bundle'
        },
        simulatorId: {
          type: 'string',
          description: 'Device UDID or name of the simulator (optional, uses booted device if not specified)'
        }
      },
      required: ['appPath']
    };
  }
  
  // MCP execute method - orchestrates everything
  async execute(args: unknown): Promise<MCPResponse> {
    try {
      // 1. Call internal handle method for business logic
      const result = await this.handle(args);
      
      // 2. Present the result
      return this.present(result);
      
    } catch (error: any) {
      // Handle all errors uniformly
      return this.presentError(error);
    }
  }
  
  // Legacy handle method - kept for backward compatibility and testing
  async handle(args: unknown): Promise<InstallResult> {
    // 1. Validate input
    const validated = this.validateInput(args);
    
    const { appPath, simulatorId } = validated;
    logger.info({ appPath, simulatorId }, 'Handling install request');
    
    try {
      // 2. Create domain request
      const request = InstallRequest.create(appPath, simulatorId);
      
      // 3. Execute use case and return result
      return await this.installUseCase.execute(request);
      
    } catch (error: any) {
      // Log and re-throw for proper error handling upstream
      logger.error({ error, appPath, simulatorId }, 'Install controller error');
      throw error;
    }
  }
  
  private validateInput(args: unknown): InstallAppArgs {
    try {
      return installAppSchema.parse(args);
    } catch (error: any) {
      logger.warn({ error, args }, 'Invalid input');
      throw error;
    }
  }
  
  private present(result: InstallResult): MCPResponse {
    if (result.isSuccess) {
      return {
        content: [
          {
            type: 'text',
            text: result.toString()
          }
        ]
      };
    } else {
      // This shouldn't happen as errors are thrown, but handle it anyway
      return this.presentError(new Error(result.error || 'Installation failed'));
    }
  }
  
  private presentError(error: any): MCPResponse {
    // For validation errors, provide more context
    if (error.name === 'ZodError') {
      const zodError = error as z.ZodError;
      const issues = zodError.issues.map(i => `${i.path.join('.')}: ${i.message}`).join(', ');
      throw new Error(`Validation failed: ${issues}`);
    }
    
    throw error;
  }
}