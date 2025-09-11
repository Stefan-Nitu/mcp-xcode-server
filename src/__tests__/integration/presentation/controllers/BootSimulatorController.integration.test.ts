import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { BootSimulatorController } from '../../../../presentation/controllers/BootSimulatorController.js';
import { BootSimulatorControllerFactory } from '../../../../factories/BootSimulatorControllerFactory.js';
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

const mockExec = exec as jest.MockedFunction<typeof exec>;

/**
 * Integration tests for BootSimulatorController
 * 
 * Tests the integration between:
 * - Controller → Use Case → Adapters
 * - Input validation → Domain logic → Output formatting
 * 
 * Mocks only external boundaries (shell commands)
 * Tests behavior, not implementation details
 */
describe('BootSimulatorController Integration', () => {
  let controller: BootSimulatorController;
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
    controller = BootSimulatorControllerFactory.create();
  });

  describe('boot simulator workflow', () => {
    it('should boot a shutdown simulator', async () => {
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
        { stdout: JSON.stringify(simulatorData), stderr: '' },  // list devices
        { stdout: '', stderr: '' }  // boot command succeeds
      ];
      
      // Act
      const result = await controller.execute({ deviceId: 'iPhone 15' });
      
      // Assert - Test behavior: simulator was successfully booted
      expect(result.content[0].text).toBe('✅ Successfully booted simulator: iPhone 15 (ABC123)');
    });

    it('should handle already booted simulator', async () => {
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
        { stdout: JSON.stringify(simulatorData), stderr: '' }  // list devices - already booted
      ];
      
      // Act
      const result = await controller.execute({ deviceId: 'iPhone 15' });
      
      // Assert - Test behavior: reports simulator is already running
      expect(result.content[0].text).toBe('✅ Simulator already booted: iPhone 15 (ABC123)');
    });

    it('should boot simulator by UUID', async () => {
      // Arrange
      const uuid = '550e8400-e29b-41d4-a716-446655440000';
      const simulatorData = {
        devices: {
          'com.apple.CoreSimulator.SimRuntime.iOS-17-0': [{
            udid: uuid,
            name: 'iPhone 15 Pro',
            state: SimulatorState.Shutdown,
            isAvailable: true,
            deviceTypeIdentifier: 'com.apple.CoreSimulator.SimDeviceType.iPhone-15-Pro'
          }]
        }
      };
      
      execMockResponses = [
        { stdout: JSON.stringify(simulatorData), stderr: '' },  // list devices
        { stdout: '', stderr: '' }  // boot command succeeds
      ];
      
      // Act
      const result = await controller.execute({ deviceId: uuid });
      
      // Assert - Test behavior: simulator was booted using UUID
      expect(result.content[0].text).toBe(`✅ Successfully booted simulator: iPhone 15 Pro (${uuid})`);
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

    it('should handle boot command failure', async () => {
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
      
      const bootError: NodeExecError = new Error('Command failed') as NodeExecError;
      bootError.code = 1;
      bootError.stdout = '';
      bootError.stderr = 'Unable to boot device';
      
      execMockResponses = [
        { stdout: JSON.stringify(simulatorData), stderr: '' },  // list devices
        { stdout: '', stderr: 'Unable to boot device', error: bootError }  // boot fails
      ];
      
      // Act
      const result = await controller.execute({ deviceId: 'iPhone 15' });
      
      // Assert - Test behavior: error message includes context for found simulator
      expect(result.content[0].text).toBe('❌ iPhone 15 (ABC123) - Unable to boot device');
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
    it('should boot specific simulator when multiple exist with similar names', async () => {
      // Arrange
      const simulatorData = {
        devices: {
          'com.apple.CoreSimulator.SimRuntime.iOS-17-0': [
            {
              udid: 'AAA111',
              name: 'iPhone 15',
              state: SimulatorState.Shutdown,
              isAvailable: true,
              deviceTypeIdentifier: 'com.apple.CoreSimulator.SimDeviceType.iPhone-15'
            },
            {
              udid: 'BBB222',
              name: 'iPhone 15 Pro',
              state: SimulatorState.Shutdown,
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
        { stdout: '', stderr: '' }  // boot command succeeds
      ];
      
      // Act
      const result = await controller.execute({ deviceId: 'iPhone 15 Pro' });
      
      // Assert - Test behavior: correct simulator was booted
      expect(result.content[0].text).toBe('✅ Successfully booted simulator: iPhone 15 Pro (BBB222)');
    });

    it('should handle mixed state simulators across runtimes', async () => {
      // Arrange
      const simulatorData = {
        devices: {
          'com.apple.CoreSimulator.SimRuntime.iOS-16-0': [{
            udid: 'OLD123',
            name: 'iPhone 14',
            state: SimulatorState.Booted,
            isAvailable: true,
            deviceTypeIdentifier: 'com.apple.CoreSimulator.SimDeviceType.iPhone-14'
          }],
          'com.apple.CoreSimulator.SimRuntime.iOS-17-0': [{
            udid: 'NEW456',
            name: 'iPhone 14',
            state: SimulatorState.Shutdown,
            isAvailable: true,
            deviceTypeIdentifier: 'com.apple.CoreSimulator.SimDeviceType.iPhone-14'
          }]
        }
      };
      
      execMockResponses = [
        { stdout: JSON.stringify(simulatorData), stderr: '' }  // list shows iOS 16 one is booted
      ];
      
      // Act - should find the first matching by name regardless of runtime
      const result = await controller.execute({ deviceId: 'iPhone 14' });
      
      // Assert - Test behavior: finds already booted simulator from any runtime
      expect(result.content[0].text).toBe('✅ Simulator already booted: iPhone 14 (OLD123)');
    });
  });
});