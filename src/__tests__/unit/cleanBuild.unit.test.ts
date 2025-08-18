/**
 * Unit tests for clean build functionality
 */

import { describe, test, expect, jest, beforeEach } from '@jest/globals';
import { XcodeBuilder } from '../../xcodeBuilder';
import { Platform } from '../../types';
import { existsSync, rmSync } from 'fs';
import path from 'path';

// Mock the util module
jest.mock('util', () => {
  const actual = jest.requireActual('util') as any;
  return {
    ...actual,
    promisify: jest.fn()
  };
});

// Mock the fs module
jest.mock('fs', () => ({
  existsSync: jest.fn(),
  rmSync: jest.fn()
}));

describe('XcodeBuilder Clean Operations', () => {
  let mockExec: any;
  let mockExecAsync: jest.Mock<any>;
  let xcodeBuilder: XcodeBuilder;
  
  const mockExistsSyncTyped = existsSync as jest.MockedFunction<typeof existsSync>;
  const mockRmSyncTyped = rmSync as jest.MockedFunction<typeof rmSync>;

  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();
    
    // Create a mock exec function
    mockExecAsync = jest.fn<any>();
    mockExec = jest.fn();
    
    // Mock the promisify function to return our mockExecAsync
    const util = require('util');
    (util.promisify as jest.Mock).mockImplementation((fn: any) => {
      if (fn === mockExec) {
        return mockExecAsync;
      }
      return jest.fn();
    });
    
    // Create a new instance with the mock
    xcodeBuilder = new XcodeBuilder(mockExec as any);
  });

  describe('cleanProjectInstance', () => {
    test('should clean build folder with xcodebuild clean', async () => {
      mockExistsSyncTyped.mockReturnValue(true);
      mockExecAsync.mockResolvedValue({ stdout: '', stderr: '' });

      const result = await xcodeBuilder.cleanProjectInstance({
        projectPath: '/path/to/project.xcodeproj',
        scheme: 'MyApp',
        configuration: 'Debug',
        cleanTarget: 'build'
      });

      expect(mockExecAsync).toHaveBeenCalledWith(
        'xcodebuild clean -project "/path/to/project.xcodeproj" -scheme "MyApp" -configuration "Debug"'
      );
      expect(result.success).toBe(true);
      expect(result.message).toContain('Cleaned build folder');
    });

    test('should clean workspace with xcodebuild clean', async () => {
      mockExistsSyncTyped.mockReturnValue(true);
      mockExecAsync.mockResolvedValue({ stdout: '', stderr: '' });

      const result = await xcodeBuilder.cleanProjectInstance({
        projectPath: '/path/to/project.xcworkspace',
        scheme: 'MyApp',
        cleanTarget: 'build'
      });

      expect(mockExecAsync).toHaveBeenCalledWith(
        'xcodebuild clean -workspace "/path/to/project.xcworkspace" -scheme "MyApp" -configuration "Debug"'
      );
      expect(result.success).toBe(true);
    });

    test('should remove DerivedData folder', async () => {
      mockExistsSyncTyped.mockReturnValue(true);

      const result = await xcodeBuilder.cleanProjectInstance({
        cleanTarget: 'derivedData',
        derivedDataPath: './DerivedData'
      });

      expect(mockRmSyncTyped).toHaveBeenCalledWith(
        './DerivedData',
        { recursive: true, force: true }
      );
      expect(result.success).toBe(true);
      expect(result.message).toContain('Removed DerivedData');
    });

    test('should clear only test results', async () => {
      mockExistsSyncTyped.mockImplementation((p) => {
        const pathStr = String(p);
        if (pathStr === './DerivedData') return true;
        if (pathStr === path.join('./DerivedData', 'Logs', 'Test')) return true;
        return false;
      });

      const result = await xcodeBuilder.cleanProjectInstance({
        cleanTarget: 'testResults',
        derivedDataPath: './DerivedData'
      });

      expect(mockRmSyncTyped).toHaveBeenCalledWith(
        path.join('./DerivedData', 'Logs', 'Test'),
        { recursive: true, force: true }
      );
      expect(result.success).toBe(true);
      expect(result.message).toContain('Cleared test results');
    });

    test('should clean all targets', async () => {
      mockExistsSyncTyped.mockReturnValue(true);
      mockExecAsync.mockResolvedValue({ stdout: '', stderr: '' });

      const result = await xcodeBuilder.cleanProjectInstance({
        projectPath: '/path/to/project.xcodeproj',
        scheme: 'MyApp',
        cleanTarget: 'all',
        derivedDataPath: './DerivedData'
      });

      // Should call xcodebuild clean
      expect(mockExecAsync).toHaveBeenCalled();
      // Should remove DerivedData
      expect(mockRmSyncTyped).toHaveBeenCalledWith(
        './DerivedData',
        { recursive: true, force: true }
      );
      expect(result.success).toBe(true);
    });

    test('should handle non-existent DerivedData gracefully', async () => {
      mockExistsSyncTyped.mockReturnValue(false);

      const result = await xcodeBuilder.cleanProjectInstance({
        cleanTarget: 'derivedData',
        derivedDataPath: './DerivedData'
      });

      expect(mockRmSyncTyped).not.toHaveBeenCalled();
      expect(result.success).toBe(true);
      expect(result.message).toContain('No DerivedData found');
    });

    test('should require project path for build clean', async () => {
      const result = await xcodeBuilder.cleanProjectInstance({
        cleanTarget: 'build'
      });

      expect(result.success).toBe(false);
      expect(result.message).toContain('Project path required');
    });

    test('should continue cleaning even if xcodebuild clean fails', async () => {
      mockExistsSyncTyped.mockReturnValue(true);
      mockExecAsync.mockRejectedValue(new Error('Clean failed'));

      const result = await xcodeBuilder.cleanProjectInstance({
        projectPath: '/path/to/project.xcodeproj',
        cleanTarget: 'all',
        derivedDataPath: './DerivedData'
      });

      // Should still try to remove DerivedData
      expect(mockRmSyncTyped).toHaveBeenCalled();
      expect(result.success).toBe(true);
      expect(result.message).toContain('Warning: Could not clean build folder');
    });
  });
});