import { XcodePlatformValidator } from '../../../../infrastructure/adapters/XcodePlatformValidator.js';
import { ICommandExecutor, ExecutionResult } from '../../../../application/ports/CommandPorts.js';
import { Platform } from '../../../../domain/value-objects/Platform.js';

describe('XcodePlatformValidator', () => {
  // Factory method for creating the SUT with its dependencies
  function createSUT() {
    const mockExecute = jest.fn();
    const mockExecutor: ICommandExecutor = { execute: mockExecute };
    const sut = new XcodePlatformValidator(mockExecutor);
    return { sut, mockExecute };
  }
  
  // Factory methods for test data
  function createSuccessResult(): ExecutionResult {
    return {
      stdout: 'Build settings for action build and target MyApp',
      stderr: '',
      exitCode: 0
    };
  }
  
  function createPlatformMismatchResult(): ExecutionResult {
    return {
      stdout: '',
      stderr: `xcodebuild: error: Unable to find a destination matching the provided destination specifier:
        { platform:iOS Simulator }

Available destinations for the "MyScheme" scheme:
    { platform:macOS, name:My Mac }`,
      exitCode: 70
    };
  }
  
  function createOtherErrorResult(): ExecutionResult {
    return {
      stdout: '',
      stderr: 'xcodebuild: warning: some other warning',
      exitCode: 1
    };
  }
  
  describe('validate', () => {
    describe('when platform is supported', () => {
      it('should validate successfully for a workspace with scheme', async () => {
        // Arrange
        const { sut, mockExecute } = createSUT();
        const projectPath = '/path/to/project.xcworkspace';
        const isWorkspace = true;
        const scheme = 'MyScheme';
        const platform = Platform.iOS;
        
        mockExecute.mockResolvedValue(createSuccessResult());
        
        // Act
        await sut.validate(projectPath, isWorkspace, scheme, platform);
        
        // Assert - should not throw
        expect(mockExecute).toHaveBeenCalledWith(
          expect.stringContaining('-workspace "/path/to/project.xcworkspace"'),
          expect.objectContaining({
            maxBuffer: 1024 * 1024,
            timeout: 10000
          })
        );
        expect(mockExecute).toHaveBeenCalledWith(
          expect.stringContaining('-scheme "MyScheme"'),
          expect.any(Object)
        );
        expect(mockExecute).toHaveBeenCalledWith(
          expect.stringContaining("destination 'generic/platform=iOS Simulator'"),
          expect.any(Object)
        );
      });
      
      it('should validate successfully for a project without scheme', async () => {
        // Arrange
        const { sut, mockExecute } = createSUT();
        const projectPath = '/path/to/project.xcodeproj';
        const isWorkspace = false;
        const scheme = undefined;
        const platform = Platform.macOS;
        
        mockExecute.mockResolvedValue(createSuccessResult());
        
        // Act
        await sut.validate(projectPath, isWorkspace, scheme, platform);
        
        // Assert
        expect(mockExecute).toHaveBeenCalledWith(
          expect.stringContaining('-project "/path/to/project.xcodeproj"'),
          expect.any(Object)
        );
        expect(mockExecute).toHaveBeenCalledWith(
          expect.not.stringContaining('-scheme'),
          expect.any(Object)
        );
        expect(mockExecute).toHaveBeenCalledWith(
          expect.stringContaining("destination 'platform=macOS'"),
          expect.any(Object)
        );
      });
    });
    
    describe('when platform is not supported', () => {
      it('should throw error with available platforms', async () => {
        // Arrange
        const { sut, mockExecute } = createSUT();
        const projectPath = '/path/to/project.xcworkspace';
        const isWorkspace = true;
        const scheme = 'MyScheme';
        const platform = Platform.iOS;
        
        mockExecute.mockResolvedValue(createPlatformMismatchResult());
        
        // Act & Assert
        await expect(
          sut.validate(projectPath, isWorkspace, scheme, platform)
        ).rejects.toThrow(
          "Platform 'iOS' is not supported by scheme 'MyScheme'. Available platforms: macOS"
        );
      });
      
      it('should handle default scheme in error message', async () => {
        // Arrange
        const { sut, mockExecute } = createSUT();
        const projectPath = '/path/to/project.xcodeproj';
        const isWorkspace = false;
        const scheme = undefined;
        const platform = Platform.tvOS;
        
        const result: ExecutionResult = {
          stdout: '',
          stderr: `Available destinations for the scheme:
            { platform:iOS Simulator, name:iPhone }
            { platform:watchOS Simulator, name:Apple Watch }`,
          exitCode: 70
        };
        
        mockExecute.mockResolvedValue(result);
        
        // Act & Assert
        await expect(
          sut.validate(projectPath, isWorkspace, scheme, platform)
        ).rejects.toThrow(
          "Platform 'tvOS' is not supported by scheme 'default'. Available platforms: iOS, watchOS"
        );
      });
    });
    
    describe('when validation fails with non-platform error', () => {
      it('should log warning but not throw', async () => {
        // Arrange
        const { sut, mockExecute } = createSUT();
        const projectPath = '/path/to/project.xcworkspace';
        const isWorkspace = true;
        const scheme = 'MyScheme';
        const platform = Platform.iOS;
        
        mockExecute.mockResolvedValue(createOtherErrorResult());
        
        // Act - should not throw
        await sut.validate(projectPath, isWorkspace, scheme, platform);
        
        // Assert
        expect(mockExecute).toHaveBeenCalled();
      });
    });
    
    describe('when using different platforms', () => {
      it.each([
        [Platform.iOS, 'generic/platform=iOS Simulator'],
        [Platform.tvOS, 'generic/platform=tvOS Simulator'],
        [Platform.watchOS, 'generic/platform=watchOS Simulator'],
        [Platform.visionOS, 'generic/platform=xrOS Simulator'],
        [Platform.macOS, 'platform=macOS']
      ])('should use correct destination for %s', async (platform, expectedDestination) => {
        // Arrange
        const { sut, mockExecute } = createSUT();
        const projectPath = '/path/to/project.xcodeproj';
        
        mockExecute.mockResolvedValue(createSuccessResult());
        
        // Act
        await sut.validate(projectPath, false, 'MyScheme', platform);
        
        // Assert
        expect(mockExecute).toHaveBeenCalledWith(
          expect.stringContaining(`destination '${expectedDestination}'`),
          expect.any(Object)
        );
      });
    });
  });
  
  describe('extractAvailablePlatforms (private method tested via public API)', () => {
    it('should extract and normalize platform names', async () => {
      // Arrange
      const { sut, mockExecute } = createSUT();
      const errorOutput = `
Available destinations for the "MyScheme" scheme:
    { platform:iOS Simulator, name:iPhone 15 }
    { platform:iOS Simulator, name:iPhone 14 }
    { platform:watchOS Simulator, name:Apple Watch }
    { platform:macOS, name:My Mac }
    { platform:tvOS Simulator, name:Apple TV }`;
      
      const result: ExecutionResult = {
        stdout: '',
        stderr: errorOutput,
        exitCode: 70
      };
      
      mockExecute.mockResolvedValue(result);
      
      // Act & Assert
      await expect(
        sut.validate('/path', false, 'MyScheme', Platform.visionOS)
      ).rejects.toThrow(
        // Should deduplicate iOS and remove "Simulator" suffix
        "Available platforms: iOS, watchOS, macOS, tvOS"
      );
    });
    
    it('should handle empty platform list', async () => {
      // Arrange
      const { sut, mockExecute } = createSUT();
      const result: ExecutionResult = {
        stdout: '',
        stderr: 'Available destinations for the scheme:',
        exitCode: 70
      };
      
      mockExecute.mockResolvedValue(result);
      
      // Act & Assert
      await expect(
        sut.validate('/path', false, 'MyScheme', Platform.iOS)
      ).rejects.toThrow(
        "Available platforms: " // Empty list
      );
    });
  });
});