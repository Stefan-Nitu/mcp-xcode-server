import { Devices } from '../../utils/devices/Devices.js';
import { PlatformInfo } from '../../domain/value-objects/PlatformInfo.js';
import { Platform } from '../../domain/value-objects/Platform.js';

/**
 * Application Service: Manages device preparation for builds
 * 
 * Single Responsibility: Ensure devices are ready for use
 */
export class DeviceManager {
  constructor(private devices: Devices = new Devices()) {}
  
  async prepareDevice(
    deviceId: string | undefined, 
    platform: Platform
  ): Promise<string | undefined> {
    if (!deviceId) return undefined;
    
    const platformInfo = PlatformInfo.fromPlatform(platform);
    if (!platformInfo.requiresSimulator()) return deviceId;
    
    const device = await this.devices.find(deviceId);
    if (!device) {
      throw new Error(`Device not found: ${deviceId}`);
    }
    
    await device.ensureBooted();
    return device.id;
  }
}