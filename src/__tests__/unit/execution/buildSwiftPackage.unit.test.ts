/**
 * Unit tests for BuildSwiftPackageTool
 * Tests behavior with mocked dependencies
 */

import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import { BuildSwiftPackageTool } from '../../../tools/execution/BuildSwiftPackageTool.js';
import { SwiftPackage } from '../../../utils/projects/SwiftPackage.js';

describe('BuildSwiftPackageTool Unit Tests', () => {
  let tool: BuildSwiftPackageTool;
  
  // Create mock SwiftPackage with proper instanceof support
  const mockBuildPackage = jest.fn<(options?: any) => Promise<any>>();
  const mockSwiftPackage = Object.create(SwiftPackage.prototype);
  mockSwiftPackage.buildPackage = mockBuildPackage;
  mockSwiftPackage.path = '/test/package';
  
  // Mock Xcode
  const mockXcode = {
    open: jest.fn<(path: string, expectedType?: 'xcode' | 'swift-package' | 'auto') => Promise<any>>()
  };

  beforeEach(() => {
    jest.clearAllMocks();
    tool = new BuildSwiftPackageTool(mockXcode as any);
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
      mockXcode.open.mockResolvedValue(mockSwiftPackage);
      mockBuildPackage.mockResolvedValue({
        success: true,
        output: 'Build succeeded'
      });

      const result = await tool.execute({
        packagePath: '/test/package'
      });

      expect(mockBuildPackage).toHaveBeenCalledWith({
        configuration: 'Debug',
        target: undefined,
        product: undefined
      });
      expect(result.content[0].text).toContain('Build succeeded');
    });

    test('should build with release configuration', async () => {
      mockXcode.open.mockResolvedValue(mockSwiftPackage);
      mockBuildPackage.mockResolvedValue({
        success: true,
        output: 'Build succeeded'
      });

      await tool.execute({
        packagePath: '/test/package',
        configuration: 'Release'
      });

      expect(mockBuildPackage).toHaveBeenCalledWith({
        configuration: 'Release',
        target: undefined,
        product: undefined
      });
    });

    test('should build specific target', async () => {
      mockXcode.open.mockResolvedValue(mockSwiftPackage);
      mockBuildPackage.mockResolvedValue({
        success: true,
        output: 'Build succeeded'
      });

      await tool.execute({
        packagePath: '/test/package',
        target: 'MyLibrary'
      });

      expect(mockBuildPackage).toHaveBeenCalledWith({
        configuration: 'Debug',
        target: 'MyLibrary',
        product: undefined
      });
    });

    test('should build specific product', async () => {
      mockXcode.open.mockResolvedValue(mockSwiftPackage);
      mockBuildPackage.mockResolvedValue({
        success: true,
        output: 'Build succeeded'
      });

      await tool.execute({
        packagePath: '/test/package',
        product: 'MyExecutable'
      });

      expect(mockBuildPackage).toHaveBeenCalledWith({
        configuration: 'Debug',
        target: undefined,
        product: 'MyExecutable'
      });
    });

    test('should handle both target and product together', async () => {
      mockXcode.open.mockResolvedValue(mockSwiftPackage);
      mockBuildPackage.mockResolvedValue({
        success: true,
        output: 'Build succeeded'
      });

      await tool.execute({
        packagePath: '/test/package',
        target: 'MyLibrary',
        product: 'MyExecutable'
      });

      expect(mockBuildPackage).toHaveBeenCalledWith({
        configuration: 'Debug',
        target: 'MyLibrary',
        product: 'MyExecutable'
      });
    });
  });

  describe('Path Handling', () => {
    test('should accept package directory path', async () => {
      mockXcode.open.mockResolvedValue(mockSwiftPackage);
      mockBuildPackage.mockResolvedValue({
        success: true,
        output: 'Build succeeded'
      });

      await tool.execute({
        packagePath: '/test/MyPackage'
      });

      expect(mockXcode.open).toHaveBeenCalledWith('/test/MyPackage', 'swift-package');
    });

    test('should accept Package.swift path directly', async () => {
      mockXcode.open.mockResolvedValue(mockSwiftPackage);
      mockBuildPackage.mockResolvedValue({
        success: true,
        output: 'Build succeeded'
      });

      await tool.execute({
        packagePath: '/test/MyPackage/Package.swift'
      });

      expect(mockXcode.open).toHaveBeenCalledWith('/test/MyPackage/Package.swift', 'swift-package');
    });
  });

  describe('Error Handling', () => {
    test('should handle non-Swift package', async () => {
      mockXcode.open.mockResolvedValue({ type: 'xcode-project' });

      const result = await tool.execute({
        packagePath: '/test/project.xcodeproj'
      });

      expect(result.content[0].text).toContain('No Package.swift found at: /test/project.xcodeproj');
    });

    test('should handle build failure', async () => {
      mockXcode.open.mockResolvedValue(mockSwiftPackage);
      mockBuildPackage.mockResolvedValue({
        success: false,
        output: 'error: no such module \'Foundation\''
      });

      const result = await tool.execute({
        packagePath: '/test/package'
      });

      expect(result.content[0].text).toContain('error: no such module \'Foundation\'');
    });

    test('should handle build throwing error', async () => {
      mockXcode.open.mockResolvedValue(mockSwiftPackage);
      const error = new Error('Build process failed') as any;
      error.stdout = 'Building...';
      error.stderr = 'error: compilation failed';
      mockBuildPackage.mockRejectedValue(error);

      const result = await tool.execute({
        packagePath: '/test/package'
      });

      // The tool should handle the error and return the output
      expect(result.content[0].text).toContain('Build failed');
    });

    test('should handle Xcode.open throwing error', async () => {
      const error = new Error('Package.swift not found');
      mockXcode.open.mockRejectedValue(error);

      const result = await tool.execute({
        packagePath: '/test/NonExistent'
      });

      expect(result.content[0].text).toContain('Build failed');
      expect(result.content[0].text).toContain('Package.swift not found');
    });
  });

  describe('Output Formatting', () => {
    test('should format success output correctly', async () => {
      mockXcode.open.mockResolvedValue(mockSwiftPackage);
      mockBuildPackage.mockResolvedValue({
        success: true,
        output: 'Build complete!'
      });

      const result = await tool.execute({
        packagePath: '/test/MyPackage',
        configuration: 'Release'
      });

      expect(result.content[0].text).toBe('✅ Build succeeded: package\nConfiguration: Release');
    });

    test('should include target in output when specified', async () => {
      mockXcode.open.mockResolvedValue(mockSwiftPackage);
      mockBuildPackage.mockResolvedValue({
        success: true,
        output: 'Build complete!'
      });

      const result = await tool.execute({
        packagePath: '/test/MyPackage',
        target: 'MyLibrary'
      });

      expect(result.content[0].text).toContain('Target: MyLibrary');
    });

    test('should include product in output when specified', async () => {
      mockXcode.open.mockResolvedValue(mockSwiftPackage);
      mockBuildPackage.mockResolvedValue({
        success: true,
        output: 'Build complete!'
      });

      const result = await tool.execute({
        packagePath: '/test/MyPackage',
        product: 'MyApp'
      });

      expect(result.content[0].text).toContain('Product: MyApp');
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
  });
});