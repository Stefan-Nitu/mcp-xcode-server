import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/**
 * Manages test simulator lifecycle for E2E tests
 * Handles creation, booting, shutdown, and cleanup of test simulators
 */
export class TestSimulatorManager {
  private simulatorId?: string;
  private simulatorName?: string;

  /**
   * Create or reuse a test simulator
   * @param namePrefix Prefix for the simulator name (e.g., "TestSimulator-Boot")
   * @param deviceType Device type (defaults to iPhone 15)
   * @returns The simulator ID
   */
  async getOrCreateSimulator(
    namePrefix: string,
    deviceType: string = 'iPhone 15'
  ): Promise<string> {
    // Check if simulator already exists
    const devicesResult = await execAsync('xcrun simctl list devices --json');
    const devices = JSON.parse(devicesResult.stdout);

    // Look for existing test simulator
    for (const runtime of Object.values(devices.devices) as any[]) {
      const existingSim = runtime.find((d: any) => d.name.includes(namePrefix));
      if (existingSim) {
        this.simulatorId = existingSim.udid;
        this.simulatorName = existingSim.name;
        return existingSim.udid;
      }
    }

    // Create new simulator if none exists
    const runtimesResult = await execAsync('xcrun simctl list runtimes --json');
    const runtimes = JSON.parse(runtimesResult.stdout);
    const iosRuntime = runtimes.runtimes.find((r: { platform: string }) => r.platform === 'iOS');

    if (!iosRuntime) {
      throw new Error('No iOS runtime found. Please install an iOS simulator runtime.');
    }

    const createResult = await execAsync(
      `xcrun simctl create "${namePrefix}" "${deviceType}" "${iosRuntime.identifier}"`
    );
    this.simulatorId = createResult.stdout.trim();
    this.simulatorName = namePrefix;

    return this.simulatorId;
  }

  /**
   * Boot the simulator and wait for it to be ready
   * @param maxSeconds Maximum seconds to wait (default 30)
   */
  async bootAndWait(maxSeconds: number = 30): Promise<void> {
    if (!this.simulatorId) {
      throw new Error('No simulator to boot. Call getOrCreateSimulator first.');
    }

    try {
      await execAsync(`xcrun simctl boot "${this.simulatorId}"`);
    } catch {
      // Ignore if already booted
    }

    await this.waitForBoot(maxSeconds);
  }

  /**
   * Shutdown the simulator and wait for completion
   * @param maxSeconds Maximum seconds to wait (default 30)
   */
  async shutdownAndWait(maxSeconds: number = 30): Promise<void> {
    if (!this.simulatorId) return;

    try {
      await execAsync(`xcrun simctl shutdown "${this.simulatorId}"`);
    } catch {
      // Ignore if already shutdown
    }

    await this.waitForShutdown(maxSeconds);
  }

  /**
   * Cleanup the test simulator (shutdown and delete)
   */
  async cleanup(): Promise<void> {
    if (!this.simulatorId) return;

    try {
      await execAsync(`xcrun simctl shutdown "${this.simulatorId}"`);
    } catch {
      // Ignore shutdown errors
    }

    try {
      await execAsync(`xcrun simctl delete "${this.simulatorId}"`);
    } catch {
      // Ignore delete errors
    }

    this.simulatorId = undefined;
    this.simulatorName = undefined;
  }

  /**
   * Get the current simulator ID
   */
  getSimulatorId(): string | undefined {
    return this.simulatorId;
  }

  /**
   * Get the current simulator name
   */
  getSimulatorName(): string | undefined {
    return this.simulatorName;
  }

  /**
   * Check if the simulator is booted
   */
  async isBooted(): Promise<boolean> {
    if (!this.simulatorId) return false;

    const listResult = await execAsync('xcrun simctl list devices --json');
    const devices = JSON.parse(listResult.stdout);

    for (const runtime of Object.values(devices.devices) as any[]) {
      const device = runtime.find((d: any) => d.udid === this.simulatorId);
      if (device) {
        return device.state === 'Booted';
      }
    }
    return false;
  }

  /**
   * Check if the simulator is shutdown
   */
  async isShutdown(): Promise<boolean> {
    if (!this.simulatorId) return true;

    const listResult = await execAsync('xcrun simctl list devices --json');
    const devices = JSON.parse(listResult.stdout);

    for (const runtime of Object.values(devices.devices) as any[]) {
      const device = runtime.find((d: any) => d.udid === this.simulatorId);
      if (device) {
        return device.state === 'Shutdown';
      }
    }
    return true;
  }

  private async waitForBoot(maxSeconds: number): Promise<void> {
    for (let i = 0; i < maxSeconds; i++) {
      const listResult = await execAsync('xcrun simctl list devices --json');
      const devices = JSON.parse(listResult.stdout);

      for (const runtime of Object.values(devices.devices) as any[]) {
        const device = runtime.find((d: any) => d.udid === this.simulatorId);
        if (device && device.state === 'Booted') {
          // Wait a bit more for services to be ready
          await new Promise(resolve => setTimeout(resolve, 2000));
          return;
        }
      }

      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    throw new Error(`Failed to boot simulator ${this.simulatorId} after ${maxSeconds} seconds`);
  }

  private async waitForShutdown(maxSeconds: number): Promise<void> {
    for (let i = 0; i < maxSeconds; i++) {
      const listResult = await execAsync('xcrun simctl list devices --json');
      const devices = JSON.parse(listResult.stdout);

      for (const runtime of Object.values(devices.devices) as any[]) {
        const device = runtime.find((d: any) => d.udid === this.simulatorId);
        if (device && device.state === 'Shutdown') {
          return;
        }
      }

      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    throw new Error(`Failed to shutdown simulator ${this.simulatorId} after ${maxSeconds} seconds`);
  }

  /**
   * Shutdown all other booted simulators except this one
   */
  async shutdownOtherSimulators(): Promise<void> {
    const devicesResult = await execAsync('xcrun simctl list devices --json');
    const devices = JSON.parse(devicesResult.stdout);

    for (const runtime of Object.values(devices.devices) as any[][]) {
      for (const device of runtime) {
        if (device.state === 'Booted' && device.udid !== this.simulatorId) {
          try {
            await execAsync(`xcrun simctl shutdown "${device.udid}"`);
          } catch {
            // Ignore errors
          }
        }
      }
    }
  }
}