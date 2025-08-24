import { execAsync } from '../../utils.js';
import { createModuleLogger } from '../../logger.js';

const logger = createModuleLogger('SimulatorBoot');

/**
 * Simple utility to boot simulators for Xcode builds
 * Extracted shared logic from BuildXcodeTool and RunXcodeTool
 */
export class SimulatorBoot {
  /**
   * Boot a simulator
   */
  async boot(deviceId: string): Promise<void> {
    try {
      await execAsync(`xcrun simctl boot "${deviceId}"`);
      logger.debug({ deviceId }, 'Simulator booted successfully');
    } catch (error: any) {
      // Check if already booted
      if (!error.message?.includes('Unable to boot device in current state: Booted')) {
        logger.error({ error: error.message, deviceId }, 'Failed to boot simulator');
        throw new Error(`Failed to boot simulator: ${error.message}`);
      }
      logger.debug({ deviceId }, 'Simulator already booted');
    }
  }

  /**
   * Shutdown a simulator
   */
  async shutdown(deviceId: string): Promise<void> {
    try {
      await execAsync(`xcrun simctl shutdown "${deviceId}"`);
      logger.debug({ deviceId }, 'Simulator shutdown successfully');
    } catch (error: any) {
      logger.error({ error: error.message, deviceId }, 'Failed to shutdown simulator');
      throw new Error(`Failed to shutdown simulator: ${error.message}`);
    }
  }

  /**
   * Opens the Simulator app GUI (skipped during tests)
   */
  async openSimulatorApp(): Promise<void> {
    // Skip opening GUI during tests
    if (process.env.NODE_ENV === 'test' || process.env.JEST_WORKER_ID) {
      logger.debug('Skipping Simulator GUI in test environment');
      return;
    }
    
    try {
      await execAsync('open -g -a Simulator');
      logger.debug('Opened Simulator app');
    } catch (error: any) {
      logger.warn({ error: error.message }, 'Failed to open Simulator app');
    }
  }

  /**
   * Ensures a simulator is booted for the given platform and device
   * Returns the booted device ID (UDID)
   */
  async ensureBooted(platform: string, deviceId?: string): Promise<string> {
    if (!deviceId) {
      // No specific device requested, use first available
      return this.bootFirstAvailable(platform);
    }

    // Check if the device exists and get its state
    try {
      const { stdout } = await execAsync('xcrun simctl list devices --json');
      const data = JSON.parse(stdout);
      
      // Collect all matching devices first, then pick the best one
      const matchingDevices: any[] = [];
      
      for (const deviceList of Object.values(data.devices)) {
        for (const device of deviceList as any[]) {
          if (device.udid === deviceId || device.name === deviceId) {
            matchingDevices.push(device);
          }
        }
      }
      
      if (matchingDevices.length === 0) {
        throw new Error(`Device '${deviceId}' not found`);
      }
      
      // Sort devices: prefer available ones, then already booted ones
      matchingDevices.sort((a, b) => {
        // First priority: available devices
        if (a.isAvailable && !b.isAvailable) return -1;
        if (!a.isAvailable && b.isAvailable) return 1;
        // Second priority: booted devices
        if (a.state === 'Booted' && b.state !== 'Booted') return -1;
        if (a.state !== 'Booted' && b.state === 'Booted') return 1;
        return 0;
      });
      
      // Use the best matching device
      const device = matchingDevices[0];
      
      if (!device.isAvailable) {
        // All matching devices are unavailable
        const availableErrors = matchingDevices
          .map(d => `${d.name} (${d.udid}): ${d.availabilityError || 'unavailable'}`)
          .join(', ');
        throw new Error(`All devices named '${deviceId}' are unavailable: ${availableErrors}`);
      }
      
      if (device.state === 'Booted') {
        logger.debug({ deviceId: device.udid, name: device.name }, 'Device already booted');
        // Still open the Simulator app to make it visible
        await this.openSimulatorApp();
        return device.udid;
      }
      
      // Boot the device
      logger.info({ deviceId: device.udid, name: device.name }, 'Booting simulator');
      try {
        await execAsync(`xcrun simctl boot "${device.udid}"`);
      } catch (error: any) {
        // Device might already be booted
        if (!error.message?.includes('Unable to boot device in current state: Booted')) {
          throw error;
        }
      }
      
      // Open the Simulator app to show the GUI
      await this.openSimulatorApp();
      
      return device.udid;
    } catch (error: any) {
      logger.error({ error: error.message, deviceId }, 'Failed to boot simulator');
      throw new Error(`Failed to boot simulator: ${error.message}`);
    }
  }

  /**
   * Boots the first available simulator for a platform
   */
  private async bootFirstAvailable(platform: string): Promise<string> {
    try {
      const { stdout } = await execAsync('xcrun simctl list devices --json');
      const data = JSON.parse(stdout);
      
      // Find first available device for the platform
      for (const [runtime, deviceList] of Object.entries(data.devices)) {
        const runtimeLower = runtime.toLowerCase();
        const platformLower = platform.toLowerCase();
        
        // Handle visionOS which is internally called xrOS
        const isVisionOS = platformLower === 'visionos' && runtimeLower.includes('xros');
        const isOtherPlatform = platformLower !== 'visionos' && runtimeLower.includes(platformLower);
        
        if (!isVisionOS && !isOtherPlatform) {
          continue;
        }
        
        for (const device of deviceList as any[]) {
          if (!device.isAvailable) continue;
          
          // Check if already booted
          if (device.state === 'Booted') {
            logger.debug({ deviceId: device.udid, name: device.name }, 'Using already booted device');
            // Still open the Simulator app to make it visible
            await this.openSimulatorApp();
            return device.udid;
          }
          
          // Boot this device
          logger.info({ deviceId: device.udid, name: device.name }, 'Booting first available simulator');
          try {
            await execAsync(`xcrun simctl boot ${device.udid}`);
          } catch (error: any) {
            // Device might already be booted
            if (!error.message?.includes('Unable to boot device in current state: Booted')) {
              throw error;
            }
          }
          
          // Open the Simulator app to show the GUI
          await this.openSimulatorApp();
          
          return device.udid;
        }
      }
      
      throw new Error(`No available simulators found for platform ${platform}`);
    } catch (error: any) {
      logger.error({ error: error.message, platform }, 'Failed to boot simulator');
      throw new Error(`Failed to boot simulator: ${error.message}`);
    }
  }
}