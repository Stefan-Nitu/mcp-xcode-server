import { ISimulatorStateQuery } from '../../application/ports/SimulatorPorts.js';
import { ICommandExecutor } from '../../application/ports/CommandPorts.js';
import { SimulatorState } from '../../domain/value-objects/SimulatorState.js';

/**
 * Queries simulator state using xcrun simctl
 */
export class SimulatorStateQueryAdapter implements ISimulatorStateQuery {
  constructor(private executor: ICommandExecutor) {}

  async getState(simulatorId: string): Promise<SimulatorState> {
    const result = await this.executor.execute('xcrun simctl list devices --json');
    const data = JSON.parse(result.stdout);
    
    for (const deviceList of Object.values(data.devices)) {
      for (const device of deviceList as any[]) {
        if (device.udid === simulatorId) {
          if (device.state === SimulatorState.Booted) return SimulatorState.Booted;
          if (device.state === SimulatorState.Shutdown) return SimulatorState.Shutdown;
          return SimulatorState.Unknown;
        }
      }
    }
    
    return SimulatorState.Unknown;
  }
}