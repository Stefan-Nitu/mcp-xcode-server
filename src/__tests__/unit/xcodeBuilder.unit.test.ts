/**
 * Unit tests for XcodeBuilder with dependency injection
 */

import { describe, test, expect, jest, beforeEach } from '@jest/globals';
import { XcodeBuilder } from '../../xcodeBuilder';
import { Platform } from '../../types';

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
}));

// Mock SimulatorManager
jest.mock('../../simulatorManager', () => ({
  SimulatorManager: {
    ensureSimulatorBooted: jest.fn(),
    installApp: jest.fn(),
  }
}));

// Mock PlatformHandler
jest.mock('../../platformHandler', () => ({
  PlatformHandler: {
    needsSimulator: jest.fn(),
    getDestination: jest.fn(),
  }
}));

describe('XcodeBuilder', () => {
  let mockExec: any;
  let mockExecAsync: jest.Mock<any>;
  let xcodeBuilder: XcodeBuilder;
  
  const { existsSync } = require('fs') as { existsSync: jest.MockedFunction<any> };
  const { SimulatorManager } = require('../../simulatorManager') as any;
  const { PlatformHandler } = require('../../platformHandler') as any;

  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();
    
    // Create a mock exec function that properly simulates Node's exec
    mockExecAsync = jest.fn<any>();
    mockExec = jest.fn();
    
    // Mock the promisify function to return our mockExecAsync
    const util = require('util');
    (util.promisify as jest.Mock).mockImplementation((fn: any) => {
      if (fn === mockExec) {
        return mockExecAsync;
      }
      // For other functions, return a basic mock
      return jest.fn();
    });
    
    // Create a new instance with the mock
    xcodeBuilder = new XcodeBuilder(mockExec as any);
    
    // Default mock implementations
    existsSync.mockReturnValue(true);
    PlatformHandler.needsSimulator.mockReturnValue(true);
    PlatformHandler.getDestination.mockReturnValue('platform=iOS Simulator,name=iPhone 15');
    SimulatorManager.ensureSimulatorBooted.mockResolvedValue('iPhone 15');
  });

  describe('buildProjectInstance', () => {
    test('should build iOS project successfully', async () => {
      const mockOutput = 'Build succeeded';
      
      mockExecAsync.mockResolvedValue({ stdout: mockOutput, stderr: '' });

      const result = await xcodeBuilder.buildProjectInstance({
        projectPath: '/path/to/project.xcodeproj',
        scheme: 'MyApp',
        platform: Platform.iOS,
        configuration: 'Debug'
      });

      expect(existsSync).toHaveBeenCalledWith('/path/to/project.xcodeproj');
      expect(SimulatorManager.ensureSimulatorBooted).toHaveBeenCalledWith(Platform.iOS, undefined);
      expect(mockExecAsync).toHaveBeenCalledWith(
        expect.stringContaining('xcodebuild -project "/path/to/project.xcodeproj"'),
        expect.objectContaining({ maxBuffer: 10 * 1024 * 1024 })
      );
      expect(result.success).toBe(true);
      expect(result.output).toBe(mockOutput);
    });

    test('should build workspace project', async () => {
      mockExecAsync.mockResolvedValue({ stdout: 'Build succeeded', stderr: '' });

      await xcodeBuilder.buildProjectInstance({
        projectPath: '/path/to/project.xcworkspace',
        scheme: 'MyApp',
        platform: Platform.iOS
      });

      expect(mockExecAsync).toHaveBeenCalledWith(
        expect.stringContaining('xcodebuild -workspace "/path/to/project.xcworkspace"'),
        expect.any(Object)
      );
    });

    test('should build macOS project without simulator', async () => {
      PlatformHandler.needsSimulator.mockReturnValue(false);
      PlatformHandler.getDestination.mockReturnValue('platform=macOS');
      
      mockExecAsync.mockResolvedValue({ stdout: 'Build succeeded', stderr: '' });

      await xcodeBuilder.buildProjectInstance({
        projectPath: '/path/to/project.xcodeproj',
        scheme: 'MyApp',
        platform: Platform.macOS
      });

      expect(SimulatorManager.ensureSimulatorBooted).not.toHaveBeenCalled();
      expect(mockExecAsync).toHaveBeenCalledWith(
        expect.stringContaining('platform=macOS'),
        expect.any(Object)
      );
    });

    test('should install app after successful build', async () => {
      // Mock both build and find app calls
      mockExecAsync
        .mockResolvedValueOnce({ stdout: 'Build succeeded', stderr: '' }) // build
        .mockResolvedValueOnce({ stdout: '/DerivedData/Build/Products/Debug-iphonesimulator/MyApp.app', stderr: '' }); // find app

      const result = await xcodeBuilder.buildProjectInstance({
        projectPath: '/path/to/project.xcodeproj',
        scheme: 'MyApp',
        platform: Platform.iOS
      });

      expect(SimulatorManager.installApp).toHaveBeenCalledWith(
        '/DerivedData/Build/Products/Debug-iphonesimulator/MyApp.app',
        'iPhone 15'
      );
      expect(result.appPath).toBe('/DerivedData/Build/Products/Debug-iphonesimulator/MyApp.app');
    });

    test('should throw error for non-existent project', async () => {
      existsSync.mockReturnValue(false);

      await expect(xcodeBuilder.buildProjectInstance({
        projectPath: '/nonexistent/project.xcodeproj',
        scheme: 'MyApp'
      })).rejects.toThrow('Project path does not exist: /nonexistent/project.xcodeproj');
    });

    test('should handle build failures', async () => {
      mockExecAsync.mockRejectedValue(new Error('Build failed'));

      await expect(xcodeBuilder.buildProjectInstance({
        projectPath: '/path/to/project.xcodeproj',
        scheme: 'MyApp'
      })).rejects.toThrow('Failed to build project: Build failed');
    });
  });

  describe('testProjectInstance', () => {
    test('should run tests successfully', async () => {
      const mockOutput = `
Test Suite 'All tests' passed.
 Executed 5 tests, with 0 failures
`;
      
      mockExecAsync.mockResolvedValue({ stdout: mockOutput, stderr: '' });

      const result = await xcodeBuilder.testProjectInstance({
        projectPath: '/path/to/project.xcodeproj',
        scheme: 'MyApp',
        platform: Platform.iOS
      });

      expect(mockExecAsync).toHaveBeenCalledWith(
        expect.stringContaining('xcodebuild test'),
        expect.any(Object)
      );
      expect(result.success).toBe(true);
      expect(result.testCount).toBe(5);
      expect(result.failureCount).toBe(0);
    });

    test('should handle test failures', async () => {
      const mockOutput = `
Test Suite 'All tests' failed.
 Executed 5 tests, with 2 failures
`;
      
      const error: any = new Error('Tests failed');
      error.stdout = mockOutput;
      mockExecAsync.mockRejectedValue(error);

      const result = await xcodeBuilder.testProjectInstance({
        projectPath: '/path/to/project.xcodeproj',
        scheme: 'MyApp'
      });

      expect(result.success).toBe(false);
      expect(result.testCount).toBe(5);
      expect(result.failureCount).toBe(2);
    });

    test('should apply test filters', async () => {
      mockExecAsync.mockResolvedValue({ stdout: 'Test output', stderr: '' });

      await xcodeBuilder.testProjectInstance({
        projectPath: '/path/to/project.xcodeproj',
        scheme: 'MyApp',
        testTarget: 'MyAppTests',
        testFilter: 'testExample'
      });

      expect(mockExecAsync).toHaveBeenCalledWith(
        expect.stringContaining('-only-testing:MyAppTests/testExample'),
        expect.any(Object)
      );
    });

    test('should disable parallel testing when requested', async () => {
      mockExecAsync.mockResolvedValue({ stdout: 'Test output', stderr: '' });

      await xcodeBuilder.testProjectInstance({
        projectPath: '/path/to/project.xcodeproj',
        scheme: 'MyApp',
        parallelTesting: false
      });

      expect(mockExecAsync).toHaveBeenCalledWith(
        expect.stringContaining('-parallel-testing-enabled NO'),
        expect.any(Object)
      );
    });

    test('should handle build errors during testing', async () => {
      mockExecAsync.mockRejectedValue(new Error('Build failed'));

      await expect(xcodeBuilder.testProjectInstance({
        projectPath: '/path/to/project.xcodeproj',
        scheme: 'MyApp'
      })).rejects.toThrow('Failed to run tests: Build failed');
    });
  });

  describe('testSPMModuleInstance', () => {
    test('should test macOS SPM package', async () => {
      const mockOutput = `
Test Suite 'All tests' passed.
 Executed 10 tests, with 0 failures
`;
      
      mockExecAsync.mockResolvedValue({ stdout: mockOutput, stderr: '' });

      const result = await xcodeBuilder.testSPMModuleInstance(
        '/path/to/package',
        Platform.macOS
      );

      expect(mockExecAsync).toHaveBeenCalledWith(
        'swift test --package-path "/path/to/package"',
        expect.objectContaining({ cwd: '/path/to/package' })
      );
      expect(result.success).toBe(true);
      expect(result.testCount).toBe(10);
    });

    test('should test iOS SPM package with xcodebuild', async () => {
      mockExecAsync.mockResolvedValue({ stdout: 'Test output', stderr: '' });

      await xcodeBuilder.testSPMModuleInstance(
        '/path/to/package',
        Platform.iOS,
        'MyTests',
        '17.2'
      );

      expect(mockExecAsync).toHaveBeenCalledWith(
        expect.stringContaining('xcodebuild test'),
        expect.any(Object)
      );
    });

    test('should apply test filter for macOS', async () => {
      mockExecAsync.mockResolvedValue({ stdout: 'Test output', stderr: '' });

      await xcodeBuilder.testSPMModuleInstance(
        '/path/to/package',
        Platform.macOS,
        'testExample'
      );

      expect(mockExecAsync).toHaveBeenCalledWith(
        expect.stringContaining('--filter "testExample"'),
        expect.any(Object)
      );
    });

    test('should throw error for non-existent package', async () => {
      existsSync.mockReturnValue(false);

      await expect(xcodeBuilder.testSPMModuleInstance(
        '/nonexistent/package',
        Platform.macOS
      )).rejects.toThrow('Package path does not exist: /nonexistent/package');
    });

    test('should throw error for missing Package.swift', async () => {
      existsSync.mockImplementation((path: string) => {
        return !path.includes('Package.swift');
      });

      await expect(xcodeBuilder.testSPMModuleInstance(
        '/path/to/package',
        Platform.macOS
      )).rejects.toThrow('No Package.swift found at: /path/to/package');
    });

    test('should handle test failures in SPM', async () => {
      const mockOutput = `
Test Suite 'MyPackageTests' failed.
 Executed 5 tests, with 1 failure
`;
      
      const error: any = new Error('Tests failed');
      error.stdout = mockOutput;
      mockExecAsync.mockRejectedValue(error);

      const result = await xcodeBuilder.testSPMModuleInstance(
        '/path/to/package',
        Platform.macOS
      );

      expect(result.success).toBe(false);
      expect(result.testCount).toBe(5);
      expect(result.failureCount).toBe(1);
      expect(result.errors).toBe('Tests failed');
    });
  });

  describe('parseTestOutput', () => {
    test('should parse XCTest framework output', () => {
      const output = `
Test Suite 'All tests' started.
Test Suite 'MyAppTests' started.
Test Case '-[MyAppTests testExample]' passed (0.001 seconds).
Test Suite 'MyAppTests' passed.
 Executed 1 test, with 0 failures
Test Suite 'All tests' passed.
 Executed 1 test, with 0 failures
`;
      
      const result = XcodeBuilder.parseTestOutput(output);
      
      expect(result.success).toBe(true);
      expect(result.testCount).toBe(1);
      expect(result.failureCount).toBe(0);
    });

    test('should parse Swift Testing framework output', () => {
      const output = `
◇ Test run started.
↳ Testing Library Version: 124.4
◇ Test example() started.
✔ Test example() passed after 0.001 seconds.
◇ Test anotherTest() started.
✔ Test anotherTest() passed after 0.002 seconds.
✔ Test run with 2 tests passed after 0.003 seconds.
`;
      
      const result = XcodeBuilder.parseTestOutput(output);
      
      expect(result.success).toBe(true);
      expect(result.testCount).toBe(2);
      expect(result.failureCount).toBe(0);
    });

    test('should parse Swift Testing failures', () => {
      const output = `
◇ Test run started.
◇ Test example() started.
✗ Test example() failed after 0.001 seconds.
◇ Test anotherTest() started.
✔ Test anotherTest() passed after 0.002 seconds.
✗ Test run with 2 tests failed after 0.003 seconds.
`;
      
      const result = XcodeBuilder.parseTestOutput(output);
      
      expect(result.success).toBe(false);
      expect(result.testCount).toBe(2);
      expect(result.failureCount).toBe(1);
    });

    test('should return full output', () => {
      const output = 'x'.repeat(5000);
      const result = XcodeBuilder.parseTestOutput(output);
      
      expect(result.output).toBe(output);
      expect(result.output.length).toBe(5000);
    });
  });
});