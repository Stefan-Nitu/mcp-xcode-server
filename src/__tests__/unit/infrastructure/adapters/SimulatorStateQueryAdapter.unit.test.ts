import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { SimulatorStateQueryAdapter } from '../../../../infrastructure/adapters/SimulatorStateQueryAdapter.js';
import { ICommandExecutor } from '../../../../application/ports/CommandPorts.js';

describe('SimulatorStateQueryAdapter', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  function createSUT() {
    const mockExecute = jest.fn<ICommandExecutor['execute']>();
    const mockExecutor: ICommandExecutor = {
      execute: mockExecute
    };
    const sut = new SimulatorStateQueryAdapter(mockExecutor);
    return { sut, mockExecute };
  }

  function createDeviceListOutput(devices: any = {}) {
    return JSON.stringify({ devices });
  }

  describe('getState', () => {
    it('should return Booted for booted simulator', async () => {
      // Arrange
      const { sut, mockExecute } = createSUT();
      const deviceList = {
        'com.apple.CoreSimulator.SimRuntime.iOS-17-0': [{
          udid: 'ABC-123',
          name: 'iPhone 15',
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
      const result = await sut.getState('ABC-123');

      // Assert
      expect(result).toBe('Booted');
    });

    it('should return Shutdown for shutdown simulator', async () => {
      // Arrange
      const { sut, mockExecute } = createSUT();
      const deviceList = {
        'com.apple.CoreSimulator.SimRuntime.iOS-17-0': [{
          udid: 'ABC-123',
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
      const result = await sut.getState('ABC-123');

      // Assert
      expect(result).toBe('Shutdown');
    });

    it('should return Unknown for other states', async () => {
      // Arrange
      const { sut, mockExecute } = createSUT();
      const deviceList = {
        'com.apple.CoreSimulator.SimRuntime.iOS-17-0': [{
          udid: 'ABC-123',
          name: 'iPhone 15',
          state: 'Creating',
          isAvailable: true
        }]
      };
      mockExecute.mockResolvedValue({
        stdout: createDeviceListOutput(deviceList),
        stderr: '',
        exitCode: 0
      });

      // Act
      const result = await sut.getState('ABC-123');

      // Assert
      expect(result).toBe('Unknown');
    });

    it('should return Unknown for non-existent simulator', async () => {
      // Arrange
      const { sut, mockExecute } = createSUT();
      mockExecute.mockResolvedValue({
        stdout: createDeviceListOutput({}),
        stderr: '',
        exitCode: 0
      });

      // Act
      const result = await sut.getState('non-existent');

      // Assert
      expect(result).toBe('Unknown');
    });

    it('should find device across multiple runtimes', async () => {
      // Arrange
      const { sut, mockExecute } = createSUT();
      const deviceList = {
        'com.apple.CoreSimulator.SimRuntime.iOS-16-0': [{
          udid: 'OTHER-123',
          name: 'iPhone 14',
          state: 'Shutdown',
          isAvailable: true
        }],
        'com.apple.CoreSimulator.SimRuntime.iOS-17-0': [{
          udid: 'TARGET-456',
          name: 'iPhone 15',
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
      const result = await sut.getState('TARGET-456');

      // Assert
      expect(result).toBe('Booted');
    });
  });
});