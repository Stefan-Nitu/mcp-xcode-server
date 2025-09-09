import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { BuildXcodeController } from '../../../../presentation/controllers/BuildXcodeController.js';
import { BuildXcodeControllerFactory } from '../../../../factories/BuildXcodeControllerFactory.js';
import { exec } from 'child_process';
import { existsSync } from 'fs';

// Mock ONLY external boundaries
jest.mock('child_process', () => ({
  exec: jest.fn()
}));

jest.mock('fs', () => ({
  existsSync: jest.fn<(path: string) => boolean>(),
  mkdirSync: jest.fn(),
  readdirSync: jest.fn(() => []),
  unlinkSync: jest.fn(),
  writeFileSync: jest.fn(),
  readFileSync: jest.fn()
}));

const mockExec = exec as jest.MockedFunction<typeof exec>;
const mockExistsSync = existsSync as jest.MockedFunction<typeof existsSync>;

/**
 * Integration tests for BuildXcodeController
 * 
 * Following testing philosophy from TESTING-PHILOSOPHY.md:
 * - Use REAL components (use case, presenter, adapters)
 * - Mock ONLY external boundaries (subprocess, filesystem)
 * - Test actual user-facing behavior, not implementation
 * - Focus on what users experience when using the tool
 */
describe('BuildXcodeController Integration', () => {
  let controller: BuildXcodeController;
  let execCallIndex: number;
  let execMockResponses: Array<{ stdout: string; stderr: string; error?: Error }>;

  // Factory methods for common mock responses
  const createArchitectureDetectionResponses = () => [
    { stdout: '1', stderr: '' }, // sysctl -n hw.optional.arm64
    { stdout: 'arm64', stderr: '' } // uname -m
  ];

  const createSuccessfulBuildResponse = (output = '** BUILD SUCCEEDED **') => ({
    stdout: output,
    stderr: ''
  });

  const createAppFoundResponse = (appPath: string) => ({
    stdout: appPath,
    stderr: ''
  });

  const createBuildFailureResponse = (output: string, stderr = 'Build failed') => ({
    stdout: output,
    stderr
  });

  const createSuccessfulBuildSequence = (appPath: string, buildOutput = '** BUILD SUCCEEDED **') => [
    ...createArchitectureDetectionResponses(),
    createSuccessfulBuildResponse(buildOutput),
    createAppFoundResponse(appPath)
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    execCallIndex = 0;
    execMockResponses = [];
    
    // Setup exec mock to return sequential responses
    (mockExec as any).mockImplementation((cmd: string, options: any, callback: (error: any, stdout: string, stderr: string) => void) => {
      const response = execMockResponses[execCallIndex++];
      if (response) {
        if (response.error) {
          callback(response.error, '', '');
        } else {
          callback(null, response.stdout, response.stderr);
        }
      } else {
        callback(new Error('No mock response configured'), '', '');
      }
    });
    
    // Default filesystem mock - project exists
    mockExistsSync.mockImplementation((path) => {
      const pathStr = String(path);
      return pathStr.endsWith('.xcodeproj') || pathStr.endsWith('.xcworkspace');
    });
    
    // Create controller with REAL components using factory
    controller = BuildXcodeControllerFactory.create();
  });

  describe('successful build scenarios - all platforms', () => {
    // iOS Platform Tests
    it('should build iOS app for simulator and return success with app location', async () => {
      // Arrange
      const input = {
        projectPath: '/Users/dev/MyApp/MyApp.xcodeproj',
        scheme: 'MyApp',
        destination: 'iOSSimulator'
      };
      
      execMockResponses = createSuccessfulBuildSequence(
        '/Users/dev/DerivedData/Build/Products/Debug-iphonesimulator/MyApp.app'
      );
      
      // Act
      const result = await controller.execute(input);
      
      // Assert
      expect(result.content[0].text).toContain('Build succeeded');
      expect(result.content[0].text).toContain('App path:');
      expect(result.content[0].text).toContain('iOS');
    });

    it('should build iOS app for device', async () => {
      // Arrange
      const input = {
        projectPath: '/Users/dev/MyApp/MyApp.xcodeproj',
        scheme: 'MyApp',
        destination: 'iOSDevice'
      };
      
      execMockResponses = createSuccessfulBuildSequence(
        '/Users/dev/DerivedData/Build/Products/Debug-iphoneos/MyApp.app'
      );
      
      // Act
      const result = await controller.execute(input);
      
      // Assert
      expect(result.content[0].text).toContain('Build succeeded');
      expect(result.content[0].text).toContain('iOS');
      // Verify correct destination was used
      expect(mockExec).toHaveBeenCalledWith(
        expect.stringContaining('generic/platform=iOS'),
        expect.any(Object),
        expect.any(Function)
      );
    });

    // macOS Platform Tests
    it('should build macOS app', async () => {
      // Arrange
      const input = {
        projectPath: '/Users/dev/MacApp/MacApp.xcodeproj',
        scheme: 'MacApp',
        destination: 'macOS'
      };
      
      execMockResponses = createSuccessfulBuildSequence(
        '/Users/dev/DerivedData/Build/Products/Debug/MacApp.app'
      );
      
      // Act
      const result = await controller.execute(input);
      
      // Assert
      expect(result.content[0].text).toContain('Build succeeded');
      expect(result.content[0].text).toContain('macOS');
    });

    // tvOS Platform Tests
    it('should build tvOS app for simulator', async () => {
      // Arrange
      const input = {
        projectPath: '/Users/dev/TVApp/TVApp.xcodeproj',
        scheme: 'TVApp',
        destination: 'tvOSSimulator'
      };
      
      execMockResponses = createSuccessfulBuildSequence(
        '/Users/dev/DerivedData/Build/Products/Debug-appletvsimulator/TVApp.app'
      );
      
      // Act
      const result = await controller.execute(input);
      
      // Assert
      expect(result.content[0].text).toContain('Build succeeded');
      expect(result.content[0].text).toContain('tvOS');
    });

    // watchOS Platform Tests
    it('should build watchOS app for simulator', async () => {
      // Arrange
      const input = {
        projectPath: '/Users/dev/WatchApp/WatchApp.xcodeproj',
        scheme: 'WatchApp',
        destination: 'watchOSSimulator'
      };
      
      execMockResponses = createSuccessfulBuildSequence(
        '/Users/dev/DerivedData/Build/Products/Debug-watchsimulator/WatchApp.app'
      );
      
      // Act
      const result = await controller.execute(input);
      
      // Assert
      expect(result.content[0].text).toContain('Build succeeded');
      expect(result.content[0].text).toContain('watchOS');
    });

    // visionOS Platform Tests
    it('should build visionOS app for simulator', async () => {
      // Arrange
      const input = {
        projectPath: '/Users/dev/VisionApp/VisionApp.xcodeproj',
        scheme: 'VisionApp',
        destination: 'visionOSSimulator'
      };
      
      execMockResponses = createSuccessfulBuildSequence(
        '/Users/dev/DerivedData/Build/Products/Debug-xrsimulator/VisionApp.app'
      );
      
      // Act
      const result = await controller.execute(input);
      
      // Assert
      expect(result.content[0].text).toContain('Build succeeded');
      expect(result.content[0].text).toContain('visionOS');
    });

    it('should use custom derived data path when provided', async () => {
      // Arrange
      const customPath = '/Custom/DerivedData';
      const input = {
        projectPath: '/Users/dev/MyApp/MyApp.xcodeproj',
        scheme: 'MyApp',
        destination: 'iOSSimulator',
        derivedDataPath: customPath
      };
      
      execMockResponses = createSuccessfulBuildSequence(
        `${customPath}/Build/Products/Debug-iphonesimulator/MyApp.app`
      );
      
      // Act
      const result = await controller.execute(input);
      
      // Assert
      expect(result.content[0].text).toContain('Build succeeded');
      expect(mockExec).toHaveBeenCalledWith(
        expect.stringContaining(`-derivedDataPath "${customPath}"`),
        expect.any(Object),
        expect.any(Function)
      );
    });
  });

  describe('build output behaviors', () => {
    it('should include warnings in build output', async () => {
      // Arrange
      const input = {
        projectPath: '/Users/dev/MyApp/MyApp.xcodeproj',
        scheme: 'MyApp',
        destination: 'iOSSimulator'
      };
      
      const buildOutputWithWarnings = `⚠️  /Users/dev/MyApp/ViewController.swift:42:10: warning: 'oldMethod()' is deprecated
⚠️  /Users/dev/MyApp/AppDelegate.swift:15:5: warning: initialization of immutable value 'unused' was never used
** BUILD SUCCEEDED **`;
      
      execMockResponses = createSuccessfulBuildSequence(
        '/Users/dev/DerivedData/Build/Products/Debug-iphonesimulator/MyApp.app',
        buildOutputWithWarnings
      );
      
      // Act
      const result = await controller.execute(input);
      
      // Assert
      expect(result.content[0].text).toContain('Build succeeded');
      expect(result.content[0].text).toContain('Warnings: 2');
    });
  });

  describe('error handling behaviors', () => {
    it('should return clear error when project not found', async () => {
      // Arrange
      const input = {
        projectPath: '/nonexistent/project.xcodeproj',
        scheme: 'MyApp',
        destination: 'iOSSimulator'
      };
      
      mockExistsSync.mockReturnValue(false);
      
      // Act
      const result = await controller.execute(input);
      
      // Assert
      expect(result.content[0].text).toContain('Project path does not exist');
      expect(result.content[0].text).toContain('/nonexistent/project.xcodeproj');
    });

    it('should return formatted compilation errors with file locations', async () => {
      // Arrange
      const input = {
        projectPath: '/Users/dev/MyApp/MyApp.xcodeproj',
        scheme: 'MyApp',
        destination: 'iOSSimulator'
      };
      
      const buildOutputWithErrors = `❌ /Users/dev/MyApp/ViewController.swift:23:15: error: cannot find type 'NonExistentType' in scope
❌ /Users/dev/MyApp/Model.swift:45:8: error: missing return in closure expected to return 'String'
** BUILD FAILED **`;
      
      execMockResponses = [
        ...createArchitectureDetectionResponses(),
        createBuildFailureResponse(buildOutputWithErrors, 'The following build commands failed:\n\tCompileSwift')
      ];
      
      // Act
      const result = await controller.execute(input);
      
      // Assert
      expect(result.content[0].text).toContain('Build failed');
      expect(result.content[0].text).toContain('Errors (2)');
      expect(result.content[0].text).toContain('ViewController.swift:23');
      expect(result.content[0].text).toContain('cannot find type');
    });

    it('should return error when scheme not found', async () => {
      // Arrange
      const input = {
        projectPath: '/Users/dev/MyApp/MyApp.xcodeproj',
        scheme: 'NonExistentScheme',
        destination: 'iOSSimulator'
      };
      
      execMockResponses = [
        ...createArchitectureDetectionResponses(),
        { error: new Error('xcodebuild: error: The project "MyApp" does not contain a scheme named "NonExistentScheme".'), stdout: '', stderr: '' }
      ];
      
      // Act
      const result = await controller.execute(input);
      
      // Assert
      expect(result.content[0].text).toContain('Build failed');
      expect(result.content[0].text).toContain('NonExistentScheme');
    });

    it('should return helpful error when Xcode not installed', async () => {
      // Arrange
      const input = {
        projectPath: '/Users/dev/MyApp/MyApp.xcodeproj',
        scheme: 'MyApp',
        destination: 'iOSSimulator'
      };
      
      execMockResponses = [
        { error: new Error('xcrun: error: unable to find utility "xcodebuild", not a developer tool or in PATH'), stdout: '', stderr: '' }
      ];
      
      // Act
      const result = await controller.execute(input);
      
      // Assert
      // Error message from shell command failure
      expect(result.content[0].text).toMatch(/Error|unable to find|xcodebuild/);
    });
  });

  describe('edge cases and robustness', () => {
    it('should handle paths with spaces correctly', async () => {
      // Arrange
      const input = {
        projectPath: '/Users/dev/My iOS App/MyApp.xcodeproj',
        scheme: 'My App Scheme',
        destination: 'iOSSimulator',
        derivedDataPath: '/Users/dev/Derived Data'
      };
      
      execMockResponses = createSuccessfulBuildSequence(
        '/Users/dev/Derived Data/Build/Products/Debug-iphonesimulator/MyApp.app'
      );
      
      // Act
      const result = await controller.execute(input);
      
      // Assert
      expect(result.content[0].text).toContain('Build succeeded');
      // Verify proper escaping in xcodebuild command
      // First call is architecture detection, second is xcodebuild
      const calls = (mockExec as any).mock.calls;
      const xcodebuildCall = calls.find((call: any[]) => call[0].includes('xcodebuild'));
      expect(xcodebuildCall).toBeDefined();
      expect(xcodebuildCall[0]).toContain('"/Users/dev/My iOS App/MyApp.xcodeproj"');
      expect(xcodebuildCall[0]).toContain('"My App Scheme"');
      expect(xcodebuildCall[0]).toContain('"/Users/dev/Derived Data"');
    });
  });

  describe('default values and convenience', () => {
    it('should use Debug configuration by default', async () => {
      // Arrange
      const input = {
        projectPath: '/Users/dev/MyApp/MyApp.xcodeproj',
        scheme: 'MyApp',
        destination: 'iOSSimulator'
        // No configuration specified
      };
      
      execMockResponses = createSuccessfulBuildSequence(
        '/Users/dev/DerivedData/Build/Products/Debug-iphonesimulator/MyApp.app'
      );
      
      // Act
      await controller.execute(input);
      
      // Assert  
      const calls = (mockExec as any).mock.calls;
      // Find the xcodebuild call (after architecture detection commands)
      const xcodebuildCall = calls.find((call: any[]) => call[0].includes('xcodebuild'));
      expect(xcodebuildCall).toBeDefined();
      expect(xcodebuildCall[0]).toContain('-configuration \"Debug\"');
    });

    it('should auto-detect workspace vs project', async () => {
      // Arrange
      const input = {
        projectPath: '/Users/dev/MyApp/MyApp.xcworkspace',
        scheme: 'MyApp',
        destination: 'iOSSimulator'
      };
      
      execMockResponses = createSuccessfulBuildSequence(
        '/Users/dev/DerivedData/Build/Products/Debug-iphonesimulator/MyApp.app'
      );
      
      // Act
      await controller.execute(input);
      
      // Assert
      const calls = (mockExec as any).mock.calls;
      const xcodebuildCall = calls.find((call: any[]) => call[0].includes('xcodebuild'));
      expect(xcodebuildCall).toBeDefined();
      expect(xcodebuildCall[0]).toContain('-workspace');
      expect(xcodebuildCall[0]).not.toContain('-project');
    });
  });
});