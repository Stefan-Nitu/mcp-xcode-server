import { BootRequest } from '../../domain/value-objects/BootRequest.js';
import { BootResult, SimulatorNotFoundError, BootCommandFailedError } from '../../domain/entities/BootResult.js';
import { SimulatorState } from '../../domain/value-objects/SimulatorState.js';
import { ISimulatorLocator, ISimulatorControl } from '../ports/SimulatorPorts.js';

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
    
    // Check if already booted
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
    
    // Boot the simulator
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