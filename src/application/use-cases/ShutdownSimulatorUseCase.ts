import { ShutdownRequest } from '../../domain/value-objects/ShutdownRequest.js';
import { ShutdownResult, SimulatorNotFoundError, ShutdownCommandFailedError } from '../../domain/entities/ShutdownResult.js';
import { SimulatorState } from '../../domain/value-objects/SimulatorState.js';
import { ISimulatorLocator, ISimulatorControl } from '../ports/SimulatorPorts.js';

export interface IShutdownSimulatorUseCase {
  execute(request: ShutdownRequest): Promise<ShutdownResult>;
}

/**
 * Use Case: Shutdown a simulator
 * 
 * Orchestrates finding the target simulator and shutting it down if needed
 */
export class ShutdownSimulatorUseCase implements IShutdownSimulatorUseCase {
  constructor(
    private simulatorLocator: ISimulatorLocator,
    private simulatorControl: ISimulatorControl
  ) {}

  async execute(request: ShutdownRequest): Promise<ShutdownResult> {
    // Find the simulator
    const simulator = await this.simulatorLocator.findSimulator(request.deviceId);
    
    if (!simulator) {
      return ShutdownResult.failed(
        request.deviceId,
        '',  // No name available since simulator wasn't found
        new SimulatorNotFoundError(request.deviceId)
      );
    }
    
    // Check simulator state
    if (simulator.state === SimulatorState.Shutdown) {
      return ShutdownResult.alreadyShutdown(
        simulator.id,
        simulator.name
      );
    }
    
    // Handle ShuttingDown state - simulator is already shutting down
    if (simulator.state === SimulatorState.ShuttingDown) {
      return ShutdownResult.alreadyShutdown(
        simulator.id,
        simulator.name
      );
    }
    
    // Shutdown the simulator (handles Booted, Booting, and Unknown states)
    try {
      await this.simulatorControl.shutdown(simulator.id);
      
      return ShutdownResult.shutdown(
        simulator.id,
        simulator.name
      );
    } catch (error: any) {
      return ShutdownResult.failed(
        simulator.id,
        simulator.name,
        new ShutdownCommandFailedError(error.stderr || error.message || '')
      );
    }
  }
}