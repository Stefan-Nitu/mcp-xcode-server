/**
 * Unit tests for validation schemas
 * Tests all Zod schemas for proper validation and security checks
 */

import { describe, test, expect } from '@jest/globals';
import { Platform } from '../../types';
import {
  listSimulatorsSchema,
  bootSimulatorSchema,
  shutdownSimulatorSchema,
  buildProjectSchema,
  runProjectSchema,
  testProjectSchema,
  testSPMModuleSchema,
  installAppSchema,
  uninstallAppSchema,
  viewSimulatorScreenSchema,
  getDeviceLogsSchema,
  cleanBuildSchema,
  listSchemesSchema,
  getBuildSettingsSchema,
  getProjectInfoSchema,
  listTargetsSchema,
  archiveProjectSchema,
  exportIPASchema
} from '../../validation';

describe('Validation Schemas', () => {
  describe('Path Security Validation', () => {
    test('should reject path traversal attempts', () => {
      const maliciousPaths = [
        '../../../etc/passwd',
        '/path/with/../traversal',
        '~/home/user',
        '/path/with/~tilde'
      ];

      maliciousPaths.forEach(path => {
        expect(() => buildProjectSchema.parse({ projectPath: path }))
          .toThrow('Path traversal patterns are not allowed');
      });
    });

    test('should reject command injection attempts', () => {
      const dangerousPaths = [
        '/path/with;command',
        '/path/with`backticks`',
        '/path/with$variable',
        '/path/with$(command)'
      ];

      dangerousPaths.forEach(path => {
        expect(() => buildProjectSchema.parse({ projectPath: path }))
          .toThrow('Command injection patterns are not allowed');
      });
    });

    test('should accept valid paths', () => {
      const validPaths = [
        '/Users/user/Projects/MyApp.xcodeproj',
        '/path/to/project/Package.swift',
        './relative/path/project.xcworkspace',
        'simple.xcodeproj'
      ];

      validPaths.forEach(path => {
        const result = buildProjectSchema.parse({ projectPath: path });
        expect(result.projectPath).toBe(path);
      });
    });
  });

  describe('listSimulatorsSchema', () => {
    test('should accept valid parameters', () => {
      const valid = [
        { showAll: true, platform: Platform.iOS },
        { showAll: false },
        { platform: Platform.macOS },
        {}
      ];

      valid.forEach(input => {
        const result = listSimulatorsSchema.parse(input);
        expect(result).toBeDefined();
        expect(result.showAll).toBe(input.showAll ?? false);
      });
    });

    test('should set default values', () => {
      const result = listSimulatorsSchema.parse({});
      expect(result.showAll).toBe(false);
      expect(result.platform).toBeUndefined();
    });

    test('should reject invalid platform', () => {
      expect(() => listSimulatorsSchema.parse({ platform: 'InvalidOS' }))
        .toThrow();
    });
  });

  describe('bootSimulatorSchema', () => {
    test('should require deviceId', () => {
      expect(() => bootSimulatorSchema.parse({}))
        .toThrow('Device ID is required');
    });

    test('should accept valid deviceId', () => {
      const result = bootSimulatorSchema.parse({ deviceId: 'iPhone-15-Pro' });
      expect(result.deviceId).toBe('iPhone-15-Pro');
    });

    test('should reject empty deviceId', () => {
      expect(() => bootSimulatorSchema.parse({ deviceId: '' }))
        .toThrow('Device ID cannot be empty');
    });
  });

  describe('buildProjectSchema', () => {
    test('should accept valid build parameters', () => {
      const input = {
        projectPath: '/path/to/project.xcodeproj',
        scheme: 'MyScheme',
        platform: Platform.iOS,
        deviceId: 'iPhone 15',
        configuration: 'Debug' as const
      };

      const result = buildProjectSchema.parse(input);
      expect(result).toEqual(input);
    });

    test('should set default values', () => {
      const result = buildProjectSchema.parse({
        projectPath: '/path/to/project.xcodeproj'
      });
      expect(result.platform).toBe(Platform.iOS);
      expect(result.configuration).toBe('Debug');
    });

    test('should reject invalid configuration', () => {
      expect(() => buildProjectSchema.parse({
        projectPath: '/path/to/project.xcodeproj',
        configuration: 'InvalidConfig'
      })).toThrow();
    });
  });

  describe('testProjectSchema', () => {
    test('should accept test-specific parameters', () => {
      const input = {
        projectPath: '/path/to/project.xcodeproj',
        scheme: 'MyScheme',
        platform: Platform.iOS,
        testTarget: 'MyAppTests',
        testFilter: 'testLogin',
        parallelTesting: true
      };

      const result = testProjectSchema.parse(input);
      expect(result.testTarget).toBe('MyAppTests');
      expect(result.testFilter).toBe('testLogin');
      expect(result.parallelTesting).toBe(true);
    });

    test('should set parallel testing default', () => {
      const result = testProjectSchema.parse({
        projectPath: '/path/to/project.xcodeproj'
      });
      expect(result.parallelTesting).toBe(false);
    });
  });

  describe('testSPMModuleSchema', () => {
    test('should accept valid SPM test parameters', () => {
      const input = {
        packagePath: '/path/to/Package.swift',
        platform: Platform.macOS,
        testFilter: 'MyTests',
        osVersion: '14.0'
      };

      const result = testSPMModuleSchema.parse(input);
      expect(result).toEqual(input);
    });

    test('should validate OS version format', () => {
      const validVersions = ['14.0', '17.2', '1.0', '99.99'];
      
      validVersions.forEach(version => {
        const result = testSPMModuleSchema.parse({
          packagePath: '/path/to/Package.swift',
          osVersion: version
        });
        expect(result.osVersion).toBe(version);
      });
    });

    test('should reject invalid OS version format', () => {
      const invalidVersions = ['14', '14.0.1', 'fourteen', '14.x'];
      
      invalidVersions.forEach(version => {
        expect(() => testSPMModuleSchema.parse({
          packagePath: '/path/to/Package.swift',
          osVersion: version
        })).toThrow('OS version must be in format: 17.2');
      });
    });

    test('should default to macOS platform', () => {
      const result = testSPMModuleSchema.parse({
        packagePath: '/path/to/Package.swift'
      });
      expect(result.platform).toBe(Platform.macOS);
    });
  });

  describe('uninstallAppSchema', () => {
    test('should validate bundle ID format', () => {
      const validBundleIds = [
        'com.apple.Safari',
        'com.example.MyApp',
        'org.swift.Package',
        'net.company.app-name'
      ];

      validBundleIds.forEach(bundleId => {
        const result = uninstallAppSchema.parse({ bundleId });
        expect(result.bundleId).toBe(bundleId);
      });
    });

    test('should reject invalid bundle ID format', () => {
      const invalidBundleIds = [
        'com/apple/Safari',
        'com.apple.Safari!',
        'com apple Safari',
        'com.apple.Safari@2x',
        'com.apple.Safari#1'
      ];

      invalidBundleIds.forEach(bundleId => {
        expect(() => uninstallAppSchema.parse({ bundleId }))
          .toThrow('Invalid bundle ID format');
      });
    });
  });

  describe('getDeviceLogsSchema', () => {
    test('should validate time interval format', () => {
      const validIntervals = ['1m', '5m', '30m', '1h', '2h', '1s', '30s'];
      
      validIntervals.forEach(interval => {
        const result = getDeviceLogsSchema.parse({ last: interval });
        expect(result.last).toBe(interval);
      });
    });

    test('should reject invalid time interval format', () => {
      const invalidIntervals = ['5', 'five', '5min', '1hr', '1d', '5ms'];
      
      invalidIntervals.forEach(interval => {
        expect(() => getDeviceLogsSchema.parse({ last: interval }))
          .toThrow('Time interval must be in format: 1m, 5m, 1h');
      });
    });

    test('should set default time interval', () => {
      const result = getDeviceLogsSchema.parse({});
      expect(result.last).toBe('5m');
    });

    test('should reject command injection in predicate', () => {
      const dangerousPredicates = [
        'process == "MyApp" && `rm -rf /`',
        'process == "MyApp"; echo "hacked"',
        'process == "$VARIABLE"',
        'process == "$(whoami)"'
      ];

      dangerousPredicates.forEach(predicate => {
        expect(() => getDeviceLogsSchema.parse({ predicate }))
          .toThrow('Command injection patterns not allowed in predicate');
      });
    });

    test('should accept safe predicates', () => {
      const safePredicates = [
        'process == "MyApp"',
        'eventMessage CONTAINS "error"',
        'subsystem == "com.example.app" AND category == "network"'
      ];

      safePredicates.forEach(predicate => {
        const result = getDeviceLogsSchema.parse({ predicate });
        expect(result.predicate).toBe(predicate);
      });
    });
  });

  describe('cleanBuildSchema', () => {
    test('should accept valid clean targets', () => {
      const targets = ['build', 'derivedData', 'testResults', 'all'];
      
      targets.forEach(target => {
        const result = cleanBuildSchema.parse({
          cleanTarget: target as any
        });
        expect(result.cleanTarget).toBe(target);
      });
    });

    test('should set default clean target', () => {
      const result = cleanBuildSchema.parse({});
      expect(result.cleanTarget).toBe('build');
    });

    test('should set default derived data path', () => {
      const result = cleanBuildSchema.parse({});
      expect(result.derivedDataPath).toBe('./DerivedData');
    });

    test('should accept custom derived data path', () => {
      const customPath = '/custom/DerivedData';
      const result = cleanBuildSchema.parse({
        derivedDataPath: customPath
      });
      expect(result.derivedDataPath).toBe(customPath);
    });
  });

  describe('archiveProjectSchema', () => {
    test('should require necessary fields', () => {
      const input = {
        projectPath: '/path/to/project.xcodeproj',
        scheme: 'MyScheme'
      };

      const result = archiveProjectSchema.parse(input);
      expect(result.projectPath).toBe(input.projectPath);
      expect(result.scheme).toBe(input.scheme);
    });

    test('should set default configuration to Release', () => {
      const result = archiveProjectSchema.parse({
        projectPath: '/path/to/project.xcodeproj',
        scheme: 'MyScheme'
      });
      expect(result.configuration).toBe('Release');
    });

    test('should set default platform to iOS', () => {
      const result = archiveProjectSchema.parse({
        projectPath: '/path/to/project.xcodeproj',
        scheme: 'MyScheme'
      });
      expect(result.platform).toBe(Platform.iOS);
    });

    test('should accept custom archive path', () => {
      const archivePath = '/path/to/archives/MyApp.xcarchive';
      const result = archiveProjectSchema.parse({
        projectPath: '/path/to/project.xcodeproj',
        scheme: 'MyScheme',
        archivePath
      });
      expect(result.archivePath).toBe(archivePath);
    });
  });

  describe('exportIPASchema', () => {
    test('should require archive path', () => {
      const result = exportIPASchema.parse({
        archivePath: '/path/to/MyApp.xcarchive'
      });
      expect(result.archivePath).toBe('/path/to/MyApp.xcarchive');
    });

    test('should validate export methods', () => {
      const methods = ['app-store', 'ad-hoc', 'enterprise', 'development'];
      
      methods.forEach(method => {
        const result = exportIPASchema.parse({
          archivePath: '/path/to/MyApp.xcarchive',
          exportMethod: method as any
        });
        expect(result.exportMethod).toBe(method);
      });
    });

    test('should set default export method', () => {
      const result = exportIPASchema.parse({
        archivePath: '/path/to/MyApp.xcarchive'
      });
      expect(result.exportMethod).toBe('development');
    });

    test('should reject invalid export method', () => {
      expect(() => exportIPASchema.parse({
        archivePath: '/path/to/MyApp.xcarchive',
        exportMethod: 'invalid-method'
      })).toThrow();
    });
  });

  describe('Platform Enum Validation', () => {
    test('should accept all valid platforms', () => {
      const platforms = [
        Platform.iOS,
        Platform.macOS,
        Platform.tvOS,
        Platform.watchOS,
        Platform.visionOS
      ];

      platforms.forEach(platform => {
        const result = buildProjectSchema.parse({
          projectPath: '/path/to/project.xcodeproj',
          platform
        });
        expect(result.platform).toBe(platform);
      });
    });

    test('should reject invalid platforms', () => {
      const invalidPlatforms = ['androidOS', 'windowsOS', 'linuxOS', 'invalid'];
      
      invalidPlatforms.forEach(platform => {
        expect(() => buildProjectSchema.parse({
          projectPath: '/path/to/project.xcodeproj',
          platform: platform as any
        })).toThrow();
      });
    });
  });

  describe('Optional Fields', () => {
    test('should handle all optional fields being undefined', () => {
      const schemas = [
        { schema: viewSimulatorScreenSchema, input: {} },
        { schema: installAppSchema, input: { appPath: '/path/to/app.app' } },
        { schema: listSchemesSchema, input: { projectPath: '/path/to/project' } },
        { schema: getProjectInfoSchema, input: { projectPath: '/path/to/project' } }
      ];

      schemas.forEach(({ schema, input }) => {
        const result = schema.parse(input);
        expect(result).toBeDefined();
      });
    });

    test('should preserve optional fields when provided', () => {
      const result = runProjectSchema.parse({
        projectPath: '/path/to/project.xcodeproj',
        scheme: 'CustomScheme',
        deviceId: 'CustomDevice'
      });

      expect(result.scheme).toBe('CustomScheme');
      expect(result.deviceId).toBe('CustomDevice');
    });
  });

  describe('Edge Cases', () => {
    test('should handle empty objects where allowed', () => {
      const result = viewSimulatorScreenSchema.parse({});
      expect(result).toEqual({});
    });

    test('should handle very long but valid paths', () => {
      const longPath = '/very/long/path/that/goes/on/and/on/and/on/with/many/directories/and/subdirectories/project.xcodeproj';
      const result = buildProjectSchema.parse({
        projectPath: longPath
      });
      expect(result.projectPath).toBe(longPath);
    });

    test('should handle special characters in valid contexts', () => {
      const result = buildProjectSchema.parse({
        projectPath: '/path/to/My-Project_2024.xcodeproj',
        scheme: 'My-Scheme_Debug'
      });
      expect(result.projectPath).toContain('My-Project_2024');
      expect(result.scheme).toContain('My-Scheme_Debug');
    });

    test('should handle Unicode in paths', () => {
      const unicodePath = '/path/to/проект/我的应用.xcodeproj';
      const result = buildProjectSchema.parse({
        projectPath: unicodePath
      });
      expect(result.projectPath).toBe(unicodePath);
    });

    test('should reject null and undefined for required fields', () => {
      expect(() => bootSimulatorSchema.parse({ deviceId: null }))
        .toThrow();
      expect(() => bootSimulatorSchema.parse({ deviceId: undefined }))
        .toThrow();
    });
  });
});