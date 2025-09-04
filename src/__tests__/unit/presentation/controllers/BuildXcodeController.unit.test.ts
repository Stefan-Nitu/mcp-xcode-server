import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { BuildXcodeController } from '../../../../presentation/controllers/BuildXcodeController.js';
import { BuildProjectUseCase } from '../../../../application/use-cases/BuildProjectUseCase.js';
import { ConfigProvider } from '../../../../infrastructure/adapters/ConfigProvider.js';
import { BuildRequest } from '../../../../domain/value-objects/BuildRequest.js';
import { BuildResult } from '../../../../domain/entities/BuildResult.js';
import { BuildDestination } from '../../../../domain/value-objects/BuildDestination.js';
import { existsSync } from 'fs';

// Mock filesystem
jest.mock('fs', () => ({
  existsSync: jest.fn()
}));

const mockExistsSync = existsSync as jest.MockedFunction<typeof existsSync>;

/**
 * Unit tests for BuildXcodeController
 * 
 * Following TDD principles from testing-philosophy.md:
 * - Test behavior, not implementation
 * - Use SUT (System Under Test) pattern with factory methods
 * - Follow DAMP over DRY for clarity
 * - Mock only at boundaries (use case, config provider)
 */

describe('BuildXcodeController', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Mock filesystem to return true for .xcodeproj and .xcworkspace files
    mockExistsSync.mockImplementation((path) => {
      const pathStr = String(path);
      return pathStr.endsWith('.xcodeproj') || pathStr.endsWith('.xcworkspace');
    });
  });

  // Factory method for creating SUT and mocks
  function createSUT() {
    // Create mocks that match the minimal interface needed
    const mockExecute = jest.fn<(request: BuildRequest) => Promise<BuildResult>>();
    const mockBuildUseCase: Pick<BuildProjectUseCase, 'execute'> = {
      execute: mockExecute
    };
    
    const mockGetDerivedDataPath = jest.fn<(projectPath: string) => string>();
    const mockConfigProvider: Pick<ConfigProvider, 'getDerivedDataPath'> = {
      getDerivedDataPath: mockGetDerivedDataPath
    };
    
    // Controller only takes 2 parameters now
    const sut = new BuildXcodeController(
      mockBuildUseCase as BuildProjectUseCase,
      mockConfigProvider as ConfigProvider
    );
    
    return {
      sut,
      mockBuildUseCase: { execute: mockExecute },
      mockConfigProvider: { getDerivedDataPath: mockGetDerivedDataPath }
    };
  }
  
  // Factory methods for test data
  function createValidInput(overrides = {}) {
    return {
      projectPath: '/path/to/project.xcodeproj',
      scheme: 'MyApp',
      destination: 'iOSSimulator',
      configuration: 'Debug',
      ...overrides
    };
  }
  
  function createSuccessfulBuildResult(): BuildResult {
    return BuildResult.success(
      'Build succeeded',
      '/path/to/app.app',
      '/path/to/logs/build.log'
    );
  }
  
  describe('input validation', () => {
    it('should accept valid input with all required fields', async () => {
      // Arrange
      const { sut, mockBuildUseCase, mockConfigProvider } = createSUT();
      const input = createValidInput();
      const expectedResult = createSuccessfulBuildResult();
      
      // Mock config provider in case derivedDataPath is not in input
      mockConfigProvider.getDerivedDataPath.mockReturnValue('/default/derived/data');
      mockBuildUseCase.execute.mockResolvedValue(expectedResult);
      
      // Act
      const result = await sut.handle(input);
      
      // Assert
      expect(result).toBe(expectedResult);
      expect(mockBuildUseCase.execute).toHaveBeenCalled();
    });
    
    it('should throw error when projectPath is missing', async () => {
      // Arrange
      const { sut } = createSUT();
      const input = createValidInput({ projectPath: undefined });
      
      // Act & Assert
      await expect(sut.handle(input)).rejects.toThrow();
    });
    
    it('should throw error when projectPath is empty string', async () => {
      // Arrange
      const { sut } = createSUT();
      const input = createValidInput({ projectPath: '' });
      
      // Act & Assert
      await expect(sut.handle(input)).rejects.toThrow();
    });
    
    it('should throw error when scheme is missing', async () => {
      // Arrange
      const { sut } = createSUT();
      const input = createValidInput({ scheme: undefined });
      
      // Act & Assert
      await expect(sut.handle(input)).rejects.toThrow();
    });
    
    it('should use default configuration Debug when not provided', async () => {
      // Arrange
      const { sut, mockBuildUseCase, mockConfigProvider } = createSUT();
      const input = { 
        projectPath: '/path/to/project.xcodeproj',
        scheme: 'MyApp',
        destination: 'iOSSimulator'
        // configuration not provided
      };
      const expectedResult = createSuccessfulBuildResult();
      
      mockConfigProvider.getDerivedDataPath.mockReturnValue('/default/derived/data');
      mockBuildUseCase.execute.mockResolvedValue(expectedResult);
      
      // Act
      await sut.handle(input);
      
      // Assert
      // Verify that BuildRequest was created with Debug configuration
      const buildRequestArg = mockBuildUseCase.execute.mock.calls[0][0];
      expect(buildRequestArg.configuration).toBe('Debug');
    });
    
    it('should reject invalid destination value', async () => {
      // Arrange
      const { sut } = createSUT();
      const input = createValidInput({ destination: 'Android' });
      
      // Act & Assert
      await expect(sut.handle(input)).rejects.toThrow();
    });
  });
  
  describe('build request creation', () => {
    it('should create BuildRequest with provided derived data path', async () => {
      // Arrange
      const { sut, mockBuildUseCase, mockConfigProvider } = createSUT();
      const derivedDataPath = '/custom/derived/data';
      const input = createValidInput({ derivedDataPath });
      const expectedResult = createSuccessfulBuildResult();
      
      mockBuildUseCase.execute.mockResolvedValue(expectedResult);
      
      // Act
      await sut.handle(input);
      
      // Assert
      expect(mockConfigProvider.getDerivedDataPath).not.toHaveBeenCalled();
      const buildRequestArg = mockBuildUseCase.execute.mock.calls[0][0];
      expect(buildRequestArg.derivedDataPath).toBe(derivedDataPath);
    });
    
    it('should get derived data path from ConfigProvider when not provided', async () => {
      // Arrange
      const { sut, mockBuildUseCase, mockConfigProvider } = createSUT();
      const input = createValidInput(); // No derivedDataPath
      const configDerivedDataPath = '/config/derived/data';
      const expectedResult = createSuccessfulBuildResult();
      
      mockConfigProvider.getDerivedDataPath.mockReturnValue(configDerivedDataPath);
      mockBuildUseCase.execute.mockResolvedValue(expectedResult);
      
      // Act
      await sut.handle(input);
      
      // Assert
      expect(mockConfigProvider.getDerivedDataPath).toHaveBeenCalledWith('/path/to/project.xcodeproj');
      const buildRequestArg = mockBuildUseCase.execute.mock.calls[0][0];
      expect(buildRequestArg.derivedDataPath).toBe(configDerivedDataPath);
    });
    
    it('should create BuildRequest with all validated fields', async () => {
      // Arrange
      const { sut, mockBuildUseCase } = createSUT();
      const input = createValidInput({
        projectPath: '/my/project.xcodeproj',
        scheme: 'TestScheme',
        destination: 'macOSUniversal',
        configuration: 'Release',
        derivedDataPath: '/custom/path'
      });
      const expectedResult = createSuccessfulBuildResult();
      
      mockBuildUseCase.execute.mockResolvedValue(expectedResult);
      
      // Act
      await sut.handle(input);
      
      // Assert
      const buildRequestArg = mockBuildUseCase.execute.mock.calls[0][0];
      expect(buildRequestArg.projectPath.toString()).toBe('/my/project.xcodeproj');
      expect(buildRequestArg.scheme).toBe('TestScheme');
      expect(buildRequestArg.destination).toBe(BuildDestination.macOSUniversal);
      expect(buildRequestArg.configuration).toBe('Release');
      expect(buildRequestArg.derivedDataPath).toBe('/custom/path');
    });

    it('should map destination strings to BuildDestination enum values', async () => {
      // Arrange
      const { sut, mockBuildUseCase, mockConfigProvider } = createSUT();
      mockConfigProvider.getDerivedDataPath.mockReturnValue('/default/derived/data');
      const destinations = [
        { input: 'iOSSimulator', expected: BuildDestination.iOSSimulator },
        { input: 'iOSDevice', expected: BuildDestination.iOSDevice },
        { input: 'iOSSimulatorUniversal', expected: BuildDestination.iOSSimulatorUniversal },
        { input: 'macOS', expected: BuildDestination.macOS },
        { input: 'macOSUniversal', expected: BuildDestination.macOSUniversal },
        { input: 'tvOSSimulator', expected: BuildDestination.tvOSSimulator },
        { input: 'watchOSSimulator', expected: BuildDestination.watchOSSimulator },
        { input: 'visionOSSimulator', expected: BuildDestination.visionOSSimulator }
      ];
      
      for (const { input, expected } of destinations) {
        const args = createValidInput({ destination: input });
        mockBuildUseCase.execute.mockResolvedValue(createSuccessfulBuildResult());
        
        // Act
        await sut.handle(args);
        
        // Assert
        const buildRequestArg = mockBuildUseCase.execute.mock.calls[mockBuildUseCase.execute.mock.calls.length - 1][0];
        expect(buildRequestArg.destination).toBe(expected);
      }
    });
  });
  
  describe('successful build flow', () => {
    it('should execute build use case and return result', async () => {
      // Arrange
      const { sut, mockBuildUseCase, mockConfigProvider } = createSUT();
      const input = createValidInput();
      const expectedResult = createSuccessfulBuildResult();
      
      mockConfigProvider.getDerivedDataPath.mockReturnValue('/default/derived/data');
      mockBuildUseCase.execute.mockResolvedValue(expectedResult);
      
      // Act
      const result = await sut.handle(input);
      
      // Assert
      expect(mockBuildUseCase.execute).toHaveBeenCalledTimes(1);
      expect(result).toBe(expectedResult);
      expect(result.success).toBe(true);
    });
    
    it('should handle failed build result', async () => {
      // Arrange
      const { sut, mockBuildUseCase, mockConfigProvider } = createSUT();
      const input = createValidInput();
      const failedResult = BuildResult.failure(
        'Build failed',
        [], // Empty issues array for now
        1, // Exit code
        '/path/to/logs/build.log'
      );
      
      mockConfigProvider.getDerivedDataPath.mockReturnValue('/default/derived/data');
      mockBuildUseCase.execute.mockResolvedValue(failedResult);
      
      // Act
      const result = await sut.handle(input);
      
      // Assert
      expect(result).toBe(failedResult);
      expect(result.success).toBe(false);
      expect(result.exitCode).toBe(1);
    });
  });
  
  describe('error handling', () => {
    it('should throw error with clear message for invalid input', async () => {
      // Arrange
      const { sut } = createSUT();
      const input = { invalidField: 'value' };
      
      // Act & Assert
      await expect(sut.handle(input)).rejects.toThrow();
    });
    
    it('should throw error when BuildRequest creation fails due to non-existent project', async () => {
      // Arrange
      const { sut } = createSUT();
      const input = createValidInput({ projectPath: '/nonexistent/project.xcodeproj' });
      
      // Mock file doesn't exist
      mockExistsSync.mockReturnValue(false);
      
      // Act & Assert
      await expect(sut.handle(input)).rejects.toThrow();
    });
    
    it('should propagate error from build use case', async () => {
      // Arrange
      const { sut, mockBuildUseCase, mockConfigProvider } = createSUT();
      const input = createValidInput();
      const buildError = new Error('Build system error');
      
      mockConfigProvider.getDerivedDataPath.mockReturnValue('/default/derived/data');
      mockBuildUseCase.execute.mockRejectedValue(buildError);
      
      // Act & Assert
      await expect(sut.handle(input)).rejects.toThrow('Build system error');
    });
    
    it('should handle unexpected errors gracefully', async () => {
      // Arrange
      const { sut, mockBuildUseCase, mockConfigProvider } = createSUT();
      const input = createValidInput();
      
      mockConfigProvider.getDerivedDataPath.mockReturnValue('/default/derived/data');
      // Simulate a rejection with no error object (edge case)
      mockBuildUseCase.execute.mockRejectedValue(new Error('Unexpected error'));
      
      // Act & Assert
      await expect(sut.handle(input)).rejects.toThrow('Unexpected error');
    });
  });
  
  describe('integration scenarios', () => {
    it('should handle complete flow with all optional parameters', async () => {
      // Arrange
      const { sut, mockBuildUseCase, mockConfigProvider } = createSUT();
      const input = {
        projectPath: '/Users/dev/MyApp/MyApp.xcodeproj',
        scheme: 'MyApp-Production',
        destination: 'visionOSSimulator',
        configuration: 'Release',
        derivedDataPath: '/Users/dev/DerivedData'
      };
      const expectedResult = BuildResult.success(
        'Build succeeded for visionOS',
        '/Users/dev/MyApp/Build/MyApp.app',
        '/path/to/logs/build.log'
      );
      
      mockBuildUseCase.execute.mockResolvedValue(expectedResult);
      
      // Act
      const result = await sut.handle(input);
      
      // Assert
      expect(mockConfigProvider.getDerivedDataPath).not.toHaveBeenCalled();
      
      const buildRequestArg = mockBuildUseCase.execute.mock.calls[0][0];
      expect(buildRequestArg.projectPath.toString()).toBe('/Users/dev/MyApp/MyApp.xcodeproj');
      expect(buildRequestArg.scheme).toBe('MyApp-Production');
      expect(buildRequestArg.destination).toBe(BuildDestination.visionOSSimulator);
      expect(buildRequestArg.configuration).toBe('Release');
      expect(buildRequestArg.derivedDataPath).toBe('/Users/dev/DerivedData');
      
      expect(result).toBe(expectedResult);
    });
    
    it('should handle minimal input with all defaults', async () => {
      // Arrange
      const { sut, mockBuildUseCase, mockConfigProvider } = createSUT();
      const input = {
        projectPath: '/path/to/project.xcodeproj',
        scheme: 'MyApp',
        destination: 'iOSSimulator'
      };
      const configDerivedData = '/default/derived/data';
      const expectedResult = createSuccessfulBuildResult();
      
      mockConfigProvider.getDerivedDataPath.mockReturnValue(configDerivedData);
      mockBuildUseCase.execute.mockResolvedValue(expectedResult);
      
      // Act
      const result = await sut.handle(input);
      
      // Assert
      expect(mockConfigProvider.getDerivedDataPath).toHaveBeenCalledWith('/path/to/project.xcodeproj');
      
      const buildRequestArg = mockBuildUseCase.execute.mock.calls[0][0];
      expect(buildRequestArg.destination).toBe(BuildDestination.iOSSimulator);
      expect(buildRequestArg.configuration).toBe('Debug'); // default
      expect(buildRequestArg.derivedDataPath).toBe(configDerivedData);
      
      expect(result).toBe(expectedResult);
    });
  });
});