/**
 * Unit tests for SimulatorManager with dependency injection
 */

import { describe, test, expect, jest, beforeEach } from '@jest/globals';
import { SimulatorManager } from '../../simulatorManager';

// Mock the util module
jest.mock('util', () => {
  const actual = jest.requireActual('util') as any;
  return {
    ...actual,
    promisify: jest.fn()
  };
});

describe('SimulatorManager', () => {
  let mockExec: any;
  let mockExecAsync: jest.Mock<any>;
  let simulatorManager: SimulatorManager;

  beforeEach(() => {
    // Create a mock exec function that properly simulates Node's exec
    mockExecAsync = jest.fn<any>();
    mockExec = jest.fn();
    
    // Mock the promisify function to return our mockExecAsync
    const util = require('util');
    (util.promisify as jest.Mock).mockImplementation((fn: any) => {
      if (fn === mockExec) {
        return mockExecAsync;
      }
      // For other functions, return a basic mock
      return jest.fn();
    });
    
    // Create a new instance with the mock
    simulatorManager = new SimulatorManager(mockExec as any);
  });

  describe('listSimulatorsInstance', () => {
    test('should parse simulator list correctly', async () => {
      const mockOutput = JSON.stringify({
        devices: {
          'com.apple.CoreSimulator.SimRuntime.iOS-17-2': [
            {
              udid: 'test-udid-1',
              name: 'iPhone 15',
              state: 'Booted',
              deviceTypeIdentifier: 'com.apple.CoreSimulator.SimDeviceType.iPhone-15',
              isAvailable: true
            },
            {
              udid: 'test-udid-2',
              name: 'iPhone 14',
              state: 'Shutdown',
              deviceTypeIdentifier: 'com.apple.CoreSimulator.SimDeviceType.iPhone-14',
              isAvailable: true
            }
          ]
        }
      });

      // Mock the promisified exec to return the expected output
      mockExecAsync.mockResolvedValue({ stdout: mockOutput, stderr: '' });

      const devices = await simulatorManager.listSimulatorsInstance();
      
      expect(mockExecAsync).toHaveBeenCalledWith('xcrun simctl list devices --json');
      
      // By default (showAll=false), shows all available devices
      expect(devices).toHaveLength(2);
      expect(devices[0]).toEqual({
        udid: 'test-udid-1',
        name: 'iPhone 15',
        state: 'Booted',
        deviceTypeIdentifier: 'com.apple.CoreSimulator.SimDeviceType.iPhone-15',
        runtime: 'iOS-17-2',
        isAvailable: true
      });
      expect(devices[1]).toEqual({
        udid: 'test-udid-2',
        name: 'iPhone 14',
        state: 'Shutdown',
        deviceTypeIdentifier: 'com.apple.CoreSimulator.SimDeviceType.iPhone-14',
        runtime: 'iOS-17-2',
        isAvailable: true
      });
    });

    test('should show all devices when showAll is true', async () => {
      const mockOutput = JSON.stringify({
        devices: {
          'com.apple.CoreSimulator.SimRuntime.iOS-17-2': [
            {
              udid: 'test-udid-1',
              name: 'iPhone 15',
              state: 'Booted',
              deviceTypeIdentifier: 'com.apple.CoreSimulator.SimDeviceType.iPhone-15',
              isAvailable: true
            },
            {
              udid: 'test-udid-2',
              name: 'iPhone 14',
              state: 'Shutdown',
              deviceTypeIdentifier: 'com.apple.CoreSimulator.SimDeviceType.iPhone-14',
              isAvailable: true
            },
            {
              udid: 'test-udid-3',
              name: 'iPhone 13',
              state: 'Shutdown',
              deviceTypeIdentifier: 'com.apple.CoreSimulator.SimDeviceType.iPhone-13',
              isAvailable: false  // Unavailable device
            }
          ]
        }
      });

      mockExecAsync.mockResolvedValue({ stdout: mockOutput, stderr: '' });

      // With showAll=true, should include unavailable devices
      const devices = await simulatorManager.listSimulatorsInstance(true);
      
      expect(devices).toHaveLength(3);
      expect(devices[2].isAvailable).toBe(false);
      
      // With showAll=false (default), should exclude unavailable devices
      const availableDevices = await simulatorManager.listSimulatorsInstance(false);
      expect(availableDevices).toHaveLength(2);
      expect(availableDevices.every(d => d.isAvailable)).toBe(true);
    });

    test('should filter by platform', async () => {
      const mockOutput = JSON.stringify({
        devices: {
          'com.apple.CoreSimulator.SimRuntime.iOS-17-2': [
            {
              udid: 'ios-udid',
              name: 'iPhone 15',
              state: 'Booted',
              deviceTypeIdentifier: 'com.apple.CoreSimulator.SimDeviceType.iPhone-15',
              isAvailable: true
            }
          ],
          'com.apple.CoreSimulator.SimRuntime.tvOS-17-2': [
            {
              udid: 'tvos-udid',
              name: 'Apple TV',
              state: 'Booted',
              deviceTypeIdentifier: 'com.apple.CoreSimulator.SimDeviceType.Apple-TV',
              isAvailable: true
            }
          ]
        }
      });

      mockExecAsync.mockResolvedValue({ stdout: mockOutput, stderr: '' });

      const { Platform } = await import('../../types');
      const devices = await simulatorManager.listSimulatorsInstance(true, Platform.iOS);
      
      expect(devices).toHaveLength(1);
      expect(devices[0].name).toBe('iPhone 15');
    });

    test('should handle exec errors', async () => {
      mockExecAsync.mockRejectedValue(new Error('Command failed'));

      await expect(simulatorManager.listSimulatorsInstance()).rejects.toThrow('Failed to list simulators');
    });
  });

  describe('bootSimulatorInstance', () => {
    test('should boot simulator successfully', async () => {
      mockExecAsync.mockResolvedValue({ stdout: '', stderr: '' });

      await simulatorManager.bootSimulatorInstance('test-device');
      
      expect(mockExecAsync).toHaveBeenCalledWith('xcrun simctl boot "test-device"');
    });

    test('should ignore already booted error', async () => {
      const error: any = new Error('Unable to boot device in current state: Booted');
      error.message = 'Unable to boot device in current state: Booted';
      mockExecAsync.mockRejectedValue(error);

      // Should not throw
      await expect(simulatorManager.bootSimulatorInstance('test-device')).resolves.toBeUndefined();
    });

    test('should throw other errors', async () => {
      mockExecAsync.mockRejectedValue(new Error('Device not found'));

      await expect(simulatorManager.bootSimulatorInstance('test-device'))
        .rejects.toThrow('Failed to boot simulator: Device not found');
    });
  });

  describe('shutdownSimulatorInstance', () => {
    test('should shutdown simulator successfully', async () => {
      mockExecAsync.mockResolvedValue({ stdout: '', stderr: '' });

      await simulatorManager.shutdownSimulatorInstance('test-device');
      
      expect(mockExecAsync).toHaveBeenCalledWith('xcrun simctl shutdown "test-device"');
    });

    test('should handle shutdown errors', async () => {
      mockExecAsync.mockRejectedValue(new Error('Device not found'));

      await expect(simulatorManager.shutdownSimulatorInstance('test-device'))
        .rejects.toThrow('Failed to shutdown simulator: Device not found');
    });
  });

  describe('installAppInstance', () => {
    test('should install app on specific device', async () => {
      mockExecAsync.mockResolvedValue({ stdout: '', stderr: '' });

      await simulatorManager.installAppInstance('/path/to/app.app', 'test-device');
      
      expect(mockExecAsync).toHaveBeenCalledWith('xcrun simctl install "test-device" "/path/to/app.app"');
    });

    test('should install app on booted device when no deviceId', async () => {
      mockExecAsync.mockResolvedValue({ stdout: '', stderr: '' });

      await simulatorManager.installAppInstance('/path/to/app.app');
      
      expect(mockExecAsync).toHaveBeenCalledWith('xcrun simctl install booted "/path/to/app.app"');
    });
  });

  describe('uninstallAppInstance', () => {
    test('should uninstall app from specific device', async () => {
      mockExecAsync.mockResolvedValue({ stdout: '', stderr: '' });

      await simulatorManager.uninstallAppInstance('com.example.app', 'test-device');
      
      expect(mockExecAsync).toHaveBeenCalledWith('xcrun simctl uninstall "test-device" "com.example.app"');
    });

    test('should uninstall app from booted device when no deviceId', async () => {
      mockExecAsync.mockResolvedValue({ stdout: '', stderr: '' });

      await simulatorManager.uninstallAppInstance('com.example.app');
      
      expect(mockExecAsync).toHaveBeenCalledWith('xcrun simctl uninstall booted "com.example.app"');
    });
  });

  describe('getDeviceLogsInstance', () => {
    test('should get device logs with default parameters', async () => {
      const mockLogs = 'Log line 1\nLog line 2\nLog line 3';
      
      mockExecAsync.mockResolvedValue({ stdout: mockLogs, stderr: '' });

      const logs = await simulatorManager.getDeviceLogsInstance();
      
      expect(mockExecAsync).toHaveBeenCalledWith(
        'xcrun simctl spawn booted log show --style syslog --last 5m',
        { maxBuffer: 10 * 1024 * 1024 }
      );
      
      expect(logs).toContain('Log line');
    });

    test('should get device logs with predicate', async () => {
      const mockLogs = 'Filtered log line 1\nFiltered log line 2';
      
      mockExecAsync.mockResolvedValue({ stdout: mockLogs, stderr: '' });

      const logs = await simulatorManager.getDeviceLogsInstance('test-device', 'process == "MyApp"', '10m');
      
      expect(mockExecAsync).toHaveBeenCalledWith(
        'xcrun simctl spawn "test-device" log show --style syslog --last 10m --predicate \'process == "MyApp"\'',
        { maxBuffer: 10 * 1024 * 1024 }
      );
    });

    test('should handle log retrieval errors', async () => {
      mockExecAsync.mockRejectedValue(new Error('Failed to get logs'));

      await expect(simulatorManager.getDeviceLogsInstance())
        .rejects.toThrow('Failed to get device logs: Failed to get logs');
    });
  });
});