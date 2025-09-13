import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { MCPController } from '../../../../presentation/interfaces/MCPController.js';
import { ShutdownSimulatorControllerFactory } from '../../../../factories/ShutdownSimulatorControllerFactory.js';
import { SimulatorState } from '../../../../domain/value-objects/SimulatorState.js';
import { exec } from 'child_process';
import type { NodeExecError } from '../../../utils/types/execTypes.js';

// Mock ONLY external boundaries
jest.mock('child_process');

// Mock promisify to return {stdout, stderr} for exec (as node's promisify does)
jest.mock('util', () => {
  const actualUtil = jest.requireActual('util') as typeof import('util');
  const { createPromisifiedExec } = require('../../../utils/mocks/promisifyExec');

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

/**
 * Integration tests for ShutdownSimulatorController
 * 
 * Tests the integration between:
 * - Controller → Use Case → Adapters
 * - Input validation → Domain logic → Output formatting
 * 
 * Mocks only external boundaries (shell commands)
 * Tests behavior, not implementation details
 */
describe('ShutdownSimulatorController Integration', () => {
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
    controller = ShutdownSimulatorControllerFactory.create();
  });

  describe('shutdown simulator workflow', () => {
    it('should shutdown a booted simulator', async () => {
      // Arrange
      const simulatorData = {
        devices: {
          'com.apple.CoreSimulator.SimRuntime.iOS-17-0': [{
            udid: 'ABC123',
            name: 'iPhone 15',
            state: SimulatorState.Booted,
            isAvailable: true,
            deviceTypeIdentifier: 'com.apple.CoreSimulator.SimDeviceType.iPhone-15'
          }]
        }
      };
      
      execMockResponses = [
        { stdout: JSON.stringify(simulatorData), stderr: '' },  // list devices
        { stdout: '', stderr: '' }  // shutdown command succeeds
      ];
      
      // Act
      const result = await controller.execute({ deviceId: 'iPhone 15' });
      
      // Assert - Test behavior: simulator was successfully shutdown
      expect(result.content[0].text).toBe('✅ Successfully shutdown simulator: iPhone 15 (ABC123)');
    });

    it('should handle already shutdown simulator', async () => {
      // Arrange
      const simulatorData = {
        devices: {
          'com.apple.CoreSimulator.SimRuntime.iOS-17-0': [{
            udid: 'ABC123',
            name: 'iPhone 15',
            state: SimulatorState.Shutdown,
            isAvailable: true,
            deviceTypeIdentifier: 'com.apple.CoreSimulator.SimDeviceType.iPhone-15'
          }]
        }
      };
      
      execMockResponses = [
        { stdout: JSON.stringify(simulatorData), stderr: '' }  // list devices - already shutdown
      ];
      
      // Act
      const result = await controller.execute({ deviceId: 'iPhone 15' });
      
      // Assert - Test behavior: reports simulator is already shutdown
      expect(result.content[0].text).toBe('✅ Simulator already shutdown: iPhone 15 (ABC123)');
    });

    it('should shutdown simulator by UUID', async () => {
      // Arrange
      const uuid = '550e8400-e29b-41d4-a716-446655440000';
      const simulatorData = {
        devices: {
          'com.apple.CoreSimulator.SimRuntime.iOS-17-0': [{
            udid: uuid,
            name: 'iPhone 15 Pro',
            state: SimulatorState.Booted,
            isAvailable: true,
            deviceTypeIdentifier: 'com.apple.CoreSimulator.SimDeviceType.iPhone-15-Pro'
          }]
        }
      };
      
      execMockResponses = [
        { stdout: JSON.stringify(simulatorData), stderr: '' },  // list devices
        { stdout: '', stderr: '' }  // shutdown command succeeds
      ];
      
      // Act
      const result = await controller.execute({ deviceId: uuid });
      
      // Assert - Test behavior: simulator was shutdown using UUID
      expect(result.content[0].text).toBe(`✅ Successfully shutdown simulator: iPhone 15 Pro (${uuid})`);
    });
  });

  describe('error handling', () => {
    it('should handle simulator not found', async () => {
      // Arrange
      execMockResponses = [
        { stdout: JSON.stringify({ devices: {} }), stderr: '' }  // empty device list
      ];
      
      // Act
      const result = await controller.execute({ deviceId: 'NonExistent' });
      
      // Assert - Test behavior: appropriate error message shown
      expect(result.content[0].text).toBe('❌ Simulator not found: NonExistent');
    });

    it('should handle shutdown command failure', async () => {
      // Arrange
      const simulatorData = {
        devices: {
          'com.apple.CoreSimulator.SimRuntime.iOS-17-0': [{
            udid: 'ABC123',
            name: 'iPhone 15',
            state: SimulatorState.Booted,
            isAvailable: true,
            deviceTypeIdentifier: 'com.apple.CoreSimulator.SimDeviceType.iPhone-15'
          }]
        }
      };
      
      const shutdownError: NodeExecError = new Error('Command failed') as NodeExecError;
      shutdownError.code = 1;
      shutdownError.stdout = '';
      shutdownError.stderr = 'Unable to shutdown device';
      
      execMockResponses = [
        { stdout: JSON.stringify(simulatorData), stderr: '' },  // list devices
        { stdout: '', stderr: 'Unable to shutdown device', error: shutdownError }  // shutdown fails
      ];
      
      // Act
      const result = await controller.execute({ deviceId: 'iPhone 15' });
      
      // Assert - Test behavior: error message includes context for found simulator
      expect(result.content[0].text).toBe('❌ iPhone 15 (ABC123) - Unable to shutdown device');
    });
  });

  describe('validation', () => {
    it('should validate required deviceId', async () => {
      // Act
      const result = await controller.execute({} as any);
      
      // Assert
      expect(result.content[0].text).toBe('❌ Device ID is required');
    });

    it('should validate empty deviceId', async () => {
      // Act
      const result = await controller.execute({ deviceId: '' });
      
      // Assert
      expect(result.content[0].text).toBe('❌ Device ID cannot be empty');
    });

    it('should validate whitespace-only deviceId', async () => {
      // Act
      const result = await controller.execute({ deviceId: '   ' });
      
      // Assert
      expect(result.content[0].text).toBe('❌ Device ID cannot be whitespace only');
    });
  });

  describe('complex scenarios', () => {
    it('should shutdown specific simulator when multiple exist with similar names', async () => {
      // Arrange
      const simulatorData = {
        devices: {
          'com.apple.CoreSimulator.SimRuntime.iOS-17-0': [
            {
              udid: 'AAA111',
              name: 'iPhone 15',
              state: SimulatorState.Booted,
              isAvailable: true,
              deviceTypeIdentifier: 'com.apple.CoreSimulator.SimDeviceType.iPhone-15'
            },
            {
              udid: 'BBB222',
              name: 'iPhone 15 Pro',
              state: SimulatorState.Booted,
              isAvailable: true,
              deviceTypeIdentifier: 'com.apple.CoreSimulator.SimDeviceType.iPhone-15-Pro'
            },
            {
              udid: 'CCC333',
              name: 'iPhone 15 Pro Max',
              state: SimulatorState.Shutdown,
              isAvailable: true,
              deviceTypeIdentifier: 'com.apple.CoreSimulator.SimDeviceType.iPhone-15-Pro-Max'
            }
          ]
        }
      };
      
      execMockResponses = [
        { stdout: JSON.stringify(simulatorData), stderr: '' },  // list devices
        { stdout: '', stderr: '' }  // shutdown command succeeds
      ];
      
      // Act
      const result = await controller.execute({ deviceId: 'iPhone 15 Pro' });
      
      // Assert - Test behavior: correct simulator was shutdown
      expect(result.content[0].text).toBe('✅ Successfully shutdown simulator: iPhone 15 Pro (BBB222)');
    });

    it('should handle mixed state simulators across runtimes', async () => {
      // Arrange
      const simulatorData = {
        devices: {
          'com.apple.CoreSimulator.SimRuntime.iOS-16-0': [{
            udid: 'OLD123',
            name: 'iPhone 14',
            state: SimulatorState.Shutdown,
            isAvailable: true,
            deviceTypeIdentifier: 'com.apple.CoreSimulator.SimDeviceType.iPhone-14'
          }],
          'com.apple.CoreSimulator.SimRuntime.iOS-17-0': [{
            udid: 'NEW456',
            name: 'iPhone 14',
            state: SimulatorState.Booted,
            isAvailable: true,
            deviceTypeIdentifier: 'com.apple.CoreSimulator.SimDeviceType.iPhone-14'
          }]
        }
      };
      
      execMockResponses = [
        { stdout: JSON.stringify(simulatorData), stderr: '' },  // list shows iOS 17 one is booted
        { stdout: '', stderr: '' }  // shutdown succeeds
      ];
      
      // Act - should find the first matching by name (prioritizes newer runtime)
      const result = await controller.execute({ deviceId: 'iPhone 14' });
      
      // Assert - Test behavior: finds and shuts down the iOS 17 device (newer runtime)
      expect(result.content[0].text).toBe('✅ Successfully shutdown simulator: iPhone 14 (NEW456)');
    });

    it('should shutdown simulator in Booting state', async () => {
      // Arrange
      const simulatorData = {
        devices: {
          'com.apple.CoreSimulator.SimRuntime.iOS-17-0': [{
            udid: 'BOOT123',
            name: 'iPhone 15',
            state: SimulatorState.Booting,
            isAvailable: true,
            deviceTypeIdentifier: 'com.apple.CoreSimulator.SimDeviceType.iPhone-15'
          }]
        }
      };
      
      execMockResponses = [
        { stdout: JSON.stringify(simulatorData), stderr: '' },  // list devices - in Booting state
        { stdout: '', stderr: '' }  // shutdown command succeeds
      ];
      
      // Act
      const result = await controller.execute({ deviceId: 'iPhone 15' });
      
      // Assert - Test behavior: can shutdown a simulator that's booting
      expect(result.content[0].text).toBe('✅ Successfully shutdown simulator: iPhone 15 (BOOT123)');
    });
  });
});