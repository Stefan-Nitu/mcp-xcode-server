/**
 * Unit tests for TestXcodeTool
 * Tests the behavior of running tests for Xcode projects
 */

import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import { TestXcodeTool } from '../../tools/TestXcodeTool.js';
import { Platform } from '../../types.js';

describe('TestXcodeTool', () => {
  let tool: TestXcodeTool;

  // Mock Devices
  const mockDevices = {
    find: jest.fn()
  };

  // Mock Xcode
  const mockXcode = {
    open: jest.fn()
  };

  beforeEach(() => {
    jest.clearAllMocks();
    tool = new TestXcodeTool(mockDevices as any, mockXcode as any);
  });

  describe('tool definition', () => {
    test('should provide correct tool definition', () => {
      const definition = tool.getToolDefinition();
      
      expect(definition.name).toBe('test_xcode');
      expect(definition.description).toContain('Run tests');
      expect(definition.inputSchema.required).toEqual(['projectPath', 'scheme']);
    });
  });

  describe('when running tests successfully', () => {
    test('should report passed tests with correct summary', async () => {
      const mockXcodeProject = {
        test: jest.fn().mockResolvedValue({
          success: true,
          output: 'Test output here',
          passed: 10,
          failed: 0
        })
      };
      
      (mockXcode.open as jest.Mock).mockResolvedValue(mockXcodeProject);

      const result = await tool.execute({
        projectPath: '/test/project.xcodeproj',
        scheme: 'MyScheme',
        platform: 'iOS'
      });

      expect(result.content[0].text).toContain('Tests passed: 10 passed, 0 failed');
      expect(result.content[0].text).toContain('Platform: iOS');
      expect(result.content[0].text).toContain('Test output here');
    });
  });

  describe('when tests fail', () => {
    test('should report failed tests with failure count', async () => {
      const mockXcodeProject = {
        test: jest.fn().mockResolvedValue({
          success: false,
          output: 'Test failures detected',
          passed: 8,
          failed: 2
        })
      };
      
      (mockXcode.open as jest.Mock).mockResolvedValue(mockXcodeProject);

      const result = await tool.execute({
        projectPath: '/test/project.xcodeproj',
        scheme: 'MyScheme',
        platform: 'iOS'
      });

      expect(result.content[0].text).toContain('Tests failed: 8 passed, 2 failed');
      expect(result.content[0].text).toContain('Test failures detected');
    });
  });

  describe('when using test filters', () => {
    test('should pass test target to underlying test method', async () => {
      const mockXcodeProject = {
        test: jest.fn().mockResolvedValue({
          success: true,
          output: '',
          passed: 5,
          failed: 0
        })
      };
      
      (mockXcode.open as jest.Mock).mockResolvedValue(mockXcodeProject);

      const result = await tool.execute({
        projectPath: '/test/project.xcodeproj',
        scheme: 'MyScheme',
        platform: 'iOS',
        testTarget: 'MyAppTests'
      });

      expect(mockXcodeProject.test).toHaveBeenCalledWith(
        expect.objectContaining({
          testTarget: 'MyAppTests'
        })
      );
      expect(result.content[0].text).toContain('Test Target: MyAppTests');
    });

    test('should pass test filter to underlying test method', async () => {
      const mockXcodeProject = {
        test: jest.fn().mockResolvedValue({
          success: true,
          output: '',
          passed: 1,
          failed: 0
        })
      };
      
      (mockXcode.open as jest.Mock).mockResolvedValue(mockXcodeProject);

      await tool.execute({
        projectPath: '/test/project.xcodeproj',
        scheme: 'MyScheme',
        platform: 'iOS',
        testFilter: 'testSpecificMethod'
      });

      expect(mockXcodeProject.test).toHaveBeenCalledWith(
        expect.objectContaining({
          testFilter: 'testSpecificMethod'
        })
      );
    });
  });

  describe('when using simulators', () => {
    test('should boot simulator for iOS platform when device specified', async () => {
      const mockDevice = {
        id: 'device-123',
        ensureBooted: jest.fn().mockResolvedValue(undefined)
      };
      
      const mockXcodeProject = {
        test: jest.fn().mockResolvedValue({
          success: true,
          output: '',
          passed: 10,
          failed: 0
        })
      };
      
      (mockDevices.find as jest.Mock).mockResolvedValue(mockDevice);
      (mockXcode.open as jest.Mock).mockResolvedValue(mockXcodeProject);

      await tool.execute({
        projectPath: '/test/project.xcodeproj',
        scheme: 'MyScheme',
        platform: 'iOS',
        deviceId: 'iPhone 15'
      });

      expect(mockDevices.find).toHaveBeenCalledWith('iPhone 15');
      expect(mockDevice.ensureBooted).toHaveBeenCalled();
      expect(mockXcodeProject.test).toHaveBeenCalledWith(
        expect.objectContaining({
          deviceId: 'device-123'
        })
      );
    });
  });

  describe('when project is not found', () => {
    test('should return error message', async () => {
      (mockXcode.open as jest.Mock).mockRejectedValue(new Error('Project path does not exist: /bad/path'));

      const result = await tool.execute({
        projectPath: '/bad/path',
        scheme: 'MyScheme'
      });

      expect(result.content[0].text).toContain('Test execution failed');
      expect(result.content[0].text).toContain('Project path does not exist');
    });
  });

  describe('when project is a Swift package', () => {
    test('should return error for wrong project type', async () => {
      const mockSwiftPackage = { /* not an XcodeProject */ };
      (mockXcode.open as jest.Mock).mockResolvedValue(mockSwiftPackage);

      const result = await tool.execute({
        projectPath: '/test/Package.swift',
        scheme: 'MyScheme'
      });

      expect(result.content[0].text).toContain('Not an Xcode project or workspace');
    });
  });

  describe('when build fails before tests run', () => {
    test('should return build error', async () => {
      const mockXcodeProject = {
        test: jest.fn().mockResolvedValue({
          success: false,
          output: 'Build failed: missing dependency',
          passed: 0,
          failed: 0
        })
      };
      
      (mockXcode.open as jest.Mock).mockResolvedValue(mockXcodeProject);

      const result = await tool.execute({
        projectPath: '/test/project.xcodeproj',
        scheme: 'MyScheme'
      });

      expect(result.content[0].text).toContain('Test execution failed');
      expect(result.content[0].text).toContain('Build failed: missing dependency');
    });
  });
});