/**
 * Integration tests for screenshot capture functionality
 */

import { describe, test, expect, beforeAll } from '@jest/globals';
import { SimulatorManager } from '../../simulatorManager';
import { Platform } from '../../types';

describe('Screenshot Capture Integration', () => {
  beforeAll(async () => {
    // Ensure we have at least one simulator available
    const devices = await SimulatorManager.listSimulators(true, Platform.iOS);
    if (devices.length === 0) {
      throw new Error('No iOS simulators available for testing');
    }
  }, 30000);
  
  describe('Screenshot Data Capture', () => {
    test('should capture screenshot and return base64 data', async () => {
      // Find a booted device or boot one
      const devices = await SimulatorManager.listSimulators(true, Platform.iOS);
      let bootedDevice = devices.find(d => d.state === 'Booted');
      
      if (!bootedDevice) {
        // Boot the first available device
        const availableDevice = devices.find(d => d.isAvailable);
        if (availableDevice) {
          await SimulatorManager.bootSimulator(availableDevice.udid);
          // Wait for boot
          await new Promise(resolve => setTimeout(resolve, 5000));
          bootedDevice = availableDevice;
        }
      }
      
      if (bootedDevice) {
        // Capture screenshot data
        const result = await SimulatorManager.captureScreenshotData(bootedDevice.udid);
        
        // Verify we got base64 data
        expect(result).toBeDefined();
        expect(result.base64).toBeDefined();
        expect(result.mimeType).toBe('image/png');
        
        // Verify it's valid base64
        expect(result.base64).toMatch(/^[A-Za-z0-9+/]+={0,2}$/);
        
        // Verify it's substantial data (not an empty image)
        expect(result.base64.length).toBeGreaterThan(1000);
        
        // Verify it starts with PNG header when decoded
        const buffer = Buffer.from(result.base64, 'base64');
        const pngHeader = buffer.slice(0, 8);
        expect(pngHeader[0]).toBe(0x89);
        expect(pngHeader[1]).toBe(0x50); // P
        expect(pngHeader[2]).toBe(0x4E); // N
        expect(pngHeader[3]).toBe(0x47); // G
      } else {
        console.warn('No simulator available for screenshot test');
      }
    }, 60000);
    
    test('should handle screenshot capture for non-existent device gracefully', async () => {
      await expect(
        SimulatorManager.captureScreenshotData('non-existent-device-id')
      ).rejects.toThrow('Failed to capture screenshot');
    });
  });
});