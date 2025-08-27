/**
 * Unit tests for RunSwiftPackageTool
 * Tests behavior with mocked dependencies
 */

import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import { RunSwiftPackageTool } from '../../tools/RunSwiftPackageTool.js';
import { SwiftPackage } from '../../utils/projects/SwiftPackage.js';

describe('RunSwiftPackageTool Unit Tests', () => {
  let tool: RunSwiftPackageTool;
  
  // Create mock SwiftPackage with proper instanceof support
  const mockRun = jest.fn<(options?: any) => Promise<any>>();
  const mockSwiftPackage = Object.create(SwiftPackage.prototype);
  mockSwiftPackage.run = mockRun;
  mockSwiftPackage.path = '/test/package';
  
  // Mock Xcode
  const mockXcode = {
    open: jest.fn<(path: string) => Promise<any>>()
  };

  beforeEach(() => {
    jest.clearAllMocks();
    tool = new RunSwiftPackageTool(mockXcode as any);
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
      mockXcode.open.mockResolvedValue(mockSwiftPackage);
      mockRun.mockResolvedValue({
        success: true,
        output: 'Hello, World!'
      });

      const result = await tool.execute({
        packagePath: '/test/package'
      });

      expect(mockRun).toHaveBeenCalledWith({
        executable: undefined,
        configuration: 'Debug',
        arguments: undefined
      });
      expect(result.content[0].text).toBe(
        '✅ Execution completed: default executable\n' +
        'Configuration: Debug\n\n' +
        'Output:\n' +
        'Hello, World!'
      );
    });

    test('should run with release configuration', async () => {
      mockXcode.open.mockResolvedValue(mockSwiftPackage);
      mockRun.mockResolvedValue({
        success: true,
        output: 'Release output'
      });

      await tool.execute({
        packagePath: '/test/package',
        configuration: 'Release'
      });

      expect(mockRun).toHaveBeenCalledWith({
        executable: undefined,
        configuration: 'Release',
        arguments: undefined
      });
    });

    test('should run specific executable', async () => {
      mockXcode.open.mockResolvedValue(mockSwiftPackage);
      mockRun.mockResolvedValue({
        success: true,
        output: 'MyApp output'
      });

      const result = await tool.execute({
        packagePath: '/test/package',
        executable: 'MyApp'
      });

      expect(mockRun).toHaveBeenCalledWith({
        executable: 'MyApp',
        configuration: 'Debug',
        arguments: undefined
      });
      expect(result.content[0].text).toBe(
        '✅ Execution completed: MyApp\n' +
        'Configuration: Debug\n\n' +
        'Output:\n' +
        'MyApp output'
      );
    });

    test('should pass arguments to executable', async () => {
      mockXcode.open.mockResolvedValue(mockSwiftPackage);
      mockRun.mockResolvedValue({
        success: true,
        output: 'Args output'
      });

      await tool.execute({
        packagePath: '/test/package',
        executable: 'MyApp',
        arguments: ['--verbose', '--input', 'test.txt']
      });

      expect(mockRun).toHaveBeenCalledWith({
        executable: 'MyApp',
        configuration: 'Debug',
        arguments: ['--verbose', '--input', 'test.txt']
      });
    });

    test('should handle all parameters together', async () => {
      mockXcode.open.mockResolvedValue(mockSwiftPackage);
      mockRun.mockResolvedValue({
        success: true,
        output: 'Complete output'
      });

      await tool.execute({
        packagePath: '/test/package',
        executable: 'MyApp',
        configuration: 'Release',
        arguments: ['--help']
      });

      expect(mockRun).toHaveBeenCalledWith({
        executable: 'MyApp',
        configuration: 'Release',
        arguments: ['--help']
      });
    });
  });

  describe('Path Handling', () => {
    test('should accept package directory path', async () => {
      mockXcode.open.mockResolvedValue(mockSwiftPackage);
      mockRun.mockResolvedValue({
        success: true,
        output: 'Success'
      });

      await tool.execute({
        packagePath: '/test/MyPackage'
      });

      expect(mockXcode.open).toHaveBeenCalledWith('/test/MyPackage');
    });

    test('should accept Package.swift path directly', async () => {
      mockXcode.open.mockResolvedValue(mockSwiftPackage);
      mockRun.mockResolvedValue({
        success: true,
        output: 'Success'
      });

      await tool.execute({
        packagePath: '/test/MyPackage/Package.swift'
      });

      expect(mockXcode.open).toHaveBeenCalledWith('/test/MyPackage/Package.swift');
    });
  });

  describe('Output Formatting', () => {
    test('should format success output correctly', async () => {
      mockXcode.open.mockResolvedValue(mockSwiftPackage);
      mockRun.mockResolvedValue({
        success: true,
        output: 'Program output:\nLine 1\nLine 2\nDone!'
      });

      const result = await tool.execute({
        packagePath: '/test/package',
        executable: 'MyApp',
        configuration: 'Release'
      });

      expect(result.content[0].text).toBe(
        '✅ Execution completed: MyApp\n' +
        'Configuration: Release\n\n' +
        'Output:\n' +
        'Program output:\nLine 1\nLine 2\nDone!'
      );
    });

    test('should handle default executable name', async () => {
      mockXcode.open.mockResolvedValue(mockSwiftPackage);
      mockRun.mockResolvedValue({
        success: true,
        output: 'Default output'
      });

      const result = await tool.execute({
        packagePath: '/test/package'
      });

      expect(result.content[0].text).toBe(
        '✅ Execution completed: default executable\n' +
        'Configuration: Debug\n\n' +
        'Output:\n' +
        'Default output'
      );
    });
  });

  describe('Error Handling', () => {
    test('should handle non-Swift package', async () => {
      mockXcode.open.mockResolvedValue({ type: 'xcode-project' });

      const result = await tool.execute({
        packagePath: '/test/project.xcodeproj'
      });

      expect(result.content[0].text).toBe('❌ Run failed: No Package.swift found at: /test/project.xcodeproj');
    });

    test('should handle run failure', async () => {
      mockXcode.open.mockResolvedValue(mockSwiftPackage);
      mockRun.mockResolvedValue({
        success: false,
        output: 'error: no such module \'Foundation\''
      });

      const result = await tool.execute({
        packagePath: '/test/package'
      });

      expect(result.content[0].text).toBe('❌ Run failed: error: no such module \'Foundation\'');
    });

    test('should handle run throwing error', async () => {
      mockXcode.open.mockResolvedValue(mockSwiftPackage);
      const error = new Error('Execution failed') as any;
      error.stdout = 'Building...';
      error.stderr = 'error: compilation failed';
      mockRun.mockRejectedValue(error);

      const result = await tool.execute({
        packagePath: '/test/package'
      });

      expect(result.content[0].text).toBe('❌ Run failed: Execution failed');
    });

    test('should handle Xcode.open throwing error', async () => {
      const error = new Error('Package.swift not found');
      mockXcode.open.mockRejectedValue(error);

      const result = await tool.execute({
        packagePath: '/test/NonExistent'
      });

      expect(result.content[0].text).toBe('❌ Run failed: Package.swift not found');
    });

    test('should handle missing executable', async () => {
      mockXcode.open.mockResolvedValue(mockSwiftPackage);
      mockRun.mockResolvedValue({
        success: false,
        output: 'error: no executable product named \'NonExistent\''
      });

      const result = await tool.execute({
        packagePath: '/test/package',
        executable: 'NonExistent'
      });

      expect(result.content[0].text).toBe('❌ Run failed: error: no executable product named \'NonExistent\'');
    });
  });

  describe('Input Validation', () => {
    test('should reject invalid configuration', async () => {
      await expect(tool.execute({
        packagePath: '/test/package',
        configuration: 'Custom'
      })).rejects.toThrow('Invalid enum value');
    });

    test('should reject path traversal attempts', async () => {
      await expect(tool.execute({
        packagePath: '../../../etc/passwd'
      })).rejects.toThrow('Path traversal');
    });

    test('should reject command injection attempts', async () => {
      await expect(tool.execute({
        packagePath: '/test/package; rm -rf /'
      })).rejects.toThrow('Command injection');
    });

    test('should validate arguments array', async () => {
      mockXcode.open.mockResolvedValue(mockSwiftPackage);
      mockRun.mockResolvedValue({
        success: true,
        output: 'Success'
      });

      // Valid arguments should work
      await tool.execute({
        packagePath: '/test/package',
        arguments: ['arg1', 'arg2', 'arg3']
      });

      expect(mockRun).toHaveBeenCalledWith({
        executable: undefined,
        configuration: 'Debug',
        arguments: ['arg1', 'arg2', 'arg3']
      });
    });
  });
});