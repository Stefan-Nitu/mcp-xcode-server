/**
 * Unit tests for BuildXcodeTool
 * Tests behavior with mocked dependencies
 */

import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import { BuildXcodeTool } from '../../../tools/execution/BuildXcodeTool.js';
import { XcodeProject } from '../../../utils/projects/XcodeProject.js';
import * as fs from 'fs';
import * as utils from '../../../utils.js';
import * as platformHandler from '../../../platformHandler.js';
import { config } from '../../../config.js';

// Mock the modules
jest.mock('fs', () => ({
  existsSync: jest.fn(),
  mkdirSync: jest.fn(),
  readdirSync: jest.fn(() => []),
  statSync: jest.fn(() => ({ mtime: new Date() })),
  rmSync: jest.fn(),
  writeFileSync: jest.fn()
}));

jest.mock('os', () => ({
  homedir: jest.fn(() => '/mocked/home'),
  hostname: jest.fn(() => 'test-host')
}));

jest.mock('../../../utils.js', () => ({
  execAsync: jest.fn()
}));

jest.mock('../../../platformHandler.js', () => ({
  PlatformHandler: {
    needsSimulator: jest.fn()
  }
}));

jest.mock('../../../config.js', () => ({
  config: {
    getDerivedDataPath: jest.fn()
  }
}));

describe('BuildXcodeTool Unit Tests', () => {
  let tool: BuildXcodeTool;
  const mockExecAsync = utils.execAsync as jest.MockedFunction<typeof utils.execAsync>;
  const mockExistsSync = fs.existsSync as jest.MockedFunction<typeof fs.existsSync>;
  const mockNeedsSimulator = platformHandler.PlatformHandler.needsSimulator as jest.MockedFunction<typeof platformHandler.PlatformHandler.needsSimulator>;
  const mockGetDerivedDataPath = config.getDerivedDataPath as jest.MockedFunction<typeof config.getDerivedDataPath>;
  
  // Create mock XcodeProject with proper instanceof support
  const mockBuildProject = jest.fn<(options: any) => Promise<any>>();
  const mockXcodeProject = Object.create(XcodeProject.prototype);
  mockXcodeProject.buildProject = mockBuildProject;
  mockXcodeProject.path = '/test/project.xcodeproj';
  
  // Mock Xcode
  const mockXcode = {
    open: jest.fn<(path: string, expectedType?: 'xcode' | 'swift-package' | 'auto') => Promise<any>>()
  };
  
  // Mock Device
  const mockDevice = {
    id: 'booted-device-id',
    name: 'Mock Device',
    ensureBooted: jest.fn<() => Promise<void>>()
  };
  
  // Mock Devices
  const mockDevices = {
    find: jest.fn<(nameOrId: string) => Promise<any>>()
  };

  beforeEach(() => {
    jest.clearAllMocks();
    tool = new BuildXcodeTool(mockDevices as any, mockXcode as any);
    // Default setup
    mockGetDerivedDataPath.mockReturnValue('./DerivedData');
  });

  describe('Tool Definition', () => {
    test('should provide correct tool definition', () => {
      const definition = tool.getToolDefinition();
      
      expect(definition.name).toBe('build_xcode');
      expect(definition.description).toBe('Build an Xcode project or workspace');
      expect(definition.inputSchema.required).toEqual(['projectPath', 'scheme']);
      expect(definition.inputSchema.properties.platform.enum).toEqual(['iOS', 'macOS', 'tvOS', 'watchOS', 'visionOS']);
      expect(definition.inputSchema.properties.platform.default).toBe('iOS');
      expect(definition.inputSchema.properties.configuration.default).toBe('Debug');
    });
  });

  describe('Build Command Generation', () => {
    test('should build .xcodeproj with scheme', async () => {
      mockExistsSync.mockReturnValue(true);
      mockXcode.open.mockResolvedValue(mockXcodeProject);
      mockBuildProject.mockResolvedValue({
        success: true,
        output: 'Build succeeded',
        appPath: '/path/to/app.app'
      });

      const result = await tool.execute({
        projectPath: '/test/project.xcodeproj',
        scheme: 'MyScheme',
        platform: 'iOS'
      });

      expect(mockBuildProject).toHaveBeenCalledWith(
        expect.objectContaining({
          scheme: 'MyScheme',
          platform: 'iOS'
        })
      );
      expect(result.content[0].text).toContain('Build succeeded');
    });

    test('should build .xcworkspace', async () => {
      mockExistsSync.mockReturnValue(true);
      mockXcode.open.mockResolvedValue(mockXcodeProject);
      mockBuildProject.mockResolvedValue({
        success: true,
        output: 'Build succeeded',
        appPath: '/path/to/app.app'
      });

      await tool.execute({
        projectPath: '/test/workspace.xcworkspace',
        scheme: 'MyScheme',
        platform: 'iOS'
      });

      expect(mockXcode.open).toHaveBeenCalledWith('/test/workspace.xcworkspace', 'xcode');
      expect(mockBuildProject).toHaveBeenCalled();
    });

    test('should build without deviceId', async () => {
      mockExistsSync.mockReturnValue(true);
      mockXcode.open.mockResolvedValue(mockXcodeProject);
      mockBuildProject.mockResolvedValue({
        success: true,
        output: 'Build succeeded',
        appPath: undefined
      });

      await tool.execute({
        projectPath: '/test/project.xcodeproj',
        scheme: 'MyScheme',
        platform: 'iOS'
      });

      expect(mockBuildProject).toHaveBeenCalledWith(
        expect.objectContaining({
          deviceId: undefined
        })
      );
    });

    test('should boot simulator when deviceId specified for iOS', async () => {
      mockExistsSync.mockReturnValue(true);
      mockNeedsSimulator.mockReturnValue(true);
      mockXcode.open.mockResolvedValue(mockXcodeProject);
      mockDevices.find.mockResolvedValue(mockDevice);
      mockDevice.ensureBooted.mockResolvedValue(undefined);
      mockBuildProject.mockResolvedValue({
        success: true,
        output: 'Build succeeded'
      });

      await tool.execute({
        projectPath: '/test/project.xcodeproj',
        scheme: 'MyScheme',
        platform: 'iOS',
        deviceId: 'my-device'
      });

      expect(mockDevices.find).toHaveBeenCalledWith('my-device');
      expect(mockDevice.ensureBooted).toHaveBeenCalled();
      expect(mockBuildProject).toHaveBeenCalledWith(
        expect.objectContaining({
          deviceId: 'booted-device-id'
        })
      );
    });

    test('should build with Release configuration', async () => {
      mockExistsSync.mockReturnValue(true);
      mockXcode.open.mockResolvedValue(mockXcodeProject);
      mockBuildProject.mockResolvedValue({
        success: true,
        output: 'Build succeeded'
      });

      await tool.execute({
        projectPath: '/test/project.xcodeproj',
        scheme: 'MyScheme',
        configuration: 'Release'
      });

      expect(mockBuildProject).toHaveBeenCalledWith(
        expect.objectContaining({
          configuration: 'Release'
        })
      );
    });

    test('should build with custom configuration', async () => {
      mockExistsSync.mockReturnValue(true);
      mockXcode.open.mockResolvedValue(mockXcodeProject);
      mockBuildProject.mockResolvedValue({
        success: true,
        output: 'Build succeeded'
      });

      await tool.execute({
        projectPath: '/test/project.xcodeproj',
        scheme: 'MyScheme',
        configuration: 'Beta'
      });

      expect(mockBuildProject).toHaveBeenCalledWith(
        expect.objectContaining({
          configuration: 'Beta'
        })
      );
    });
  });

  describe('Output Handling', () => {
    test('should find and report app path after successful build', async () => {
      mockExistsSync.mockReturnValue(true);
      mockXcode.open.mockResolvedValue(mockXcodeProject);
      mockBuildProject.mockResolvedValue({
        success: true,
        output: 'Build succeeded',
        appPath: './DerivedData/Build/Products/Debug-iphonesimulator/MyApp.app'
      });

      const result = await tool.execute({
        projectPath: '/test/project.xcodeproj',
        scheme: 'MyScheme'
      });

      expect(result.content[0].text).toContain('Build succeeded: MyScheme');
      expect(result.content[0].text).toContain('App path: ./DerivedData/Build/Products/Debug-iphonesimulator/MyApp.app');
    });

    test('should handle missing app path gracefully', async () => {
      mockExistsSync.mockReturnValue(true);
      mockXcode.open.mockResolvedValue(mockXcodeProject);
      mockBuildProject.mockResolvedValue({
        success: true,
        output: 'Build succeeded',
        appPath: undefined
      });
      mockExecAsync.mockRejectedValue(new Error('find failed'));

      const result = await tool.execute({
        projectPath: '/test/project.xcodeproj',
        scheme: 'MyScheme'
      });

      expect(result.content[0].text).toContain('Build succeeded');
      expect(result.content[0].text).toContain('App path: N/A');
    });

    test('should detect when custom configuration falls back to Release', async () => {
      mockExistsSync.mockReturnValue(true);
      mockXcode.open.mockResolvedValue(mockXcodeProject);
      mockBuildProject.mockResolvedValue({
        success: true,
        output: 'Build succeeded',
        appPath: './DerivedData/Build/Products/Release-iphonesimulator/MyApp.app'
      });

      const result = await tool.execute({
        projectPath: '/test/project.xcodeproj',
        scheme: 'MyScheme',
        configuration: 'Beta'
      });

      expect(result.content[0].text).toContain('Configuration: Release - Beta configuration was not found');
    });
  });

  describe('Error Handling', () => {
    test('should handle non-existent project path', async () => {
      mockXcode.open.mockRejectedValue(new Error('No Xcode project found at: /non/existent/project.xcodeproj'));

      const result = await tool.execute({
        projectPath: '/non/existent/project.xcodeproj',
        scheme: 'MyScheme'
      });

      expect(result.content[0].text).toContain('❌ No Xcode project found at: /non/existent/project.xcodeproj');
      expect(result.content[0].text).toContain('Platform: iOS');
      expect(result.content[0].text).toContain('Configuration: Debug');
      expect(result.content[0].text).toContain('Scheme: MyScheme');
    });

    test('should handle non-Xcode project', async () => {
      mockExistsSync.mockReturnValue(true);
      mockXcode.open.mockResolvedValue({ type: 'swift-package' });

      const result = await tool.execute({
        projectPath: '/test/Package.swift',
        scheme: 'MyScheme'
      });

      expect(result.content[0].text).toContain('❌ Build failed');
      expect(result.content[0].text).toContain('Not an Xcode project or workspace');
      expect(result.content[0].text).toContain('Platform: iOS');
      expect(result.content[0].text).toContain('Configuration: Debug');
      expect(result.content[0].text).toContain('Scheme: MyScheme');
    });

    test('should handle build failure', async () => {
      mockExistsSync.mockReturnValue(true);
      mockXcode.open.mockResolvedValue(mockXcodeProject);
      mockBuildProject.mockResolvedValue({
        success: false,
        output: 'xcodebuild: error: Scheme "InvalidScheme" is not configured',
        logPath: '/path/to/build.log'
      });

      const result = await tool.execute({
        projectPath: '/test/project.xcodeproj',
        scheme: 'InvalidScheme'
      });

      expect(result.content[0].text).toContain('Scheme not found: "InvalidScheme"');
      expect(result.content[0].text).toContain('The specified scheme does not exist in the project');
      expect(result.content[0].text).toContain('📁 Full logs saved to: /path/to/build.log');
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

      expect(result.content[0].text).toContain('❌ Build failed');
      expect(result.content[0].text).toContain('Device not found: non-existent');
      expect(result.content[0].text).toContain('Platform: iOS');
      expect(result.content[0].text).toContain('Configuration: Debug');
      expect(result.content[0].text).toContain('Scheme: MyScheme');
    });

    test('should handle general errors', async () => {
      mockExistsSync.mockReturnValue(true);
      mockXcode.open.mockRejectedValue(new Error('Unknown error'));

      const result = await tool.execute({
        projectPath: '/test/project.xcodeproj',
        scheme: 'MyScheme'
      });

      expect(result.content[0].text).toContain('❌ Build failed');
      expect(result.content[0].text).toContain('Unknown error');
      expect(result.content[0].text).toContain('Platform: iOS');
      expect(result.content[0].text).toContain('Configuration: Debug');
      expect(result.content[0].text).toContain('Scheme: MyScheme');
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

    test('should reject path traversal attempts', async () => {
      await expect(tool.execute({
        projectPath: '../../../etc/passwd',
        scheme: 'MyScheme'
      })).rejects.toThrow('Path traversal');
    });

    test('should reject command injection attempts', async () => {
      await expect(tool.execute({
        projectPath: '/test; rm -rf /',
        scheme: 'MyScheme'
      })).rejects.toThrow('Command injection');
    });

    test('should require scheme parameter', async () => {
      await expect(tool.execute({
        projectPath: '/test/project.xcodeproj'
      })).rejects.toThrow();
    });
  });
});