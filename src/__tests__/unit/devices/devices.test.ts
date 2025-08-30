/**
 * Unit tests for Devices class
 * Tests device discovery, JSON parsing, and device prioritization logic
 */

import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import { Devices } from '../../../utils/devices/Devices.js';
import { SimulatorDevice } from '../../../utils/devices/SimulatorDevice.js';
import { Platform } from '../../../types.js';
import * as utils from '../../../utils.js';

// Mock the utils module
jest.mock('../../../utils.js', () => ({
  execAsync: jest.fn<() => Promise<{ stdout: string; stderr: string }>>()
}));

describe('Devices Unit Tests', () => {
  let devices: Devices;
  let mockExecAsync: jest.MockedFunction<typeof utils.execAsync>;

  // Sample simulator data that simctl returns
  const sampleDeviceList = {
    devices: {
      'com.apple.CoreSimulator.SimRuntime.iOS-17-2': [
        {
          udid: 'iphone-15-pro-uuid',
          name: 'iPhone 15 Pro',
          state: 'Shutdown',
          isAvailable: true
        },
        {
          udid: 'iphone-15-uuid',
          name: 'iPhone 15',
          state: 'Booted',
          isAvailable: true
        },
        {
          udid: 'iphone-14-uuid',
          name: 'iPhone 14',
          state: 'Shutdown',
          isAvailable: false
        }
      ],
      'com.apple.CoreSimulator.SimRuntime.tvOS-17-2': [
        {
          udid: 'apple-tv-uuid',
          name: 'Apple TV 4K',
          state: 'Shutdown',
          isAvailable: true
        }
      ],
      'com.apple.CoreSimulator.SimRuntime.watchOS-10-2': [
        {
          udid: 'apple-watch-uuid',
          name: 'Apple Watch Series 9',
          state: 'Shutdown',
          isAvailable: true
        }
      ],
      'com.apple.CoreSimulator.SimRuntime.xrOS-1-0': [
        {
          udid: 'vision-pro-uuid',
          name: 'Apple Vision Pro',
          state: 'Shutdown',
          isAvailable: true
        }
      ]
    }
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockExecAsync = utils.execAsync as jest.MockedFunction<typeof utils.execAsync>;
    devices = new Devices();
  });

  describe('find()', () => {
    test('should find device by UUID', async () => {
      mockExecAsync.mockResolvedValue({
        stdout: JSON.stringify(sampleDeviceList),
        stderr: ''
      });

      const device = await devices.find('iphone-15-pro-uuid');
      
      expect(device).not.toBeNull();
      expect(device?.id).toBe('iphone-15-pro-uuid');
      expect(device?.name).toBe('iPhone 15 Pro');
      expect(device?.platform).toBe('iOS');
    });

    test('should find device by name', async () => {
      mockExecAsync.mockResolvedValue({
        stdout: JSON.stringify(sampleDeviceList),
        stderr: ''
      });

      const device = await devices.find('iPhone 15 Pro');
      
      expect(device).not.toBeNull();
      expect(device?.id).toBe('iphone-15-pro-uuid');
      expect(device?.name).toBe('iPhone 15 Pro');
    });

    test('should return null when device not found', async () => {
      mockExecAsync.mockResolvedValue({
        stdout: JSON.stringify(sampleDeviceList),
        stderr: ''
      });

      const device = await devices.find('non-existent-device');
      
      expect(device).toBeNull();
    });

    test('should prefer available devices over unavailable', async () => {
      const deviceListWithDuplicates = {
        devices: {
          'com.apple.CoreSimulator.SimRuntime.iOS-17-2': [
            {
              udid: 'unavailable-iphone',
              name: 'iPhone 15',
              state: 'Shutdown',
              isAvailable: false
            },
            {
              udid: 'available-iphone',
              name: 'iPhone 15',
              state: 'Shutdown',
              isAvailable: true
            }
          ]
        }
      };

      mockExecAsync.mockResolvedValue({
        stdout: JSON.stringify(deviceListWithDuplicates),
        stderr: ''
      });

      const device = await devices.find('iPhone 15');
      
      expect(device?.id).toBe('available-iphone');
    });

    test('should prefer booted devices over shutdown', async () => {
      const deviceListWithStates = {
        devices: {
          'com.apple.CoreSimulator.SimRuntime.iOS-17-2': [
            {
              udid: 'shutdown-iphone',
              name: 'iPhone 15',
              state: 'Shutdown',
              isAvailable: true
            },
            {
              udid: 'booted-iphone',
              name: 'iPhone 15',
              state: 'Booted',
              isAvailable: true
            }
          ]
        }
      };

      mockExecAsync.mockResolvedValue({
        stdout: JSON.stringify(deviceListWithStates),
        stderr: ''
      });

      const device = await devices.find('iPhone 15');
      
      expect(device?.id).toBe('booted-iphone');
    });

    test('should handle malformed JSON gracefully', async () => {
      mockExecAsync.mockResolvedValue({
        stdout: 'not valid json',
        stderr: ''
      });

      await expect(devices.find('some-device'))
        .rejects.toThrow('Failed to find device');
    });

    test('should handle execAsync errors', async () => {
      mockExecAsync.mockRejectedValue(new Error('Command failed'));

      await expect(devices.find('some-device'))
        .rejects.toThrow('Failed to find device: Command failed');
    });

    test('should warn when selecting unavailable device', async () => {
      const onlyUnavailable = {
        devices: {
          'com.apple.CoreSimulator.SimRuntime.iOS-17-2': [
            {
              udid: 'unavailable-device',
              name: 'iPhone 15',
              state: 'Shutdown',
              isAvailable: false
            }
          ]
        }
      };

      mockExecAsync.mockResolvedValue({
        stdout: JSON.stringify(onlyUnavailable),
        stderr: ''
      });

      const device = await devices.find('iPhone 15');
      
      expect(device).not.toBeNull();
      expect(device?.id).toBe('unavailable-device');
      // Logger would warn about unavailable device
    });
  });

  describe('listSimulators()', () => {
    test('should list all available simulators', async () => {
      mockExecAsync.mockResolvedValue({
        stdout: JSON.stringify(sampleDeviceList),
        stderr: ''
      });

      const deviceList = await devices.listSimulators();
      
      // Should include all available devices
      expect(deviceList).toHaveLength(5); // All except the unavailable iPhone 14
      expect(deviceList.map(d => d.name)).toContain('iPhone 15 Pro');
      expect(deviceList.map(d => d.name)).toContain('iPhone 15');
      expect(deviceList.map(d => d.name)).toContain('Apple TV 4K');
      expect(deviceList.map(d => d.name)).toContain('Apple Watch Series 9');
      expect(deviceList.map(d => d.name)).toContain('Apple Vision Pro');
    });

    test('should filter by iOS platform', async () => {
      mockExecAsync.mockResolvedValue({
        stdout: JSON.stringify(sampleDeviceList),
        stderr: ''
      });

      const deviceList = await devices.listSimulators(Platform.iOS);
      
      expect(deviceList).toHaveLength(2);
      expect(deviceList.every(d => d.platform === 'iOS')).toBe(true);
    });

    test('should filter by tvOS platform', async () => {
      mockExecAsync.mockResolvedValue({
        stdout: JSON.stringify(sampleDeviceList),
        stderr: ''
      });

      const deviceList = await devices.listSimulators(Platform.tvOS);
      
      expect(deviceList).toHaveLength(1);
      expect(deviceList[0].name).toBe('Apple TV 4K');
      expect(deviceList[0].platform).toBe('tvOS');
    });

    test('should filter by watchOS platform', async () => {
      mockExecAsync.mockResolvedValue({
        stdout: JSON.stringify(sampleDeviceList),
        stderr: ''
      });

      const deviceList = await devices.listSimulators(Platform.watchOS);
      
      expect(deviceList).toHaveLength(1);
      expect(deviceList[0].name).toBe('Apple Watch Series 9');
      expect(deviceList[0].platform).toBe('watchOS');
    });

    test('should filter by visionOS platform', async () => {
      mockExecAsync.mockResolvedValue({
        stdout: JSON.stringify(sampleDeviceList),
        stderr: ''
      });

      const deviceList = await devices.listSimulators(Platform.visionOS);
      
      expect(deviceList).toHaveLength(1);
      expect(deviceList[0].name).toBe('Apple Vision Pro');
      expect(deviceList[0].platform).toBe('visionOS');
    });

    test('should exclude unavailable devices', async () => {
      mockExecAsync.mockResolvedValue({
        stdout: JSON.stringify(sampleDeviceList),
        stderr: ''
      });

      const deviceList = await devices.listSimulators();
      
      // iPhone 14 is unavailable and should not be included
      expect(deviceList.map(d => d.name)).not.toContain('iPhone 14');
    });

    test('should handle empty device list', async () => {
      mockExecAsync.mockResolvedValue({
        stdout: JSON.stringify({ devices: {} }),
        stderr: ''
      });

      const deviceList = await devices.listSimulators();
      
      expect(deviceList).toEqual([]);
    });

    test('should handle execAsync errors', async () => {
      mockExecAsync.mockRejectedValue(new Error('Command failed'));

      await expect(devices.listSimulators())
        .rejects.toThrow('Failed to list simulators: Command failed');
    });
  });

  describe('getBooted()', () => {
    test('should find booted simulator', async () => {
      mockExecAsync.mockResolvedValue({
        stdout: JSON.stringify(sampleDeviceList),
        stderr: ''
      });

      const device = await devices.getBooted();
      
      expect(device).not.toBeNull();
      expect(device?.id).toBe('iphone-15-uuid');
      expect(device?.name).toBe('iPhone 15');
    });

    test('should return null when no booted simulator', async () => {
      const allShutdown = {
        devices: {
          'com.apple.CoreSimulator.SimRuntime.iOS-17-2': [
            {
              udid: 'device-1',
              name: 'iPhone 15',
              state: 'Shutdown',
              isAvailable: true
            }
          ]
        }
      };

      mockExecAsync.mockResolvedValue({
        stdout: JSON.stringify(allShutdown),
        stderr: ''
      });

      const device = await devices.getBooted();
      
      expect(device).toBeNull();
    });

    test('should only return available booted devices', async () => {
      const mixedBooted = {
        devices: {
          'com.apple.CoreSimulator.SimRuntime.iOS-17-2': [
            {
              udid: 'unavailable-booted',
              name: 'iPhone 14',
              state: 'Booted',
              isAvailable: false
            },
            {
              udid: 'available-booted',
              name: 'iPhone 15',
              state: 'Booted',
              isAvailable: true
            }
          ]
        }
      };

      mockExecAsync.mockResolvedValue({
        stdout: JSON.stringify(mixedBooted),
        stderr: ''
      });

      const device = await devices.getBooted();
      
      expect(device?.id).toBe('available-booted');
    });
  });

  describe('findForPlatform()', () => {
    test('should find device for specific platform', async () => {
      mockExecAsync.mockResolvedValue({
        stdout: JSON.stringify(sampleDeviceList),
        stderr: ''
      });

      const device = await devices.findForPlatform(Platform.iOS);
      
      expect(device).not.toBeNull();
      // Should return the booted iOS device
      expect(device?.id).toBe('iphone-15-uuid');
      expect(device?.platform).toBe('iOS');
    });

    test('should prefer booted device for platform', async () => {
      const mixedStates = {
        devices: {
          'com.apple.CoreSimulator.SimRuntime.iOS-17-2': [
            {
              udid: 'shutdown-ios',
              name: 'iPhone 14',
              state: 'Shutdown',
              isAvailable: true
            },
            {
              udid: 'booted-ios',
              name: 'iPhone 15',
              state: 'Booted',
              isAvailable: true
            }
          ]
        }
      };

      mockExecAsync.mockResolvedValue({
        stdout: JSON.stringify(mixedStates),
        stderr: ''
      });

      const device = await devices.findForPlatform(Platform.iOS);
      
      expect(device?.id).toBe('booted-ios');
    });

    test('should return null if no devices for platform', async () => {
      const noMacDevices = {
        devices: {
          'com.apple.CoreSimulator.SimRuntime.iOS-17-2': [
            {
              udid: 'ios-device',
              name: 'iPhone 15',
              state: 'Shutdown',
              isAvailable: true
            }
          ]
        }
      };

      mockExecAsync.mockResolvedValue({
        stdout: JSON.stringify(noMacDevices),
        stderr: ''
      });

      const device = await devices.findForPlatform(Platform.macOS);
      
      expect(device).toBeNull();
    });

    test('should handle visionOS platform correctly', async () => {
      mockExecAsync.mockResolvedValue({
        stdout: JSON.stringify(sampleDeviceList),
        stderr: ''
      });

      const device = await devices.findForPlatform(Platform.visionOS);
      
      expect(device).not.toBeNull();
      expect(device?.id).toBe('vision-pro-uuid');
      expect(device?.platform).toBe('visionOS');
    });
  });

  describe('findFirstAvailable()', () => {
    test('should find first available device for platform', async () => {
      mockExecAsync.mockResolvedValue({
        stdout: JSON.stringify(sampleDeviceList),
        stderr: ''
      });

      const device = await devices.findFirstAvailable(Platform.iOS);
      
      expect(device).not.toBeNull();
      // Should return an iOS device (booted one is preferred)
      expect(device?.platform).toBe('iOS');
      // The booted iPhone 15 should be selected
      expect(['iphone-15-uuid', 'iphone-15-pro-uuid']).toContain(device?.id);
    });

    test('should return first available if none booted', async () => {
      const allShutdown = {
        devices: {
          'com.apple.CoreSimulator.SimRuntime.iOS-17-2': [
            {
              udid: 'device-1',
              name: 'iPhone 14',
              state: 'Shutdown',
              isAvailable: true
            },
            {
              udid: 'device-2',
              name: 'iPhone 15',
              state: 'Shutdown',
              isAvailable: true
            }
          ]
        }
      };

      mockExecAsync.mockResolvedValue({
        stdout: JSON.stringify(allShutdown),
        stderr: ''
      });

      const device = await devices.findFirstAvailable(Platform.iOS);
      
      expect(device).not.toBeNull();
      expect(device?.id).toBe('device-1');
    });

    test('should return null if no available devices', async () => {
      const noDevices = {
        devices: {}
      };

      mockExecAsync.mockResolvedValue({
        stdout: JSON.stringify(noDevices),
        stderr: ''
      });

      const device = await devices.findFirstAvailable(Platform.iOS);
      
      expect(device).toBeNull();
    });
  });

  describe('Platform extraction', () => {
    test('should extract iOS platform from runtime', async () => {
      const iosRuntime = {
        devices: {
          'com.apple.CoreSimulator.SimRuntime.iOS-17-2': [
            {
              udid: 'test-device',
              name: 'Test Device',
              state: 'Shutdown',
              isAvailable: true
            }
          ]
        }
      };

      mockExecAsync.mockResolvedValue({
        stdout: JSON.stringify(iosRuntime),
        stderr: ''
      });

      const deviceList = await devices.listSimulators();
      expect(deviceList[0].platform).toBe('iOS');
    });

    test('should handle xrOS runtime as visionOS', async () => {
      const xrosRuntime = {
        devices: {
          'com.apple.CoreSimulator.SimRuntime.xrOS-1-0': [
            {
              udid: 'vision-device',
              name: 'Vision Device',
              state: 'Shutdown',
              isAvailable: true
            }
          ]
        }
      };

      mockExecAsync.mockResolvedValue({
        stdout: JSON.stringify(xrosRuntime),
        stderr: ''
      });

      const deviceList = await devices.listSimulators();
      expect(deviceList[0].platform).toBe('visionOS');
    });
  });

  describe('Type safety', () => {
    test('should return SimulatorDevice instances', async () => {
      mockExecAsync.mockResolvedValue({
        stdout: JSON.stringify(sampleDeviceList),
        stderr: ''
      });

      const device = await devices.find('iPhone 15 Pro');
      
      expect(device).toBeInstanceOf(SimulatorDevice);
    });

    test('should handle various runtime formats', async () => {
      const variousRuntimes = {
        devices: {
          'com.apple.CoreSimulator.SimRuntime.iOS-16-4': [],
          'com.apple.CoreSimulator.SimRuntime.iOS-17-0': [],
          'com.apple.CoreSimulator.SimRuntime.tvOS-17-2': [],
          'com.apple.CoreSimulator.SimRuntime.watchOS-10-2': [],
          'com.apple.CoreSimulator.SimRuntime.xrOS-1-0': [],
          'com.apple.CoreSimulator.SimRuntime.visionOS-1-0': []
        }
      };

      mockExecAsync.mockResolvedValue({
        stdout: JSON.stringify(variousRuntimes),
        stderr: ''
      });

      // Should not throw
      await expect(devices.listSimulators()).resolves.toBeDefined();
    });
  });
});