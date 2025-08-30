/**
 * Unit tests for RunXcodeTool
 * Tests behavior with mocked dependencies
 */

import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import { RunXcodeTool } from '../../../tools/execution/RunXcodeTool.js';
import { XcodeProject } from '../../../utils/projects/XcodeProject.js';
import { Platform } from '../../../types.js';
import * as fs from 'fs';
import * as utils from '../../../utils.js';
import * as platformHandler from '../../../platformHandler.js';

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
    needsSimulator: jest.fn(),
    getDestination: jest.fn(),
    getGenericDestination: jest.fn()
  }
}));

// Mock the config module
jest.mock('../../../config.js', () => ({
  config: {
    getDerivedDataPath: jest.fn()
  }
}));

// Import after mocking
import { config } from '../../../config.js';

describe('RunXcodeTool Unit Tests', () => {
  let tool: RunXcodeTool;
  const mockExecAsync = utils.execAsync as jest.MockedFunction<typeof utils.execAsync>;
  const mockExistsSync = fs.existsSync as jest.MockedFunction<typeof fs.existsSync>;
  const mockNeedsSimulator = platformHandler.PlatformHandler.needsSimulator as jest.MockedFunction<typeof platformHandler.PlatformHandler.needsSimulator>;
  const mockGetDerivedDataPath = config.getDerivedDataPath as jest.MockedFunction<typeof config.getDerivedDataPath>;
  
  // Create a mock XcodeProject instance
  const mockBuildProject = jest.fn<(args: any) => Promise<any>>();
  const mockXcodeProject = Object.create(XcodeProject.prototype);
  mockXcodeProject.buildProject = mockBuildProject;
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
    install: jest.fn<(appPath: string) => Promise<void>>(),
    launch: jest.fn<(bundleId: string) => Promise<string>>(),
    getBundleId: jest.fn<(appPath: string) => Promise<string>>(),
    open: jest.fn<() => Promise<void>>(),
    setAppearance: jest.fn<(appearance: string) => Promise<void>>()
  };
  
  // Mock Devices
  const mockDevices = {
    find: jest.fn<(nameOrId: string) => Promise<any>>(),
    findForPlatform: jest.fn<(platform: string) => Promise<any>>()
  };

  beforeEach(() => {
    jest.clearAllMocks();
    tool = new RunXcodeTool(
      mockDevices as any,
      mockXcode as any
    );
  });

  describe('Tool Definition', () => {
    test('should provide correct tool definition', () => {
      const definition = tool.getToolDefinition();
      
      expect(definition.name).toBe('run_xcode');
      expect(definition.description).toBe('Build and run an Xcode project or workspace');
      expect(definition.inputSchema.required).toEqual(['projectPath', 'scheme']);
      expect(definition.inputSchema.properties.platform.enum).toEqual(['iOS', 'macOS', 'tvOS', 'watchOS', 'visionOS']);
      expect(definition.inputSchema.properties.platform.default).toBe('iOS');
      expect(definition.inputSchema.properties.configuration.default).toBe('Debug');
    });
  });

  describe('iOS App Running', () => {
    test('should boot simulator and run iOS app', async () => {
      // Setup mocks
      mockExistsSync.mockReturnValue(true);
      mockNeedsSimulator.mockReturnValue(true);
      mockXcode.open.mockResolvedValue(mockXcodeProject);
      mockDevices.find.mockResolvedValue(mockDevice);
      mockDevice.ensureBooted.mockResolvedValue(undefined);
      mockGetDerivedDataPath.mockReturnValue('./DerivedData');
      mockBuildProject.mockResolvedValue({
        success: true,
        output: 'Build succeeded',
        appPath: './DerivedData/Build/Products/Debug-iphonesimulator/MyApp.app'
      });
      mockDevice.install.mockResolvedValue(undefined);
      mockDevice.getBundleId.mockResolvedValue('com.example.app');
      mockDevice.launch.mockResolvedValue('12345');
      mockDevice.open.mockResolvedValue(undefined);
      mockDevice.setAppearance.mockResolvedValue(undefined);

      const result = await tool.execute({
        projectPath: '/test/project.xcodeproj',
        scheme: 'MyScheme',
        platform: 'iOS',
        deviceId: 'my-device'
      });

      // Verify device was found and booted
      expect(mockDevices.find).toHaveBeenCalledWith('my-device');
      expect(mockDevice.ensureBooted).toHaveBeenCalled();
      
      // Verify build was called with correct params
      expect(mockBuildProject).toHaveBeenCalledWith({
        scheme: 'MyScheme',
        configuration: 'Debug',
        platform: 'iOS',
        deviceId: 'mock-device-id',
        derivedDataPath: './DerivedData'
      });
      
      // Verify app was installed
      expect(mockDevice.install).toHaveBeenCalledWith(
        './DerivedData/Build/Products/Debug-iphonesimulator/MyApp.app'
      );
      
      expect(result.content[0].text).toContain('Successfully built and ran project: MyScheme');
      expect(result.content[0].text).toContain('Device: Mock Device');
    });

    test('should work without deviceId', async () => {
      mockExistsSync.mockReturnValue(true);
      mockNeedsSimulator.mockReturnValue(true);
      mockXcode.open.mockResolvedValue(mockXcodeProject);
      mockDevices.findForPlatform.mockResolvedValue(mockDevice);
      mockDevice.ensureBooted.mockResolvedValue(undefined);
      mockGetDerivedDataPath.mockReturnValue('./DerivedData');
      mockBuildProject.mockResolvedValue({
        success: true,
        output: 'Build succeeded',
        appPath: './DerivedData/Build/Products/Debug-iphonesimulator/MyApp.app'
      });
      mockDevice.install.mockResolvedValue(undefined);
      mockDevice.getBundleId.mockResolvedValue('com.example.app');
      mockDevice.launch.mockResolvedValue('12345');
      mockDevice.open.mockResolvedValue(undefined);
      mockDevice.setAppearance.mockResolvedValue(undefined);

      await tool.execute({
        projectPath: '/test/project.xcodeproj',
        scheme: 'MyScheme',
        platform: 'iOS'
      });

      // Should find device for platform
      expect(mockDevices.findForPlatform).toHaveBeenCalledWith('iOS');
      expect(mockDevice.ensureBooted).toHaveBeenCalled();
    });
  });

  describe('macOS App Running', () => {
    test('should launch macOS app without simulator', async () => {
      mockExistsSync.mockReturnValue(true);
      mockNeedsSimulator.mockReturnValue(false);
      mockXcode.open.mockResolvedValue(mockXcodeProject);
      mockGetDerivedDataPath.mockReturnValue('./DerivedData');
      mockBuildProject.mockResolvedValue({
        success: true,
        output: 'Build succeeded',
        appPath: './DerivedData/Build/Products/Debug/MyApp.app'
      });
      mockExecAsync.mockResolvedValue({ stdout: '', stderr: '' });

      const result = await tool.execute({
        projectPath: '/test/project.xcodeproj',
        scheme: 'MyScheme',
        platform: 'macOS'
      });

      // Should not try to find device
      expect(mockDevices.find).not.toHaveBeenCalled();
      expect(mockDevices.findForPlatform).not.toHaveBeenCalled();
      
      // Should build without deviceId
      expect(mockBuildProject).toHaveBeenCalledWith({
        scheme: 'MyScheme',
        configuration: 'Debug',
        platform: 'macOS',
        deviceId: undefined,
        derivedDataPath: './DerivedData'
      });
      
      // Should launch using open command with absolute path
      expect(mockExecAsync).toHaveBeenCalledWith(
        expect.stringContaining('open')
      );
      expect(mockExecAsync).toHaveBeenCalledWith(
        expect.stringContaining('MyApp.app')
      );
      
      expect(result.content[0].text).toContain('Successfully built and ran project');
    });

    test('should handle macOS app launch failure gracefully', async () => {
      mockExistsSync.mockReturnValue(true);
      mockNeedsSimulator.mockReturnValue(false);
      mockXcode.open.mockResolvedValue(mockXcodeProject);
      mockGetDerivedDataPath.mockReturnValue('./DerivedData');
      mockBuildProject.mockResolvedValue({
        success: true,
        output: 'Build succeeded',
        appPath: './DerivedData/Build/Products/Debug/MyApp.app'
      });
      mockExecAsync.mockRejectedValue(new Error('Failed to launch'));

      const result = await tool.execute({
        projectPath: '/test/project.xcodeproj',
        scheme: 'MyScheme',
        platform: 'macOS'
      });

      // Should still report success even if launch fails
      expect(result.content[0].text).toContain('Successfully built and ran project');
    });
  });

  describe('Other Platforms', () => {
    test('should handle tvOS platform', async () => {
      mockExistsSync.mockReturnValue(true);
      mockNeedsSimulator.mockReturnValue(true);
      mockXcode.open.mockResolvedValue(mockXcodeProject);
      mockDevices.findForPlatform.mockResolvedValue(mockDevice);
      mockDevice.ensureBooted.mockResolvedValue(undefined);
      mockGetDerivedDataPath.mockReturnValue('./DerivedData');
      mockBuildProject.mockResolvedValue({
        success: true,
        output: 'Build succeeded',
        appPath: './DerivedData/Build/Products/Debug-appletvsimulator/MyApp.app'
      });
      mockDevice.install.mockResolvedValue(undefined);
      mockDevice.getBundleId.mockResolvedValue('com.example.app');
      mockDevice.launch.mockResolvedValue('12345');
      mockDevice.open.mockResolvedValue(undefined);
      mockDevice.setAppearance.mockResolvedValue(undefined);

      await tool.execute({
        projectPath: '/test/project.xcodeproj',
        scheme: 'MyScheme',
        platform: 'tvOS'
      });

      expect(mockDevices.findForPlatform).toHaveBeenCalledWith('tvOS');
    });

    test('should handle watchOS platform', async () => {
      mockExistsSync.mockReturnValue(true);
      mockNeedsSimulator.mockReturnValue(true);
      mockXcode.open.mockResolvedValue(mockXcodeProject);
      mockDevices.findForPlatform.mockResolvedValue(mockDevice);
      mockDevice.ensureBooted.mockResolvedValue(undefined);
      mockGetDerivedDataPath.mockReturnValue('./DerivedData');
      mockBuildProject.mockResolvedValue({
        success: true,
        output: 'Build succeeded',
        appPath: './DerivedData/Build/Products/Debug-watchsimulator/MyApp.app'
      });
      mockDevice.install.mockResolvedValue(undefined);
      mockDevice.getBundleId.mockResolvedValue('com.example.app');
      mockDevice.launch.mockResolvedValue('12345');
      mockDevice.open.mockResolvedValue(undefined);
      mockDevice.setAppearance.mockResolvedValue(undefined);

      await tool.execute({
        projectPath: '/test/project.xcodeproj',
        scheme: 'MyScheme',
        platform: 'watchOS'
      });

      expect(mockDevices.findForPlatform).toHaveBeenCalledWith('watchOS');
    });

    test('should handle visionOS platform', async () => {
      mockExistsSync.mockReturnValue(true);
      mockNeedsSimulator.mockReturnValue(true);
      mockXcode.open.mockResolvedValue(mockXcodeProject);
      mockDevices.findForPlatform.mockResolvedValue(mockDevice);
      mockDevice.ensureBooted.mockResolvedValue(undefined);
      mockGetDerivedDataPath.mockReturnValue('./DerivedData');
      mockBuildProject.mockResolvedValue({
        success: true,
        output: 'Build succeeded',
        appPath: './DerivedData/Build/Products/Debug-xrsimulator/MyApp.app'
      });
      mockDevice.install.mockResolvedValue(undefined);
      mockDevice.getBundleId.mockResolvedValue('com.example.app');
      mockDevice.launch.mockResolvedValue('12345');
      mockDevice.open.mockResolvedValue(undefined);
      mockDevice.setAppearance.mockResolvedValue(undefined);

      await tool.execute({
        projectPath: '/test/project.xcodeproj',
        scheme: 'MyScheme',
        platform: 'visionOS'
      });

      expect(mockDevices.findForPlatform).toHaveBeenCalledWith('visionOS');
    });
  });

  describe('Configuration Handling', () => {
    test('should pass Release configuration to build', async () => {
      mockExistsSync.mockReturnValue(true);
      mockNeedsSimulator.mockReturnValue(true);
      mockXcode.open.mockResolvedValue(mockXcodeProject);
      mockDevices.findForPlatform.mockResolvedValue(mockDevice);
      mockDevice.ensureBooted.mockResolvedValue(undefined);
      mockGetDerivedDataPath.mockReturnValue('./DerivedData');
      mockBuildProject.mockResolvedValue({
        success: true,
        output: 'Build succeeded',
        appPath: './DerivedData/Build/Products/Release-iphonesimulator/MyApp.app'
      });
      mockDevice.install.mockResolvedValue(undefined);
      mockDevice.getBundleId.mockResolvedValue('com.example.app');
      mockDevice.launch.mockResolvedValue('12345');
      mockDevice.open.mockResolvedValue(undefined);
      mockDevice.setAppearance.mockResolvedValue(undefined);

      await tool.execute({
        projectPath: '/test/project.xcodeproj',
        scheme: 'MyScheme',
        platform: 'iOS',
        configuration: 'Release'
      });

      expect(mockBuildProject).toHaveBeenCalledWith(
        expect.objectContaining({
          configuration: 'Release'
        })
      );
    });
  });

  describe('Error Handling', () => {
    test('should handle build failure', async () => {
      mockExistsSync.mockReturnValue(true);
      mockNeedsSimulator.mockReturnValue(true);
      mockXcode.open.mockResolvedValue(mockXcodeProject);
      mockDevices.findForPlatform.mockResolvedValue(mockDevice);
      mockDevice.ensureBooted.mockResolvedValue(undefined);
      mockGetDerivedDataPath.mockReturnValue('./DerivedData');
      
      // Build should throw an error when it fails, not return success: false
      const buildError = new Error('error message') as any;
      buildError.output = 'Build output with errors';
      buildError.logPath = '/path/to/log';
      mockBuildProject.mockRejectedValue(buildError);

      const result = await tool.execute({
        projectPath: '/test/project.xcodeproj',
        scheme: 'MyScheme',
        platform: 'iOS'
      });

      expect(result.content[0].text).toContain('❌ Build failed');
      expect(result.content[0].text).toContain('📍 error message');
      expect(result.content[0].text).toContain('Platform: iOS');
      expect(result.content[0].text).toContain('Configuration: Debug');
      expect(result.content[0].text).toContain('Scheme: MyScheme');
      expect(result.content[0].text).toContain('📁 Full logs saved to: /path/to/log');
    });

    test('should handle missing app path', async () => {
      mockExistsSync.mockReturnValue(true);
      mockNeedsSimulator.mockReturnValue(true);
      mockXcode.open.mockResolvedValue(mockXcodeProject);
      mockDevices.findForPlatform.mockResolvedValue(mockDevice);
      mockDevice.ensureBooted.mockResolvedValue(undefined);
      mockGetDerivedDataPath.mockReturnValue('./DerivedData');
      mockBuildProject.mockResolvedValue({
        success: true,
        output: 'Build succeeded',
        appPath: undefined
      });
      mockExecAsync.mockResolvedValue({ stdout: '', stderr: '' }); // find returns nothing

      const result = await tool.execute({
        projectPath: '/test/project.xcodeproj',
        scheme: 'MyScheme',
        platform: 'iOS'
      });

      expect(result.content[0].text).toContain('❌ Run failed');
      expect(result.content[0].text).toContain('Build succeeded but the app bundle could not be located');
      expect(result.content[0].text).toContain('Platform: iOS');
      expect(result.content[0].text).toContain('Configuration: Debug');
      expect(result.content[0].text).toContain('Scheme: MyScheme');
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

    test('should handle project not existing', async () => {
      mockExistsSync.mockReturnValue(false);

      const result = await tool.execute({
        projectPath: '/test/project.xcodeproj',
        scheme: 'MyScheme',
        platform: 'iOS'
      });

      expect(result.content[0].text).toContain('❌ No project found at: /test/project.xcodeproj');
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
        platform: 'InvalidPlatform'
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
        projectPath: '/test/project.xcodeproj; rm -rf /',
        scheme: 'MyScheme'
      })).rejects.toThrow('Command injection');
    });
  });
});