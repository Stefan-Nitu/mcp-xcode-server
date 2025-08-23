/**
 * Unit tests for RunSwiftPackageTool
 * Tests behavior with mocked dependencies
 */

import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import { RunSwiftPackageTool } from '../../tools/RunSwiftPackageTool.js';
import * as fs from 'fs';
import * as utils from '../../utils.js';

// Mock the modules
jest.mock('fs', () => ({
  existsSync: jest.fn()
}));

jest.mock('../../utils.js', () => ({
  execAsync: jest.fn()
}));

describe('RunSwiftPackageTool Unit Tests', () => {
  let tool: RunSwiftPackageTool;
  const mockExecAsync = utils.execAsync as jest.MockedFunction<typeof utils.execAsync>;
  const mockExistsSync = fs.existsSync as jest.MockedFunction<typeof fs.existsSync>;

  beforeEach(() => {
    jest.clearAllMocks();
    tool = new RunSwiftPackageTool();
  });

  describe('Tool Definition', () => {
    test('should provide correct tool definition', () => {
      const definition = tool.getToolDefinition();
      
      expect(definition.name).toBe('run_swift_package');
      expect(definition.description).toBe('Build and run a Swift Package Manager executable');
      expect(definition.inputSchema.required).toEqual(['packagePath']);
      expect(definition.inputSchema.properties.configuration.enum).toEqual(['Debug', 'Release']);
      expect(definition.inputSchema.properties.configuration.default).toBe('Debug');
    });
  });

  describe('Command Generation', () => {
    test('should run with debug configuration by default', async () => {
      mockExistsSync.mockReturnValue(true);
      mockExecAsync.mockResolvedValue({ stdout: 'Test output', stderr: '' });

      await tool.execute({
        packagePath: '/test/package'
      });

      expect(mockExecAsync).toHaveBeenCalledWith(
        'swift run --package-path "/test/package" -c debug',
        { maxBuffer: 10 * 1024 * 1024 }
      );
    });

    test('should run with release configuration when specified', async () => {
      mockExistsSync.mockReturnValue(true);
      mockExecAsync.mockResolvedValue({ stdout: 'Test output', stderr: '' });

      await tool.execute({
        packagePath: '/test/package',
        configuration: 'Release'
      });

      expect(mockExecAsync).toHaveBeenCalledWith(
        'swift run --package-path "/test/package" -c release',
        { maxBuffer: 10 * 1024 * 1024 }
      );
    });

    test('should specify executable when provided', async () => {
      mockExistsSync.mockReturnValue(true);
      mockExecAsync.mockResolvedValue({ stdout: 'Test output', stderr: '' });

      await tool.execute({
        packagePath: '/test/package',
        executable: 'MyExecutable'
      });

      expect(mockExecAsync).toHaveBeenCalledWith(
        'swift run --package-path "/test/package" -c debug "MyExecutable"',
        { maxBuffer: 10 * 1024 * 1024 }
      );
    });

    test('should pass single argument to executable', async () => {
      mockExistsSync.mockReturnValue(true);
      mockExecAsync.mockResolvedValue({ stdout: 'Test output', stderr: '' });

      await tool.execute({
        packagePath: '/test/package',
        executable: 'MyExecutable',
        arguments: ['--verbose']
      });

      expect(mockExecAsync).toHaveBeenCalledWith(
        'swift run --package-path "/test/package" -c debug "MyExecutable" "--verbose"',
        { maxBuffer: 10 * 1024 * 1024 }
      );
    });

    test('should pass multiple arguments to executable', async () => {
      mockExistsSync.mockReturnValue(true);
      mockExecAsync.mockResolvedValue({ stdout: 'Test output', stderr: '' });

      await tool.execute({
        packagePath: '/test/package',
        executable: 'MyExecutable',
        arguments: ['arg1', 'arg2', 'arg3']
      });

      expect(mockExecAsync).toHaveBeenCalledWith(
        'swift run --package-path "/test/package" -c debug "MyExecutable" "arg1" "arg2" "arg3"',
        { maxBuffer: 10 * 1024 * 1024 }
      );
    });
  });

  describe('Path Handling', () => {
    test('should extract directory from Package.swift path', async () => {
      mockExistsSync.mockReturnValue(true);
      mockExecAsync.mockResolvedValue({ stdout: 'Test output', stderr: '' });

      await tool.execute({
        packagePath: '/test/package/Package.swift'
      });

      expect(mockExecAsync).toHaveBeenCalledWith(
        'swift run --package-path "/test/package" -c debug',
        { maxBuffer: 10 * 1024 * 1024 }
      );
    });

    test('should use directory path directly', async () => {
      mockExistsSync.mockReturnValue(true);
      mockExecAsync.mockResolvedValue({ stdout: 'Test output', stderr: '' });

      await tool.execute({
        packagePath: '/test/package'
      });

      expect(mockExecAsync).toHaveBeenCalledWith(
        'swift run --package-path "/test/package" -c debug',
        { maxBuffer: 10 * 1024 * 1024 }
      );
    });

    test('should check for Package.swift existence', async () => {
      mockExistsSync.mockReturnValue(false);

      const result = await tool.execute({
        packagePath: '/test/package'
      });

      expect(mockExistsSync).toHaveBeenCalledWith('/test/package/Package.swift');
      expect(result.content[0].text).toContain('No Package.swift found');
    });
  });

  describe('Output Handling', () => {
    test('should return stdout and stderr combined on success', async () => {
      mockExistsSync.mockReturnValue(true);
      mockExecAsync.mockResolvedValue({ 
        stdout: 'Program output',
        stderr: 'Warning message'
      });

      const result = await tool.execute({
        packagePath: '/test/package',
        executable: 'MyExecutable'
      });

      expect(result.content[0].text).toContain('Execution completed: MyExecutable');
      expect(result.content[0].text).toContain('Program output');
      expect(result.content[0].text).toContain('Warning message');
    });

    test('should include configuration in output', async () => {
      mockExistsSync.mockReturnValue(true);
      mockExecAsync.mockResolvedValue({ stdout: 'Test output', stderr: '' });

      const result = await tool.execute({
        packagePath: '/test/package',
        configuration: 'Release'
      });

      expect(result.content[0].text).toContain('Configuration: Release');
    });

    test('should show default executable when none specified', async () => {
      mockExistsSync.mockReturnValue(true);
      mockExecAsync.mockResolvedValue({ stdout: 'Test output', stderr: '' });

      const result = await tool.execute({
        packagePath: '/test/package'
      });

      expect(result.content[0].text).toContain('Execution completed: default executable');
    });
  });

  describe('Error Handling', () => {
    test('should return combined stdout and stderr on failure', async () => {
      mockExistsSync.mockReturnValue(true);
      const runError = new Error('Command failed') as any;
      runError.stdout = 'Program output before error';
      runError.stderr = 'Error: Something went wrong';
      mockExecAsync.mockRejectedValue(runError);

      const result = await tool.execute({
        packagePath: '/test/package'
      });

      expect(result.content[0].text).toContain('Program output before error');
      expect(result.content[0].text).toContain('Error: Something went wrong');
    });

    test('should handle only stdout on failure', async () => {
      mockExistsSync.mockReturnValue(true);
      const runError = new Error('Command failed') as any;
      runError.stdout = 'Only stdout output';
      runError.stderr = '';
      mockExecAsync.mockRejectedValue(runError);

      const result = await tool.execute({
        packagePath: '/test/package'
      });

      expect(result.content[0].text).toBe('Only stdout output');
    });

    test('should handle only stderr on failure', async () => {
      mockExistsSync.mockReturnValue(true);
      const runError = new Error('Command failed') as any;
      runError.stdout = '';
      runError.stderr = 'Only stderr output';
      mockExecAsync.mockRejectedValue(runError);

      const result = await tool.execute({
        packagePath: '/test/package'
      });

      expect(result.content[0].text).toBe('Only stderr output');
    });

    test('should return error message if no output available', async () => {
      mockExistsSync.mockReturnValue(true);
      const runError = new Error('Command failed');
      mockExecAsync.mockRejectedValue(runError);

      const result = await tool.execute({
        packagePath: '/test/package'
      });

      expect(result.content[0].text).toBe('Run failed: Command failed');
    });

    test('should handle Package.swift not found', async () => {
      mockExistsSync.mockReturnValue(false);

      const result = await tool.execute({
        packagePath: '/test/nonexistent'
      });

      expect(result.content[0].text).toBe('Run failed: Error: No Package.swift found at: /test/nonexistent');
    });
  });

  describe('Input Validation', () => {
    test('should reject invalid configuration', async () => {
      await expect(tool.execute({
        packagePath: '/test/package',
        configuration: 'Beta'
      })).rejects.toThrow();
    });

    test('should reject path traversal attempts', async () => {
      await expect(tool.execute({
        packagePath: '../../../etc/passwd'
      })).rejects.toThrow('Path traversal');
    });

    test('should reject command injection attempts', async () => {
      await expect(tool.execute({
        packagePath: '/test; rm -rf /'
      })).rejects.toThrow('Command injection');
    });

    test('should accept empty arguments array', async () => {
      mockExistsSync.mockReturnValue(true);
      mockExecAsync.mockResolvedValue({ stdout: 'Test output', stderr: '' });

      await tool.execute({
        packagePath: '/test/package',
        arguments: []
      });

      expect(mockExecAsync).toHaveBeenCalledWith(
        'swift run --package-path "/test/package" -c debug',
        { maxBuffer: 10 * 1024 * 1024 }
      );
    });
  });
});