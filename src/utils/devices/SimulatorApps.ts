import { execAsync } from '../../utils.js';
import { createModuleLogger } from '../../logger.js';
import path from 'path';

const logger = createModuleLogger('SimulatorApps');

/**
 * Handles app management on simulators
 * Single responsibility: Install, uninstall, and launch apps
 */
export class SimulatorApps {
  /**
   * Install an app on the simulator
   */
  async install(appPath: string, deviceId?: string): Promise<void> {
    let command = `xcrun simctl install `;
    if (deviceId) {
      command += `"${deviceId}" `;
    } else {
      command += 'booted ';
    }
    command += `"${appPath}"`;

    try {
      await execAsync(command);
      logger.debug({ appPath, deviceId }, 'App installed successfully');
    } catch (error: any) {
      logger.error({ error: error.message, appPath, deviceId }, 'Failed to install app');
      throw new Error(`Failed to install app: ${error.message}`);
    }
  }

  /**
   * Uninstall an app from the simulator
   */
  async uninstall(bundleId: string, deviceId?: string): Promise<void> {
    let command = `xcrun simctl uninstall `;
    if (deviceId) {
      command += `"${deviceId}" `;
    } else {
      command += 'booted ';
    }
    command += `"${bundleId}"`;

    try {
      await execAsync(command);
      logger.debug({ bundleId, deviceId }, 'App uninstalled successfully');
    } catch (error: any) {
      logger.error({ error: error.message, bundleId, deviceId }, 'Failed to uninstall app');
      throw new Error(`Failed to uninstall app: ${error.message}`);
    }
  }

  /**
   * Launch an app on the simulator
   * Returns the process ID of the launched app
   */
  async launch(bundleId: string, deviceId?: string): Promise<string> {
    let command = `xcrun simctl launch --terminate-running-process `;
    if (deviceId) {
      command += `"${deviceId}" `;
    } else {
      command += 'booted ';
    }
    command += `"${bundleId}"`;

    try {
      const { stdout } = await execAsync(command);
      const pid = stdout.trim();
      logger.debug({ bundleId, deviceId, pid }, 'App launched successfully');
      return pid;
    } catch (error: any) {
      logger.error({ error: error.message, bundleId, deviceId }, 'Failed to launch app');
      throw new Error(`Failed to launch app: ${error.message}`);
    }
  }

  /**
   * Get bundle ID from an app bundle
   */
  async getBundleId(appPath: string): Promise<string> {
    try {
      const plistPath = path.join(appPath, 'Info.plist');
      const { stdout } = await execAsync(
        `/usr/libexec/PlistBuddy -c "Print :CFBundleIdentifier" "${plistPath}"`
      );
      return stdout.trim();
    } catch (error: any) {
      logger.error({ error: error.message, appPath }, 'Failed to get bundle ID');
      throw new Error(`Failed to get bundle ID: ${error.message}`);
    }
  }
}