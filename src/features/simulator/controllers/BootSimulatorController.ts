import { BootSimulatorUseCase } from '../use-cases/BootSimulatorUseCase.js';
import { BootRequest } from '../domain/BootRequest.js';
import { DeviceId } from '../../../shared/domain/DeviceId.js';
import { BootResult, BootOutcome, SimulatorNotFoundError, BootCommandFailedError, SimulatorBusyError } from '../domain/BootResult.js';
import { ErrorFormatter } from '../../../presentation/formatters/ErrorFormatter.js';
import { MCPController } from '../../../presentation/interfaces/MCPController.js';

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
      // Cast to expected shape
      const input = args as { deviceId: unknown };

      // Create domain value object - will validate
      const deviceId = DeviceId.create(input.deviceId);

      // Create domain request
      const request = BootRequest.create(deviceId);

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
        
        if (error instanceof SimulatorBusyError) {
          // Handle simulator busy scenarios
          return `❌ Cannot boot simulator: currently ${error.currentState.toLowerCase()}`;
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