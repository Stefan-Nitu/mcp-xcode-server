import { describe, it, expect, jest } from '@jest/globals';
import { DeviceRepository, DeviceList } from '../../repositories/DeviceRepository.js';
import { ICommandExecutor } from '../../../application/ports/CommandPorts.js';

describe('DeviceRepository', () => {
  function createSUT() {
    const mockExecute = jest.fn<ICommandExecutor['execute']>();
    const mockExecutor: ICommandExecutor = { execute: mockExecute };
    const sut = new DeviceRepository(mockExecutor);
    return { sut, mockExecute };
  }

  describe('getAllDevices', () => {
    it('should return parsed device list from xcrun simctl', async () => {
      // Arrange
      const { sut, mockExecute } = createSUT();

      const mockDevices: DeviceList = {
        'com.apple.CoreSimulator.SimRuntime.iOS-17-0': [
          {
            udid: 'test-uuid-1',
            name: 'iPhone 15',
            state: 'Booted',
            isAvailable: true,
            deviceTypeIdentifier: 'com.apple.iPhone15'
          }
        ],
        'com.apple.CoreSimulator.SimRuntime.iOS-16-4': [
          {
            udid: 'test-uuid-2',
            name: 'iPhone 14',
            state: 'Shutdown',
            isAvailable: true
          }
        ]
      };

      mockExecute.mockResolvedValue({
        stdout: JSON.stringify({ devices: mockDevices }),
        stderr: '',
        exitCode: 0
      });

      // Act
      const result = await sut.getAllDevices();

      // Assert
      expect(mockExecute).toHaveBeenCalledWith('xcrun simctl list devices --json');
      expect(result).toEqual(mockDevices);
    });

    it('should handle empty device list', async () => {
      // Arrange
      const { sut, mockExecute } = createSUT();
      const emptyDevices: DeviceList = {};

      mockExecute.mockResolvedValue({
        stdout: JSON.stringify({ devices: emptyDevices }),
        stderr: '',
        exitCode: 0
      });

      // Act
      const result = await sut.getAllDevices();

      // Assert
      expect(result).toEqual(emptyDevices);
    });

    it('should propagate executor errors', async () => {
      // Arrange
      const { sut, mockExecute } = createSUT();
      const error = new Error('Command failed');
      mockExecute.mockRejectedValue(error);

      // Act & Assert
      await expect(sut.getAllDevices()).rejects.toThrow('Command failed');
    });

    it('should throw on invalid JSON response', async () => {
      // Arrange
      const { sut, mockExecute } = createSUT();
      mockExecute.mockResolvedValue({
        stdout: 'not valid json',
        stderr: '',
        exitCode: 0
      });

      // Act & Assert
      await expect(sut.getAllDevices()).rejects.toThrow();
    });

    it('should handle devices with all optional fields', async () => {
      // Arrange
      const { sut, mockExecute } = createSUT();

      const deviceWithAllFields: DeviceList = {
        'com.apple.CoreSimulator.SimRuntime.iOS-17-0': [
          {
            udid: 'full-uuid',
            name: 'iPhone 15 Pro',
            state: 'Booted',
            isAvailable: true,
            deviceTypeIdentifier: 'com.apple.iPhone15Pro',
            dataPath: '/path/to/data',
            dataPathSize: 1024000,
            logPath: '/path/to/logs'
          }
        ]
      };

      mockExecute.mockResolvedValue({
        stdout: JSON.stringify({ devices: deviceWithAllFields }),
        stderr: '',
        exitCode: 0
      });

      // Act
      const result = await sut.getAllDevices();

      // Assert
      expect(result).toEqual(deviceWithAllFields);
      const device = result['com.apple.CoreSimulator.SimRuntime.iOS-17-0'][0];
      expect(device.dataPath).toBe('/path/to/data');
      expect(device.dataPathSize).toBe(1024000);
      expect(device.logPath).toBe('/path/to/logs');
    });
  });
});