import { BootRequest } from '../domain/BootRequest.js';
import { BootResult, SimulatorNotFoundError, BootCommandFailedError, SimulatorBusyError } from '../domain/BootResult.js';
import { SimulatorState } from '../domain/SimulatorState.js';
import { ISimulatorLocator, ISimulatorControl } from '../../../application/ports/SimulatorPorts.js';

export interface IBootSimulatorUseCase {
  execute(request: BootRequest): Promise<BootResult>;
}

/**
 * Use Case: Boot a simulator
 * 
 * Orchestrates finding the target simulator and booting it if needed
 */
export class BootSimulatorUseCase implements IBootSimulatorUseCase {
  constructor(
    private simulatorLocator: ISimulatorLocator,
    private simulatorControl: ISimulatorControl
  ) {}

  async execute(request: BootRequest): Promise<BootResult> {
    // Find the simulator
    const simulator = await this.simulatorLocator.findSimulator(request.deviceId);
    
    if (!simulator) {
      return BootResult.failed(
        request.deviceId,
        '',  // No name available since simulator wasn't found
        new SimulatorNotFoundError(request.deviceId)
      );
    }
    
    // Check simulator state
    if (simulator.state === SimulatorState.Booted) {
      return BootResult.alreadyBooted(
        simulator.id,
        simulator.name,
        {
          platform: simulator.platform,
          runtime: simulator.runtime
        }
      );
    }
    
    // Handle Booting state - simulator is already in the process of booting
    if (simulator.state === SimulatorState.Booting) {
      return BootResult.alreadyBooted(
        simulator.id,
        simulator.name,
        {
          platform: simulator.platform,
          runtime: simulator.runtime
        }
      );
    }
    
    // Handle ShuttingDown state - can't boot while shutting down
    if (simulator.state === SimulatorState.ShuttingDown) {
      return BootResult.failed(
        simulator.id,
        simulator.name,
        new SimulatorBusyError(SimulatorState.ShuttingDown)
      );
    }
    
    // Boot the simulator (handles Shutdown state)
    try {
      await this.simulatorControl.boot(simulator.id);
      
      return BootResult.booted(
        simulator.id,
        simulator.name,
        {
          platform: simulator.platform,
          runtime: simulator.runtime
        }
      );
    } catch (error: any) {
      return BootResult.failed(
        simulator.id,
        simulator.name,
        new BootCommandFailedError(error.stderr || error.message || '')
      );
    }
  }
}