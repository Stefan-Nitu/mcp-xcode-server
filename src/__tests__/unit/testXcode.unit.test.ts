/**
 * Unit tests for TestXcodeTool
 * Tests behavior with mocked dependencies
 */

import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import { TestXcodeTool } from '../../tools/TestXcodeTool.js';
import { XcodeProject } from '../../utils/projects/XcodeProject.js';
import { Platform } from '../../types.js';
import * as fs from 'fs';
import * as platformHandler from '../../platformHandler.js';

// Mock the modules
jest.mock('fs', () => ({
  existsSync: jest.fn()
}));

jest.mock('../../platformHandler.js', () => ({
  PlatformHandler: {
    needsSimulator: jest.fn()
  }
}));

describe('TestXcodeTool Unit Tests', () => {
  let tool: TestXcodeTool;
  const mockExistsSync = fs.existsSync as jest.MockedFunction<typeof fs.existsSync>;
  const mockNeedsSimulator = platformHandler.PlatformHandler.needsSimulator as jest.MockedFunction<typeof platformHandler.PlatformHandler.needsSimulator>;
  
  // Create mock XcodeProject with proper instanceof support
  const mockTest = jest.fn<(options: any) => Promise<any>>();
  const mockXcodeProject = Object.create(XcodeProject.prototype);
  mockXcodeProject.test = mockTest;
  mockXcodeProject.path = '/test/project.xcodeproj';
  
  // Mock Xcode
  const mockXcode = {
    open: jest.fn<(path: string) => Promise<any>>()
  };
  
  // Mock Device
  const mockDevice = {
    id: 'mock-device-id',
    name: 'Mock Device',
    ensureBooted: jest.fn<() => Promise<void>>(),
    open: jest.fn<() => Promise<void>>()
  };
  
  // Mock Devices
  const mockDevices = {
    find: jest.fn<(nameOrId: string) => Promise<any>>()
  };

  beforeEach(() => {
    jest.clearAllMocks();
    tool = new TestXcodeTool(
      mockDevices as any,
      mockXcode as any
    );
  });

  describe('Tool Definition', () => {
    test('should provide correct tool definition', () => {
      const definition = tool.getToolDefinition();
      
      expect(definition.name).toBe('test_xcode');
      expect(definition.description).toBe('Run tests for an Xcode project or workspace');
      expect(definition.inputSchema.required).toEqual(['projectPath', 'scheme']);
      expect(definition.inputSchema.properties.platform.enum).toEqual(['iOS', 'macOS', 'tvOS', 'watchOS', 'visionOS']);
      expect(definition.inputSchema.properties.platform.default).toBe('iOS');
      expect(definition.inputSchema.properties.configuration.default).toBe('Debug');
    });
  });

  describe('Test Execution', () => {
    test('should run tests successfully', async () => {
      mockExistsSync.mockReturnValue(true);
      mockNeedsSimulator.mockReturnValue(false);
      mockXcode.open.mockResolvedValue(mockXcodeProject);
      mockTest.mockResolvedValue({
        success: true,
        output: 'All tests passed',
        passed: 10,
        failed: 0
      });

      const result = await tool.execute({
        projectPath: '/test/project.xcodeproj',
        scheme: 'MyScheme',
        platform: 'macOS'
      });

      expect(mockTest).toHaveBeenCalledWith({
        scheme: 'MyScheme',
        configuration: 'Debug',
        platform: 'macOS',
        deviceId: undefined,
        testTarget: undefined,
        testFilter: undefined
      });
      
      expect(result.content[0].text).toContain('Tests passed: 10 passed, 0 failed');
      expect(result.content[0].text).toContain('Platform: macOS');
    });

    test('should handle test failures', async () => {
      mockExistsSync.mockReturnValue(true);
      mockNeedsSimulator.mockReturnValue(false);
      mockXcode.open.mockResolvedValue(mockXcodeProject);
      mockTest.mockResolvedValue({
        success: false,
        output: 'Test failures detected',
        passed: 8,
        failed: 2
      });

      const result = await tool.execute({
        projectPath: '/test/project.xcodeproj',
        scheme: 'MyScheme'
      });

      expect(result.content[0].text).toContain('Tests failed: 8 passed, 2 failed');
      // The output is now in the Test Results section
      expect(result.content[0].text).toContain('Test Results:');
    });

    test('should boot simulator for iOS tests with deviceId', async () => {
      mockExistsSync.mockReturnValue(true);
      mockNeedsSimulator.mockReturnValue(true);
      mockXcode.open.mockResolvedValue(mockXcodeProject);
      mockDevices.find.mockResolvedValue(mockDevice);
      mockDevice.ensureBooted.mockResolvedValue(undefined);
      mockTest.mockResolvedValue({
        success: true,
        output: 'Tests passed',
        passed: 5,
        failed: 0
      });

      await tool.execute({
        projectPath: '/test/project.xcodeproj',
        scheme: 'MyScheme',
        platform: 'iOS',
        deviceId: 'my-device'
      });

      expect(mockDevices.find).toHaveBeenCalledWith('my-device');
      expect(mockDevice.ensureBooted).toHaveBeenCalled();
      expect(mockTest).toHaveBeenCalledWith(
        expect.objectContaining({
          deviceId: 'mock-device-id'
        })
      );
    });

    test('should pass test target and filter', async () => {
      mockExistsSync.mockReturnValue(true);
      mockNeedsSimulator.mockReturnValue(false);
      mockXcode.open.mockResolvedValue(mockXcodeProject);
      mockTest.mockResolvedValue({
        success: true,
        output: 'Filtered tests passed',
        passed: 3,
        failed: 0
      });

      const result = await tool.execute({
        projectPath: '/test/project.xcodeproj',
        scheme: 'MyScheme',
        testTarget: 'MyAppTests',
        testFilter: 'testLogin'
      });

      expect(mockTest).toHaveBeenCalledWith(
        expect.objectContaining({
          testTarget: 'MyAppTests',
          testFilter: 'testLogin'
        })
      );
      
      expect(result.content[0].text).toContain('Test Target: MyAppTests');
      expect(result.content[0].text).toContain('Filter: testLogin');
    });

    test('should use Release configuration', async () => {
      mockExistsSync.mockReturnValue(true);
      mockNeedsSimulator.mockReturnValue(false);
      mockXcode.open.mockResolvedValue(mockXcodeProject);
      mockTest.mockResolvedValue({
        success: true,
        output: 'Tests passed',
        passed: 10,
        failed: 0
      });

      await tool.execute({
        projectPath: '/test/project.xcodeproj',
        scheme: 'MyScheme',
        configuration: 'Release'
      });

      expect(mockTest).toHaveBeenCalledWith(
        expect.objectContaining({
          configuration: 'Release'
        })
      );
    });
  });

  describe('Error Handling', () => {
    test('should handle project not existing', async () => {
      mockExistsSync.mockReturnValue(false);

      const result = await tool.execute({
        projectPath: '/non/existent/project.xcodeproj',
        scheme: 'MyScheme'
      });

      expect(result.content[0].text).toContain('Test execution failed: Project path does not exist');
    });

    test('should handle non-Xcode project', async () => {
      mockExistsSync.mockReturnValue(true);
      mockXcode.open.mockResolvedValue({ type: 'swift-package' });

      const result = await tool.execute({
        projectPath: '/test/Package.swift',
        scheme: 'MyScheme'
      });

      expect(result.content[0].text).toContain('Test execution failed: Not an Xcode project or workspace');
    });

    test('should handle device not found', async () => {
      mockExistsSync.mockReturnValue(true);
      mockNeedsSimulator.mockReturnValue(true);
      mockXcode.open.mockResolvedValue(mockXcodeProject);
      mockDevices.find.mockResolvedValue(null);

      const result = await tool.execute({
        projectPath: '/test/project.xcodeproj',
        scheme: 'MyScheme',
        platform: 'iOS',
        deviceId: 'non-existent'
      });

      expect(result.content[0].text).toContain('Test execution failed: Device not found: non-existent');
    });

    test('should handle build/setup errors', async () => {
      mockExistsSync.mockReturnValue(true);
      mockNeedsSimulator.mockReturnValue(false);
      mockXcode.open.mockResolvedValue(mockXcodeProject);
      mockTest.mockResolvedValue({
        success: false,
        output: 'Build failed: Missing dependency',
        passed: 0,
        failed: 0
      });

      const result = await tool.execute({
        projectPath: '/test/project.xcodeproj',
        scheme: 'MyScheme'
      });

      expect(result.content[0].text).toContain('Test execution failed: Build failed: Missing dependency');
    });

    test('should handle test method throwing error', async () => {
      mockExistsSync.mockReturnValue(true);
      mockNeedsSimulator.mockReturnValue(false);
      mockXcode.open.mockResolvedValue(mockXcodeProject);
      
      const error = new Error('Unexpected test error') as any;
      error.stdout = 'Build output...';
      error.stderr = 'Error details...';
      mockTest.mockRejectedValue(error);

      const result = await tool.execute({
        projectPath: '/test/project.xcodeproj',
        scheme: 'MyScheme'
      });

      expect(result.content[0].text).toContain('Test execution failed: Unexpected test error');
      expect(result.content[0].text).toContain('Build output...');
    });
  });

  describe('Input Validation', () => {
    test('should reject invalid platform', async () => {
      await expect(tool.execute({
        projectPath: '/test/project.xcodeproj',
        scheme: 'MyScheme',
        platform: 'Android'
      })).rejects.toThrow('Invalid enum value');
    });

    test('should accept custom configuration', async () => {
      mockExistsSync.mockReturnValue(true);
      mockNeedsSimulator.mockReturnValue(false);
      mockXcode.open.mockResolvedValue(mockXcodeProject);
      mockTest.mockResolvedValue({
        success: true,
        output: 'Tests passed',
        passed: 10,
        failed: 0
      });

      await tool.execute({
        projectPath: '/test/project.xcodeproj',
        scheme: 'MyScheme',
        configuration: 'Beta'
      });

      expect(mockTest).toHaveBeenCalledWith(
        expect.objectContaining({
          configuration: 'Beta'
        })
      );
    });

    test('should reject path traversal attempts', async () => {
      await expect(tool.execute({
        projectPath: '../../../etc/passwd',
        scheme: 'MyScheme'
      })).rejects.toThrow('Path traversal');
    });

    test('should reject command injection attempts', async () => {
      await expect(tool.execute({
        projectPath: '/test/project.xcodeproj; rm -rf /',
        scheme: 'MyScheme'
      })).rejects.toThrow('Command injection');
    });

    test('should display failing test names when available', async () => {
      mockExistsSync.mockReturnValue(true);
      mockNeedsSimulator.mockReturnValue(false);
      mockXcode.open.mockResolvedValue(mockXcodeProject);
      mockTest.mockResolvedValue({
        success: false,
        output: 'Test Case \'-[TestProjectXCTestTests.TestProjectXCTestTests testFailingTest]\' failed',
        passed: 7,
        failed: 1,
        failingTests: ['testFailingTest', 'testAnotherFailure']
      });

      const result = await tool.execute({
        projectPath: '/test/project.xcodeproj',
        scheme: 'MyScheme',
        platform: 'iOS'
      });

      expect(result.content[0].text).toContain('Tests failed: 7 passed, 1 failed');
      expect(result.content[0].text).toContain('Failing tests:');
      expect(result.content[0].text).toContain('- testFailingTest');
      expect(result.content[0].text).toContain('- testAnotherFailure');
    });
  });
});