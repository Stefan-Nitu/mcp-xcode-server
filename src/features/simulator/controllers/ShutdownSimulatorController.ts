import { ShutdownSimulatorUseCase } from '../use-cases/ShutdownSimulatorUseCase.js';
import { DeviceId } from '../../../shared/domain/DeviceId.js';
import { ShutdownRequest } from '../domain/ShutdownRequest.js';
import { ShutdownResult, ShutdownOutcome, SimulatorNotFoundError, ShutdownCommandFailedError } from '../domain/ShutdownResult.js';
import { ErrorFormatter } from '../../../presentation/formatters/ErrorFormatter.js';
import { MCPController } from '../../../presentation/interfaces/MCPController.js';

/**
 * Controller for the shutdown_simulator MCP tool
 * 
 * Handles input validation and orchestrates the shutdown simulator use case
 */
export class ShutdownSimulatorController implements MCPController {
  readonly name = 'shutdown_simulator';
  readonly description = 'Shutdown a simulator';
  
  constructor(
    private useCase: ShutdownSimulatorUseCase
  ) {}
  
  get inputSchema() {
    return {
      type: 'object' as const,
      properties: {
        deviceId: {
          type: 'string' as const,
          description: 'Device UDID or name of the simulator to shutdown'
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
      // Cast to expected shape
      const input = args as { deviceId: unknown };

      // Create domain value object - will validate
      const deviceId = DeviceId.create(input.deviceId);

      // Create domain request
      const request = ShutdownRequest.create(deviceId);

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
  
  private formatResult(result: ShutdownResult): string {
    const { outcome, diagnostics } = result;
    
    switch (outcome) {
      case ShutdownOutcome.Shutdown:
        return `✅ Successfully shutdown simulator: ${diagnostics.simulatorName} (${diagnostics.simulatorId})`;
      
      case ShutdownOutcome.AlreadyShutdown:
        return `✅ Simulator already shutdown: ${diagnostics.simulatorName} (${diagnostics.simulatorId})`;
      
      case ShutdownOutcome.Failed:
        const { error } = diagnostics;
        
        if (error instanceof SimulatorNotFoundError) {
          // Use consistent error formatting with ❌ emoji
          return `❌ Simulator not found: ${error.deviceId}`;
        }
        
        if (error instanceof ShutdownCommandFailedError) {
          const message = ErrorFormatter.format(error);
          // Include simulator context if available
          if (diagnostics.simulatorName && diagnostics.simulatorId) {
            return `❌ ${diagnostics.simulatorName} (${diagnostics.simulatorId}) - ${message}`;
          }
          return `❌ ${message}`;
        }
        
        // Shouldn't happen but handle gracefully
        const fallbackMessage = error ? ErrorFormatter.format(error) : 'Shutdown operation failed';
        return `❌ ${fallbackMessage}`;
    }
  }
}