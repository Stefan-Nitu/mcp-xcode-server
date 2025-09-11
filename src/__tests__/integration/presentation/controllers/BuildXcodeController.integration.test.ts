import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { BuildXcodeController } from '../../../../presentation/controllers/BuildXcodeController.js';
import { BuildXcodeControllerFactory } from '../../../../factories/BuildXcodeControllerFactory.js';
import { exec } from 'child_process';
import { existsSync } from 'fs';
import type { NodeExecError, ExecMockCall } from '../../../utils/types/execTypes.js';

// Mock ONLY external boundaries
jest.mock('child_process');

// Mock promisify to return {stdout, stderr} for exec (as node's promisify does)
jest.mock('util', () => {
  const actualUtil = jest.requireActual('util') as typeof import('util');
  const { createPromisifiedExec } = require('../../../utils/mocks/promisifyExec');
  
  return {
    ...actualUtil,
    promisify: (fn: Function) => 
      fn?.name === 'exec' ? createPromisifiedExec(fn) : actualUtil.promisify(fn)
  };
});

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
  let execMockResponses: Array<{ stdout: string; stderr: string; error?: NodeExecError }>;

  // Factory for xcodebuild mock responses
  const XcodebuildResponse = {
    success: (output = '** BUILD SUCCEEDED **') => ({
      stdout: output,
      stderr: ''
    }),
    
    buildFailure: (output: string, stderr = 'Build failed') => {
      const error = new Error(`Command failed: xcodebuild`) as NodeExecError;
      error.code = 65; // xcodebuild exit code for build failure
      error.stdout = output;
      error.stderr = stderr;
      return { error, stdout: output, stderr };
    },
    
    commandNotFound: (command: string, stderr: string) => ({
      error: Object.assign(new Error(`Command failed: ${command}`), {
        code: 127, // Exit code 127 = command not found
        stdout: '',
        stderr
      }),
      stdout: '',
      stderr
    })
  };

  beforeEach(() => {
    jest.clearAllMocks();
    execCallIndex = 0;
    execMockResponses = [];
    
    // Setup selective exec mock - only mocks xcodebuild commands
    const actualExec = (jest.requireActual('child_process') as typeof import('child_process')).exec;
    const { createSelectiveExecMock } = require('../../../utils/mocks/selectiveExecMock');
    const { isXcodebuildCommand } = require('../../../utils/mocks/xcodebuildHelpers');
    
    mockExec.mockImplementation(
      createSelectiveExecMock(
        isXcodebuildCommand,
        () => execMockResponses[execCallIndex++],
        actualExec
      )
    );
    
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
      
      execMockResponses = [
        XcodebuildResponse.success('** BUILD SUCCEEDED **')
      ];
      
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
      
      execMockResponses = [
        XcodebuildResponse.success()
      ];
      
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
      
      execMockResponses = [
        XcodebuildResponse.success()
      ];
      
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
      
      execMockResponses = [
        XcodebuildResponse.success()
      ];
      
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
      
      execMockResponses = [
        XcodebuildResponse.success()
      ];
      
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
      
      execMockResponses = [
        XcodebuildResponse.success()
      ];
      
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
      
      execMockResponses = [
        XcodebuildResponse.success()
      ];
      
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
      
      // Raw xcodebuild output format (before xcbeautify formatting)
      // Based on real xcodebuild output captured from test_artifacts/TestProjectXCTest
      const buildOutputWithWarnings = `/Users/dev/MyApp/ViewController.swift:42:10: warning: 'oldMethod()' is deprecated: Use newMethod instead
            oldMethod()  // This will generate a deprecation warning
            ^
/Users/dev/MyApp/AppDelegate.swift:15:5: warning: variable 'unused' was never used; consider replacing with '_' or removing it
            let unused = 42
            ^
** BUILD SUCCEEDED **`;
      
      execMockResponses = [
        XcodebuildResponse.success(buildOutputWithWarnings)
      ];
      
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
      
      // Raw xcodebuild output format (before xcbeautify formatting)
      // This is what xcodebuild actually outputs for compilation errors
      const buildOutputWithErrors = `CompileSwift normal x86_64 /Users/dev/MyApp/ViewController.swift (in target 'MyApp' from project 'MyApp')
    cd /Users/dev/MyApp
    /Applications/Xcode.app/Contents/Developer/Toolchains/XcodeDefault.xctoolchain/usr/bin/swift

/Users/dev/MyApp/ViewController.swift:23:15: error: cannot find type 'NonExistentType' in scope
    let value: NonExistentType = "test"
               ^~~~~~~~~~~~~~~

CompileSwift normal x86_64 /Users/dev/MyApp/Model.swift (in target 'MyApp' from project 'MyApp')
    cd /Users/dev/MyApp
    /Applications/Xcode.app/Contents/Developer/Toolchains/XcodeDefault.xctoolchain/usr/bin/swift

/Users/dev/MyApp/Model.swift:45:8: error: missing return in closure expected to return 'String'
    }
    ^

** BUILD FAILED **

The following build commands failed:
    CompileSwift normal x86_64 /Users/dev/MyApp/ViewController.swift (in target 'MyApp' from project 'MyApp')
    CompileSwift normal x86_64 /Users/dev/MyApp/Model.swift (in target 'MyApp' from project 'MyApp')
(2 failures)`;
      
      execMockResponses = [
        XcodebuildResponse.buildFailure(buildOutputWithErrors, 'The following build commands failed:\n\tCompileSwift')
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
      
      const error = new Error('xcodebuild: error: The project "MyApp" does not contain a scheme named "NonExistentScheme".') as NodeExecError;
      error.code = 65;
      error.stdout = '';
      error.stderr = '';
      execMockResponses = [
        { error, stdout: '', stderr: '' }
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
        // xcodebuild command fails - shell returns error before xcbeautify runs
        XcodebuildResponse.commandNotFound(
          'xcodebuild',
          'xcrun: error: unable to find utility "xcodebuild", not a developer tool or in PATH'
        )
      ];
      
      // Act
      const result = await controller.execute(input);
      
      // Assert
      // The presenter should show the error message
      expect(result.content[0].text).toContain('Build failed');
      // Should show the actual error from xcrun
      expect(result.content[0].text).toMatch(/xcrun.*unable to find.*xcodebuild|Errors \(1\)/);
    });
  });

  describe('input validation', () => {
    it('should reject missing projectPath', async () => {
      // Arrange
      const input = {
        scheme: 'MyApp',
        destination: 'iOSSimulator'
      } as any;
      
      // Act
      const result = await controller.execute(input);
      
      // Assert - validation error returned
      expect(result.content[0].text).toBe('❌ Project path is required');
    });

    it('should reject empty projectPath', async () => {
      // Arrange
      const input = {
        projectPath: '',
        scheme: 'MyApp',
        destination: 'iOSSimulator'
      };
      
      // Act
      const result = await controller.execute(input);
      
      // Assert - validation error returned
      expect(result.content[0].text).toBe('❌ Project path cannot be empty');
    });

    it('should reject missing scheme', async () => {
      // Arrange
      const input = {
        projectPath: '/Users/dev/MyApp/MyApp.xcodeproj',
        destination: 'iOSSimulator'
      } as any;
      
      // Act
      const result = await controller.execute(input);
      
      // Assert - validation error returned
      expect(result.content[0].text).toBe('❌ Scheme is required');
    });

    it('should reject invalid destination value', async () => {
      // Arrange
      const input = {
        projectPath: '/Users/dev/MyApp/MyApp.xcodeproj',
        scheme: 'MyApp',
        destination: 'invalidDestination'
      };
      
      // Act
      const result = await controller.execute(input);
      
      // Assert - validation error returned
      expect(result.content[0].text).toBe('❌ Invalid destination. Use format: [platform][Simulator|Device|SimulatorUniversal]');
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
      
      execMockResponses = [
        XcodebuildResponse.success()
      ];
      
      // Act
      const result = await controller.execute(input);
      
      // Assert
      expect(result.content[0].text).toContain('Build succeeded');
      // Verify proper escaping in xcodebuild command
      // First call is architecture detection, second is xcodebuild
      const calls = mockExec.mock.calls as ExecMockCall[];
      const xcodebuildCall = calls.find((call) => (call[0] as string).includes('xcodebuild'));
      expect(xcodebuildCall).toBeDefined();
      expect(xcodebuildCall?.[0]).toContain('"/Users/dev/My iOS App/MyApp.xcodeproj"');
      expect(xcodebuildCall?.[0]).toContain('"My App Scheme"');
      expect(xcodebuildCall?.[0]).toContain('"/Users/dev/Derived Data"');
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
      
      execMockResponses = [
        XcodebuildResponse.success('** BUILD SUCCEEDED **')
      ];
      
      // Act
      await controller.execute(input);
      
      // Assert  
      const calls = mockExec.mock.calls as ExecMockCall[];
      // Find the xcodebuild call (after architecture detection commands)
      const xcodebuildCall = calls.find((call) => (call[0] as string).includes('xcodebuild'));
      expect(xcodebuildCall).toBeDefined();
      expect(xcodebuildCall?.[0]).toContain('-configuration \"Debug\"');
    });

    it('should auto-detect workspace vs project', async () => {
      // Arrange
      const input = {
        projectPath: '/Users/dev/MyApp/MyApp.xcworkspace',
        scheme: 'MyApp',
        destination: 'iOSSimulator'
      };
      
      execMockResponses = [
        XcodebuildResponse.success('** BUILD SUCCEEDED **')
      ];
      
      // Act
      await controller.execute(input);
      
      // Assert
      const calls = mockExec.mock.calls as ExecMockCall[];
      const xcodebuildCall = calls.find((call) => (call[0] as string).includes('xcodebuild'));
      expect(xcodebuildCall).toBeDefined();
      expect(xcodebuildCall?.[0]).toContain('-workspace');
      expect(xcodebuildCall?.[0]).not.toContain('-project');
    });
  });
});