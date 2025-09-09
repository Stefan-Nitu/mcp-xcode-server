import { describe, it, expect } from '@jest/globals';
import { XcodeBuildCommandAdapter } from '../../../../infrastructure/adapters/XcodeBuildCommandAdapter.js';
import { BuildCommandOptions } from '../../../../application/ports/BuildPorts.js';

/**
 * Unit tests for XcodeBuildCommandBuilder
 * 
 * Testing Strategy:
 * - XcodeBuildCommandBuilder should be a simple string builder
 * - It takes already-mapped values (no BuildDestination enums)
 * - It has no dependency on BuildDestinationMapper
 * - Following DAMP over DRY for test clarity
 */

describe('XcodeBuildCommandBuilder', () => {
  // Factory method for creating the SUT (no dependencies needed!)
  function createSUT(): XcodeBuildCommandAdapter {
    return new XcodeBuildCommandAdapter();
  }

  describe('build', () => {
    describe('when building a workspace', () => {
      it('should use -workspace flag and include all options', () => {
        // Arrange
        const sut = createSUT();
        const projectPath = '/path/to/MyApp.xcworkspace';
        const isWorkspace = true;
        const options: BuildCommandOptions = {
          scheme: 'MyScheme',
          destination: 'generic/platform=iOS Simulator',
          configuration: 'Release',
          additionalSettings: ['ARCHS=arm64', 'ONLY_ACTIVE_ARCH=YES'],
          derivedDataPath: '/tmp/DerivedData'
        };

        // Act
        const command = sut.build(projectPath, isWorkspace, options);

        // Assert
        expect(command).toBe(
          'xcodebuild -workspace "/path/to/MyApp.xcworkspace" ' +
          '-scheme "MyScheme" -configuration "Release" ' +
          '-destination \'generic/platform=iOS Simulator\' ' +
          'ARCHS=arm64 ONLY_ACTIVE_ARCH=YES ' +
          '-derivedDataPath "/tmp/DerivedData" ' +
          'build 2>&1'
        );
      });

      it('should use -workspace flag for minimal options', () => {
        // Arrange
        const sut = createSUT();
        const projectPath = '/path/to/MyApp.xcworkspace';
        const isWorkspace = true;
        const options: BuildCommandOptions = {
          scheme: 'MyScheme',
          destination: 'platform=iOS Simulator,name=iPhone 15'
        };

        // Act
        const command = sut.build(projectPath, isWorkspace, options);

        // Assert
        expect(command).toBe(
          'xcodebuild -workspace "/path/to/MyApp.xcworkspace" ' +
          '-scheme "MyScheme" -configuration "Debug" ' +
          '-destination \'platform=iOS Simulator,name=iPhone 15\' ' +
          'build 2>&1'
        );
      });
    });

    describe('when building a project', () => {
      it('should use -project flag', () => {
        // Arrange
        const sut = createSUT();
        const projectPath = '/path/to/MyApp.xcodeproj';
        const isWorkspace = false;
        const options: BuildCommandOptions = {
          scheme: 'MyScheme',
          destination: 'generic/platform=iOS'
        };

        // Act
        const command = sut.build(projectPath, isWorkspace, options);

        // Assert
        expect(command).toBe(
          'xcodebuild -project "/path/to/MyApp.xcodeproj" ' +
          '-scheme "MyScheme" -configuration "Debug" ' +
          '-destination \'generic/platform=iOS\' ' +
          'build 2>&1'
        );
      });
    });

    describe('when configuration is not provided', () => {
      it('should default to Debug configuration', () => {
        // Arrange
        const sut = createSUT();
        const projectPath = '/path/to/MyApp.xcodeproj';
        const isWorkspace = false;
        const options: BuildCommandOptions = {
          scheme: 'MyScheme',
          destination: 'platform=macOS'
        };

        // Act
        const command = sut.build(projectPath, isWorkspace, options);

        // Assert
        expect(command).toContain('-configuration "Debug"');
      });
    });

    describe('when configuration is provided', () => {
      it('should use the provided configuration', () => {
        // Arrange
        const sut = createSUT();
        const projectPath = '/path/to/MyApp.xcodeproj';
        const isWorkspace = false;
        const options: BuildCommandOptions = {
          scheme: 'MyScheme',
          destination: 'platform=macOS',
          configuration: 'Release'
        };

        // Act
        const command = sut.build(projectPath, isWorkspace, options);

        // Assert
        expect(command).toContain('-configuration "Release"');
      });
    });

    describe('when additionalSettings are provided', () => {
      it('should include them as space-separated strings', () => {
        // Arrange
        const sut = createSUT();
        const options: BuildCommandOptions = {
          scheme: 'MyScheme',
          destination: 'platform=macOS',
          additionalSettings: ['ARCHS=x86_64', 'arm64', 'ONLY_ACTIVE_ARCH=NO']
        };

        // Act
        const command = sut.build('/path/project.xcodeproj', false, options);

        // Assert
        expect(command).toContain('ARCHS=x86_64 arm64 ONLY_ACTIVE_ARCH=NO');
      });

      it('should handle empty additionalSettings array', () => {
        // Arrange
        const sut = createSUT();
        const options: BuildCommandOptions = {
          scheme: 'MyScheme',
          destination: 'platform=macOS',
          additionalSettings: []
        };

        // Act
        const command = sut.build('/path/project.xcodeproj', false, options);

        // Assert
        // Should not have extra spaces
        expect(command).not.toMatch(/\s{2,}/); // No double spaces
      });
    });

    describe('when derivedDataPath is provided', () => {
      it('should include -derivedDataPath flag', () => {
        // Arrange
        const sut = createSUT();
        const options: BuildCommandOptions = {
          scheme: 'MyScheme',
          destination: 'platform=iOS Simulator,name=iPhone 15',
          derivedDataPath: '/custom/derived/data'
        };

        // Act
        const command = sut.build('/path/project.xcodeproj', false, options);

        // Assert
        expect(command).toContain('-derivedDataPath "/custom/derived/data"');
      });
    });

    describe('when derivedDataPath is not provided', () => {
      it('should not include -derivedDataPath flag', () => {
        // Arrange
        const sut = createSUT();
        const options: BuildCommandOptions = {
          scheme: 'MyScheme',
          destination: 'platform=iOS Simulator,name=iPhone 15'
        };

        // Act
        const command = sut.build('/path/project.xcodeproj', false, options);

        // Assert
        expect(command).not.toContain('-derivedDataPath');
      });
    });

    describe('command structure', () => {
      it('should properly quote paths with spaces', () => {
        // Arrange
        const sut = createSUT();
        const projectPath = '/path/with spaces/MyApp.xcworkspace';
        const options: BuildCommandOptions = {
          scheme: 'My Scheme',
          destination: 'platform=iOS Simulator,name=iPhone 15 Pro',
          derivedDataPath: '/path/with spaces/DerivedData'
        };

        // Act
        const command = sut.build(projectPath, true, options);

        // Assert
        expect(command).toContain('-workspace "/path/with spaces/MyApp.xcworkspace"');
        expect(command).toContain('-scheme "My Scheme"');
        expect(command).toContain('-derivedDataPath "/path/with spaces/DerivedData"');
      });

      it('should use single quotes for destination', () => {
        // Arrange
        const sut = createSUT();
        const options: BuildCommandOptions = {
          scheme: 'MyScheme',
          destination: 'platform=iOS Simulator,name=iPhone 15'
        };

        // Act
        const command = sut.build('/path/project.xcodeproj', false, options);

        // Assert
        // Destination should use single quotes
        expect(command).toContain('-destination \'platform=iOS Simulator,name=iPhone 15\'');
      });

      it('should redirect stderr to stdout', () => {
        // Arrange
        const sut = createSUT();
        const options: BuildCommandOptions = {
          scheme: 'MyScheme',
          destination: 'platform=macOS'
        };

        // Act
        const command = sut.build('/path/project.xcodeproj', false, options);

        // Assert
        expect(command).toMatch(/2>&1$/);
      });

      it('should end with build action before redirecting', () => {
        // Arrange
        const sut = createSUT();
        const options: BuildCommandOptions = {
          scheme: 'MyScheme',
          destination: 'platform=macOS'
        };

        // Act
        const command = sut.build('/path/project.xcodeproj', false, options);

        // Assert
        // The build action should come before the redirection
        expect(command).toMatch(/build 2>&1$/);
      });
    });

    describe('complete command examples', () => {
      it('should build correct command for minimal project', () => {
        // Arrange
        const sut = createSUT();
        const options: BuildCommandOptions = {
          scheme: 'MyApp',
          destination: 'generic/platform=iOS Simulator'
        };

        // Act
        const command = sut.build('/Users/dev/MyApp.xcodeproj', false, options);

        // Assert
        const expected = 
          'xcodebuild -project "/Users/dev/MyApp.xcodeproj" ' +
          '-scheme "MyApp" -configuration "Debug" ' +
          '-destination \'generic/platform=iOS Simulator\' ' +
          'build 2>&1';
        expect(command).toBe(expected);
      });

      it('should build correct command for full workspace options', () => {
        // Arrange
        const sut = createSUT();
        const options: BuildCommandOptions = {
          scheme: 'Production',
          configuration: 'Release',
          destination: 'platform=iOS Simulator,name=iPhone 15',
          additionalSettings: ['ARCHS=arm64', 'ONLY_ACTIVE_ARCH=YES'],
          derivedDataPath: '/tmp/DD'
        };

        // Act
        const command = sut.build('/Users/dev/MyApp.xcworkspace', true, options);

        // Assert
        const expected = 
          'xcodebuild -workspace "/Users/dev/MyApp.xcworkspace" ' +
          '-scheme "Production" -configuration "Release" ' +
          '-destination \'platform=iOS Simulator,name=iPhone 15\' ' +
          'ARCHS=arm64 ONLY_ACTIVE_ARCH=YES ' +
          '-derivedDataPath "/tmp/DD" ' +
          'build 2>&1';
        expect(command).toBe(expected);
      });

      it('should build correct command for macOS universal build', () => {
        // Arrange
        const sut = createSUT();
        const options: BuildCommandOptions = {
          scheme: 'MyMacApp',
          configuration: 'Release',
          destination: 'platform=macOS',
          additionalSettings: ['ARCHS=x86_64 arm64', 'ONLY_ACTIVE_ARCH=NO']
        };

        // Act
        const command = sut.build('/Users/dev/MyMacApp.xcodeproj', false, options);

        // Assert
        const expected = 
          'xcodebuild -project "/Users/dev/MyMacApp.xcodeproj" ' +
          '-scheme "MyMacApp" -configuration "Release" ' +
          '-destination \'platform=macOS\' ' +
          'ARCHS=x86_64 arm64 ONLY_ACTIVE_ARCH=NO ' +
          'build 2>&1';
        expect(command).toBe(expected);
      });
    });
  });
});