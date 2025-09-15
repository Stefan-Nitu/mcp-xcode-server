import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { ListSimulatorsController } from '../../../../presentation/controllers/ListSimulatorsController.js';
import { ListSimulatorsUseCase } from '../../../../application/use-cases/ListSimulatorsUseCase.js';
import { DeviceRepository } from '../../../../infrastructure/repositories/DeviceRepository.js';
import { ShellCommandExecutorAdapter } from '../../../../infrastructure/adapters/ShellCommandExecutorAdapter.js';
import { SimulatorState } from '../../../../domain/value-objects/SimulatorState.js';
import { exec } from 'child_process';
import { promisify } from 'util';

const mockExec = jest.fn<(command: string) => Promise<{ stdout: string; stderr: string }>>();
jest.mock('child_process', () => ({
  exec: jest.fn((cmd: string, callback: any) => {
    mockExec(cmd)
      .then(result => callback(null, result.stdout, result.stderr))
      .catch(error => callback(error));
  })
}));

describe('ListSimulatorsController Integration', () => {
  let controller: ListSimulatorsController;

  beforeEach(() => {
    jest.clearAllMocks();

    const execAsync = promisify(exec);
    const executor = new ShellCommandExecutorAdapter(execAsync);
    const repository = new DeviceRepository(executor);
    const useCase = new ListSimulatorsUseCase(repository);
    controller = new ListSimulatorsController(useCase);
  });

  describe('with mocked shell commands', () => {
    it('should list all simulators', async () => {
      // Arrange
      const mockDeviceList = {
        devices: {
          'com.apple.CoreSimulator.SimRuntime.iOS-17-0': [
            {
              dataPath: '/path/to/data',
              dataPathSize: 1000000,
              logPath: '/path/to/logs',
              udid: 'ABC123',
              isAvailable: true,
              deviceTypeIdentifier: 'com.apple.iPhone15',
              state: 'Booted',
              name: 'iPhone 15'
            },
            {
              dataPath: '/path/to/data2',
              dataPathSize: 2000000,
              logPath: '/path/to/logs2',
              udid: 'DEF456',
              isAvailable: true,
              deviceTypeIdentifier: 'com.apple.iPadPro',
              state: 'Shutdown',
              name: 'iPad Pro'
            }
          ],
          'com.apple.CoreSimulator.SimRuntime.tvOS-17-0': [
            {
              dataPath: '/path/to/data3',
              dataPathSize: 3000000,
              logPath: '/path/to/logs3',
              udid: 'GHI789',
              isAvailable: true,
              deviceTypeIdentifier: 'com.apple.AppleTV',
              state: 'Shutdown',
              name: 'Apple TV'
            }
          ]
        }
      };

      mockExec.mockResolvedValue({
        stdout: JSON.stringify(mockDeviceList),
        stderr: ''
      });

      // Act
      const result = await controller.execute({});

      // Assert
      expect(mockExec).toHaveBeenCalledWith('xcrun simctl list devices --json');
      expect(result.content[0].text).toContain('Found 3 simulators');
      expect(result.content[0].text).toContain('iPhone 15');
      expect(result.content[0].text).toContain('iPad Pro');
      expect(result.content[0].text).toContain('Apple TV');
    });

    it('should filter by iOS platform', async () => {
      // Arrange
      const mockDeviceList = {
        devices: {
          'com.apple.CoreSimulator.SimRuntime.iOS-17-0': [
            {
              udid: 'ABC123',
              isAvailable: true,
              state: 'Booted',
              name: 'iPhone 15'
            }
          ],
          'com.apple.CoreSimulator.SimRuntime.tvOS-17-0': [
            {
              udid: 'GHI789',
              isAvailable: true,
              state: 'Shutdown',
              name: 'Apple TV'
            }
          ]
        }
      };

      mockExec.mockResolvedValue({
        stdout: JSON.stringify(mockDeviceList),
        stderr: ''
      });

      // Act
      const result = await controller.execute({ platform: 'iOS' });

      // Assert
      expect(result.content[0].text).toContain('Found 1 simulator');
      expect(result.content[0].text).toContain('iPhone 15');
      expect(result.content[0].text).not.toContain('Apple TV');
    });

    it('should filter by booted state', async () => {
      // Arrange
      const mockDeviceList = {
        devices: {
          'com.apple.CoreSimulator.SimRuntime.iOS-17-0': [
            {
              udid: 'ABC123',
              isAvailable: true,
              state: 'Booted',
              name: 'iPhone 15'
            },
            {
              udid: 'DEF456',
              isAvailable: true,
              state: 'Shutdown',
              name: 'iPad Pro'
            }
          ]
        }
      };

      mockExec.mockResolvedValue({
        stdout: JSON.stringify(mockDeviceList),
        stderr: ''
      });

      // Act
      const result = await controller.execute({ state: 'Booted' });

      // Assert
      expect(result.content[0].text).toContain('Found 1 simulator');
      expect(result.content[0].text).toContain('iPhone 15');
      expect(result.content[0].text).not.toContain('iPad Pro');
    });

    it('should handle command failure', async () => {
      // Arrange
      mockExec.mockRejectedValue(new Error('xcrun not found'));

      // Act
      const result = await controller.execute({});

      // Assert
      expect(result.content[0].text).toContain('❌');
      expect(result.content[0].text).toContain('xcrun not found');
    });

    it('should handle empty device list', async () => {
      // Arrange
      mockExec.mockResolvedValue({
        stdout: JSON.stringify({ devices: {} }),
        stderr: ''
      });

      // Act
      const result = await controller.execute({});

      // Assert
      expect(result.content[0].text).toBe('⚠️ No simulators found');
    });

    it('should filter by multiple criteria', async () => {
      // Arrange
      const mockDeviceList = {
        devices: {
          'com.apple.CoreSimulator.SimRuntime.iOS-17-0': [
            {
              udid: 'ABC123',
              isAvailable: true,
              state: 'Booted',
              name: 'iPhone 15'
            },
            {
              udid: 'DEF456',
              isAvailable: true,
              state: 'Shutdown',
              name: 'iPad Pro'
            }
          ],
          'com.apple.CoreSimulator.SimRuntime.tvOS-17-0': [
            {
              udid: 'GHI789',
              isAvailable: true,
              state: 'Booted',
              name: 'Apple TV'
            }
          ]
        }
      };

      mockExec.mockResolvedValue({
        stdout: JSON.stringify(mockDeviceList),
        stderr: ''
      });

      // Act
      const result = await controller.execute({
        platform: 'iOS',
        state: 'Booted'
      });

      // Assert
      expect(result.content[0].text).toContain('Found 1 simulator');
      expect(result.content[0].text).toContain('iPhone 15');
      expect(result.content[0].text).not.toContain('iPad Pro');
      expect(result.content[0].text).not.toContain('Apple TV');
    });

    it('should handle malformed JSON response', async () => {
      // Arrange
      mockExec.mockResolvedValue({
        stdout: 'not valid json',
        stderr: ''
      });

      // Act
      const result = await controller.execute({});

      // Assert
      expect(result.content[0].text).toContain('❌');
    });

    it('should validate platform parameter', async () => {
      // Act & Assert
      await expect(controller.execute({
        platform: 'Android'
      })).rejects.toThrow();
    });

    it('should validate state parameter', async () => {
      // Act & Assert
      await expect(controller.execute({
        state: 'Running'
      })).rejects.toThrow();
    });
  });
});