/**
 * Unit tests for TestSwiftPackageTool
 * Tests the behavior of running tests for Swift packages
 */

import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import { TestSwiftPackageTool } from '../../tools/TestSwiftPackageTool.js';

describe('TestSwiftPackageTool', () => {
  let tool: TestSwiftPackageTool;

  // Mock Xcode
  const mockXcode = {
    open: jest.fn()
  };

  beforeEach(() => {
    jest.clearAllMocks();
    tool = new TestSwiftPackageTool(mockXcode as any);
  });

  describe('tool definition', () => {
    test('should provide correct tool definition', () => {
      const definition = tool.getToolDefinition();
      
      expect(definition.name).toBe('test_swift_package');
      expect(definition.description).toContain('Run tests');
      expect(definition.description).toContain('Swift Package');
      expect(definition.inputSchema.required).toEqual(['packagePath']);
    });
  });

  describe('when running all tests successfully', () => {
    test('should report passed tests with summary', async () => {
      const mockSwiftPackage = {
        path: '/test/MyPackage',
        test: jest.fn().mockResolvedValue({
          success: true,
          output: 'All tests passed',
          passed: 25,
          failed: 0
        })
      };
      
      (mockXcode.open as jest.Mock).mockResolvedValue(mockSwiftPackage);

      const result = await tool.execute({
        packagePath: '/test/MyPackage'
      });

      expect(result.content[0].text).toContain('Tests passed: 25 passed, 0 failed');
      expect(result.content[0].text).toContain('Package: MyPackage');
      expect(result.content[0].text).toContain('Configuration: Debug');
      expect(result.content[0].text).toContain('All tests passed');
    });
  });

  describe('when tests fail', () => {
    test('should report failed tests with counts', async () => {
      const mockSwiftPackage = {
        path: '/test/MyPackage',
        test: jest.fn().mockResolvedValue({
          success: false,
          output: 'Test Suite failed',
          passed: 20,
          failed: 5
        })
      };
      
      (mockXcode.open as jest.Mock).mockResolvedValue(mockSwiftPackage);

      const result = await tool.execute({
        packagePath: '/test/MyPackage',
        configuration: 'Release'
      });

      expect(result.content[0].text).toContain('Tests failed: 20 passed, 5 failed');
      expect(result.content[0].text).toContain('Configuration: Release');
      expect(result.content[0].text).toContain('Test Suite failed');
    });
  });

  describe('when using test filters', () => {
    test('should pass filter to test method', async () => {
      const mockSwiftPackage = {
        path: '/test/MyPackage',
        test: jest.fn().mockResolvedValue({
          success: true,
          output: '',
          passed: 1,
          failed: 0
        })
      };
      
      (mockXcode.open as jest.Mock).mockResolvedValue(mockSwiftPackage);

      const result = await tool.execute({
        packagePath: '/test/MyPackage',
        filter: 'MyTests.testSpecificFunction'
      });

      expect(mockSwiftPackage.test).toHaveBeenCalledWith({
        filter: 'MyTests.testSpecificFunction',
        configuration: 'Debug'
      });
      expect(result.content[0].text).toContain('Filter: MyTests.testSpecificFunction');
    });
  });

  describe('when using different configurations', () => {
    test('should use Release configuration when specified', async () => {
      const mockSwiftPackage = {
        path: '/test/MyPackage',
        test: jest.fn().mockResolvedValue({
          success: true,
          output: '',
          passed: 10,
          failed: 0
        })
      };
      
      (mockXcode.open as jest.Mock).mockResolvedValue(mockSwiftPackage);

      await tool.execute({
        packagePath: '/test/MyPackage',
        configuration: 'Release'
      });

      expect(mockSwiftPackage.test).toHaveBeenCalledWith({
        configuration: 'Release'
      });
    });

    test('should default to Debug configuration', async () => {
      const mockSwiftPackage = {
        path: '/test/MyPackage',
        test: jest.fn().mockResolvedValue({
          success: true,
          output: '',
          passed: 10,
          failed: 0
        })
      };
      
      (mockXcode.open as jest.Mock).mockResolvedValue(mockSwiftPackage);

      await tool.execute({
        packagePath: '/test/MyPackage'
      });

      expect(mockSwiftPackage.test).toHaveBeenCalledWith({
        configuration: 'Debug'
      });
    });
  });

  describe('when package is not found', () => {
    test('should return error message', async () => {
      (mockXcode.open as jest.Mock).mockRejectedValue(new Error('No Package.swift found at: /bad/path'));

      const result = await tool.execute({
        packagePath: '/bad/path'
      });

      expect(result.content[0].text).toContain('Test execution failed');
      expect(result.content[0].text).toContain('No Package.swift found');
    });
  });

  describe('when project is an Xcode project', () => {
    test('should return error for wrong project type', async () => {
      const mockXcodeProject = { /* not a SwiftPackage */ };
      (mockXcode.open as jest.Mock).mockResolvedValue(mockXcodeProject);

      const result = await tool.execute({
        packagePath: '/test/project.xcodeproj'
      });

      expect(result.content[0].text).toContain('No Package.swift found');
    });
  });

  describe('when build fails before tests', () => {
    test('should return build error', async () => {
      const mockSwiftPackage = {
        path: '/test/MyPackage',
        test: jest.fn().mockResolvedValue({
          success: false,
          output: 'error: no such module "NonExistent"',
          passed: 0,
          failed: 0
        })
      };
      
      (mockXcode.open as jest.Mock).mockResolvedValue(mockSwiftPackage);

      const result = await tool.execute({
        packagePath: '/test/MyPackage'
      });

      expect(result.content[0].text).toContain('Test execution failed');
      expect(result.content[0].text).toContain('no such module');
    });
  });

  describe('when handling Package.swift directly', () => {
    test('should extract package name from path', async () => {
      const mockSwiftPackage = {
        path: '/test/packages/AwesomeKit',
        test: jest.fn().mockResolvedValue({
          success: true,
          output: '',
          passed: 15,
          failed: 0
        })
      };
      
      (mockXcode.open as jest.Mock).mockResolvedValue(mockSwiftPackage);

      const result = await tool.execute({
        packagePath: '/test/packages/AwesomeKit/Package.swift'
      });

      expect(result.content[0].text).toContain('Package: AwesomeKit');
    });
  });
});