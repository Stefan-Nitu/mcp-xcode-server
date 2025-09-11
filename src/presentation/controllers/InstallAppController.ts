import { z } from 'zod';
import { InstallAppUseCase } from '../../application/use-cases/InstallAppUseCase.js';
import { InstallRequest } from '../../domain/value-objects/InstallRequest.js';
import { 
  InstallResult,
  InstallOutcome,
  InstallCommandFailedError,
  SimulatorNotFoundError 
} from '../../domain/entities/InstallResult.js';
import { ErrorFormatter } from '../formatters/ErrorFormatter.js';
import {
  appPathSchema,
  simulatorIdSchema
} from '../validation/ToolInputValidators.js';
import { MCPController } from '../interfaces/MCPController.js';

/**
 * MCP Controller for installing apps on simulators
 * 
 * Handles input validation and orchestrates the install app use case
 */

// Compose the validation schema from reusable validators
const installAppSchema = z.object({
  appPath: appPathSchema,
  simulatorId: simulatorIdSchema
});

type InstallAppArgs = z.infer<typeof installAppSchema>;

export class InstallAppController implements MCPController {
  // MCP Tool metadata
  readonly name = 'install_app';
  readonly description = 'Install an app on the simulator';
  
  constructor(
    private useCase: InstallAppUseCase
  ) {}
  
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
  
  getToolDefinition() {
    return {
      name: this.name,
      description: this.description,
      inputSchema: this.inputSchema
    };
  }
  
  async execute(args: unknown): Promise<{ content: Array<{ type: string; text: string }> }> {
    try {
      // Validate input
      const validated = installAppSchema.parse(args) as InstallAppArgs;
      
      // Create domain request
      const request = InstallRequest.create(validated.appPath, validated.simulatorId);
      
      // Execute use case
      const result = await this.useCase.execute(request);
      
      // Format response
      return {
        content: [{
          type: 'text',
          text: this.formatResult(result)
        }]
      };
    } catch (error: any) {
      // Handle validation and use case errors consistently
      const message = ErrorFormatter.format(error);
      return {
        content: [{
          type: 'text',
          text: `❌ ${message}`
        }]
      };
    }
  }
  
  private formatResult(result: InstallResult): string {
    const { outcome, diagnostics } = result;
    
    switch (outcome) {
      case InstallOutcome.Succeeded:
        return `✅ Successfully installed ${diagnostics.bundleId} on ${diagnostics.simulatorName} (${diagnostics.simulatorId})`;
      
      case InstallOutcome.Failed:
        const { error } = diagnostics;
        
        if (error instanceof SimulatorNotFoundError) {
          if (error.simulatorId === 'booted') {
            return `❌ No booted simulator found. Please boot a simulator first or specify a simulator ID.`;
          }
          return `❌ Simulator not found: ${error.simulatorId}`;
        }
        
        if (error instanceof InstallCommandFailedError) {
          const message = ErrorFormatter.format(error);
          // Include simulator context if available
          if (diagnostics.simulatorName && diagnostics.simulatorId) {
            return `❌ ${diagnostics.simulatorName} (${diagnostics.simulatorId}) - ${message}`;
          }
          return `❌ ${message}`;
        }
        
        // Shouldn't happen but handle gracefully
        const fallbackMessage = error ? ErrorFormatter.format(error) : 'Install operation failed';
        return `❌ ${fallbackMessage}`;
    }
  }
}