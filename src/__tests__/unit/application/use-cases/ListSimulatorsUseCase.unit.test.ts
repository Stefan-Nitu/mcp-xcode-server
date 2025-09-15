import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { ListSimulatorsUseCase } from '../../../../application/use-cases/ListSimulatorsUseCase.js';
import { DeviceRepository } from '../../../../infrastructure/repositories/DeviceRepository.js';
import { ListSimulatorsRequest } from '../../../../domain/value-objects/ListSimulatorsRequest.js';
import { Platform } from '../../../../domain/value-objects/Platform.js';
import { SimulatorState } from '../../../../domain/value-objects/SimulatorState.js';

describe('ListSimulatorsUseCase', () => {
  let mockDeviceRepository: jest.Mocked<DeviceRepository>;
  let sut: ListSimulatorsUseCase;

  beforeEach(() => {
    mockDeviceRepository = {
      getAllDevices: jest.fn()
    } as any;

    sut = new ListSimulatorsUseCase(mockDeviceRepository);
  });

  describe('execute', () => {
    it('should return all available simulators when no filters', async () => {
      // Arrange
      mockDeviceRepository.getAllDevices.mockResolvedValue({
        'com.apple.CoreSimulator.SimRuntime.iOS-17-0': [
          {
            udid: 'ABC123',
            name: 'iPhone 15',
            state: 'Booted',
            isAvailable: true
          },
          {
            udid: 'DEF456',
            name: 'iPad Pro',
            state: 'Shutdown',
            isAvailable: true
          },
          {
            udid: 'NOTAVAIL',
            name: 'Old iPhone',
            state: 'Shutdown',
            isAvailable: false
          }
        ]
      });

      const request = ListSimulatorsRequest.create();

      // Act
      const result = await sut.execute(request);

      // Assert
      expect(result.isSuccess).toBe(true);
      expect(result.count).toBe(2); // Only available devices
      expect(result.simulators).toHaveLength(2);
      expect(result.simulators[0]).toMatchObject({
        udid: 'ABC123',
        name: 'iPhone 15',
        state: SimulatorState.Booted,
        platform: 'iOS',
        runtime: 'iOS 17.0'
      });
    });

    it('should filter by platform', async () => {
      // Arrange
      mockDeviceRepository.getAllDevices.mockResolvedValue({
        'com.apple.CoreSimulator.SimRuntime.iOS-17-0': [
          {
            udid: 'IOS1',
            name: 'iPhone 15',
            state: 'Booted',
            isAvailable: true
          }
        ],
        'com.apple.CoreSimulator.SimRuntime.tvOS-17-0': [
          {
            udid: 'TV1',
            name: 'Apple TV',
            state: 'Shutdown',
            isAvailable: true
          }
        ]
      });

      const request = ListSimulatorsRequest.create(Platform.iOS);

      // Act
      const result = await sut.execute(request);

      // Assert
      expect(result.isSuccess).toBe(true);
      expect(result.count).toBe(1);
      expect(result.simulators[0].udid).toBe('IOS1');
    });

    it('should filter by state', async () => {
      // Arrange
      mockDeviceRepository.getAllDevices.mockResolvedValue({
        'com.apple.CoreSimulator.SimRuntime.iOS-17-0': [
          {
            udid: 'BOOTED1',
            name: 'iPhone 15',
            state: 'Booted',
            isAvailable: true
          },
          {
            udid: 'SHUTDOWN1',
            name: 'iPad Pro',
            state: 'Shutdown',
            isAvailable: true
          }
        ]
      });

      const request = ListSimulatorsRequest.create(undefined, SimulatorState.Booted);

      // Act
      const result = await sut.execute(request);

      // Assert
      expect(result.isSuccess).toBe(true);
      expect(result.count).toBe(1);
      expect(result.simulators[0].udid).toBe('BOOTED1');
    });

    it('should handle watchOS platform detection', async () => {
      // Arrange
      mockDeviceRepository.getAllDevices.mockResolvedValue({
        'com.apple.CoreSimulator.SimRuntime.watchOS-10-0': [
          {
            udid: 'WATCH1',
            name: 'Apple Watch Series 9',
            state: 'Shutdown',
            isAvailable: true
          }
        ]
      });

      const request = ListSimulatorsRequest.create();

      // Act
      const result = await sut.execute(request);

      // Assert
      expect(result.isSuccess).toBe(true);
      expect(result.simulators[0].platform).toBe('watchOS');
      expect(result.simulators[0].runtime).toBe('watchOS 10.0');
    });

    it('should handle visionOS platform detection', async () => {
      // Arrange
      mockDeviceRepository.getAllDevices.mockResolvedValue({
        'com.apple.CoreSimulator.SimRuntime.visionOS-1-0': [
          {
            udid: 'VISION1',
            name: 'Apple Vision Pro',
            state: 'Shutdown',
            isAvailable: true
          }
        ]
      });

      const request = ListSimulatorsRequest.create();

      // Act
      const result = await sut.execute(request);

      // Assert
      expect(result.isSuccess).toBe(true);
      expect(result.simulators[0].platform).toBe('visionOS');
      expect(result.simulators[0].runtime).toBe('visionOS 1.0');
    });

    it('should handle xrOS platform detection (legacy name for visionOS)', async () => {
      // Arrange
      mockDeviceRepository.getAllDevices.mockResolvedValue({
        'com.apple.CoreSimulator.SimRuntime.xrOS-1-0': [
          {
            udid: 'XR1',
            name: 'Apple Vision Pro',
            state: 'Shutdown',
            isAvailable: true
          }
        ]
      });

      const request = ListSimulatorsRequest.create();

      // Act
      const result = await sut.execute(request);

      // Assert
      expect(result.isSuccess).toBe(true);
      expect(result.simulators[0].platform).toBe('visionOS');
      expect(result.simulators[0].runtime).toBe('visionOS 1.0');
    });

    it('should handle macOS platform detection', async () => {
      // Arrange
      mockDeviceRepository.getAllDevices.mockResolvedValue({
        'com.apple.CoreSimulator.SimRuntime.macOS-14-0': [
          {
            udid: 'MAC1',
            name: 'Mac',
            state: 'Shutdown',
            isAvailable: true
          }
        ]
      });

      const request = ListSimulatorsRequest.create();

      // Act
      const result = await sut.execute(request);

      // Assert
      expect(result.isSuccess).toBe(true);
      expect(result.simulators[0].platform).toBe('macOS');
      expect(result.simulators[0].runtime).toBe('macOS 14.0');
    });

    it('should handle unknown platform', async () => {
      // Arrange
      mockDeviceRepository.getAllDevices.mockResolvedValue({
        'com.apple.CoreSimulator.SimRuntime.unknown-1-0': [
          {
            udid: 'UNKNOWN1',
            name: 'Unknown Device',
            state: 'Shutdown',
            isAvailable: true
          }
        ]
      });

      const request = ListSimulatorsRequest.create();

      // Act
      const result = await sut.execute(request);

      // Assert
      expect(result.isSuccess).toBe(true);
      expect(result.simulators[0].platform).toBe('Unknown');
      expect(result.simulators[0].runtime).toBe('Unknown 1.0');
    });

    it('should handle Booting state', async () => {
      // Arrange
      mockDeviceRepository.getAllDevices.mockResolvedValue({
        'com.apple.CoreSimulator.SimRuntime.iOS-17-0': [
          {
            udid: 'BOOT1',
            name: 'iPhone 15',
            state: 'Booting',
            isAvailable: true
          }
        ]
      });

      const request = ListSimulatorsRequest.create();

      // Act
      const result = await sut.execute(request);

      // Assert
      expect(result.isSuccess).toBe(true);
      expect(result.simulators[0].state).toBe(SimulatorState.Booting);
    });

    it('should handle Shutting Down state', async () => {
      // Arrange
      mockDeviceRepository.getAllDevices.mockResolvedValue({
        'com.apple.CoreSimulator.SimRuntime.iOS-17-0': [
          {
            udid: 'SHUTTING1',
            name: 'iPhone 15',
            state: 'Shutting Down',
            isAvailable: true
          }
        ]
      });

      const request = ListSimulatorsRequest.create();

      // Act
      const result = await sut.execute(request);

      // Assert
      expect(result.isSuccess).toBe(true);
      expect(result.simulators[0].state).toBe(SimulatorState.ShuttingDown);
    });

    it('should handle unknown device state by throwing error', async () => {
      // Arrange
      mockDeviceRepository.getAllDevices.mockResolvedValue({
        'com.apple.CoreSimulator.SimRuntime.iOS-17-0': [
          {
            udid: 'WEIRD1',
            name: 'iPhone 15',
            state: 'WeirdState',
            isAvailable: true
          }
        ]
      });

      const request = ListSimulatorsRequest.create();

      // Act
      const result = await sut.execute(request);

      // Assert - should fail with error about unrecognized state
      expect(result.isSuccess).toBe(false);
      expect(result.error?.message).toContain('Invalid simulator state: WeirdState');
    });

    it('should handle runtime without version number', async () => {
      // Arrange
      mockDeviceRepository.getAllDevices.mockResolvedValue({
        'com.apple.CoreSimulator.SimRuntime.iOS': [
          {
            udid: 'NOVERSION1',
            name: 'iPhone',
            state: 'Shutdown',
            isAvailable: true
          }
        ]
      });

      const request = ListSimulatorsRequest.create();

      // Act
      const result = await sut.execute(request);

      // Assert
      expect(result.isSuccess).toBe(true);
      expect(result.simulators[0].runtime).toBe('iOS Unknown');
    });

    it('should handle repository errors', async () => {
      // Arrange
      const error = new Error('Repository failed');
      mockDeviceRepository.getAllDevices.mockRejectedValue(error);

      const request = ListSimulatorsRequest.create();

      // Act
      const result = await sut.execute(request);

      // Assert
      expect(result.isSuccess).toBe(false);
      expect(result.error).toBe(error);
    });

    it('should return empty list when no simulators available', async () => {
      // Arrange
      mockDeviceRepository.getAllDevices.mockResolvedValue({});

      const request = ListSimulatorsRequest.create();

      // Act
      const result = await sut.execute(request);

      // Assert
      expect(result.isSuccess).toBe(true);
      expect(result.count).toBe(0);
      expect(result.simulators).toHaveLength(0);
    });
  });
});