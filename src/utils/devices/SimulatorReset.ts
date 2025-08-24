import { execAsync } from '../../utils.js';
import { createModuleLogger } from '../../logger.js';

const logger = createModuleLogger('SimulatorReset');

/**
 * Utility class for resetting simulator state
 * Single responsibility: Reset a simulator (erase all content and settings)
 */
export class SimulatorReset {
  /**
   * Reset a simulator by erasing all content and settings
   * Equivalent to "Device > Erase All Content and Settings" in Simulator app
   */
  async reset(deviceId: string): Promise<void> {
    try {
      logger.info({ deviceId }, 'Resetting simulator - erasing all content and settings');
      await execAsync(`xcrun simctl erase "${deviceId}"`);
      logger.debug({ deviceId }, 'Successfully reset simulator');
    } catch (error: any) {
      logger.error({ error: error.message, deviceId }, 'Failed to reset simulator');
      throw new Error(`Failed to reset simulator: ${error.message}`);
    }
  }
}