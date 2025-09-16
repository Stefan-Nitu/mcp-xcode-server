import { ISimulatorControl } from '../../../application/ports/SimulatorPorts.js';
import { ICommandExecutor } from '../../../application/ports/CommandPorts.js';

/**
 * Controls simulator lifecycle using xcrun simctl
 */
export class SimulatorControlAdapter implements ISimulatorControl {
  constructor(private executor: ICommandExecutor) {}

  async boot(simulatorId: string): Promise<void> {
    const result = await this.executor.execute(`xcrun simctl boot "${simulatorId}"`);
    
    // Already booted is not an error
    if (result.exitCode !== 0 && 
        !result.stderr.includes('Unable to boot device in current state: Booted')) {
      // Throw raw error - presentation layer will format it
      throw new Error(result.stderr);
    }
  }

  async shutdown(simulatorId: string): Promise<void> {
    const result = await this.executor.execute(`xcrun simctl shutdown "${simulatorId}"`);
    
    // Already shutdown is not an error
    if (result.exitCode !== 0 && 
        !result.stderr.includes('Unable to shutdown device in current state: Shutdown')) {
      // Throw raw error - presentation layer will format it
      throw new Error(result.stderr);
    }
  }
}