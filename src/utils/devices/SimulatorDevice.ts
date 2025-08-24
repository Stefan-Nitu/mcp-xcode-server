import { SimulatorBoot } from './SimulatorBoot.js';
import { SimulatorApps } from './SimulatorApps.js';
import { SimulatorUI } from './SimulatorUI.js';
import { SimulatorInfo } from './SimulatorInfo.js';
import { SimulatorReset } from './SimulatorReset.js';
import { createModuleLogger } from '../../logger.js';

const logger = createModuleLogger('SimulatorDevice');

/**
 * Represents a specific simulator device instance.
 * Provides a complete interface for simulator operations while
 * delegating to specialized components internally.
 */
export class SimulatorDevice {
  private boot: SimulatorBoot;
  private apps: SimulatorApps;
  private ui: SimulatorUI;
  private info: SimulatorInfo;
  private reset: SimulatorReset;

  constructor(
    public readonly id: string,
    public readonly name: string,
    public readonly platform: string,
    public readonly runtime: string,
    components?: {
      boot?: SimulatorBoot;
      apps?: SimulatorApps;
      ui?: SimulatorUI;
      info?: SimulatorInfo;
      reset?: SimulatorReset;
    }
  ) {
    this.boot = components?.boot || new SimulatorBoot();
    this.apps = components?.apps || new SimulatorApps();
    this.ui = components?.ui || new SimulatorUI();
    this.info = components?.info || new SimulatorInfo();
    this.reset = components?.reset || new SimulatorReset();
  }

  /**
   * Boot this simulator device
   */
  async bootDevice(): Promise<void> {
    logger.debug({ deviceId: this.id, name: this.name }, 'Booting device');
    await this.boot.boot(this.id);
  }

  /**
   * Shutdown this simulator device
   */
  async shutdown(): Promise<void> {
    logger.debug({ deviceId: this.id, name: this.name }, 'Shutting down device');
    await this.boot.shutdown(this.id);
  }

  /**
   * Install an app on this device
   */
  async install(appPath: string): Promise<void> {
    logger.debug({ deviceId: this.id, appPath }, 'Installing app on device');
    await this.apps.install(appPath, this.id);
  }

  /**
   * Uninstall an app from this device
   */
  async uninstall(bundleId: string): Promise<void> {
    logger.debug({ deviceId: this.id, bundleId }, 'Uninstalling app from device');
    await this.apps.uninstall(bundleId, this.id);
  }

  /**
   * Launch an app on this device
   */
  async launch(bundleId: string): Promise<string> {
    logger.debug({ deviceId: this.id, bundleId }, 'Launching app on device');
    return await this.apps.launch(bundleId, this.id);
  }

  /**
   * Get bundle ID from an app path
   */
  async getBundleId(appPath: string): Promise<string> {
    return await this.apps.getBundleId(appPath);
  }

  /**
   * Take a screenshot of this device
   */
  async screenshot(outputPath: string): Promise<void> {
    logger.debug({ deviceId: this.id, outputPath }, 'Taking screenshot');
    await this.ui.screenshot(outputPath, this.id);
  }

  /**
   * Get screenshot data as base64
   */
  async screenshotData(): Promise<{ base64: string; mimeType: string }> {
    logger.debug({ deviceId: this.id }, 'Getting screenshot data');
    return await this.ui.screenshotData(this.id);
  }

  /**
   * Set appearance mode (light/dark)
   */
  async setAppearance(appearance: 'light' | 'dark'): Promise<void> {
    logger.debug({ deviceId: this.id, appearance }, 'Setting appearance');
    await this.ui.setAppearance(appearance, this.id);
  }

  /**
   * Open the Simulator app UI
   */
  async open(): Promise<void> {
    await this.ui.open();
  }

  /**
   * Get device logs
   */
  async logs(predicate?: string, last?: string): Promise<string> {
    logger.debug({ deviceId: this.id, predicate, last }, 'Getting device logs');
    return await this.info.logs(this.id, predicate, last);
  }

  /**
   * Get current device state
   */
  async getState(): Promise<string> {
    return await this.info.getDeviceState(this.id);
  }

  /**
   * Check if device is available
   */
  async checkAvailability(): Promise<boolean> {
    return await this.info.isAvailable(this.id);
  }

  /**
   * Reset this device to clean state
   */
  async resetDevice(): Promise<void> {
    logger.debug({ deviceId: this.id, name: this.name }, 'Resetting device');
    await this.reset.reset(this.id);
  }

  /**
   * Check if device is currently booted
   * Checks actual current state, not cached value
   */
  async isBooted(): Promise<boolean> {
    const currentState = await this.getState();
    return currentState === 'Booted';
  }

  /**
   * Ensure this device is booted, boot if necessary
   */
  async ensureBooted(): Promise<void> {
    // Check if device is available before trying to boot
    const available = await this.checkAvailability();
    if (!available) {
      throw new Error(
        `Device "${this.name}" (${this.id}) is not available. ` +
        `The runtime "${this.runtime}" may be missing or corrupted. ` +
        `Try downloading the runtime in Xcode or use a different simulator.`
      );
    }
    
    // Use the async isBooted() method to check actual state
    if (!(await this.isBooted())) {
      await this.bootDevice();
    } else {
      logger.debug({ deviceId: this.id, name: this.name }, 'Device already booted');
    }
  }
}