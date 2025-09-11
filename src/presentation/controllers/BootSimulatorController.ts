import { z } from 'zod';
import { BootSimulatorUseCase } from '../../application/use-cases/BootSimulatorUseCase.js';
import { BootRequest } from '../../domain/value-objects/BootRequest.js';
import { BootResult, BootOutcome, SimulatorNotFoundError, BootCommandFailedError } from '../../domain/entities/BootResult.js';
import { deviceIdSchema } from '../validation/ToolInputValidators.js';
import { ErrorFormatter } from '../formatters/ErrorFormatter.js';
import { MCPController } from '../interfaces/MCPController.js';

// Compose the validation schema from reusable validators
const bootSimulatorSchema = z.object({
  deviceId: deviceIdSchema
});

type BootSimulatorArgs = z.infer<typeof bootSimulatorSchema>;

/**
 * Controller for the boot_simulator MCP tool
 * 
 * Handles input validation and orchestrates the boot simulator use case
 */
export class BootSimulatorController implements MCPController {
  readonly name = 'boot_simulator';
  readonly description = 'Boot a simulator';
  
  constructor(
    private useCase: BootSimulatorUseCase
  ) {}
  
  get inputSchema() {
    return {
      type: 'object' as const,
      properties: {
        deviceId: {
          type: 'string' as const,
          description: 'Device UDID or name of the simulator to boot'
        }
      },
      required: ['deviceId'] as const
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
      const validated = bootSimulatorSchema.parse(args) as BootSimulatorArgs;
      
      // Create domain request
      const request = BootRequest.create(validated.deviceId);
      
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
      // Handle validation and other errors consistently
      const message = ErrorFormatter.format(error);
      return {
        content: [{
          type: 'text',
          text: `❌ ${message}`
        }]
      };
    }
  }
  
  private formatResult(result: BootResult): string {
    const { outcome, diagnostics } = result;
    
    switch (outcome) {
      case BootOutcome.Booted:
        return `✅ Successfully booted simulator: ${diagnostics.simulatorName} (${diagnostics.simulatorId})`;
      
      case BootOutcome.AlreadyBooted:
        return `✅ Simulator already booted: ${diagnostics.simulatorName} (${diagnostics.simulatorId})`;
      
      case BootOutcome.Failed:
        const { error } = diagnostics;
        
        if (error instanceof SimulatorNotFoundError) {
          // Use consistent error formatting with ❌ emoji
          return `❌ Simulator not found: ${error.deviceId}`;
        }
        
        if (error instanceof BootCommandFailedError) {
          const message = ErrorFormatter.format(error);
          // Include simulator context if available
          if (diagnostics.simulatorName && diagnostics.simulatorId) {
            return `❌ ${diagnostics.simulatorName} (${diagnostics.simulatorId}) - ${message}`;
          }
          return `❌ ${message}`;
        }
        
        // Shouldn't happen but handle gracefully
        const fallbackMessage = error ? ErrorFormatter.format(error) : 'Boot operation failed';
        return `❌ ${fallbackMessage}`;
    }
  }
}