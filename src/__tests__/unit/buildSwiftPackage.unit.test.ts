/**
 * Unit tests for BuildSwiftPackageTool
 * Tests behavior with mocked dependencies
 */

import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import { BuildSwiftPackageTool } from '../../tools/BuildSwiftPackageTool.js';
import * as fs from 'fs';
import * as utils from '../../utils.js';

// Mock the modules
jest.mock('fs', () => ({
  existsSync: jest.fn()
}));

jest.mock('../../utils.js', () => ({
  execAsync: jest.fn()
}));

describe('BuildSwiftPackageTool Unit Tests', () => {
  let tool: BuildSwiftPackageTool;
  const mockExecAsync = utils.execAsync as jest.MockedFunction<typeof utils.execAsync>;
  const mockExistsSync = fs.existsSync as jest.MockedFunction<typeof fs.existsSync>;

  beforeEach(() => {
    jest.clearAllMocks();
    tool = new BuildSwiftPackageTool();
  });

  describe('Tool Definition', () => {
    test('should provide correct tool definition', () => {
      const definition = tool.getToolDefinition();
      
      expect(definition.name).toBe('build_swift_package');
      expect(definition.description).toBe('Build a Swift Package Manager package');
      expect(definition.inputSchema.required).toEqual(['packagePath']);
      expect(definition.inputSchema.properties.configuration.enum).toEqual(['Debug', 'Release']);
      expect(definition.inputSchema.properties.configuration.default).toBe('Debug');
    });
  });

  describe('Build Command Generation', () => {
    test('should build with debug configuration by default', async () => {
      mockExistsSync.mockReturnValue(true);
      mockExecAsync.mockResolvedValue({ stdout: '', stderr: '' });

      await tool.execute({
        packagePath: '/test/package'
      });

      expect(mockExecAsync).toHaveBeenCalledWith(
        'swift build --package-path "/test/package" -c debug',
        { maxBuffer: 10 * 1024 * 1024 }
      );
    });

    test('should build with release configuration when specified', async () => {
      mockExistsSync.mockReturnValue(true);
      mockExecAsync.mockResolvedValue({ stdout: '', stderr: '' });

      await tool.execute({
        packagePath: '/test/package',
        configuration: 'Release'
      });

      expect(mockExecAsync).toHaveBeenCalledWith(
        'swift build --package-path "/test/package" -c release',
        { maxBuffer: 10 * 1024 * 1024 }
      );
    });

    test('should add target flag when target is specified', async () => {
      mockExistsSync.mockReturnValue(true);
      mockExecAsync.mockResolvedValue({ stdout: '', stderr: '' });

      await tool.execute({
        packagePath: '/test/package',
        target: 'MyTarget'
      });

      expect(mockExecAsync).toHaveBeenCalledWith(
        'swift build --package-path "/test/package" -c debug --target "MyTarget"',
        { maxBuffer: 10 * 1024 * 1024 }
      );
    });

    test('should add product flag when product is specified', async () => {
      mockExistsSync.mockReturnValue(true);
      mockExecAsync.mockResolvedValue({ stdout: '', stderr: '' });

      await tool.execute({
        packagePath: '/test/package',
        product: 'MyProduct'
      });

      expect(mockExecAsync).toHaveBeenCalledWith(
        'swift build --package-path "/test/package" -c debug --product "MyProduct"',
        { maxBuffer: 10 * 1024 * 1024 }
      );
    });

    test('should handle both target and product together', async () => {
      mockExistsSync.mockReturnValue(true);
      mockExecAsync.mockResolvedValue({ stdout: '', stderr: '' });

      await tool.execute({
        packagePath: '/test/package',
        target: 'MyTarget',
        product: 'MyProduct',
        configuration: 'Release'
      });

      expect(mockExecAsync).toHaveBeenCalledWith(
        'swift build --package-path "/test/package" -c release --target "MyTarget" --product "MyProduct"',
        { maxBuffer: 10 * 1024 * 1024 }
      );
    });
  });

  describe('Path Handling', () => {
    test('should extract directory from Package.swift path', async () => {
      mockExistsSync.mockReturnValue(true);
      mockExecAsync.mockResolvedValue({ stdout: '', stderr: '' });

      await tool.execute({
        packagePath: '/test/package/Package.swift'
      });

      expect(mockExecAsync).toHaveBeenCalledWith(
        'swift build --package-path "/test/package" -c debug',
        { maxBuffer: 10 * 1024 * 1024 }
      );
    });

    test('should use directory path directly', async () => {
      mockExistsSync.mockReturnValue(true);
      mockExecAsync.mockResolvedValue({ stdout: '', stderr: '' });

      await tool.execute({
        packagePath: '/test/package'
      });

      expect(mockExecAsync).toHaveBeenCalledWith(
        'swift build --package-path "/test/package" -c debug',
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

  describe('Success Response', () => {
    test('should return success message with configuration', async () => {
      mockExistsSync.mockReturnValue(true);
      mockExecAsync.mockResolvedValue({ stdout: '', stderr: '' });

      const result = await tool.execute({
        packagePath: '/test/package',
        configuration: 'Release'
      });

      expect(result.content[0].text).toContain('Build succeeded: package');
      expect(result.content[0].text).toContain('Configuration: Release');
    });

    test('should include target in success message', async () => {
      mockExistsSync.mockReturnValue(true);
      mockExecAsync.mockResolvedValue({ stdout: '', stderr: '' });

      const result = await tool.execute({
        packagePath: '/test/package',
        target: 'MyTarget'
      });

      expect(result.content[0].text).toContain('Target: MyTarget');
    });

    test('should include product in success message', async () => {
      mockExistsSync.mockReturnValue(true);
      mockExecAsync.mockResolvedValue({ stdout: '', stderr: '' });

      const result = await tool.execute({
        packagePath: '/test/package',
        product: 'MyProduct'
      });

      expect(result.content[0].text).toContain('Product: MyProduct');
    });
  });

  describe('Error Handling', () => {
    test('should return build output on failure', async () => {
      mockExistsSync.mockReturnValue(true);
      const buildError = new Error('Build failed') as any;
      buildError.stdout = 'error: no such module \'Foundation\'';
      buildError.stderr = '';
      mockExecAsync.mockRejectedValue(buildError);

      const result = await tool.execute({
        packagePath: '/test/package'
      });

      expect(result.content[0].text).toBe('error: no such module \'Foundation\'');
    });

    test('should return stderr if no stdout on failure', async () => {
      mockExistsSync.mockReturnValue(true);
      const buildError = new Error('Build failed') as any;
      buildError.stdout = '';
      buildError.stderr = 'fatal error: module not found';
      mockExecAsync.mockRejectedValue(buildError);

      const result = await tool.execute({
        packagePath: '/test/package'
      });

      expect(result.content[0].text).toBe('fatal error: module not found');
    });

    test('should return error message if no output available', async () => {
      mockExistsSync.mockReturnValue(true);
      const buildError = new Error('Command failed');
      mockExecAsync.mockRejectedValue(buildError);

      const result = await tool.execute({
        packagePath: '/test/package'
      });

      expect(result.content[0].text).toBe('Build failed: Command failed');
    });

    test('should handle Package.swift not found', async () => {
      mockExistsSync.mockReturnValue(false);

      const result = await tool.execute({
        packagePath: '/test/nonexistent'
      });

      expect(result.content[0].text).toBe('Build failed: No Package.swift found at: /test/nonexistent');
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
  });
});