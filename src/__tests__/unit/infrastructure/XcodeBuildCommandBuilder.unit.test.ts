import { XcodeBuildCommandBuilder } from '../../../infrastructure/adapters/XcodeBuildCommandBuilder.js';
import { IBuildCommandBuilder } from '../../../application/ports/BuildPorts.js';
import { Platform } from '../../../types.js';

describe('XcodeBuildCommandBuilder', () => {
  // Factory method for creating the SUT
  function createSUT(): IBuildCommandBuilder {
    return new XcodeBuildCommandBuilder();
  }
  
  describe('build', () => {
    describe('when building a workspace', () => {
      it('should use -workspace flag and include all options', () => {
        // Arrange
        const sut = createSUT();
        const projectPath = '/path/to/MyApp.xcworkspace';
        const isWorkspace = true;
        const options = {
          scheme: 'MyScheme',
          configuration: 'Release',
          platform: Platform.iOS,
          deviceId: 'iPhone 15',
          derivedDataPath: '/tmp/DerivedData'
        };
        
        // Act
        const command = sut.build(projectPath, isWorkspace, options);
        
        // Assert
        expect(command).toContain('-workspace "/path/to/MyApp.xcworkspace"');
        expect(command).toContain('-scheme "MyScheme"');
        expect(command).toContain('-configuration "Release"');
        expect(command).toContain('-destination \'platform=iOS Simulator,name=iPhone 15\'');
        expect(command).toContain('-derivedDataPath "/tmp/DerivedData"');
        expect(command).toContain('build');
        expect(command).toContain('set -o pipefail');
        expect(command).toContain('| xcbeautify');
      });
    });
    
    describe('when building a project', () => {
      it('should use -project flag', () => {
        // Arrange
        const sut = createSUT();
        const projectPath = '/path/to/MyApp.xcodeproj';
        const isWorkspace = false;
        const options = {
          scheme: 'MyScheme'
        };
        
        // Act
        const command = sut.build(projectPath, isWorkspace, options);
        
        // Assert
        expect(command).toContain('-project "/path/to/MyApp.xcodeproj"');
        expect(command).not.toContain('-workspace');
      });
    });
    
    describe('when scheme is not provided', () => {
      it('should not include -scheme flag', () => {
        // Arrange
        const sut = createSUT();
        const projectPath = '/path/to/MyApp.xcodeproj';
        const isWorkspace = false;
        const options = {};
        
        // Act
        const command = sut.build(projectPath, isWorkspace, options);
        
        // Assert
        expect(command).not.toContain('-scheme');
      });
    });
    
    describe('when configuration is not provided', () => {
      it('should default to Debug configuration', () => {
        // Arrange
        const sut = createSUT();
        const projectPath = '/path/to/MyApp.xcodeproj';
        const isWorkspace = false;
        const options = {};
        
        // Act
        const command = sut.build(projectPath, isWorkspace, options);
        
        // Assert
        expect(command).toContain('-configuration "Debug"');
      });
    });
    
    describe('when platform is not provided', () => {
      it('should default to iOS platform', () => {
        // Arrange
        const sut = createSUT();
        const projectPath = '/path/to/MyApp.xcodeproj';
        const isWorkspace = false;
        const options = {};
        
        // Act
        const command = sut.build(projectPath, isWorkspace, options);
        
        // Assert
        // Default iOS uses generic destination
        expect(command).toContain('-destination \'generic/platform=iOS Simulator\'');
      });
    });
    
    describe('when deviceId is provided', () => {
      it('should use specific device destination for iOS', () => {
        // Arrange
        const sut = createSUT();
        const options = {
          platform: Platform.iOS,
          deviceId: 'iPhone 15 Pro'
        };
        
        // Act
        const command = sut.build('/path/project.xcodeproj', false, options);
        
        // Assert
        expect(command).toContain('-destination \'platform=iOS Simulator,name=iPhone 15 Pro\'');
      });
      
      it('should use UUID when deviceId is a UUID', () => {
        // Arrange
        const sut = createSUT();
        const options = {
          platform: Platform.iOS,
          deviceId: '550E8400-E29B-41D4-A716-446655440000'
        };
        
        // Act
        const command = sut.build('/path/project.xcodeproj', false, options);
        
        // Assert
        expect(command).toContain('-destination \'platform=iOS Simulator,id=550E8400-E29B-41D4-A716-446655440000\'');
      });
    });
    
    describe('when deviceId is not provided', () => {
      it('should use generic destination', () => {
        // Arrange
        const sut = createSUT();
        const options = {
          platform: Platform.iOS
        };
        
        // Act
        const command = sut.build('/path/project.xcodeproj', false, options);
        
        // Assert
        expect(command).toContain('-destination \'generic/platform=iOS Simulator\'');
      });
    });
    
    describe('when different platforms are specified', () => {
      it.each([
        [Platform.iOS, 'generic/platform=iOS Simulator'],
        [Platform.macOS, 'platform=macOS'],
        [Platform.tvOS, 'generic/platform=tvOS Simulator'],
        [Platform.watchOS, 'generic/platform=watchOS Simulator'],
        [Platform.visionOS, 'generic/platform=xrOS Simulator']
      ])('should use correct generic destination for %s', (platform, expectedDestination) => {
        // Arrange
        const sut = createSUT();
        const options = { platform };
        
        // Act
        const command = sut.build('/path/project.xcodeproj', false, options);
        
        // Assert
        expect(command).toContain(`-destination '${expectedDestination}'`);
      });
    });
    
    describe('when derivedDataPath is not provided', () => {
      it('should not include -derivedDataPath flag', () => {
        // Arrange
        const sut = createSUT();
        const options = {};
        
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
        const options = {
          scheme: 'My Scheme',
          derivedDataPath: '/path/with spaces/DerivedData'
        };
        
        // Act
        const command = sut.build(projectPath, true, options);
        
        // Assert
        expect(command).toContain('-workspace "/path/with spaces/MyApp.xcworkspace"');
        expect(command).toContain('-scheme "My Scheme"');
        expect(command).toContain('-derivedDataPath "/path/with spaces/DerivedData"');
      });
      
      it('should include pipefail and xcbeautify', () => {
        // Arrange
        const sut = createSUT();
        
        // Act
        const command = sut.build('/path/project.xcodeproj', false, {});
        
        // Assert
        expect(command).toMatch(/^set -o pipefail && xcodebuild/);
        expect(command).toMatch(/2>&1 \| xcbeautify$/);
      });
      
      it('should end with build action before piping', () => {
        // Arrange
        const sut = createSUT();
        
        // Act
        const command = sut.build('/path/project.xcodeproj', false, {});
        
        // Assert
        // The build action should come before the pipe
        expect(command).toMatch(/build 2>&1 \| xcbeautify$/);
      });
    });
    
    describe('complete command examples', () => {
      it('should build correct command for minimal project', () => {
        // Arrange
        const sut = createSUT();
        
        // Act
        const command = sut.build('/Users/dev/MyApp.xcodeproj', false, {});
        
        // Assert
        const expected = 'set -o pipefail && xcodebuild -project "/Users/dev/MyApp.xcodeproj" ' +
                        '-configuration "Debug" -destination \'generic/platform=iOS Simulator\' ' +
                        'build 2>&1 | xcbeautify';
        expect(command).toBe(expected);
      });
      
      it('should build correct command for full workspace options', () => {
        // Arrange
        const sut = createSUT();
        const options = {
          scheme: 'Production',
          configuration: 'Release',
          platform: Platform.iOS,
          deviceId: 'iPhone 15',
          derivedDataPath: '/tmp/DD'
        };
        
        // Act
        const command = sut.build('/Users/dev/MyApp.xcworkspace', true, options);
        
        // Assert
        const expected = 'set -o pipefail && xcodebuild -workspace "/Users/dev/MyApp.xcworkspace" ' +
                        '-scheme "Production" -configuration "Release" ' +
                        '-destination \'platform=iOS Simulator,name=iPhone 15\' ' +
                        '-derivedDataPath "/tmp/DD" build 2>&1 | xcbeautify';
        expect(command).toBe(expected);
      });
    });
  });
});