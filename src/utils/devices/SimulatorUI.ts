import { execAsync } from '../../utils.js';
import { createModuleLogger } from '../../logger.js';
import { readFileSync, existsSync, unlinkSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

const logger = createModuleLogger('SimulatorUI');

/**
 * Handles simulator UI operations
 * Single responsibility: GUI operations and screenshots
 */
export class SimulatorUI {
  /**
   * Opens the Simulator app GUI (skipped during tests)
   */
  async open(): Promise<void> {
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
   * Capture a screenshot from the simulator
   */
  async screenshot(outputPath: string, deviceId?: string): Promise<void> {
    let command = `xcrun simctl io `;
    if (deviceId) {
      command += `"${deviceId}" `;
    } else {
      command += 'booted ';
    }
    command += `screenshot "${outputPath}"`;

    try {
      await execAsync(command);
      logger.debug({ outputPath, deviceId }, 'Screenshot captured successfully');
    } catch (error: any) {
      logger.error({ error: error.message, outputPath, deviceId }, 'Failed to capture screenshot');
      throw new Error(`Failed to capture screenshot: ${error.message}`);
    }
  }

  /**
   * Capture a screenshot and return as base64
   */
  async screenshotData(deviceId?: string): Promise<{ base64: string; mimeType: string }> {
    // Create a temporary file path
    const tempPath = join(tmpdir(), `simulator-screenshot-${Date.now()}.png`);
    
    try {
      // Capture the screenshot to temp file
      await this.screenshot(tempPath, deviceId);
      
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
   * Set simulator appearance (light/dark mode)
   * May fail on older Xcode versions
   */
  async setAppearance(appearance: 'light' | 'dark', deviceId?: string): Promise<void> {
    let command = `xcrun simctl ui `;
    if (deviceId) {
      command += `"${deviceId}" `;
    } else {
      command += 'booted ';
    }
    command += appearance;

    try {
      await execAsync(command);
      logger.debug({ appearance, deviceId }, 'Appearance set successfully');
    } catch (error: any) {
      // This command may not be available on older Xcode versions
      logger.debug({ error: error.message }, 'Could not set appearance (may not be supported)');
    }
  }
}