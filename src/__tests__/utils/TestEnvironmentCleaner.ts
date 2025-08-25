import { execSync } from 'child_process';
import { createModuleLogger } from '../../logger';

const logger = createModuleLogger('TestEnvironmentCleaner');

/**
 * Utility class for cleaning up test environment (simulators, processes, etc.)
 * Separate from TestProjectManager to maintain single responsibility
 */
export class TestEnvironmentCleaner {
  /**
   * Shutdown all running simulators
   * Faster than erasing simulators, just powers them off
   */
  static shutdownAllSimulators(): void {
    try {
      execSync('xcrun simctl shutdown all', { stdio: 'ignore' });
      logger.debug('All simulators shut down');
    } catch (error) {
      // Ignore errors - simulators might not be running
      logger.debug('No simulators to shutdown or shutdown failed (normal)');
    }
  }

  /**
   * Kill a running macOS app by name
   * @param appName Name of the app process to kill
   */
  static killMacOSApp(appName: string): void {
    try {
      execSync(`pkill -f ${appName}`, { stdio: 'ignore' });
      logger.debug({ appName }, 'Killed macOS app');
    } catch (error) {
      // Ignore errors - app might not be running
      logger.debug({ appName }, 'App not running or kill failed (normal)');
    }
  }

  /**
   * Kill the test project app if it's running on macOS
   */
  static killTestProjectApp(): void {
    this.killMacOSApp('TestProjectXCTest');
  }

  /**
   * Full cleanup of test environment
   * Shuts down simulators and kills test apps
   */
  static cleanupTestEnvironment(): void {
    logger.debug('Cleaning up test environment');
    
    // Shutdown all simulators
    this.shutdownAllSimulators();
    
    // Kill any running test apps
    this.killTestProjectApp();
    
    logger.debug('Test environment cleanup complete');
  }

  /**
   * Reset a specific simulator by erasing its contents
   * @param deviceId The simulator device ID to reset
   */
  static resetSimulator(deviceId: string): void {
    try {
      execSync(`xcrun simctl erase "${deviceId}"`, { stdio: 'ignore' });
      logger.debug({ deviceId }, 'Simulator erased');
    } catch (error) {
      logger.warn({ deviceId, error }, 'Failed to erase simulator');
    }
  }

  /**
   * Boot a specific simulator
   * @param deviceId The simulator device ID to boot
   */
  static bootSimulator(deviceId: string): void {
    try {
      execSync(`xcrun simctl boot "${deviceId}"`, { stdio: 'ignore' });
      logger.debug({ deviceId }, 'Simulator booted');
    } catch (error) {
      // Might already be booted
      logger.debug({ deviceId }, 'Simulator already booted or boot failed');
    }
  }
}