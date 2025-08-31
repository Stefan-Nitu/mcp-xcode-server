import { execAsync } from '../../utils.js';
import { SimulatorDevice } from './SimulatorDevice.js';
import { createModuleLogger } from '../../logger.js';
import { Platform } from '../../types.js';

const logger = createModuleLogger('Devices');

/**
 * Device discovery and management.
 * Provides methods to find and list simulator devices.
 * Future-ready for physical device support.
 */
export class Devices {
  /**
   * Find a device by name or UDID
   */
  async find(nameOrId: string): Promise<SimulatorDevice | null> {
    try {
      const { stdout } = await execAsync('xcrun simctl list devices --json');
      const data = JSON.parse(stdout);
      
      // Collect all matching devices with their raw data for sorting
      const matchingDevices: Array<{device: SimulatorDevice, state: string, isAvailable: boolean}> = [];
      
      for (const [runtime, deviceList] of Object.entries(data.devices)) {
        for (const device of deviceList as any[]) {
          if (device.udid === nameOrId || device.name === nameOrId) {
            matchingDevices.push({
              device: new SimulatorDevice(
                device.udid,
                device.name,
                this.extractPlatformFromRuntime(runtime),
                runtime
              ),
              state: device.state,
              isAvailable: device.isAvailable
            });
          }
        }
      }
      
      if (matchingDevices.length === 0) {
        logger.debug({ nameOrId }, 'Device not found');
        return null;
      }
      
      // Sort to prefer available, booted, and newer devices
      this.sortDevices(matchingDevices);
      
      const selected = matchingDevices[0];
      
      // Warn if selected device is not available
      if (!selected.isAvailable) {
        logger.warn({ 
          nameOrId, 
          deviceId: selected.device.id,
          runtime: selected.device.runtime 
        }, 'Selected device is not available - may fail to boot');
      }
      
      return selected.device;
    } catch (error: any) {
      logger.error({ error: error.message }, 'Failed to find device');
      throw new Error(`Failed to find device: ${error.message}`);
    }
  }

  /**
   * List all available simulators, optionally filtered by platform
   */
  async listSimulators(platform?: Platform): Promise<SimulatorDevice[]> {
    try {
      const { stdout } = await execAsync('xcrun simctl list devices --json');
      const data = JSON.parse(stdout);
      const devices: SimulatorDevice[] = [];
      
      for (const [runtime, deviceList] of Object.entries(data.devices)) {
        const extractedPlatform = this.extractPlatformFromRuntime(runtime);
        
        // Filter by platform if specified
        if (platform && !this.matchesPlatform(extractedPlatform, platform)) {
          continue;
        }
        
        for (const device of deviceList as any[]) {
          if (device.isAvailable) {
            devices.push(new SimulatorDevice(
              device.udid,
              device.name,
              extractedPlatform,
              runtime
            ));
          }
        }
      }
      
      return devices;
    } catch (error: any) {
      logger.error({ error: error.message }, 'Failed to list simulators');
      throw new Error(`Failed to list simulators: ${error.message}`);
    }
  }

  /**
   * Get the currently booted simulator, if any
   */
  async getBooted(): Promise<SimulatorDevice | null> {
    try {
      const { stdout } = await execAsync('xcrun simctl list devices --json');
      const data = JSON.parse(stdout);
      
      for (const [runtime, deviceList] of Object.entries(data.devices)) {
        for (const device of deviceList as any[]) {
          if (device.state === 'Booted' && device.isAvailable) {
            return new SimulatorDevice(
              device.udid,
              device.name,
              this.extractPlatformFromRuntime(runtime),
              runtime
            );
          }
        }
      }
      
      logger.debug('No booted simulator found');
      return null;
    } catch (error: any) {
      logger.error({ error: error.message }, 'Failed to get booted device');
      throw new Error(`Failed to get booted device: ${error.message}`);
    }
  }

  /**
   * Find the first available device for a platform
   */
  async findFirstAvailable(platform: Platform): Promise<SimulatorDevice | null> {
    const devices = await this.listSimulators(platform);
    
    // First, look for an already booted device
    const booted = devices.find((d: SimulatorDevice) => d.isBooted());
    if (booted) {
      logger.debug({ device: booted.name, id: booted.id }, 'Using already booted device');
      return booted;
    }
    
    // Otherwise, return the first available device
    const available = devices[0];
    if (available) {
      logger.debug({ device: available.name, id: available.id }, 'Found available device');
      return available;
    }
    
    logger.debug({ platform }, 'No available devices for platform');
    return null;
  }

  /**
   * Extract platform from runtime string
   */
  private extractPlatformFromRuntime(runtime: string): string {
    const runtimeLower = runtime.toLowerCase();
    
    if (runtimeLower.includes('ios')) return 'iOS';
    if (runtimeLower.includes('tvos')) return 'tvOS';
    if (runtimeLower.includes('watchos')) return 'watchOS';
    if (runtimeLower.includes('xros') || runtimeLower.includes('visionos')) return 'visionOS';
    
    // Default fallback
    return 'iOS';
  }

  /**
   * Extract version number from runtime string
   */
  private getVersionFromRuntime(runtime: string): number {
    const match = runtime.match(/(\d+)[.-](\d+)/);
    return match ? parseFloat(`${match[1]}.${match[2]}`) : 0;
  }

  /**
   * Sort devices preferring: available > booted > newer iOS versions
   */
  private sortDevices(devices: Array<{device: SimulatorDevice, state: string, isAvailable: boolean}>): void {
    devices.sort((a, b) => {
      if (a.isAvailable !== b.isAvailable) return a.isAvailable ? -1 : 1;
      if (a.state === 'Booted' !== (b.state === 'Booted')) return a.state === 'Booted' ? -1 : 1;
      return this.getVersionFromRuntime(b.device.runtime) - this.getVersionFromRuntime(a.device.runtime);
    });
  }

  /**
   * Check if a runtime matches a platform
   */
  private matchesPlatform(extractedPlatform: string, targetPlatform: Platform): boolean {
    const extractedLower = extractedPlatform.toLowerCase();
    const targetLower = targetPlatform.toLowerCase();
    
    // Handle visionOS special case (internally called xrOS)
    if (targetLower === 'visionos') {
      return extractedLower === 'visionos' || extractedLower === 'xros';
    }
    
    return extractedLower === targetLower;
  }

  /**
   * Find an available device for a specific platform
   * Returns the first available device, preferring already booted ones
   */
  async findForPlatform(platform: Platform): Promise<SimulatorDevice | null> {
    logger.debug({ platform }, 'Finding device for platform');
    
    try {
      const devices = await this.listSimulators();
      
      // Filter devices for the requested platform
      const platformDevices = devices.filter((device: SimulatorDevice) => 
        this.matchesPlatform(this.extractPlatformFromRuntime(device.runtime), platform)
      );
      
      if (platformDevices.length === 0) {
        logger.warn({ platform }, 'No devices found for platform');
        return null;
      }
      
      // Try to find a booted device first
      const booted = await this.getBooted();
      if (booted && platformDevices.some(d => d.id === booted.id)) {
        logger.debug({ 
          device: booted.name, 
          id: booted.id
        }, 'Selected already booted device for platform');
        return booted;
      }
      
      // Sort by runtime version (prefer newer) and return the first
      platformDevices.sort((a, b) => 
        this.getVersionFromRuntime(b.runtime) - this.getVersionFromRuntime(a.runtime)
      );
      
      const selected = platformDevices[0];
      logger.debug({ 
        device: selected.name, 
        id: selected.id
      }, 'Selected device for platform');
      
      return selected;
    } catch (error: any) {
      logger.error({ error: error.message, platform }, 'Failed to find device for platform');
      throw new Error(`Failed to find device for platform ${platform}: ${error.message}`);
    }
  }

  /**
   * Future: List physical devices connected to the system
   * Currently returns empty array as physical device support is not yet implemented
   */
  async listPhysical(): Promise<any[]> {
    // Future implementation for physical devices
    // Would use xcrun devicectl or ios-deploy
    return [];
  }
}

// Export a default instance for convenience
export const devices = new Devices();