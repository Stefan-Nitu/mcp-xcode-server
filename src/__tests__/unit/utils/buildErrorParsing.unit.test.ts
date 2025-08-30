/**
 * Unit tests for buildErrorParsing utility
 * Tests error parsing and formatting behavior
 */

import { describe, test, expect } from '@jest/globals';
import { parseBuildErrors, formatBuildErrors, BuildError } from '../../../utils/errors/index.js';

describe('buildErrorParsing', () => {
  describe('parseBuildErrors', () => {
    describe('scheme errors', () => {
      test('should parse scheme not found error', () => {
        const output = `xcodebuild: error: The scheme "NonExistentScheme" could not be found.`;
        const errors = parseBuildErrors(output);
        
        expect(errors).toHaveLength(1);
        expect(errors[0]).toEqual({
          type: 'scheme',
          title: 'Scheme not found: "NonExistentScheme"',
          details: 'The specified scheme does not exist in the project',
          suggestion: 'Check available schemes with list_schemes tool'
        });
      });

      test('should parse generic scheme error', () => {
        const output = `xcodebuild: error: something wrong with scheme`;
        const errors = parseBuildErrors(output);
        
        expect(errors).toHaveLength(1);
        expect(errors[0].type).toBe('scheme');
        expect(errors[0].title).toBe('Scheme not found');
      });
    });

    describe('code signing errors', () => {
      test('should parse missing signing certificate', () => {
        const output = `Code Signing Error: No signing certificate "iOS Development" found`;
        const errors = parseBuildErrors(output);
        
        expect(errors).toHaveLength(1);
        expect(errors[0]).toEqual({
          type: 'signing',
          title: 'Code signing failed',
          details: 'No valid signing certificate found',
          suggestion: 'Check your Keychain for valid certificates or use automatic signing'
        });
      });

      test('should parse signing identity error', () => {
        const output = `error: Code Sign error: No signing identity "iPhone Developer: John Doe" found`;
        const errors = parseBuildErrors(output);
        
        expect(errors).toHaveLength(1);
        expect(errors[0]).toEqual({
          type: 'signing',
          title: 'Code signing failed',
          details: 'Missing signing identity: "iPhone Developer: John Doe"',
          suggestion: 'Check your Keychain for valid certificates or use automatic signing'
        });
      });
    });

    describe('provisioning profile errors', () => {
      test('should parse missing provisioning profile', () => {
        const output = `error: Provisioning profile "MyApp Development" not found`;
        const errors = parseBuildErrors(output);
        
        expect(errors).toHaveLength(1);
        expect(errors[0]).toEqual({
          type: 'provisioning',
          title: 'Provisioning profile issue',
          details: 'Profile "MyApp Development" not found or invalid',
          suggestion: 'Check your Apple Developer account or use automatic provisioning'
        });
      });

      test('should parse capability mismatch', () => {
        const output = `error: Provisioning profile not found. Profile doesn't support the Push Notifications capability`;
        const errors = parseBuildErrors(output);
        
        expect(errors).toHaveLength(1);
        expect(errors[0]).toEqual({
          type: 'provisioning',
          title: 'Provisioning profile issue',
          details: "Profile doesn't support Push Notifications capability",
          suggestion: 'Check your Apple Developer account or use automatic provisioning'
        });
      });

      test('should parse generic provisioning error', () => {
        const output = `error: requires a provisioning profile`;
        const errors = parseBuildErrors(output);
        
        expect(errors).toHaveLength(1);
        expect(errors[0].type).toBe('provisioning');
        expect(errors[0].details).toBe('No valid provisioning profile found');
      });
    });

    describe('dependency errors', () => {
      test('should parse missing module error', () => {
        const output = `error: no such module 'Alamofire'`;
        const errors = parseBuildErrors(output);
        
        expect(errors).toHaveLength(1);
        expect(errors[0]).toEqual({
          type: 'dependency',
          title: 'Missing dependency',
          details: "Module 'Alamofire' not found",
          suggestion: 'Run "swift package resolve" or check your Package.swift/Podfile'
        });
      });

      test('should parse unresolved identifier', () => {
        const output = `error: cannot find 'SomeClass' in scope`;
        const errors = parseBuildErrors(output);
        
        expect(errors).toHaveLength(1);
        expect(errors[0]).toEqual({
          type: 'dependency',
          title: 'Missing dependency',
          details: 'Required dependency is missing',
          suggestion: 'Run "swift package resolve" or check your Package.swift/Podfile'
        });
      });

      test('should parse repository clone failure', () => {
        const output = `error: Failed to clone repository https://github.com/user/repo.git:
    Cloning into bare repository '/path/to/cache'...
    fatal: repository not found`;
        const errors = parseBuildErrors(output);
        
        expect(errors).toHaveLength(1);
        expect(errors[0]).toEqual({
          type: 'dependency',
          title: 'Failed to clone repository',
          details: 'Could not fetch dependency from https://github.com/user/repo.git',
          suggestion: 'Verify the repository URL exists and is accessible'
        });
      });

      test('should parse repository not found with fatal error', () => {
        const output = `fatal: repository 'https://github.com/user/missing.git' not found`;
        const errors = parseBuildErrors(output);
        
        expect(errors).toHaveLength(1);
        expect(errors[0]).toEqual({
          type: 'dependency',
          title: 'Repository not found',
          details: 'Repository https://github.com/user/missing.git does not exist',
          suggestion: 'Check the package URL in Package.swift dependencies'
        });
      });

      test('should parse unknown package in dependencies', () => {
        const output = `error: unknown package 'SomePackage' in dependencies of target 'MyApp'`;
        const errors = parseBuildErrors(output);
        
        expect(errors).toHaveLength(1);
        expect(errors[0]).toEqual({
          type: 'dependency',
          title: 'Unknown package in dependencies',
          details: "Package 'SomePackage' is not defined in Package.swift",
          suggestion: 'Ensure the package is listed in the Package dependencies array'
        });
      });
    });

    describe('configuration errors', () => {
      test('should parse configuration not found', () => {
        const output = `error: Configuration "Production" not found`;
        const errors = parseBuildErrors(output);
        
        expect(errors).toHaveLength(1);
        expect(errors[0]).toEqual({
          type: 'configuration',
          title: 'Configuration error',
          details: 'Configuration "Production" not found',
          suggestion: 'Use Debug or Release, or check project for custom configurations'
        });
      });

      test('should parse invalid configuration', () => {
        const output = `error: invalid configuration specified`;
        const errors = parseBuildErrors(output);
        
        expect(errors).toHaveLength(1);
        expect(errors[0]).toEqual({
          type: 'configuration',
          title: 'Configuration error',
          details: 'Invalid build configuration',
          suggestion: 'Use Debug or Release, or check project for custom configurations'
        });
      });
    });

    describe('SDK errors', () => {
      test('should parse SDK not installed error', () => {
        const output = `iOS 18.0 is not installed. To use with Xcode, first download and install the platform`;
        const errors = parseBuildErrors(output);
        
        expect(errors).toHaveLength(1);
        expect(errors[0]).toEqual({
          type: 'sdk',
          title: 'SDK not installed',
          details: 'iOS 18.0 SDK is not installed',
          suggestion: 'Install via: xcodebuild -downloadPlatform iOS or Xcode > Settings > Platforms'
        });
      });

      test('should parse SDK not installed from destination error', () => {
        const output = `xcodebuild: error: Unable to find a destination matching the provided destination specifier:
		{ id:550E8400-E29B-41D4-A716-446655440000 }

	Available destinations for the "TestProjectXCTest" scheme:
		{ platform:macOS, arch:arm64, id:00006000-000430C93E02401E, name:My Mac }
		{ platform:macOS, arch:x86_64, id:00006000-000430C93E02401E, name:My Mac }

	Ineligible destinations for the "TestProjectXCTest" scheme:
		{ platform:iOS, arch:arm64, id:550E8400-E29B-41D4-A716-446655440000, error:iOS 18.0 is not installed. To use with Xcode, first download and install the platform }`;
        const errors = parseBuildErrors(output);
        
        expect(errors).toHaveLength(1);
        expect(errors[0]).toEqual({
          type: 'sdk',
          title: 'SDK not installed',
          details: 'iOS 18.0 SDK is not installed',
          suggestion: 'Install via: xcodebuild -downloadPlatform iOS or Xcode > Settings > Platforms'
        });
      });

      test('should parse no valid destination when SDK is missing', () => {
        const output = `xcodebuild: error: Unable to find a destination matching the provided destination specifier:
		{ platform:iOS }

	Available destinations for the "TestProject" scheme:
		{ platform:macOS, arch:arm64, id:00006000-000430C93E02401E, name:My Mac }`;
        const errors = parseBuildErrors(output);
        
        expect(errors).toHaveLength(1);
        expect(errors[0]).toEqual({
          type: 'destination',
          title: 'No valid destination found',
          details: 'Unable to find a valid destination for building',
          suggestion: 'Check available simulators with "xcrun simctl list devices" or use a different platform'
        });
      });
    });

    describe('platform/destination errors', () => {
      test('should parse platform not supported', () => {
        const output = `error: platform 'tvOS' not supported by scheme`;
        const errors = parseBuildErrors(output);
        
        expect(errors).toHaveLength(1);
        expect(errors[0]).toEqual({
          type: 'configuration',
          title: 'Platform/Destination error',
          details: "Platform 'tvOS' not supported by scheme",
          suggestion: 'Check scheme settings or use a different platform'
        });
      });

      test('should parse invalid destination', () => {
        const output = `error: invalid destination or no destinations available`;
        const errors = parseBuildErrors(output);
        
        expect(errors).toHaveLength(1);
        expect(errors[0]).toEqual({
          type: 'configuration',
          title: 'Platform/Destination error',
          details: 'Invalid or unsupported destination',
          suggestion: 'Check scheme settings or use a different platform'
        });
      });
    });

    describe('project/workspace errors', () => {
      test('should parse missing xcodeproj', () => {
        const output = `error: MyProject.xcodeproj does not exist`;
        const errors = parseBuildErrors(output);
        
        expect(errors).toHaveLength(1);
        expect(errors[0]).toEqual({
          type: 'configuration',
          title: 'Project not found',
          details: 'The specified project or workspace file does not exist',
          suggestion: 'Check the file path and ensure the project exists'
        });
      });

      test('should parse missing xcworkspace', () => {
        const output = `error: could not find MyWorkspace.xcworkspace`;
        const errors = parseBuildErrors(output);
        
        expect(errors).toHaveLength(1);
        expect(errors[0]).toEqual({
          type: 'configuration',
          title: 'Project not found',
          details: 'The specified project or workspace file does not exist',
          suggestion: 'Check the file path and ensure the project exists'
        });
      });

      test('should ignore AXLoading URL errors', () => {
        const output = `[AXLoading] Failed to load URL https://something.xcodeproj does not exist`;
        const errors = parseBuildErrors(output);
        
        expect(errors).toHaveLength(0);
      });
    });

    describe('generic errors', () => {
      test('should parse generic xcodebuild error', () => {
        const output = `xcodebuild: error: Something went wrong with the build`;
        const errors = parseBuildErrors(output);
        
        expect(errors).toHaveLength(1);
        expect(errors[0]).toEqual({
          type: 'generic',
          title: 'Build failed',
          details: 'Something went wrong with the build'
        });
      });

      test('should parse build commands failed', () => {
        const output = `The following build commands failed:
    CompileC /path/to/file.m
    Ld /path/to/binary
    CodeSign /path/to/app`;
        const errors = parseBuildErrors(output);
        
        expect(errors).toHaveLength(1);
        expect(errors[0]).toEqual({
          type: 'generic',
          title: 'Build commands failed',
          details: 'CompileC /path/to/file.m\n    Ld /path/to/binary'  // Only first 3 lines are captured
        });
      });
    });

    describe('multiple errors', () => {
      test('should parse multiple different errors', () => {
        const output = `xcodebuild: error: scheme "Test" not found
error: no such module 'Firebase'
error: code signing error: no certificate found`;
        
        const errors = parseBuildErrors(output);
        
        expect(errors).toHaveLength(3);
        expect(errors[0].type).toBe('scheme');
        expect(errors[1].type).toBe('signing');  // signing is found before dependency
        expect(errors[2].type).toBe('dependency');
      });
    });

    test('should return empty array for successful output', () => {
      const output = `Build succeeded\nAll tests passed`;
      const errors = parseBuildErrors(output);
      
      expect(errors).toHaveLength(0);
    });
  });

  describe('formatBuildErrors', () => {
    test('should return empty string for no errors', () => {
      const result = formatBuildErrors([]);
      expect(result).toBe('');
    });

    test('should format single error with all fields', () => {
      const errors: BuildError[] = [{
        type: 'scheme',
        title: 'Scheme not found',
        details: 'The scheme "MyScheme" does not exist',
        suggestion: 'Check available schemes'
      }];
      
      const result = formatBuildErrors(errors);
      
      expect(result).toContain('❌ Build failed');
      expect(result).toContain('📍 Scheme not found');
      expect(result).toContain('The scheme "MyScheme" does not exist');
      expect(result).toContain('💡 Check available schemes');
    });

    test('should format error without details', () => {
      const errors: BuildError[] = [{
        type: 'generic',
        title: 'Build failed'
      }];
      
      const result = formatBuildErrors(errors);
      
      expect(result).toContain('❌ Build failed');
      expect(result).toContain('📍 Build failed');
      expect(result).not.toContain('💡');
    });

    test('should format multiple errors', () => {
      const errors: BuildError[] = [
        {
          type: 'scheme',
          title: 'Scheme not found',
          details: 'Scheme "Test" missing'
        },
        {
          type: 'signing',
          title: 'Code signing failed',
          suggestion: 'Check certificates'
        }
      ];
      
      const result = formatBuildErrors(errors);
      
      expect(result).toContain('❌ Build failed');
      expect(result).toContain('📍 Scheme not found');
      expect(result).toContain('Scheme "Test" missing');
      expect(result).toContain('📍 Code signing failed');
      expect(result).toContain('💡 Check certificates');
    });
  });
});