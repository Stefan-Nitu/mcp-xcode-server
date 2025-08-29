/**
 * Unit tests for BootSimulatorTool
 * Tests validation, command building, and error handling without real simulator interaction
 */

import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import { BootSimulatorTool } from '../../../tools/simulator/BootSimulatorTool.js';
import { SubprocessMock, commonMockResponses } from '../../utils/mockHelpers.js';
import { z } from 'zod';

describe('BootSimulatorTool Unit Tests', () => {
  let tool: BootSimulatorTool;
  let subprocess: SubprocessMock;
  let mockExecSync: jest.Mock;

  beforeEach(() => {
    tool = new BootSimulatorTool();
    subprocess = new SubprocessMock();
    mockExecSync = jest.fn();
    
    // Mock the execSync function
    jest.spyOn(require('child_process'), 'execSync').mockImplementation(mockExecSync);
  });

  describe('Validation', () => {
    test('should require deviceId parameter', async () => {
      await expect(tool.execute({}))
        .rejects.toThrow('Validation error');
      
      await expect(tool.execute({ deviceId: undefined }))
        .rejects.toThrow('Validation error');
    });

    test('should reject empty deviceId', async () => {
      await expect(tool.execute({ deviceId: '' }))
        .rejects.toThrow('Validation error');
      
      await expect(tool.execute({ deviceId: '   ' }))
        .rejects.toThrow('Validation error');
    });

    test('should reject invalid deviceId types', async () => {
      await expect(tool.execute({ deviceId: 123 }))
        .rejects.toThrow('Validation error');
      
      await expect(tool.execute({ deviceId: null }))
        .rejects.toThrow('Validation error');
      
      await expect(tool.execute({ deviceId: {} }))
        .rejects.toThrow('Validation error');
    });

    test('should accept valid deviceId formats', async () => {
      // Mock successful boot for valid IDs
      subprocess.mockCommand(/xcrun simctl boot/, commonMockResponses.simulatorBootSuccess('test-device'));
      mockExecSync.mockImplementation(subprocess.getExecSyncMock());

      // UUID format
      const uuidResult = await tool.execute({ 
        deviceId: '12345678-1234-1234-1234-123456789012' 
      });
      expect(uuidResult).toContain('Successfully booted');

      // Name format
      const nameResult = await tool.execute({ 
        deviceId: 'iPhone 15 Pro' 
      });
      expect(nameResult).toContain('Successfully booted');

      // Partial UUID
      const partialResult = await tool.execute({ 
        deviceId: '12345678' 
      });
      expect(partialResult).toContain('Successfully booted');
    });
  });

  describe('Command Building', () => {
    test('should build correct boot command', async () => {
      subprocess.mockCommand(/xcrun simctl boot/, commonMockResponses.simulatorBootSuccess('test-device'));
      mockExecSync.mockImplementation(subprocess.getExecSyncMock());

      await tool.execute({ deviceId: 'test-device' });

      expect(mockExecSync).toHaveBeenCalledWith(
        'xcrun simctl boot test-device',
        expect.objectContaining({ encoding: 'utf-8' })
      );
    });

    test('should handle device IDs with spaces', async () => {
      subprocess.mockCommand(/xcrun simctl boot/, commonMockResponses.simulatorBootSuccess('iPhone 15 Pro'));
      mockExecSync.mockImplementation(subprocess.getExecSyncMock());

      await tool.execute({ deviceId: 'iPhone 15 Pro' });

      expect(mockExecSync).toHaveBeenCalledWith(
        'xcrun simctl boot "iPhone 15 Pro"',
        expect.objectContaining({ encoding: 'utf-8' })
      );
    });

    test('should open Simulator app after boot', async () => {
      subprocess.mockCommand(/xcrun simctl boot/, commonMockResponses.simulatorBootSuccess('test-device'));
      subprocess.mockCommand(/open.*Simulator\.app/, { stdout: '' });
      mockExecSync.mockImplementation(subprocess.getExecSyncMock());

      await tool.execute({ deviceId: 'test-device' });

      const calls = mockExecSync.mock.calls;
      expect(calls.some(call => call[0].includes('open'))).toBe(true);
      expect(calls.some(call => call[0].includes('Simulator.app'))).toBe(true);
    });
  });

  describe('Error Handling', () => {
    test('should handle device not found error', async () => {
      const error = new Error('Invalid device: test-device');
      subprocess.mockCommand(/xcrun simctl boot/, { 
        stderr: 'Invalid device: test-device',
        error 
      });
      mockExecSync.mockImplementation(subprocess.getExecSyncMock());

      const result = await tool.execute({ deviceId: 'test-device' });
      expect(result).toContain('Error: Device not found');
      expect(result).toContain('test-device');
    });

    test('should handle already booted device', async () => {
      const error = new Error('Unable to boot device in current state: Booted');
      subprocess.mockCommand(/xcrun simctl boot/, { 
        stderr: 'Unable to boot device in current state: Booted',
        error 
      });
      mockExecSync.mockImplementation(subprocess.getExecSyncMock());

      const result = await tool.execute({ deviceId: 'test-device' });
      expect(result).toContain('already booted');
    });

    test('should handle permission errors', async () => {
      const error = new Error('Operation not permitted');
      subprocess.mockCommand(/xcrun simctl boot/, { 
        stderr: 'Operation not permitted',
        error 
      });
      mockExecSync.mockImplementation(subprocess.getExecSyncMock());

      const result = await tool.execute({ deviceId: 'test-device' });
      expect(result).toContain('Error');
      expect(result).toContain('Operation not permitted');
    });

    test('should handle xcrun not found', async () => {
      const error = new Error('xcrun: command not found');
      subprocess.mockCommand(/xcrun simctl boot/, { 
        stderr: 'xcrun: command not found',
        error 
      });
      mockExecSync.mockImplementation(subprocess.getExecSyncMock());

      const result = await tool.execute({ deviceId: 'test-device' });
      expect(result).toContain('Error');
      expect(result).toContain('xcrun');
    });
  });

  describe('Tool Definition', () => {
    test('should provide correct tool definition', () => {
      const definition = tool.getToolDefinition();
      
      expect(definition.name).toBe('boot_simulator');
      expect(definition.description).toContain('Boot');
      expect(definition.inputSchema.properties).toHaveProperty('deviceId');
      expect(definition.inputSchema.required).toContain('deviceId');
    });

    test('should have proper schema for MCP', () => {
      const definition = tool.getToolDefinition();
      
      // Validate the schema structure
      expect(definition.inputSchema.type).toBe('object');
      expect(definition.inputSchema.properties.deviceId.type).toBe('string');
      expect(definition.inputSchema.properties.deviceId.description).toBeDefined();
    });
  });

  describe('Success Response Format', () => {
    test('should return formatted success message', async () => {
      subprocess.mockCommand(/xcrun simctl boot/, commonMockResponses.simulatorBootSuccess('12345'));
      mockExecSync.mockImplementation(subprocess.getExecSyncMock());

      const result = await tool.execute({ deviceId: '12345' });
      
      expect(result).toContain('Successfully booted simulator');
      expect(result).toContain('12345');
    });

    test('should handle device name in success message', async () => {
      subprocess.mockCommand(/xcrun simctl boot/, commonMockResponses.simulatorBootSuccess('iPhone 15 Pro'));
      mockExecSync.mockImplementation(subprocess.getExecSyncMock());

      const result = await tool.execute({ deviceId: 'iPhone 15 Pro' });
      
      expect(result).toContain('Successfully booted simulator');
      expect(result).toContain('iPhone 15 Pro');
    });
  });
});