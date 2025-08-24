/**
 * Unit tests for BuildXcodeTool
 * Tests behavior with mocked dependencies
 */

import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import { BuildXcodeTool } from '../../tools/BuildXcodeTool.js';
import { Platform } from '../../types.js';
import * as fs from 'fs';
import * as utils from '../../utils.js';
import * as platformHandler from '../../platformHandler.js';

// Mock the modules
jest.mock('fs', () => ({
  existsSync: jest.fn()
}));

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

describe('BuildXcodeTool Unit Tests', () => {
  let tool: BuildXcodeTool;
  const mockExecAsync = utils.execAsync as jest.MockedFunction<typeof utils.execAsync>;
  const mockExistsSync = fs.existsSync as jest.MockedFunction<typeof fs.existsSync>;
  const mockNeedsSimulator = platformHandler.PlatformHandler.needsSimulator as jest.MockedFunction<typeof platformHandler.PlatformHandler.needsSimulator>;
  const mockGetDestination = platformHandler.PlatformHandler.getDestination as jest.MockedFunction<typeof platformHandler.PlatformHandler.getDestination>;
  const mockGetGenericDestination = platformHandler.PlatformHandler.getGenericDestination as jest.MockedFunction<typeof platformHandler.PlatformHandler.getGenericDestination>;

  // Mock SimulatorBooter
  const mockSimulatorBooter = {
    ensureBooted: jest.fn<(platform: string, deviceId?: string) => Promise<string>>()
  };

  beforeEach(() => {
    jest.clearAllMocks();
    tool = new BuildXcodeTool(mockSimulatorBooter as any);
  });

  describe('Tool Definition', () => {
    test('should provide correct tool definition', () => {
      const definition = tool.getToolDefinition();
      
      expect(definition.name).toBe('build_xcode');
      expect(definition.description).toBe('Build an Xcode project or workspace');
      expect(definition.inputSchema.required).toEqual(['projectPath']);
      expect(definition.inputSchema.properties.platform.enum).toEqual(['iOS', 'macOS', 'tvOS', 'watchOS', 'visionOS']);
      expect(definition.inputSchema.properties.platform.default).toBe('iOS');
      expect(definition.inputSchema.properties.configuration.default).toBe('Debug');
    });
  });

  describe('Build Command Generation', () => {
    test('should build .xcodeproj with scheme', async () => {
      mockExistsSync.mockReturnValue(true);
      mockGetGenericDestination.mockReturnValue('generic/platform=iOS Simulator');
      mockExecAsync
        .mockResolvedValueOnce({ stdout: '', stderr: '' }) // platform validation
        .mockResolvedValueOnce({ stdout: '', stderr: '' }) // build
        .mockResolvedValueOnce({ stdout: '/path/to/app.app', stderr: '' }); // find app

      await tool.execute({
        projectPath: '/test/project.xcodeproj',
        scheme: 'MyScheme',
        platform: 'iOS'
      });

      expect(mockExecAsync).toHaveBeenCalledWith(
        expect.stringContaining('-project "/test/project.xcodeproj"'),
        expect.any(Object)
      );
      expect(mockExecAsync).toHaveBeenCalledWith(
        expect.stringContaining('-scheme "MyScheme"'),
        expect.any(Object)
      );
    });

    test('should build .xcworkspace with workspace flag', async () => {
      mockExistsSync.mockReturnValue(true);
      mockGetGenericDestination.mockReturnValue('generic/platform=iOS Simulator');
      mockExecAsync
        .mockResolvedValueOnce({ stdout: '', stderr: '' }) // platform validation
        .mockResolvedValueOnce({ stdout: '', stderr: '' }); // build

      await tool.execute({
        projectPath: '/test/workspace.xcworkspace',
        scheme: 'MyScheme',
        platform: 'iOS'
      });

      expect(mockExecAsync).toHaveBeenCalledWith(
        expect.stringContaining('-workspace "/test/workspace.xcworkspace"'),
        expect.any(Object)
      );
    });

    test('should use generic destination when no deviceId specified', async () => {
      mockExistsSync.mockReturnValue(true);
      mockGetGenericDestination.mockReturnValue('generic/platform=iOS Simulator');
      mockExecAsync
        .mockResolvedValueOnce({ stdout: '', stderr: '' }) // platform validation
        .mockResolvedValueOnce({ stdout: '', stderr: '' }); // build

      await tool.execute({
        projectPath: '/test/project.xcodeproj',
        platform: 'iOS'
      });

      expect(mockGetGenericDestination).toHaveBeenCalledWith(Platform.iOS);
      expect(mockExecAsync).toHaveBeenCalledWith(
        expect.stringContaining("destination 'generic/platform=iOS Simulator'"),
        expect.any(Object)
      );
    });

    test('should boot simulator when deviceId specified for iOS', async () => {
      mockExistsSync.mockReturnValue(true);
      mockNeedsSimulator.mockReturnValue(true);
      mockSimulatorBooter.ensureBooted.mockResolvedValue('booted-device-id');
      mockGetDestination.mockReturnValue('id=booted-device-id');
      mockGetGenericDestination.mockReturnValue('generic/platform=iOS Simulator');
      mockExecAsync
        .mockResolvedValueOnce({ stdout: '', stderr: '' }) // platform validation
        .mockResolvedValueOnce({ stdout: '', stderr: '' }); // build

      await tool.execute({
        projectPath: '/test/project.xcodeproj',
        platform: 'iOS',
        deviceId: 'my-device'
      });

      expect(mockSimulatorBooter.ensureBooted).toHaveBeenCalledWith('iOS', 'my-device');
      expect(mockGetDestination).toHaveBeenCalledWith(Platform.iOS, 'booted-device-id');
    });

    test('should build with Release configuration', async () => {
      mockExistsSync.mockReturnValue(true);
      mockGetGenericDestination.mockReturnValue('generic/platform=iOS Simulator');
      mockExecAsync
        .mockResolvedValueOnce({ stdout: '', stderr: '' }) // platform validation
        .mockResolvedValueOnce({ stdout: '', stderr: '' }); // build

      await tool.execute({
        projectPath: '/test/project.xcodeproj',
        configuration: 'Release'
      });

      expect(mockExecAsync).toHaveBeenCalledWith(
        expect.stringContaining('-configuration "Release"'),
        expect.any(Object)
      );
    });

    test('should build with custom configuration', async () => {
      mockExistsSync.mockReturnValue(true);
      mockGetGenericDestination.mockReturnValue('generic/platform=iOS Simulator');
      mockExecAsync
        .mockResolvedValueOnce({ stdout: '', stderr: '' }) // platform validation
        .mockResolvedValueOnce({ stdout: '', stderr: '' }); // build

      await tool.execute({
        projectPath: '/test/project.xcodeproj',
        configuration: 'Beta'
      });

      expect(mockExecAsync).toHaveBeenCalledWith(
        expect.stringContaining('-configuration "Beta"'),
        expect.any(Object)
      );
    });
  });

  describe('Platform Validation', () => {
    test('should validate platform support before building', async () => {
      mockExistsSync.mockReturnValue(true);
      mockGetGenericDestination.mockReturnValue('generic/platform=iOS Simulator');
      mockExecAsync
        .mockResolvedValueOnce({ stdout: '', stderr: '' }) // platform validation succeeds
        .mockResolvedValueOnce({ stdout: '', stderr: '' }); // build

      await tool.execute({
        projectPath: '/test/project.xcodeproj',
        scheme: 'MyScheme',
        platform: 'iOS'
      });

      // First call should be platform validation
      expect(mockExecAsync).toHaveBeenNthCalledWith(1,
        expect.stringContaining('xcodebuild -showBuildSettings'),
        expect.objectContaining({ timeout: 10000 })
      );
    });

    test('should handle platform not supported error', async () => {
      mockExistsSync.mockReturnValue(true);
      mockGetGenericDestination.mockReturnValue('generic/platform=watchOS Simulator');
      
      const platformError = new Error('Platform check failed') as any;
      platformError.stderr = 'Available destinations for the "MyScheme" scheme: { platform:iOS }';
      mockExecAsync.mockRejectedValueOnce(platformError);

      const result = await tool.execute({
        projectPath: '/test/project.xcodeproj',
        scheme: 'MyScheme',
        platform: 'watchOS'
      });

      expect(result.content[0].text).toContain("Platform 'watchOS' is not supported");
      expect(result.content[0].text).toContain('Available platforms: iOS');
    });
  });

  describe('Output Handling', () => {
    test('should find and report app path after successful build', async () => {
      mockExistsSync.mockReturnValue(true);
      mockGetGenericDestination.mockReturnValue('generic/platform=iOS Simulator');
      mockExecAsync
        .mockResolvedValueOnce({ stdout: '', stderr: '' }) // platform validation
        .mockResolvedValueOnce({ stdout: 'Build succeeded', stderr: '' }) // build
        .mockResolvedValueOnce({ stdout: './DerivedData/Build/Products/Debug-iphonesimulator/MyApp.app', stderr: '' }); // find app

      const result = await tool.execute({
        projectPath: '/test/project.xcodeproj',
        scheme: 'MyScheme'
      });

      expect(result.content[0].text).toContain('Build succeeded: MyScheme');
      expect(result.content[0].text).toContain('App path: ./DerivedData/Build/Products/Debug-iphonesimulator/MyApp.app');
    });

    test('should handle missing app path gracefully', async () => {
      mockExistsSync.mockReturnValue(true);
      mockGetGenericDestination.mockReturnValue('generic/platform=iOS Simulator');
      mockExecAsync
        .mockResolvedValueOnce({ stdout: '', stderr: '' }) // platform validation
        .mockResolvedValueOnce({ stdout: 'Build succeeded', stderr: '' }) // build
        .mockRejectedValueOnce(new Error('find failed')); // find app fails

      const result = await tool.execute({
        projectPath: '/test/project.xcodeproj'
      });

      expect(result.content[0].text).toContain('Build succeeded');
      expect(result.content[0].text).toContain('App path: N/A');
    });

    test('should detect when custom configuration falls back to Release', async () => {
      mockExistsSync.mockReturnValue(true);
      mockGetGenericDestination.mockReturnValue('generic/platform=iOS Simulator');
      mockExecAsync
        .mockResolvedValueOnce({ stdout: '', stderr: '' }) // platform validation
        .mockResolvedValueOnce({ stdout: 'Build succeeded', stderr: '' }) // build
        .mockResolvedValueOnce({ stdout: './DerivedData/Build/Products/Release-iphonesimulator/MyApp.app', stderr: '' }); // find app in Release folder

      const result = await tool.execute({
        projectPath: '/test/project.xcodeproj',
        configuration: 'Beta'
      });

      expect(result.content[0].text).toContain('Configuration: Release - Beta configuration was not found');
    });
  });

  describe('Error Handling', () => {
    test('should handle non-existent project path', async () => {
      mockExistsSync.mockReturnValue(false);

      const result = await tool.execute({
        projectPath: '/non/existent/project.xcodeproj'
      });

      expect(result.content[0].text).toBe('Build failed: Project path does not exist: /non/existent/project.xcodeproj');
    });

    test('should handle build failure with stderr', async () => {
      mockExistsSync.mockReturnValue(true);
      mockGetGenericDestination.mockReturnValue('generic/platform=iOS Simulator');
      mockExecAsync
        .mockResolvedValueOnce({ stdout: '', stderr: '' }); // platform validation
      
      const buildError = new Error('Build failed') as any;
      buildError.stderr = 'xcodebuild: error: Scheme "InvalidScheme" is not configured';
      mockExecAsync.mockRejectedValueOnce(buildError);

      const result = await tool.execute({
        projectPath: '/test/project.xcodeproj',
        scheme: 'InvalidScheme'
      });

      expect(result.content[0].text).toContain('xcodebuild: error: Scheme "InvalidScheme" is not configured');
    });

    test('should handle build failure with stdout', async () => {
      mockExistsSync.mockReturnValue(true);
      mockGetGenericDestination.mockReturnValue('generic/platform=iOS Simulator');
      mockExecAsync
        .mockResolvedValueOnce({ stdout: '', stderr: '' }); // platform validation
      
      const buildError = new Error('Build failed') as any;
      buildError.stdout = 'xcodebuild output: compilation errors';
      buildError.stderr = '';
      mockExecAsync.mockRejectedValueOnce(buildError);

      const result = await tool.execute({
        projectPath: '/test/project.xcodeproj'
      });

      expect(result.content[0].text).toBe('xcodebuild output: compilation errors');
    });

    test('should handle build failure with only error message', async () => {
      mockExistsSync.mockReturnValue(true);
      mockGetGenericDestination.mockReturnValue('generic/platform=iOS Simulator');
      mockExecAsync
        .mockResolvedValueOnce({ stdout: '', stderr: '' }); // platform validation
      
      const buildError = new Error('Unknown build error');
      mockExecAsync.mockRejectedValueOnce(buildError);

      const result = await tool.execute({
        projectPath: '/test/project.xcodeproj'
      });

      expect(result.content[0].text).toBe('Build failed: Unknown build error');
    });
  });

  describe('Input Validation', () => {
    test('should reject invalid platform', async () => {
      await expect(tool.execute({
        projectPath: '/test/project.xcodeproj',
        platform: 'Android'
      })).rejects.toThrow();
    });

    test('should reject path traversal attempts', async () => {
      await expect(tool.execute({
        projectPath: '../../../etc/passwd'
      })).rejects.toThrow('Path traversal');
    });

    test('should reject command injection attempts', async () => {
      await expect(tool.execute({
        projectPath: '/test; rm -rf /'
      })).rejects.toThrow('Command injection');
    });

    test('should accept project without scheme', async () => {
      mockExistsSync.mockReturnValue(true);
      mockGetGenericDestination.mockReturnValue('generic/platform=iOS Simulator');
      mockExecAsync
        .mockResolvedValueOnce({ stdout: '', stderr: '' }) // platform validation
        .mockResolvedValueOnce({ stdout: '', stderr: '' }); // build

      await tool.execute({
        projectPath: '/test/project.xcodeproj'
      });

      // Should not include -scheme in command
      expect(mockExecAsync).toHaveBeenCalledWith(
        expect.not.stringContaining('-scheme'),
        expect.any(Object)
      );
    });
  });
});