/**
 * Unit tests for TestSwiftPackageTool
 * Tests behavior with mocked dependencies
 */

import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import { TestSwiftPackageTool } from '../../../tools/test/TestSwiftPackageTool.js';
import { SwiftPackage } from '../../../utils/projects/SwiftPackage.js';

describe('TestSwiftPackageTool Unit Tests', () => {
  let tool: TestSwiftPackageTool;
  
  // Create mock SwiftPackage with proper instanceof support
  const mockTest = jest.fn<(options: any) => Promise<any>>();
  const mockSwiftPackage = Object.create(SwiftPackage.prototype);
  mockSwiftPackage.test = mockTest;
  mockSwiftPackage.path = '/test/MyPackage';
  
  // Mock Xcode
  const mockXcode = {
    open: jest.fn<(path: string, expectedType?: 'xcode' | 'swift-package' | 'auto') => Promise<any>>()
  };

  beforeEach(() => {
    jest.clearAllMocks();
    tool = new TestSwiftPackageTool(mockXcode as any);
  });

  describe('Tool Definition', () => {
    test('should provide correct tool definition', () => {
      const definition = tool.getToolDefinition();
      
      expect(definition.name).toBe('test_swift_package');
      expect(definition.description).toBe('Run tests for a Swift Package Manager package');
      expect(definition.inputSchema.required).toEqual(['packagePath']);
      expect(definition.inputSchema.properties.configuration.enum).toEqual(['Debug', 'Release']);
      expect(definition.inputSchema.properties.configuration.default).toBe('Debug');
    });
  });

  describe('Test Execution', () => {
    test('should run all tests successfully', async () => {
      mockXcode.open.mockResolvedValue(mockSwiftPackage);
      mockTest.mockResolvedValue({
        success: true,
        output: 'All tests passed',
        passed: 15,
        failed: 0
      });

      const result = await tool.execute({
        packagePath: '/test/MyPackage'
      });

      expect(mockXcode.open).toHaveBeenCalledWith('/test/MyPackage', 'swift-package');
      expect(mockTest).toHaveBeenCalledWith({
        filter: undefined,
        configuration: 'Debug'
      });
      
      expect(result.content[0].text).toBe(
        '✅ Tests passed: 15 passed, 0 failed\n\n' +
        'Package: MyPackage\n' +
        'Configuration: Debug\n\n' +
        '📁 Full logs saved to: undefined'
      );
    });

    test('should run filtered tests', async () => {
      mockXcode.open.mockResolvedValue(mockSwiftPackage);
      mockTest.mockResolvedValue({
        success: true,
        output: 'Filtered tests passed',
        passed: 3,
        failed: 0
      });

      const result = await tool.execute({
        packagePath: '/test/MyPackage',
        filter: 'MyPackageTests.testSpecificFeature'
      });

      expect(mockTest).toHaveBeenCalledWith({
        filter: 'MyPackageTests.testSpecificFeature',
        configuration: 'Debug'
      });
      
      expect(result.content[0].text).toBe(
        '✅ Tests passed: 3 passed, 0 failed\n\n' +
        'Package: MyPackage\n' +
        'Configuration: Debug\n' +
        'Filter: MyPackageTests.testSpecificFeature\n\n' +
        '📁 Full logs saved to: undefined'
      );
    });

    test('should use Release configuration', async () => {
      mockXcode.open.mockResolvedValue(mockSwiftPackage);
      mockTest.mockResolvedValue({
        success: true,
        output: 'Tests passed',
        passed: 10,
        failed: 0
      });

      const result = await tool.execute({
        packagePath: '/test/MyPackage',
        configuration: 'Release'
      });

      expect(mockTest).toHaveBeenCalledWith({
        filter: undefined,
        configuration: 'Release'
      });
      
      expect(result.content[0].text).toBe(
        '✅ Tests passed: 10 passed, 0 failed\n\n' +
        'Package: MyPackage\n' +
        'Configuration: Release\n\n' +
        '📁 Full logs saved to: undefined'
      );
    });

    test('should handle test failures', async () => {
      mockXcode.open.mockResolvedValue(mockSwiftPackage);
      mockTest.mockResolvedValue({
        success: false,
        output: 'Test failures:\n- testExample failed\n- testPerformance failed',
        passed: 8,
        failed: 2
      });

      const result = await tool.execute({
        packagePath: '/test/MyPackage'
      });

      expect(result.content[0].text).toBe(
        '❌ Tests failed: 8 passed, 2 failed\n\n' +
        'Package: MyPackage\n' +
        'Configuration: Debug\n\n' +
        '📁 Full logs saved to: undefined'
      );
    });

    test('should report failing test names when available', async () => {
      mockXcode.open.mockResolvedValue(mockSwiftPackage);
      mockTest.mockResolvedValue({
        success: false,
        output: 'Test Case \'TestSwiftPackageXCTestTests.testExample\' failed\nTest Case \'TestSwiftPackageXCTestTests.testPerformance\' failed',
        passed: 8,
        failed: 2,
        failingTests: [
          { identifier: 'TestSwiftPackageXCTestTests.testExample', reason: 'Test failed' },
          { identifier: 'TestSwiftPackageXCTestTests.testPerformance', reason: 'Performance test failed' }
        ]
      });

      const result = await tool.execute({
        packagePath: '/test/MyPackage'
      });

      expect(result.content[0].text).toBe(
        '❌ Tests failed: 8 passed, 2 failed\n\n' +
        '**Failing tests:**\n' +
        '• TestSwiftPackageXCTestTests.testExample\n' +
        '  Test failed\n\n' +
        '• TestSwiftPackageXCTestTests.testPerformance\n' +
        '  Performance test failed\n\n' +
        'Package: MyPackage\n' +
        'Configuration: Debug\n\n' +
        '📁 Full logs saved to: undefined'
      );
    });

    test('should handle Package.swift path directly', async () => {
      mockXcode.open.mockResolvedValue(mockSwiftPackage);
      mockTest.mockResolvedValue({
        success: true,
        output: 'Tests passed',
        passed: 5,
        failed: 0
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

      const output = result.content[0].text;
      expect(output).toContain('❌ No Package.swift found at: /test/project.xcodeproj');
      expect(output).toContain('configuration: Debug');
    });

    test('should handle build/setup errors', async () => {
      mockXcode.open.mockResolvedValue(mockSwiftPackage);
      mockTest.mockResolvedValue({
        success: false,
        output: 'error: no such module \'XCTest\'',
        passed: 0,
        failed: 0,
        logPath: '/path/to/log'
      });

      const result = await tool.execute({
        packagePath: '/test/MyPackage'
      });

      expect(result.content[0].text).toBe(
        '❌ Test execution failed: no such module \'XCTest\'\n\n' +
        'Package: MyPackage\n' +
        'Configuration: Debug\n\n' +
        '📁 Full logs saved to: /path/to/log'
      );
    });

    test('should handle test method throwing error', async () => {
      mockXcode.open.mockResolvedValue(mockSwiftPackage);
      
      const error = new Error('Failed to resolve dependencies');
      mockTest.mockRejectedValue(error);

      const result = await tool.execute({
        packagePath: '/test/MyPackage'
      });

      const output = result.content[0].text;
      expect(output).toContain('❌ Failed to resolve dependencies');
      expect(output).toContain('configuration: Debug');
    });

    test('should handle Xcode.open throwing error', async () => {
      const error = new Error('Package.swift not found');
      mockXcode.open.mockRejectedValue(error);

      const result = await tool.execute({
        packagePath: '/test/NonExistent'
      });

      const output = result.content[0].text;
      expect(output).toContain('❌ Package.swift not found');
      expect(output).toContain('configuration: Debug');
    });
  });

  describe('Input Validation', () => {
    test('should reject invalid configuration', async () => {
      await expect(tool.execute({
        packagePath: '/test/MyPackage',
        configuration: 'Invalid'
      })).rejects.toThrow('Invalid enum value');
    });

    test('should reject path traversal attempts', async () => {
      await expect(tool.execute({
        packagePath: '../../../etc/passwd'
      })).rejects.toThrow('Path traversal');
    });

    test('should reject command injection attempts', async () => {
      await expect(tool.execute({
        packagePath: '/test/MyPackage; rm -rf /'
      })).rejects.toThrow('Command injection');
    });

    test('should accept valid paths', async () => {
      mockXcode.open.mockResolvedValue(mockSwiftPackage);
      mockTest.mockResolvedValue({
        success: true,
        output: 'Tests passed',
        passed: 1,
        failed: 0
      });

      // Should not throw
      await tool.execute({
        packagePath: '/Users/test/Projects/MyPackage'
      });

      await tool.execute({
        packagePath: './MyPackage'
      });

      await tool.execute({
        packagePath: '/test/Package.swift'
      });
    });
  });
});