import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { SimulatorLocatorAdapter } from '../../infrastructure/SimulatorLocatorAdapter.js';
import { ICommandExecutor } from '../../../../application/ports/CommandPorts.js';
import { SimulatorState } from '../../domain/SimulatorState.js';

describe('SimulatorLocatorAdapter', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  function createSUT() {
    const mockExecute = jest.fn<ICommandExecutor['execute']>();
    const mockExecutor: ICommandExecutor = {
      execute: mockExecute
    };
    const sut = new SimulatorLocatorAdapter(mockExecutor);
    return { sut, mockExecute };
  }

  function createDeviceListOutput(devices: any = {}) {
    return JSON.stringify({ devices });
  }

  describe('findSimulator', () => {
    describe('finding by UUID', () => {
      it('should find simulator by exact UUID match', async () => {
        // Arrange
        const { sut, mockExecute } = createSUT();
        const deviceList = {
          'com.apple.CoreSimulator.SimRuntime.iOS-17-0': [{
            udid: 'ABC-123-EXACT',
            name: 'iPhone 15',
            state: 'Shutdown',
            isAvailable: true
          }]
        };
        mockExecute.mockResolvedValue({
          stdout: createDeviceListOutput(deviceList),
          stderr: '',
          exitCode: 0
        });

        // Act
        const result = await sut.findSimulator('ABC-123-EXACT');

        // Assert
        expect(result).toEqual({
          id: 'ABC-123-EXACT',
          name: 'iPhone 15',
          state: SimulatorState.Shutdown,
          platform: 'iOS',
          runtime: 'com.apple.CoreSimulator.SimRuntime.iOS-17-0'
        });
      });
    });

    describe('finding by name with multiple matches', () => {
      it('should prefer booted device when multiple devices have same name', async () => {
        // Arrange
        const { sut, mockExecute } = createSUT();
        const deviceList = {
          'com.apple.CoreSimulator.SimRuntime.iOS-16-0': [{
            udid: 'OLD-123',
            name: 'iPhone 15 Pro',
            state: 'Shutdown',
            isAvailable: true
          }],
          'com.apple.CoreSimulator.SimRuntime.iOS-17-0': [{
            udid: 'NEW-456',
            name: 'iPhone 15 Pro',
            state: 'Booted',
            isAvailable: true
          }]
        };
        mockExecute.mockResolvedValue({
          stdout: createDeviceListOutput(deviceList),
          stderr: '',
          exitCode: 0
        });

        // Act
        const result = await sut.findSimulator('iPhone 15 Pro');

        // Assert
        expect(result?.id).toBe('NEW-456'); // Should pick booted one
      });

      it('should prefer newer runtime when multiple shutdown devices have same name', async () => {
        // Arrange
        const { sut, mockExecute } = createSUT();
        const deviceList = {
          'com.apple.CoreSimulator.SimRuntime.iOS-16-4': [{
            udid: 'OLD-123',
            name: 'iPhone 14',
            state: 'Shutdown',
            isAvailable: true
          }],
          'com.apple.CoreSimulator.SimRuntime.iOS-17-2': [{
            udid: 'NEW-456',
            name: 'iPhone 14',
            state: 'Shutdown',
            isAvailable: true
          }],
          'com.apple.CoreSimulator.SimRuntime.iOS-15-0': [{
            udid: 'OLDER-789',
            name: 'iPhone 14',
            state: 'Shutdown',
            isAvailable: true
          }]
        };
        mockExecute.mockResolvedValue({
          stdout: createDeviceListOutput(deviceList),
          stderr: '',
          exitCode: 0
        });

        // Act
        const result = await sut.findSimulator('iPhone 14');

        // Assert
        expect(result?.id).toBe('NEW-456'); // Should pick iOS 17.2
        expect(result?.runtime).toContain('iOS-17-2');
      });
    });

    describe('availability handling', () => {
      it('should skip unavailable devices', async () => {
        // Arrange
        const { sut, mockExecute } = createSUT();
        const deviceList = {
          'com.apple.CoreSimulator.SimRuntime.iOS-17-0': [{
            udid: 'UNAVAIL-123',
            name: 'iPhone 15',
            state: 'Shutdown',
            isAvailable: false
          }]
        };
        mockExecute.mockResolvedValue({
          stdout: createDeviceListOutput(deviceList),
          stderr: '',
          exitCode: 0
        });

        // Act
        const result = await sut.findSimulator('iPhone 15');

        // Assert
        expect(result).toBeNull();
      });
    });

    describe('platform extraction', () => {
      it('should correctly identify iOS platform', async () => {
        // Arrange
        const { sut, mockExecute } = createSUT();
        const deviceList = {
          'com.apple.CoreSimulator.SimRuntime.iOS-17-0': [{
            udid: 'IOS-123',
            name: 'iPhone 15',
            state: 'Shutdown',
            isAvailable: true
          }]
        };
        mockExecute.mockResolvedValue({
          stdout: createDeviceListOutput(deviceList),
          stderr: '',
          exitCode: 0
        });

        // Act
        const result = await sut.findSimulator('IOS-123');

        // Assert
        expect(result?.platform).toBe('iOS');
      });

      it('should correctly identify tvOS platform', async () => {
        // Arrange
        const { sut, mockExecute } = createSUT();
        const deviceList = {
          'com.apple.CoreSimulator.SimRuntime.tvOS-17-0': [{
            udid: 'TV-123',
            name: 'Apple TV',
            state: 'Shutdown',
            isAvailable: true
          }]
        };
        mockExecute.mockResolvedValue({
          stdout: createDeviceListOutput(deviceList),
          stderr: '',
          exitCode: 0
        });

        // Act
        const result = await sut.findSimulator('TV-123');

        // Assert
        expect(result?.platform).toBe('tvOS');
      });

      it('should correctly identify visionOS platform', async () => {
        // Arrange
        const { sut, mockExecute } = createSUT();
        const deviceList = {
          'com.apple.CoreSimulator.SimRuntime.xrOS-1-0': [{
            udid: 'VISION-123',
            name: 'Apple Vision Pro',
            state: 'Shutdown',
            isAvailable: true
          }]
        };
        mockExecute.mockResolvedValue({
          stdout: createDeviceListOutput(deviceList),
          stderr: '',
          exitCode: 0
        });

        // Act
        const result = await sut.findSimulator('VISION-123');

        // Assert
        expect(result?.platform).toBe('visionOS');
      });
    });
  });

  describe('findBootedSimulator', () => {
    describe('with single booted simulator', () => {
      it('should return the booted simulator', async () => {
        // Arrange
        const { sut, mockExecute } = createSUT();
        const deviceList = {
          'com.apple.CoreSimulator.SimRuntime.iOS-17-0': [
            {
              udid: 'SHUT-123',
              name: 'iPhone 15',
              state: 'Shutdown',
              isAvailable: true
            },
            {
              udid: 'BOOT-456',
              name: 'iPhone 14',
              state: 'Booted',
              isAvailable: true
            }
          ]
        };
        mockExecute.mockResolvedValue({
          stdout: createDeviceListOutput(deviceList),
          stderr: '',
          exitCode: 0
        });

        // Act
        const result = await sut.findBootedSimulator();

        // Assert
        expect(result).toEqual({
          id: 'BOOT-456',
          name: 'iPhone 14',
          state: SimulatorState.Booted,
          platform: 'iOS',
          runtime: 'com.apple.CoreSimulator.SimRuntime.iOS-17-0'
        });
      });
    });

    describe('with multiple booted simulators', () => {
      it('should throw error indicating multiple booted simulators', async () => {
        // Arrange
        const { sut, mockExecute } = createSUT();
        const deviceList = {
          'com.apple.CoreSimulator.SimRuntime.iOS-17-0': [
            {
              udid: 'BOOT-1',
              name: 'iPhone 15',
              state: 'Booted',
              isAvailable: true
            },
            {
              udid: 'BOOT-2',
              name: 'iPhone 14',
              state: 'Booted',
              isAvailable: true
            }
          ]
        };
        mockExecute.mockResolvedValue({
          stdout: createDeviceListOutput(deviceList),
          stderr: '',
          exitCode: 0
        });

        // Act & Assert
        await expect(sut.findBootedSimulator())
          .rejects.toThrow('Multiple booted simulators found (2). Please specify a simulator ID.');
      });
    });

    describe('with no booted simulators', () => {
      it('should return null', async () => {
        // Arrange
        const { sut, mockExecute } = createSUT();
        const deviceList = {
          'com.apple.CoreSimulator.SimRuntime.iOS-17-0': [{
            udid: 'SHUT-123',
            name: 'iPhone 15',
            state: 'Shutdown',
            isAvailable: true
          }]
        };
        mockExecute.mockResolvedValue({
          stdout: createDeviceListOutput(deviceList),
          stderr: '',
          exitCode: 0
        });

        // Act
        const result = await sut.findBootedSimulator();

        // Assert
        expect(result).toBeNull();
      });
    });

    describe('with unavailable booted device', () => {
      it('should skip unavailable devices even if booted', async () => {
        // Arrange
        const { sut, mockExecute } = createSUT();
        const deviceList = {
          'com.apple.CoreSimulator.SimRuntime.iOS-17-0': [{
            udid: 'BOOT-123',
            name: 'iPhone 15',
            state: 'Booted',
            isAvailable: false
          }]
        };
        mockExecute.mockResolvedValue({
          stdout: createDeviceListOutput(deviceList),
          stderr: '',
          exitCode: 0
        });

        // Act
        const result = await sut.findBootedSimulator();

        // Assert
        expect(result).toBeNull();
      });
    });
  });
});