/**
 * Unit tests for RunXcodeTool
 * Tests behavior with mocked dependencies
 */

import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import { RunXcodeTool } from '../../tools/RunXcodeTool.js';
import { BuildXcodeTool } from '../../tools/BuildXcodeTool.js';
import { InstallAppTool } from '../../tools/InstallAppTool.js';
import { Platform } from '../../types.js';
import * as utils from '../../utils.js';
import * as platformHandler from '../../platformHandler.js';

// Mock the modules
jest.mock('../../utils.js', () => ({
  execAsync: jest.fn()
}));

jest.mock('../../platformHandler.js', () => ({
  PlatformHandler: {
    needsSimulator: jest.fn(),
    getDestination: jest.fn(),
    getGenericDestination: jest.fn()
  }
}));

jest.mock('../../tools/BuildXcodeTool.js');
jest.mock('../../tools/InstallAppTool.js');

describe('RunXcodeTool Unit Tests', () => {
  let tool: RunXcodeTool;
  const mockExecAsync = utils.execAsync as jest.MockedFunction<typeof utils.execAsync>;
  const mockNeedsSimulator = platformHandler.PlatformHandler.needsSimulator as jest.MockedFunction<typeof platformHandler.PlatformHandler.needsSimulator>;
  
  // Mock dependencies
  const mockBuildTool = {
    execute: jest.fn<(args: any) => Promise<any>>(),
    getToolDefinition: jest.fn()
  };
  
  const mockSimulator = {
    boot: {
      ensureBooted: jest.fn<(platform: string, deviceId?: string) => Promise<string>>()
    },
    apps: {
      install: jest.fn<(appPath: string, deviceId?: string) => Promise<void>>(),
      getBundleId: jest.fn<(appPath: string) => Promise<string>>(),
      launch: jest.fn<(bundleId: string, deviceId?: string) => Promise<string>>()
    },
    ui: {
      open: jest.fn<() => Promise<void>>(),
      setAppearance: jest.fn<(appearance: 'light' | 'dark', deviceId?: string) => Promise<void>>()
    }
  };

  beforeEach(() => {
    jest.clearAllMocks();
    tool = new RunXcodeTool(
      mockBuildTool as any,
      mockSimulator as any
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
      mockNeedsSimulator.mockReturnValue(true);
      mockSimulator.boot.ensureBooted.mockResolvedValue('booted-device-id');
      mockBuildTool.execute.mockResolvedValue({
        content: [{
          type: 'text',
          text: 'Build succeeded: MyApp\nPlatform: iOS\nConfiguration: Debug\nApp path: ./DerivedData/Build/Products/Debug-iphonesimulator/MyApp.app'
        }]
      });
      mockSimulator.apps.install.mockResolvedValue(undefined);
      mockSimulator.apps.getBundleId.mockResolvedValue('com.example.MyApp');
      mockSimulator.apps.launch.mockResolvedValue('12345');
      mockSimulator.ui.open.mockResolvedValue(undefined);
      mockSimulator.ui.setAppearance.mockResolvedValue(undefined);

      const result = await tool.execute({
        projectPath: '/test/project.xcodeproj',
        scheme: 'MyScheme',
        platform: 'iOS',
        deviceId: 'my-device'
      });

      // Should boot simulator
      expect(mockSimulator.boot.ensureBooted).toHaveBeenCalledWith('iOS', 'my-device');
      
      // Should build with the booted device
      expect(mockBuildTool.execute).toHaveBeenCalledWith({
        projectPath: '/test/project.xcodeproj',
        scheme: 'MyScheme',
        platform: 'iOS',
        deviceId: 'booted-device-id',
        configuration: 'Debug'
      });
      
      // Should install the app
      expect(mockSimulator.apps.install).toHaveBeenCalledWith(
        './DerivedData/Build/Products/Debug-iphonesimulator/MyApp.app',
        'booted-device-id'
      );
      
      expect(result.content[0].text).toContain('Successfully built and ran project: MyScheme');
      expect(result.content[0].text).toContain('Device: my-device');
    });

    test('should work without deviceId', async () => {
      mockNeedsSimulator.mockReturnValue(true);
      mockSimulator.boot.ensureBooted.mockResolvedValue('auto-booted-device');
      mockBuildTool.execute.mockResolvedValue({
        content: [{
          type: 'text',
          text: 'Build succeeded: MyApp\nPlatform: iOS\nConfiguration: Debug\nApp path: ./DerivedData/Build/Products/Debug-iphonesimulator/MyApp.app'
        }]
      });
      mockSimulator.apps.install.mockResolvedValue(undefined);
      mockSimulator.apps.getBundleId.mockResolvedValue('com.example.MyApp');
      mockSimulator.apps.launch.mockResolvedValue('12345');
      mockSimulator.ui.open.mockResolvedValue(undefined);
      mockSimulator.ui.setAppearance.mockResolvedValue(undefined);

      await tool.execute({
        projectPath: '/test/project.xcodeproj',
        scheme: 'MyScheme',
        platform: 'iOS'
      });

      // Should boot default simulator
      expect(mockSimulator.boot.ensureBooted).toHaveBeenCalledWith('iOS', undefined);
      
      // Should build with auto-booted device
      expect(mockBuildTool.execute).toHaveBeenCalledWith({
        projectPath: '/test/project.xcodeproj',
        scheme: 'MyScheme',
        platform: 'iOS',
        deviceId: 'auto-booted-device',
        configuration: 'Debug'
      });
    });
  });

  describe('macOS App Running', () => {
    test('should launch macOS app without simulator', async () => {
      mockNeedsSimulator.mockReturnValue(false);
      mockBuildTool.execute.mockResolvedValue({
        content: [{
          type: 'text',
          text: 'Build succeeded: MyApp\nPlatform: macOS\nConfiguration: Debug\nApp path: ./DerivedData/Build/Products/Debug/MyApp.app'
        }]
      });
      mockExecAsync.mockResolvedValue({ stdout: '', stderr: '' });

      const result = await tool.execute({
        projectPath: '/test/project.xcodeproj',
        scheme: 'MyScheme',
        platform: 'macOS'
      });

      // Should not boot simulator
      expect(mockSimulator.boot.ensureBooted).not.toHaveBeenCalled();
      
      // Should build without deviceId
      expect(mockBuildTool.execute).toHaveBeenCalledWith({
        projectPath: '/test/project.xcodeproj',
        scheme: 'MyScheme',
        platform: 'macOS',
        deviceId: undefined,
        configuration: 'Debug'
      });
      
      // Should not call InstallAppTool
      expect(mockSimulator.apps.install).not.toHaveBeenCalled();
      
      // Should launch the app using open command
      expect(mockExecAsync).toHaveBeenCalledWith(
        expect.stringContaining('open')
      );
      
      expect(result.content[0].text).toContain('Successfully built and ran project: MyScheme');
      expect(result.content[0].text).toContain('Platform: macOS');
    });

    test('should handle macOS app launch failure gracefully', async () => {
      mockNeedsSimulator.mockReturnValue(false);
      mockBuildTool.execute.mockResolvedValue({
        content: [{
          type: 'text',
          text: 'Build succeeded: MyApp\nPlatform: macOS\nConfiguration: Debug\nApp path: ./DerivedData/Build/Products/Debug/MyApp.app'
        }]
      });
      mockExecAsync.mockRejectedValue(new Error('Failed to launch app'));

      const result = await tool.execute({
        projectPath: '/test/project.xcodeproj',
        scheme: 'MyScheme',
        platform: 'macOS'
      });

      // Should still return success (launch failure is logged but not fatal)
      expect(result.content[0].text).toContain('Successfully built and ran project');
    });
  });

  describe('Other Platforms', () => {
    test('should handle tvOS platform', async () => {
      mockNeedsSimulator.mockReturnValue(true);
      mockSimulator.boot.ensureBooted.mockResolvedValue('tvos-device-id');
      mockBuildTool.execute.mockResolvedValue({
        content: [{
          type: 'text',
          text: 'Build succeeded: MyApp\nPlatform: tvOS\nConfiguration: Debug\nApp path: ./DerivedData/Build/Products/Debug-appletvsimulator/MyApp.app'
        }]
      });
      mockSimulator.apps.install.mockResolvedValue(undefined);
      mockSimulator.apps.getBundleId.mockResolvedValue('com.example.MyApp');
      mockSimulator.apps.launch.mockResolvedValue('12345');
      mockSimulator.ui.open.mockResolvedValue(undefined);
      mockSimulator.ui.setAppearance.mockResolvedValue(undefined);

      await tool.execute({
        projectPath: '/test/project.xcodeproj',
        scheme: 'MyScheme',
        platform: 'tvOS'
      });

      expect(mockSimulator.boot.ensureBooted).toHaveBeenCalledWith('tvOS', undefined);
      expect(mockBuildTool.execute).toHaveBeenCalledWith(
        expect.objectContaining({ platform: 'tvOS' })
      );
      expect(mockSimulator.apps.install).toHaveBeenCalled();
    });

    test('should handle watchOS platform', async () => {
      mockNeedsSimulator.mockReturnValue(true);
      mockSimulator.boot.ensureBooted.mockResolvedValue('watchos-device-id');
      mockBuildTool.execute.mockResolvedValue({
        content: [{
          type: 'text',
          text: 'Build succeeded: MyApp\nPlatform: watchOS\nConfiguration: Debug\nApp path: ./DerivedData/Build/Products/Debug-watchsimulator/MyApp.app'
        }]
      });
      mockSimulator.apps.install.mockResolvedValue(undefined);
      mockSimulator.apps.getBundleId.mockResolvedValue('com.example.MyApp');
      mockSimulator.apps.launch.mockResolvedValue('12345');
      mockSimulator.ui.open.mockResolvedValue(undefined);
      mockSimulator.ui.setAppearance.mockResolvedValue(undefined);

      await tool.execute({
        projectPath: '/test/project.xcodeproj',
        scheme: 'MyScheme',
        platform: 'watchOS'
      });

      expect(mockSimulator.boot.ensureBooted).toHaveBeenCalledWith('watchOS', undefined);
      expect(mockBuildTool.execute).toHaveBeenCalledWith(
        expect.objectContaining({ platform: 'watchOS' })
      );
    });

    test('should handle visionOS platform', async () => {
      mockNeedsSimulator.mockReturnValue(true);
      mockSimulator.boot.ensureBooted.mockResolvedValue('visionos-device-id');
      mockBuildTool.execute.mockResolvedValue({
        content: [{
          type: 'text',
          text: 'Build succeeded: MyApp\nPlatform: visionOS\nConfiguration: Debug\nApp path: ./DerivedData/Build/Products/Debug-visionsimulator/MyApp.app'
        }]
      });
      mockSimulator.apps.install.mockResolvedValue(undefined);
      mockSimulator.apps.getBundleId.mockResolvedValue('com.example.MyApp');
      mockSimulator.apps.launch.mockResolvedValue('12345');
      mockSimulator.ui.open.mockResolvedValue(undefined);
      mockSimulator.ui.setAppearance.mockResolvedValue(undefined);

      await tool.execute({
        projectPath: '/test/project.xcodeproj',
        scheme: 'MyScheme',
        platform: 'visionOS'
      });

      expect(mockSimulator.boot.ensureBooted).toHaveBeenCalledWith('visionOS', undefined);
      expect(mockBuildTool.execute).toHaveBeenCalledWith(
        expect.objectContaining({ platform: 'visionOS' })
      );
    });
  });

  describe('Configuration Handling', () => {
    test('should pass Release configuration to build', async () => {
      mockNeedsSimulator.mockReturnValue(true);
      mockSimulator.boot.ensureBooted.mockResolvedValue('device-id');
      mockBuildTool.execute.mockResolvedValue({
        content: [{
          type: 'text',
          text: 'Build succeeded: MyApp\nPlatform: iOS\nConfiguration: Release\nApp path: ./DerivedData/Build/Products/Release-iphonesimulator/MyApp.app'
        }]
      });
      mockSimulator.apps.install.mockResolvedValue(undefined);
      mockSimulator.apps.getBundleId.mockResolvedValue('com.example.MyApp');
      mockSimulator.apps.launch.mockResolvedValue('12345');
      mockSimulator.ui.open.mockResolvedValue(undefined);
      mockSimulator.ui.setAppearance.mockResolvedValue(undefined);

      await tool.execute({
        projectPath: '/test/project.xcodeproj',
        scheme: 'MyScheme',
        platform: 'iOS',
        configuration: 'Release'
      });

      expect(mockBuildTool.execute).toHaveBeenCalledWith(
        expect.objectContaining({ configuration: 'Release' })
      );
    });

    test('should pass custom configuration to build', async () => {
      mockNeedsSimulator.mockReturnValue(true);
      mockSimulator.boot.ensureBooted.mockResolvedValue('device-id');
      mockBuildTool.execute.mockResolvedValue({
        content: [{
          type: 'text',
          text: 'Build succeeded: MyApp\nPlatform: iOS\nConfiguration: Beta\nApp path: ./DerivedData/Build/Products/Beta-iphonesimulator/MyApp.app'
        }]
      });
      mockSimulator.apps.install.mockResolvedValue(undefined);
      mockSimulator.apps.getBundleId.mockResolvedValue('com.example.MyApp');
      mockSimulator.apps.launch.mockResolvedValue('12345');
      mockSimulator.ui.open.mockResolvedValue(undefined);
      mockSimulator.ui.setAppearance.mockResolvedValue(undefined);

      await tool.execute({
        projectPath: '/test/project.xcodeproj',
        scheme: 'MyScheme',
        platform: 'iOS',
        configuration: 'Beta'
      });

      expect(mockBuildTool.execute).toHaveBeenCalledWith(
        expect.objectContaining({ configuration: 'Beta' })
      );
    });
  });

  describe('Error Handling', () => {
    test('should handle build failure', async () => {
      mockNeedsSimulator.mockReturnValue(true);
      mockSimulator.boot.ensureBooted.mockResolvedValue('device-id');
      mockBuildTool.execute.mockResolvedValue({
        content: [{
          type: 'text',
          text: 'Build failed: Compilation error'
        }]
      });

      const result = await tool.execute({
        projectPath: '/test/project.xcodeproj',
        scheme: 'MyScheme',
        platform: 'iOS'
      });

      expect(result.content[0].text).toContain('Run failed: Build succeeded but could not find app path');
      expect(mockSimulator.apps.install).not.toHaveBeenCalled();
    });

    test('should handle missing app path', async () => {
      mockNeedsSimulator.mockReturnValue(true);
      mockSimulator.boot.ensureBooted.mockResolvedValue('device-id');
      mockBuildTool.execute.mockResolvedValue({
        content: [{
          type: 'text',
          text: 'Build succeeded: MyApp\nPlatform: iOS\nConfiguration: Debug\nApp path: N/A'
        }]
      });

      const result = await tool.execute({
        projectPath: '/test/project.xcodeproj',
        scheme: 'MyScheme',
        platform: 'iOS'
      });

      expect(result.content[0].text).toContain('Run failed: Build succeeded but could not find app path');
      expect(mockSimulator.apps.install).not.toHaveBeenCalled();
    });

    test('should handle simulator boot failure', async () => {
      mockNeedsSimulator.mockReturnValue(true);
      mockSimulator.boot.ensureBooted.mockRejectedValue(new Error('No simulators available'));

      const result = await tool.execute({
        projectPath: '/test/project.xcodeproj',
        scheme: 'MyScheme',
        platform: 'iOS'
      });

      expect(result.content[0].text).toContain('Run failed: No simulators available');
      expect(mockBuildTool.execute).not.toHaveBeenCalled();
    });

    test('should handle install failure', async () => {
      mockNeedsSimulator.mockReturnValue(true);
      mockSimulator.boot.ensureBooted.mockResolvedValue('device-id');
      mockBuildTool.execute.mockResolvedValue({
        content: [{
          type: 'text',
          text: 'Build succeeded: MyApp\nPlatform: iOS\nConfiguration: Debug\nApp path: ./DerivedData/Build/Products/Debug-iphonesimulator/MyApp.app'
        }]
      });
      mockSimulator.apps.install.mockRejectedValue(new Error('Failed to install app'));

      const result = await tool.execute({
        projectPath: '/test/project.xcodeproj',
        scheme: 'MyScheme',
        platform: 'iOS'
      });

      expect(result.content[0].text).toContain('Run failed: Failed to install app');
    });
  });

  describe('Input Validation', () => {
    test('should reject invalid platform', async () => {
      await expect(tool.execute({
        projectPath: '/test/project.xcodeproj',
        scheme: 'MyScheme',
        platform: 'Android'
      })).rejects.toThrow();
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
  });
});