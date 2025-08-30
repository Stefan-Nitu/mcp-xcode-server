/**
 * Unit tests for BootSimulatorTool
 * Tests validation, command building, and error handling without real simulator interaction
 */

import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import { BootSimulatorTool } from '../../../tools/simulator/BootSimulatorTool.js';

describe('BootSimulatorTool Unit Tests', () => {
  let tool: BootSimulatorTool;
  let mockDevice: any;
  let mockDevices: any;

  beforeEach(() => {
    // Create a mock device
    mockDevice = {
      id: 'test-device-id',
      name: 'Test Device',
      bootDevice: jest.fn<() => Promise<void>>(),
      open: jest.fn<() => Promise<void>>()
    };

    // Create a mock Devices instance
    mockDevices = {
      find: jest.fn<(deviceId: string) => Promise<any>>()
    };

    // Default mock behavior - device found
    mockDevices.find.mockResolvedValue(mockDevice);

    // Create tool with mocked dependencies
    tool = new BootSimulatorTool(mockDevices);
  });

  describe('Validation', () => {
    test('should require deviceId parameter', async () => {
      await expect(tool.execute({}))
        .rejects.toThrow('Device ID is required');
      
      await expect(tool.execute({ deviceId: undefined }))
        .rejects.toThrow('Device ID is required');
    });

    test('should reject empty deviceId', async () => {
      await expect(tool.execute({ deviceId: '' }))
        .rejects.toThrow('Device ID is required');
      
      // Note: Spaces-only string will be trimmed by Zod, so this actually passes validation
      // This is acceptable behavior as it prevents accidental whitespace issues
    });

    test('should reject invalid deviceId types', async () => {
      await expect(tool.execute({ deviceId: 123 }))
        .rejects.toThrow('Expected string');
      
      await expect(tool.execute({ deviceId: null }))
        .rejects.toThrow();
      
      await expect(tool.execute({ deviceId: {} }))
        .rejects.toThrow('Expected string');
    });

    test('should accept valid deviceId formats', async () => {
      // UUID format
      const uuidResult = await tool.execute({ 
        deviceId: '12345678-1234-1234-1234-123456789012' 
      });
      expect(uuidResult.content[0].text).toContain('Successfully booted');

      // Name format
      const nameResult = await tool.execute({ 
        deviceId: 'iPhone 15 Pro' 
      });
      expect(nameResult.content[0].text).toContain('Successfully booted');

      // Partial UUID
      const partialResult = await tool.execute({ 
        deviceId: '12345678' 
      });
      expect(partialResult.content[0].text).toContain('Successfully booted');
    });
  });

  describe('Device Interaction', () => {
    test('should find device and boot it', async () => {
      await tool.execute({ deviceId: 'test-device' });

      expect(mockDevices.find).toHaveBeenCalledWith('test-device');
      expect(mockDevice.bootDevice).toHaveBeenCalled();
      expect(mockDevice.open).toHaveBeenCalled();
    });

    test('should pass device ID to find method', async () => {
      await tool.execute({ deviceId: 'iPhone 15 Pro' });

      expect(mockDevices.find).toHaveBeenCalledWith('iPhone 15 Pro');
    });

    test('should open Simulator app after boot', async () => {
      await tool.execute({ deviceId: 'test-device' });

      // Verify boot is called before open
      const bootCallOrder = mockDevice.bootDevice.mock.invocationCallOrder[0];
      const openCallOrder = mockDevice.open.mock.invocationCallOrder[0];
      expect(bootCallOrder).toBeLessThan(openCallOrder);
    });
  });

  describe('Error Handling', () => {
    test('should handle device not found error', async () => {
      mockDevices.find.mockResolvedValue(null);

      await expect(tool.execute({ deviceId: 'nonexistent-device' }))
        .rejects.toThrow('Device not found: nonexistent-device');
    });

    test('should handle already booted device', async () => {
      const error = new Error('Unable to boot device in current state: Booted');
      mockDevice.bootDevice.mockRejectedValue(error);

      const result = await tool.execute({ deviceId: 'test-device' });
      
      expect(result.content[0].text).toContain('Simulator already booted');
      expect(result.content[0].text).toContain('Test Device');
      expect(mockDevice.open).not.toHaveBeenCalled(); // Should not open if already booted
    });

    test('should handle boot failure', async () => {
      const error = new Error('Failed to boot: Permission denied');
      mockDevice.bootDevice.mockRejectedValue(error);

      await expect(tool.execute({ deviceId: 'test-device' }))
        .rejects.toThrow('Failed to boot: Permission denied');
      
      expect(mockDevice.open).not.toHaveBeenCalled(); // Should not open if boot failed
    });

    test('should handle open failure', async () => {
      const error = new Error('Failed to open Simulator.app');
      mockDevice.open.mockRejectedValue(error);

      await expect(tool.execute({ deviceId: 'test-device' }))
        .rejects.toThrow('Failed to open Simulator.app');
      
      expect(mockDevice.bootDevice).toHaveBeenCalled(); // Boot should still be attempted
    });
  });

  describe('Tool Definition', () => {
    test('should provide correct tool definition', () => {
      const definition = tool.getToolDefinition();
      
      expect(definition.name).toBe('boot_simulator');
      expect(definition.description).toContain('Boot');
      expect(definition.inputSchema.properties).toHaveProperty('deviceId');
      expect(definition.inputSchema.required).toContain('deviceId');
    });

    test('should have proper schema for MCP', () => {
      const definition = tool.getToolDefinition();
      
      // Validate the schema structure
      expect(definition.inputSchema.type).toBe('object');
      expect(definition.inputSchema.properties.deviceId.type).toBe('string');
      expect(definition.inputSchema.properties.deviceId.description).toBeDefined();
    });
  });

  describe('Success Response Format', () => {
    test('should return formatted success message with device info', async () => {
      mockDevice.id = '12345-UUID';
      mockDevice.name = 'iPhone 15 Pro';

      const result = await tool.execute({ deviceId: 'test-input' });
      
      expect(result.content[0].text).toBe('Successfully booted simulator: iPhone 15 Pro (12345-UUID)');
    });

    test('should handle different device names in success message', async () => {
      mockDevice.name = 'iPad Pro 12.9-inch';
      mockDevice.id = 'ipad-uuid';

      const result = await tool.execute({ deviceId: 'iPad Pro' });
      
      expect(result.content[0].text).toContain('iPad Pro 12.9-inch');
      expect(result.content[0].text).toContain('ipad-uuid');
    });

    test('should return already booted message when appropriate', async () => {
      const error = new Error('Unable to boot device in current state: Booted');
      mockDevice.bootDevice.mockRejectedValue(error);
      mockDevice.name = 'Test iPhone';
      mockDevice.id = 'test-id';

      const result = await tool.execute({ deviceId: 'test' });
      
      expect(result.content[0].text).toBe('Simulator already booted: Test iPhone (test-id)');
    });
  });

  describe('Edge Cases', () => {
    test('should handle device with special characters in name', async () => {
      mockDevice.name = 'iPhone 15 Pro (Special Edition)';
      
      const result = await tool.execute({ deviceId: 'special-device' });
      
      expect(result.content[0].text).toContain('iPhone 15 Pro (Special Edition)');
    });

    test('should handle very long device IDs', async () => {
      const longId = 'a'.repeat(100);
      
      const result = await tool.execute({ deviceId: longId });
      
      expect(mockDevices.find).toHaveBeenCalledWith(longId);
      expect(result.content[0].text).toContain('Successfully booted');
    });

    test('should handle concurrent boot requests', async () => {
      // Simulate multiple concurrent boot attempts
      const promises = [
        tool.execute({ deviceId: 'device1' }),
        tool.execute({ deviceId: 'device2' }),
        tool.execute({ deviceId: 'device3' })
      ];

      const results = await Promise.all(promises);
      
      expect(mockDevices.find).toHaveBeenCalledTimes(3);
      expect(mockDevice.bootDevice).toHaveBeenCalledTimes(3);
      results.forEach(result => {
        expect(result.content[0].text).toContain('Successfully booted');
      });
    });
  });
});