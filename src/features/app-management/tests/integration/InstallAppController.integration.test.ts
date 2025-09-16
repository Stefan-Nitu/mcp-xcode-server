/**
 * Integration Test for InstallAppController
 * 
 * Tests the controller with REAL use case, presenter, and adapters
 * but MOCKS external boundaries (filesystem, subprocess).
 * 
 * Following testing philosophy:
 * - Integration tests (60% of suite) test component interactions
 * - Mock only external boundaries
 * - Test behavior, not implementation
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { MCPController } from '../../../../presentation/interfaces/MCPController.js';
import { InstallAppControllerFactory } from '../../factories/InstallAppControllerFactory.js';
import { exec } from 'child_process';
import { existsSync, statSync } from 'fs';
import type { NodeExecError } from '../../../../shared/tests/types/execTypes.js';

// Mock ONLY external boundaries
jest.mock('child_process');
jest.mock('fs');

// Mock promisify to return {stdout, stderr} for exec (as node's promisify does)
jest.mock('util', () => {
  const actualUtil = jest.requireActual('util') as typeof import('util');
  const { createPromisifiedExec } = require('../../../../shared/tests/mocks/promisifyExec');

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
const mockExistsSync = existsSync as jest.MockedFunction<typeof existsSync>;
const mockStatSync = statSync as jest.MockedFunction<typeof statSync>;

describe('InstallAppController Integration', () => {
  let controller: MCPController;
  let execCallIndex: number;
  let execMockResponses: Array<{ stdout: string; stderr: string; error?: NodeExecError }>;
  
  // Helper to create device list JSON response
  const createDeviceListResponse = (devices: Array<{udid: string, name: string, state: string}>) => ({
    stdout: JSON.stringify({
      devices: {
        'com.apple.CoreSimulator.SimRuntime.iOS-17-0': devices.map(d => ({
          ...d,
          isAvailable: true
        }))
      }
    }),
    stderr: ''
  });

  beforeEach(() => {
    jest.clearAllMocks();
    execCallIndex = 0;
    execMockResponses = [];
    
    // Setup selective exec mock for xcrun simctl commands
    const actualExec = (jest.requireActual('child_process') as typeof import('child_process')).exec;
    const { createSelectiveExecMock } = require('../../../../shared/tests/mocks/selectiveExecMock');
    
    const isSimctlCommand = (cmd: string) => 
      cmd.includes('xcrun simctl');
    
    mockExec.mockImplementation(
      createSelectiveExecMock(
        isSimctlCommand,
        () => execMockResponses[execCallIndex++],
        actualExec
      )
    );
    
    // Default filesystem mocks
    mockExistsSync.mockImplementation((path) => {
      const pathStr = String(path);
      return pathStr.endsWith('.app');
    });
    
    mockStatSync.mockImplementation((path) => ({
      isDirectory: () => String(path).endsWith('.app'),
      isFile: () => false,
      // Add other stat properties as needed
    } as any));
    
    // Create controller with REAL components using factory
    controller = InstallAppControllerFactory.create();
  });

  describe('successful app installation', () => {
    it('should install app on booted simulator', async () => {
      // Arrange
      const appPath = '/Users/dev/MyApp.app';
      const simulatorId = 'test-simulator-id';
      
      execMockResponses = [
        // Find simulator
        createDeviceListResponse([
          { udid: simulatorId, name: 'iPhone 15', state: 'Booted' }
        ]),
        // Install app
        { stdout: '', stderr: '' }
      ];
      
      // Act
      const result = await controller.execute({
        appPath,
        simulatorId
      });
      
      // Assert
      expect(result).toMatchObject({
        content: expect.arrayContaining([
          expect.objectContaining({
            type: 'text',
            text: expect.stringContaining('Successfully installed')
          })
        ])
      });
      
    });

    it('should find and use booted simulator when no ID specified', async () => {
      // Arrange
      const appPath = '/Users/dev/MyApp.app';
      
      execMockResponses = [
        // xcrun simctl list devices --json (to find booted simulator)
        { 
          stdout: JSON.stringify({
            devices: {
              'com.apple.CoreSimulator.SimRuntime.iOS-17-0': [
                {
                  udid: 'booted-sim-id',
                  name: 'iPhone 15',
                  state: 'Booted',
                  isAvailable: true
                },
                {
                  udid: 'shutdown-sim-id',
                  name: 'iPhone 14',
                  state: 'Shutdown',
                  isAvailable: true
                }
              ]
            }
          }),
          stderr: ''
        },
        // xcrun simctl install command
        { stdout: '', stderr: '' }
      ];
      
      // Act
      const result = await controller.execute({
        appPath
      });
      
      // Assert
      expect(result).toMatchObject({
        content: expect.arrayContaining([
          expect.objectContaining({
            type: 'text',
            text: expect.stringContaining('Successfully installed')
          })
        ])
      });
      
    });

    it('should boot simulator if shutdown', async () => {
      // Arrange
      const appPath = '/Users/dev/MyApp.app';
      const simulatorId = 'shutdown-sim-id';
      
      execMockResponses = [
        // Find simulator
        {
          stdout: JSON.stringify({
            devices: {
              'com.apple.CoreSimulator.SimRuntime.iOS-17-0': [
                {
                  udid: simulatorId,
                  name: 'iPhone 15',
                  state: 'Shutdown',
                  isAvailable: true
                }
              ]
            }
          }),
          stderr: ''
        },
        // Boot simulator
        { stdout: '', stderr: '' },
        // Install app
        { stdout: '', stderr: '' }
      ];
      
      // Act
      const result = await controller.execute({
        appPath,
        simulatorId
      });
      
      // Assert
      expect(result).toMatchObject({
        content: expect.arrayContaining([
          expect.objectContaining({
            type: 'text',
            text: expect.stringContaining('Successfully installed')
          })
        ])
      });
      
    });
  });

  describe('error handling', () => {
    it('should fail when app path does not exist', async () => {
      // Arrange
      const nonExistentPath = '/path/that/does/not/exist.app';
      mockExistsSync.mockReturnValue(false);
      
      execMockResponses = [
        // Find simulator
        createDeviceListResponse([
          { udid: 'test-sim', name: 'iPhone 15', state: 'Booted' }
        ]),
        // Install command would fail with file not found
        {
          error: Object.assign(new Error('Failed to install app'), {
            code: 1,
            stdout: '',
            stderr: 'xcrun simctl install: No such file or directory'
          }),
          stdout: '',
          stderr: 'xcrun simctl install: No such file or directory'
        }
      ];
      
      // Act
      const result = await controller.execute({
        appPath: nonExistentPath,
        simulatorId: 'test-sim'
      });
      
      // Assert
      expect(result.content[0].text).toBe('❌ iPhone 15 (test-sim) - xcrun simctl install: No such file or directory');
    });

    it('should fail when app path is not an app bundle', async () => {
      // Arrange
      const invalidPath = '/Users/dev/file.txt';
      mockExistsSync.mockReturnValue(true);
      mockStatSync.mockReturnValue({
        isDirectory: () => false,
        isFile: () => true
      } as any);
      
      // Act
      const result = await controller.execute({
        appPath: invalidPath,
        simulatorId: 'test-sim'
      });
      
      // Assert
      expect(result.content[0].text).toBe('❌ App path must end with .app');
    });

    it('should fail when simulator does not exist', async () => {
      // Arrange
      const appPath = '/Users/dev/MyApp.app';
      const nonExistentSim = 'non-existent-id';
      
      execMockResponses = [
        // List devices - simulator not found
        {
          stdout: JSON.stringify({
            devices: {
              'com.apple.CoreSimulator.SimRuntime.iOS-17-0': []
            }
          }),
          stderr: ''
        }
      ];
      
      // Act
      const result = await controller.execute({
        appPath,
        simulatorId: nonExistentSim
      });
      
      // Assert
      expect(result.content[0].text).toBe(`❌ Simulator not found: ${nonExistentSim}`);
    });

    it('should fail when no booted simulator and no ID specified', async () => {
      // Arrange
      const appPath = '/Users/dev/MyApp.app';
      
      execMockResponses = [
        // List devices - no booted simulators
        {
          stdout: JSON.stringify({
            devices: {
              'com.apple.CoreSimulator.SimRuntime.iOS-17-0': [
                {
                  udid: 'shutdown-sim',
                  name: 'iPhone 15',
                  state: 'Shutdown',
                  isAvailable: true
                }
              ]
            }
          }),
          stderr: ''
        }
      ];
      
      // Act
      const result = await controller.execute({
        appPath
      });
      
      // Assert
      expect(result.content[0].text).toBe('❌ No booted simulator found. Please boot a simulator first or specify a simulator ID.');
    });

    it('should handle installation failure gracefully', async () => {
      // Arrange
      const appPath = '/Users/dev/MyApp.app';
      const simulatorId = 'test-sim';
      
      const error = new Error('Failed to install app: incompatible architecture') as NodeExecError;
      error.code = 1;
      error.stdout = '';
      error.stderr = 'Error: incompatible architecture';
      
      execMockResponses = [
        // Find simulator
        createDeviceListResponse([
          { udid: simulatorId, name: 'iPhone 15', state: 'Booted' }
        ]),
        // Install fails
        { error, stdout: '', stderr: error.stderr }
      ];
      
      // Act
      const result = await controller.execute({
        appPath,
        simulatorId
      });
      
      // Assert
      expect(result.content[0].text).toBe('❌ iPhone 15 (test-sim) - incompatible architecture');
    });
  });

  describe('input validation', () => {
    it('should accept simulator name instead of UUID', async () => {
      // Arrange
      const appPath = '/Users/dev/MyApp.app';
      const simulatorName = 'iPhone 15 Pro';
      
      execMockResponses = [
        // Find simulator by name
        createDeviceListResponse([
          { udid: 'sim-id-123', name: simulatorName, state: 'Booted' }
        ]),
        // Install succeeds
        { stdout: '', stderr: '' }
      ];
      
      // Act
      const result = await controller.execute({
        appPath,
        simulatorId: simulatorName
      });
      
      // Assert
      expect(result).toMatchObject({
        content: expect.arrayContaining([
          expect.objectContaining({
            type: 'text',
            text: expect.stringContaining('Successfully installed')
          })
        ])
      });
      // Should show both simulator name and ID in format: "name (id)"
      expect(result.content[0].text).toContain(`${simulatorName} (sim-id-123)`);
    });

    it('should handle paths with spaces', async () => {
      // Arrange
      const appPath = '/Users/dev/My iOS App/MyApp.app';
      const simulatorId = 'test-sim';
      
      execMockResponses = [
        // Find simulator
        createDeviceListResponse([
          { udid: simulatorId, name: 'iPhone 15', state: 'Booted' }
        ]),
        // Install app
        { stdout: '', stderr: '' }
      ];
      
      // Act
      const result = await controller.execute({
        appPath,
        simulatorId
      });
      
      // Assert
      expect(result).toMatchObject({
        content: expect.arrayContaining([
          expect.objectContaining({
            type: 'text',
            text: expect.stringContaining('Successfully installed')
          })
        ])
      });
      // Path with spaces should be handled correctly
      expect(result.content[0].text).toContain('iPhone 15 (test-sim)');
      
    });
  });
});