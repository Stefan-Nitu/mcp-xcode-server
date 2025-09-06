import { ISimulatorLocator, SimulatorInfo } from '../../application/ports/SimulatorPorts.js';
import { ICommandExecutor } from '../../application/ports/CommandPorts.js';
import { SimulatorState } from '../../domain/value-objects/SimulatorState.js';

/**
 * Locates simulators using xcrun simctl
 */
export class SimulatorLocatorAdapter implements ISimulatorLocator {
  constructor(private executor: ICommandExecutor) {}

  async findSimulator(idOrName: string): Promise<SimulatorInfo | null> {
    const result = await this.executor.execute('xcrun simctl list devices --json');
    const data = JSON.parse(result.stdout);
    
    const allMatches: Array<{
      device: any;
      runtime: string;
    }> = [];
    
    for (const [runtime, deviceList] of Object.entries(data.devices)) {
      for (const device of deviceList as any[]) {
        if ((device.udid === idOrName || device.name === idOrName) && device.isAvailable) {
          allMatches.push({ device, runtime });
        }
      }
    }
    
    if (allMatches.length === 0) {
      return null;
    }
    
    // Sort by: booted first, then newer runtime
    allMatches.sort((a, b) => {
      // Booted devices first
      if (a.device.state === SimulatorState.Booted && b.device.state !== SimulatorState.Booted) return -1;
      if (b.device.state === SimulatorState.Booted && a.device.state !== SimulatorState.Booted) return 1;
      
      // Then by runtime version (newer first)
      return this.compareRuntimeVersions(b.runtime, a.runtime);
    });
    
    const selected = allMatches[0];
    return {
      id: selected.device.udid,
      name: selected.device.name,
      platform: this.extractPlatform(selected.runtime),
      runtime: selected.runtime
    };
  }

  async findBootedSimulator(): Promise<SimulatorInfo | null> {
    const result = await this.executor.execute('xcrun simctl list devices --json');
    const data = JSON.parse(result.stdout);
    
    const bootedDevices: SimulatorInfo[] = [];
    
    for (const [runtime, deviceList] of Object.entries(data.devices)) {
      for (const device of deviceList as any[]) {
        if (device.state === SimulatorState.Booted && device.isAvailable) {
          bootedDevices.push({
            id: device.udid,
            name: device.name,
            platform: this.extractPlatform(runtime),
            runtime: runtime
          });
        }
      }
    }
    
    if (bootedDevices.length === 0) {
      return null;
    }
    
    if (bootedDevices.length > 1) {
      throw new Error(`Multiple booted simulators found (${bootedDevices.length}). Please specify a simulator ID.`);
    }
    
    return bootedDevices[0];
  }

  private extractPlatform(runtime: string): string {
    const runtimeLower = runtime.toLowerCase();
    
    if (runtimeLower.includes('ios')) return 'iOS';
    if (runtimeLower.includes('tvos')) return 'tvOS';
    if (runtimeLower.includes('watchos')) return 'watchOS';
    if (runtimeLower.includes('xros') || runtimeLower.includes('visionos')) return 'visionOS';
    
    return 'iOS';
  }

  private compareRuntimeVersions(runtimeA: string, runtimeB: string): number {
    const extractVersion = (runtime: string): number[] => {
      const match = runtime.match(/(\d+)-(\d+)/);
      if (!match) return [0, 0];
      return [parseInt(match[1]), parseInt(match[2])];
    };
    
    const [majorA, minorA] = extractVersion(runtimeA);
    const [majorB, minorB] = extractVersion(runtimeB);
    
    if (majorA !== majorB) return majorA - majorB;
    return minorA - minorB;
  }
}