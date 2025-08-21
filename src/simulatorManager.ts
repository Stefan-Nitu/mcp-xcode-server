/**
 * Simulator management functionality
 * Single Responsibility: Managing simulator lifecycle
 */

import { exec as nodeExec, ExecException } from 'child_process';
import { promisify } from 'util';
import { readFileSync, existsSync, unlinkSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { SimulatorDevice, Platform } from './types.js';
import { PlatformHandler } from './platformHandler.js';
import { createModuleLogger } from './logger.js';

const logger = createModuleLogger('SimulatorManager');

// Type for the exec function and promisified version
export type ExecFunction = typeof nodeExec;
export type ExecAsyncFunction = (command: string, options?: any) => Promise<{ stdout: string; stderr: string }>;

/**
 * SimulatorManager with dependency injection for testability
 */
export class SimulatorManager {
  private static readonly BOOT_TIMEOUT = 60000; // 1 minute
  private static readonly POLL_INTERVAL = 500; // 500ms
  
  private readonly execAsync: ExecAsyncFunction;
  
  // Default instance for static method compatibility
  private static defaultInstance: SimulatorManager;
  
  constructor(execFunc?: ExecFunction) {
    // Use provided exec or default to Node's exec
    const exec = execFunc || nodeExec;
    // Proper type assertion for promisified exec
    this.execAsync = promisify(exec) as unknown as ExecAsyncFunction;
  }
  
  /**
   * Get the default instance (singleton pattern)
   */
  private static getDefaultInstance(): SimulatorManager {
    if (!SimulatorManager.defaultInstance) {
      SimulatorManager.defaultInstance = new SimulatorManager();
    }
    return SimulatorManager.defaultInstance;
  }

  /**
   * List all available simulators, optionally filtered by platform
   */
  async listSimulatorsInstance(showAll = false, platform?: Platform): Promise<SimulatorDevice[]> {
    try {
      const { stdout } = await this.execAsync('xcrun simctl list devices --json');
      const data = JSON.parse(stdout);
      
      const devices: SimulatorDevice[] = [];
      for (const [runtime, deviceList] of Object.entries(data.devices)) {
        // Filter by platform if specified
        if (platform) {
          const runtimeLower = runtime.toLowerCase();
          const platformLower = platform.toLowerCase();
          
          // Skip if runtime doesn't match platform
          if (!runtimeLower.includes(platformLower)) {
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
    } catch (error) {
      logger.error({ error }, 'Failed to list simulators');
      throw new Error(`Failed to list simulators: ${error}`);
    }
  }

  /**
   * Boot a simulator if not already booted
   */
  async bootSimulatorInstance(deviceId: string): Promise<void> {
    try {
      await this.execAsync(`xcrun simctl boot "${deviceId}"`);
    } catch (error: any) {
      if (!error.message.includes('Unable to boot device in current state: Booted')) {
        logger.error({ error, deviceId }, 'Failed to boot simulator');
        throw new Error(`Failed to boot simulator: ${error.message}`);
      }
      // Already booted, that's fine
      logger.debug({ deviceId }, 'Simulator already in booted state')
    }
    
    // Open Simulator app with GUI after booting
    await this.ensureSimulatorAppOpen();
  }

  /**
   * Shutdown a simulator
   */
  async shutdownSimulatorInstance(deviceId: string): Promise<void> {
    try {
      await this.execAsync(`xcrun simctl shutdown "${deviceId}"`);
    } catch (error: any) {
      logger.error({ error, deviceId }, 'Failed to shutdown simulator');
      throw new Error(`Failed to shutdown simulator: ${error.message}`);
    }
  }

  /**
   * Ensure a simulator is booted and ready
   */
  async ensureSimulatorBootedInstance(platform: Platform, deviceId?: string): Promise<string> {
    // Check if platform needs a simulator
    if (!PlatformHandler.needsSimulator(platform)) {
      logger.info({ platform }, 'Platform does not require a simulator');
      return '';
    }

    const targetDevice = deviceId || PlatformHandler.getDefaultDevice(platform) || '';
    
    try {
      // Check if the device is already booted (include unavailable for checking booted state)
      const allDevices = await this.listSimulatorsInstance(true, platform);
      
      for (const device of allDevices) {
        if ((device.name === targetDevice || device.udid === targetDevice) && device.state === 'Booted') {
          logger.info({ device: device.name, state: device.state }, 'Simulator already booted, reusing');
          await this.ensureSimulatorAppOpen();
          return device.name;
        }
      }
      
      // Find an available device to boot (exclude unavailable devices)
      const availableDevices = await this.listSimulatorsInstance(false, platform);
      let deviceToBootId: string | null = null;
      let deviceToBootName = targetDevice;
      
      for (const device of availableDevices) {
        if (device.name === targetDevice || device.udid === targetDevice) {
          deviceToBootId = device.udid;
          deviceToBootName = device.name;
          break;
        }
      }
      
      // If no matching device found, throw an error
      if (!deviceToBootId) {
        const availableNames = availableDevices.map(d => d.name).join(', ');
        throw new Error(`No available simulator found with name or ID "${targetDevice}". Available devices: ${availableNames || 'none'}`);
      }
      
      // Boot the device
      logger.info({ deviceId: deviceToBootId, deviceName: deviceToBootName }, 'Booting simulator');
      await this.bootSimulatorInstance(deviceToBootId);
      
      // Open Simulator app
      await this.ensureSimulatorAppOpen();
      
      // Poll until booted
      await this.waitForBoot(deviceToBootId, deviceToBootName);
      
      return deviceToBootName;
    } catch (error: any) {
      // If booting fails because it's already booted, that's OK
      if (error.message.includes('Unable to boot device in current state: Booted')) {
        return targetDevice;
      }
      throw error;
    }
  }

  /**
   * Wait for a simulator to finish booting
   */
  private async waitForBoot(deviceId: string, deviceName: string): Promise<void> {
    const startTime = Date.now();
    
    while (Date.now() - startTime < SimulatorManager.BOOT_TIMEOUT) {
      const devices = await this.listSimulatorsInstance(true);
      
      for (const device of devices) {
        if (device.udid === deviceId && device.state === 'Booted') {
          logger.info({ deviceId, deviceName }, 'Simulator successfully booted');
          return;
        }
      }
      
      await new Promise(resolve => setTimeout(resolve, SimulatorManager.POLL_INTERVAL));
    }
    
    throw new Error(`Timeout waiting for simulator ${deviceName} to boot`);
  }

  /**
   * Ensure the Simulator app is open
   */
  private async ensureSimulatorAppOpen(): Promise<void> {
    try {
      await this.execAsync(`pgrep -x Simulator`);
      // Simulator is running
    } catch {
      // Simulator app not running, open it
      logger.debug('Opening Simulator app');
      await this.execAsync(`open -a Simulator`);
    }
  }

  /**
   * Install an app on the simulator
   */
  async installAppInstance(appPath: string, deviceId?: string): Promise<void> {
    let command = `xcrun simctl install `;
    if (deviceId) {
      command += `"${deviceId}" `;
    } else {
      command += 'booted ';
    }
    command += `"${appPath}"`;

    try {
      await this.execAsync(command);
    } catch (error: any) {
      logger.error({ error, appPath, deviceId }, 'Failed to install app');
      throw new Error(`Failed to install app: ${error.message}`);
    }
  }

  /**
   * Uninstall an app from the simulator
   */
  async uninstallAppInstance(bundleId: string, deviceId?: string): Promise<void> {
    let command = `xcrun simctl uninstall `;
    if (deviceId) {
      command += `"${deviceId}" `;
    } else {
      command += 'booted ';
    }
    command += `"${bundleId}"`;

    try {
      await this.execAsync(command);
    } catch (error: any) {
      logger.error({ error, bundleId, deviceId }, 'Failed to uninstall app');
      throw new Error(`Failed to uninstall app: ${error.message}`);
    }
  }

  /**
   * Capture a screenshot from the simulator
   */
  async captureScreenshotInstance(outputPath: string, deviceId?: string): Promise<void> {
    let command = `xcrun simctl io `;
    if (deviceId) {
      command += `"${deviceId}" `;
    } else {
      command += 'booted ';
    }
    command += `screenshot "${outputPath}"`;

    try {
      await this.execAsync(command);
    } catch (error: any) {
      logger.error({ error, outputPath, deviceId }, 'Failed to capture screenshot');
      throw new Error(`Failed to capture screenshot: ${error.message}`);
    }
  }

  /**
   * Capture a screenshot and return as base64 for Claude Code to display
   */
  async captureScreenshotDataInstance(deviceId?: string): Promise<{ base64: string; mimeType: string }> {
    // Create a temporary file path
    const tempPath = join(tmpdir(), `simulator-screenshot-${Date.now()}.png`);
    
    try {
      // Capture the screenshot to temp file
      await this.captureScreenshotInstance(tempPath, deviceId);
      
      // Read the file and convert to base64
      const imageData = readFileSync(tempPath);
      const base64 = imageData.toString('base64');
      
      return {
        base64,
        mimeType: 'image/png'
      };
    } finally {
      // Clean up temp file
      if (existsSync(tempPath)) {
        unlinkSync(tempPath);
      }
    }
  }

  /**
   * Get device logs from the simulator
   */
  async getDeviceLogsInstance(deviceId?: string, predicate?: string, last: string = '5m'): Promise<string> {
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
      const { stdout } = await this.execAsync(command, { maxBuffer: 10 * 1024 * 1024 });
      const lines = stdout.split('\n').slice(-100);
      return lines.join('\n');
    } catch (error: any) {
      logger.error({ error, deviceId, predicate }, 'Failed to get device logs');
      throw new Error(`Failed to get device logs: ${error.message}`);
    }
  }

  // Static methods for backward compatibility - delegate to default instance
  static async listSimulators(showAll = false, platform?: Platform): Promise<SimulatorDevice[]> {
    return SimulatorManager.getDefaultInstance().listSimulatorsInstance(showAll, platform);
  }

  static async bootSimulator(deviceId: string): Promise<void> {
    return SimulatorManager.getDefaultInstance().bootSimulatorInstance(deviceId);
  }

  static async shutdownSimulator(deviceId: string): Promise<void> {
    return SimulatorManager.getDefaultInstance().shutdownSimulatorInstance(deviceId);
  }

  static async ensureSimulatorBooted(platform: Platform, deviceId?: string): Promise<string> {
    return SimulatorManager.getDefaultInstance().ensureSimulatorBootedInstance(platform, deviceId);
  }

  static async installApp(appPath: string, deviceId?: string): Promise<void> {
    return SimulatorManager.getDefaultInstance().installAppInstance(appPath, deviceId);
  }

  static async uninstallApp(bundleId: string, deviceId?: string): Promise<void> {
    return SimulatorManager.getDefaultInstance().uninstallAppInstance(bundleId, deviceId);
  }

  static async captureScreenshot(outputPath: string, deviceId?: string): Promise<void> {
    return SimulatorManager.getDefaultInstance().captureScreenshotInstance(outputPath, deviceId);
  }

  static async captureScreenshotData(deviceId?: string): Promise<{ base64: string; mimeType: string }> {
    return SimulatorManager.getDefaultInstance().captureScreenshotDataInstance(deviceId);
  }

  static async getDeviceLogs(deviceId?: string, predicate?: string, last: string = '5m'): Promise<string> {
    return SimulatorManager.getDefaultInstance().getDeviceLogsInstance(deviceId, predicate, last);
  }
}