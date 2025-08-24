import { execAsync } from '../../utils.js';
import { createModuleLogger } from '../../logger.js';
import { SimulatorDevice, Platform } from '../../types.js';

const logger = createModuleLogger('SimulatorInfo');

/**
 * Provides information about simulators
 * Single responsibility: Query simulator state and logs
 */
export class SimulatorInfo {
  /**
   * List all available simulators, optionally filtered by platform
   */
  async list(platform?: Platform, showAll = false): Promise<SimulatorDevice[]> {
    try {
      const { stdout } = await execAsync('xcrun simctl list devices --json');
      const data = JSON.parse(stdout);
      
      const devices: SimulatorDevice[] = [];
      for (const [runtime, deviceList] of Object.entries(data.devices)) {
        // Filter by platform if specified
        if (platform) {
          const runtimeLower = runtime.toLowerCase();
          const platformLower = platform.toLowerCase();
          
          // Handle visionOS which is internally called xrOS
          const isVisionOS = platformLower === 'visionos' && runtimeLower.includes('xros');
          const isOtherPlatform = platformLower !== 'visionos' && runtimeLower.includes(platformLower);
          
          if (!isVisionOS && !isOtherPlatform) {
            continue;
          }
        }

        for (const device of deviceList as any[]) {
          if (!showAll && !device.isAvailable) {
            continue;
          }
          devices.push({
            udid: device.udid,
            name: device.name,
            state: device.state,
            deviceTypeIdentifier: device.deviceTypeIdentifier,
            runtime: runtime.replace('com.apple.CoreSimulator.SimRuntime.', ''),
            isAvailable: device.isAvailable
          });
        }
      }

      return devices;
    } catch (error: any) {
      logger.error({ error: error.message }, 'Failed to list simulators');
      throw new Error(`Failed to list simulators: ${error.message}`);
    }
  }

  /**
   * Get device logs from the simulator
   */
  async logs(deviceId?: string, predicate?: string, last: string = '5m'): Promise<string> {
    let command = `xcrun simctl spawn `;
    if (deviceId) {
      command += `"${deviceId}" `;
    } else {
      command += 'booted ';
    }
    command += `log show --style syslog --last ${last}`;
    
    if (predicate) {
      command += ` --predicate '${predicate}'`;
    }

    try {
      const { stdout } = await execAsync(command, { maxBuffer: 10 * 1024 * 1024 });
      // Return last 100 lines to keep it manageable
      const lines = stdout.split('\n').slice(-100);
      return lines.join('\n');
    } catch (error: any) {
      logger.error({ error: error.message, deviceId, predicate }, 'Failed to get device logs');
      throw new Error(`Failed to get device logs: ${error.message}`);
    }
  }

  /**
   * Get the state of a specific device
   */
  async getDeviceState(deviceId: string): Promise<string> {
    const devices = await this.list(undefined, true);
    const device = devices.find(d => d.udid === deviceId || d.name === deviceId);
    
    if (!device) {
      throw new Error(`Device '${deviceId}' not found`);
    }
    
    return device.state;
  }

  /**
   * Check if a device is available
   */
  async isAvailable(deviceId: string): Promise<boolean> {
    const devices = await this.list(undefined, true);
    const device = devices.find(d => d.udid === deviceId || d.name === deviceId);
    
    return device?.isAvailable || false;
  }
}