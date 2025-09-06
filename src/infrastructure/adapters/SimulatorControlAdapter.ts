import { ISimulatorControl } from '../../application/ports/SimulatorPorts.js';
import { ICommandExecutor } from '../../application/ports/CommandPorts.js';

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
      throw new Error(`Failed to boot simulator: ${result.stderr}`);
    }
  }

  async shutdown(simulatorId: string): Promise<void> {
    const result = await this.executor.execute(`xcrun simctl shutdown "${simulatorId}"`);
    
    // Already shutdown is not an error
    if (result.exitCode !== 0 && 
        !result.stderr.includes('Unable to shutdown device in current state: Shutdown')) {
      throw new Error(`Failed to shutdown simulator: ${result.stderr}`);
    }
  }
}