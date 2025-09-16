import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { MCPController } from '../../../../presentation/interfaces/MCPController.js';
import { ListSimulatorsControllerFactory } from '../../factories/ListSimulatorsControllerFactory.js';
import { SimulatorState } from '../../domain/SimulatorState.js';
import { exec } from 'child_process';
import type { NodeExecError } from '../../../../__tests__/utils/types/execTypes.js';

// Mock ONLY external boundaries
jest.mock('child_process');

// Mock promisify to return {stdout, stderr} for exec (as node's promisify does)
jest.mock('util', () => {
  const actualUtil = jest.requireActual('util') as typeof import('util');
  const { createPromisifiedExec } = require('../../../../__tests__/utils/mocks/promisifyExec');

  return {
    ...actualUtil,
    promisify: (fn: Function) =>
      fn?.name === 'exec' ? createPromisifiedExec(fn) : actualUtil.promisify(fn)
  };
});

// Mock DependencyChecker to always report dependencies are available in tests
jest.mock('../../../../infrastructure/services/DependencyChecker', () => ({
  DependencyChecker: jest.fn().mockImplementation(() => ({
    check: jest.fn<() => Promise<[]>>().mockResolvedValue([]) // No missing dependencies
  }))
}));

const mockExec = exec as jest.MockedFunction<typeof exec>;

describe('ListSimulatorsController Integration', () => {
  let controller: MCPController;
  let execCallIndex: number;
  let execMockResponses: Array<{ stdout: string; stderr: string; error?: NodeExecError }>;

  beforeEach(() => {
    jest.clearAllMocks();
    execCallIndex = 0;
    execMockResponses = [];

    // Setup exec mock to return responses sequentially
    mockExec.mockImplementation(((
      _cmd: string,
      _options: any,
      callback: (error: Error | null, stdout: string, stderr: string) => void
    ) => {
      const response = execMockResponses[execCallIndex++] || { stdout: '', stderr: '' };
      if (response.error) {
        callback(response.error, response.stdout, response.stderr);
      } else {
        callback(null, response.stdout, response.stderr);
      }
    }) as any);

    // Create controller with REAL components using factory
    controller = ListSimulatorsControllerFactory.create();
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

      execMockResponses = [
        { stdout: JSON.stringify(mockDeviceList), stderr: '' }
      ];

      // Act
      const result = await controller.execute({});

      // Assert - Test behavior: lists all simulators
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

      execMockResponses = [
        { stdout: JSON.stringify(mockDeviceList), stderr: '' }
      ];

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

      execMockResponses = [
        { stdout: JSON.stringify(mockDeviceList), stderr: '' }
      ];

      // Act
      const result = await controller.execute({ state: 'Booted' });

      // Assert
      expect(result.content[0].text).toContain('Found 1 simulator');
      expect(result.content[0].text).toContain('iPhone 15');
      expect(result.content[0].text).not.toContain('iPad Pro');
    });

    it('should return error when command execution fails', async () => {
      // Arrange
      const error = new Error('xcrun not found') as NodeExecError;
      error.code = 1;
      execMockResponses = [
        { stdout: '', stderr: 'xcrun not found', error }
      ];

      // Act
      const result = await controller.execute({});

      // Assert
      expect(result.content[0].type).toBe('text');
      expect(result.content[0].text).toMatch(/^❌.*JSON/); // Error about JSON parsing
    });

    it('should show warning when no simulators exist', async () => {
      // Arrange
      execMockResponses = [
        { stdout: JSON.stringify({ devices: {} }), stderr: '' }
      ];

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

      execMockResponses = [
        { stdout: JSON.stringify(mockDeviceList), stderr: '' }
      ];

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

    it('should return JSON parse error for malformed response', async () => {
      // Arrange
      execMockResponses = [
        { stdout: 'not valid json', stderr: '' }
      ];

      // Act
      const result = await controller.execute({});

      // Assert
      expect(result.content[0].type).toBe('text');
      expect(result.content[0].text).toMatch(/^❌.*not valid JSON/);
    });

    it('should return error for invalid platform', async () => {
      // Arrange, Act, Assert
      const result = await controller.execute({
        platform: 'Android'
      });

      expect(result.content[0].text).toBe('❌ Invalid platform: Android. Valid values are: iOS, macOS, tvOS, watchOS, visionOS');
    });

    it('should return error for invalid state', async () => {
      // Arrange, Act, Assert
      const result = await controller.execute({
        state: 'Running'
      });

      expect(result.content[0].text).toBe('❌ Invalid simulator state: Running. Valid values are: Booted, Booting, Shutdown, Shutting Down');
    });
  });
});