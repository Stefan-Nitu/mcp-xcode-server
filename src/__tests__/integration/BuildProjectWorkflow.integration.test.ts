import { BuildProjectUseCase } from '../../application/use-cases/BuildProjectUseCase.js';
import { BuildRequest } from '../../domain/value-objects/BuildRequest.js';
import { BuildIssue } from '../../domain/value-objects/BuildIssue.js';
import { Platform } from '../../domain/value-objects/Platform.js';
import { 
  IPlatformValidator, 
  IBuildCommandBuilder, 
  ICommandExecutor,
  IAppLocator
} from '../../application/ports/BuildPorts.js';
import { ILogManager } from '../../application/ports/LoggingPorts.js';
import { IOutputParser, ParsedOutput } from '../../application/ports/OutputParserPorts.js';
import * as fs from 'fs';

// Mock filesystem for ProjectPath validation
jest.mock('fs', () => ({
  existsSync: jest.fn().mockReturnValue(true)
}));

/**
 * Integration tests for BuildProjectUseCase
 * Following testing philosophy: Integration test with mocked external boundaries only
 * Tests the orchestration and data flow through the use case
 */
describe('BuildProjectWorkflow', () => {
  // Factory for creating SUT with mocked boundaries
  function createSUT() {
    // Mock only external boundaries (subprocess, filesystem)
    const mockValidator: jest.Mocked<IPlatformValidator> = {
      validate: jest.fn()
    };
    
    const mockCommandBuilder: jest.Mocked<IBuildCommandBuilder> = {
      build: jest.fn()
    };
    
    const mockExecutor: jest.Mocked<ICommandExecutor> = {
      execute: jest.fn()
    };
    
    const mockAppLocator: jest.Mocked<IAppLocator> = {
      findApp: jest.fn()
    };
    
    const mockLogger: jest.Mocked<ILogManager> = {
      saveLog: jest.fn().mockReturnValue('/path/to/log'),
      saveDebugData: jest.fn().mockReturnValue('/path/to/debug')
    };
    
    const mockOutputParser: jest.Mocked<IOutputParser> = {
      parseBuildOutput: jest.fn()
    };
    
    const sut = new BuildProjectUseCase(
      mockValidator,
      mockCommandBuilder,
      mockExecutor,
      mockAppLocator,
      mockLogger,
      mockOutputParser
    );
    
    return {
      sut,
      mocks: {
        validator: mockValidator,
        commandBuilder: mockCommandBuilder,
        executor: mockExecutor,
        appLocator: mockAppLocator,
        logger: mockLogger,
        outputParser: mockOutputParser
      }
    };
  }
  
  // Factory for creating domain objects (using real implementations)
  function createBuildRequest(overrides: Partial<{
    projectPath: string;
    scheme: string;
    platform: Platform;
    configuration: string;
    deviceId?: string;
    derivedDataPath?: string;
  }> = {}) {
    // BuildRequest constructor takes raw values and creates domain objects internally
    return new BuildRequest({
      projectPath: overrides.projectPath || '/path/to/project.xcodeproj',
      scheme: overrides.scheme || 'MyApp',
      platform: overrides.platform || Platform.iOS,
      configuration: overrides.configuration || 'Debug',
      deviceId: overrides.deviceId,
      derivedDataPath: overrides.derivedDataPath
    });
  }
  
  describe('successful build workflow', () => {
    it('should orchestrate a successful build with app artifact', async () => {
      // Arrange
      const { sut, mocks } = createSUT();
      const request = createBuildRequest();
      
      // Setup mock behavior for successful build
      mocks.validator.validate.mockResolvedValue(undefined);
      mocks.commandBuilder.build.mockReturnValue('xcodebuild -project /path/to/project.xcodeproj -scheme MyApp');
      mocks.executor.execute.mockResolvedValue({
        exitCode: 0,
        stdout: 'Build succeeded\nBuilding target MyApp',
        stderr: ''
      });
      mocks.appLocator.findApp.mockResolvedValue('/path/to/DerivedData/MyApp.app');
      
      // Act
      const result = await sut.execute(request);
      
      // Assert - verify the outcome
      expect(result.success).toBe(true);
      expect(result.appPath).toBe('/path/to/DerivedData/MyApp.app');
      expect(result.logPath).toBe('/path/to/log');
      expect(result.hasErrors()).toBe(false);
      expect(result.output).toContain('Build succeeded');
      
      // Verify the orchestration flow
      expect(mocks.validator.validate).toHaveBeenCalledWith(
        '/path/to/project.xcodeproj',
        false,
        'MyApp',
        Platform.iOS
      );
      expect(mocks.commandBuilder.build).toHaveBeenCalled();
      expect(mocks.executor.execute).toHaveBeenCalled();
      expect(mocks.appLocator.findApp).toHaveBeenCalled();
      expect(mocks.logger.saveLog).toHaveBeenCalledWith(
        'build',
        expect.stringContaining('Build succeeded'),
        'project',
        expect.objectContaining({
          scheme: 'MyApp',
          configuration: 'Debug',
          platform: Platform.iOS,
          exitCode: 0
        })
      );
    });
    
    it('should handle workspace projects correctly', async () => {
      // Arrange
      const { sut, mocks } = createSUT();
      const request = createBuildRequest({
        projectPath: '/path/to/project.xcworkspace'
      });
      
      mocks.validator.validate.mockResolvedValue(undefined);
      mocks.commandBuilder.build.mockReturnValue('xcodebuild -workspace ...');
      mocks.executor.execute.mockResolvedValue({
        exitCode: 0,
        stdout: 'Build succeeded',
        stderr: ''
      });
      
      // Act
      await sut.execute(request);
      
      // Assert
      expect(mocks.validator.validate).toHaveBeenCalledWith(
        '/path/to/project.xcworkspace',
        true, // Should detect workspace
        'MyApp',
        Platform.iOS
      );
    });
    
    it('should succeed even when app artifact cannot be located', async () => {
      // Arrange
      const { sut, mocks } = createSUT();
      const request = createBuildRequest();
      
      mocks.validator.validate.mockResolvedValue(undefined);
      mocks.commandBuilder.build.mockReturnValue('xcodebuild ...');
      mocks.executor.execute.mockResolvedValue({
        exitCode: 0,
        stdout: 'Build succeeded',
        stderr: ''
      });
      mocks.appLocator.findApp.mockResolvedValue(undefined); // App not found
      
      // Act
      const result = await sut.execute(request);
      
      // Assert
      expect(result.success).toBe(true);
      expect(result.appPath).toBeUndefined();
      expect(result.hasErrors()).toBe(false);
    });
    
    it('should use custom derived data path when provided', async () => {
      // Arrange
      const { sut, mocks } = createSUT();
      const customPath = '/custom/derived/data';
      const request = createBuildRequest({ 
        derivedDataPath: customPath 
      });
      
      mocks.validator.validate.mockResolvedValue(undefined);
      mocks.commandBuilder.build.mockReturnValue('xcodebuild ...');
      mocks.executor.execute.mockResolvedValue({
        exitCode: 0,
        stdout: 'Build succeeded',
        stderr: ''
      });
      
      // Act
      await sut.execute(request);
      
      // Assert
      expect(mocks.commandBuilder.build).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Boolean),
        expect.objectContaining({ 
          derivedDataPath: customPath 
        })
      );
      expect(mocks.appLocator.findApp).toHaveBeenCalledWith(customPath);
    });
  });
  
  describe('build failure scenarios', () => {
    it('should handle validation failure', async () => {
      // Arrange
      const { sut, mocks } = createSUT();
      const request = createBuildRequest({ 
        scheme: 'InvalidScheme' 
      });
      
      mocks.validator.validate.mockRejectedValue(
        new Error('Scheme "InvalidScheme" does not support platform iOS')
      );
      
      // Act & Assert
      await expect(sut.execute(request)).rejects.toThrow(
        'Scheme "InvalidScheme" does not support platform iOS'
      );
      
      // Verify build was not attempted
      expect(mocks.executor.execute).not.toHaveBeenCalled();
    });
    
    it('should handle build execution failure with parsed issues', async () => {
      // Arrange
      const { sut, mocks } = createSUT();
      const request = createBuildRequest();
      
      const issues = [
        BuildIssue.error('no such module', '/path/file.swift', 10, 5),
        BuildIssue.warning('deprecated API', '/path/other.swift', 20, 8)
      ];
      
      mocks.validator.validate.mockResolvedValue(undefined);
      mocks.commandBuilder.build.mockReturnValue('xcodebuild ...');
      mocks.executor.execute.mockResolvedValue({
        exitCode: 1,
        stdout: 'error: no such module',
        stderr: 'Build failed'
      });
      mocks.outputParser.parseBuildOutput.mockReturnValue({ 
        issues 
      });
      
      // Act
      const result = await sut.execute(request);
      
      // Assert
      expect(result.success).toBe(false);
      expect(result.exitCode).toBe(1);
      
      // Check that issues were properly extracted
      const errors = result.getErrors();
      const warnings = result.getWarnings();
      expect(errors).toHaveLength(1);
      expect(warnings).toHaveLength(1);
      expect(errors[0].message).toBe('no such module');
      expect(warnings[0].message).toBe('deprecated API');
    });
    
    it('should handle command timeout', async () => {
      // Arrange
      const { sut, mocks } = createSUT();
      const request = createBuildRequest();
      
      mocks.validator.validate.mockResolvedValue(undefined);
      mocks.commandBuilder.build.mockReturnValue('xcodebuild ...');
      mocks.executor.execute.mockRejectedValue(
        new Error('Command timed out after 600000ms')
      );
      
      // Act & Assert
      await expect(sut.execute(request)).rejects.toThrow(
        'Command timed out after 600000ms'
      );
    });
  });
  
  describe('build with warnings', () => {
    it('should succeed with warnings when exit code is 0', async () => {
      // Arrange
      const { sut, mocks } = createSUT();
      const request = createBuildRequest();
      
      const warnings = [
        BuildIssue.warning('Deprecated API usage'),
        BuildIssue.warning('Unused variable')
      ];
      
      mocks.validator.validate.mockResolvedValue(undefined);
      mocks.commandBuilder.build.mockReturnValue('xcodebuild ...');
      mocks.executor.execute.mockResolvedValue({
        exitCode: 0,
        stdout: 'Build succeeded with warnings',
        stderr: ''
      });
      // Note: When exit code is 0, we don't parse output
      mocks.appLocator.findApp.mockResolvedValue('/path/to/MyApp.app');
      
      // Act
      const result = await sut.execute(request);
      
      // Assert
      expect(result.success).toBe(true);
      expect(result.appPath).toBe('/path/to/MyApp.app');
      // Since exit code is 0, parser isn't called and no warnings are extracted
      expect(mocks.outputParser.parseBuildOutput).not.toHaveBeenCalled();
    });
  });
  
  describe('logging behavior', () => {
    it('should save build output and debug data', async () => {
      // Arrange
      const { sut, mocks } = createSUT();
      const request = createBuildRequest();
      const buildOutput = 'Detailed build output...';
      const buildCommand = 'xcodebuild -project ...';
      
      mocks.validator.validate.mockResolvedValue(undefined);
      mocks.commandBuilder.build.mockReturnValue(buildCommand);
      mocks.executor.execute.mockResolvedValue({
        exitCode: 0,
        stdout: buildOutput,
        stderr: ''
      });
      
      // Act
      const result = await sut.execute(request);
      
      // Assert
      expect(mocks.logger.saveDebugData).toHaveBeenCalledWith(
        'build-command',
        { command: buildCommand },
        'project'
      );
      expect(mocks.logger.saveDebugData).toHaveBeenCalledWith(
        'build-success',
        expect.objectContaining({
          project: 'project',
          scheme: 'MyApp'
        }),
        'project'
      );
      expect(mocks.logger.saveLog).toHaveBeenCalledWith(
        'build',
        buildOutput,
        'project',
        expect.objectContaining({
          scheme: 'MyApp',
          configuration: 'Debug',
          platform: Platform.iOS,
          exitCode: 0,
          command: buildCommand
        })
      );
      expect(result.logPath).toBe('/path/to/log');
    });
    
    it('should log failure details', async () => {
      // Arrange
      const { sut, mocks } = createSUT();
      const request = createBuildRequest();
      
      const issues = [BuildIssue.error('Compilation failed')];
      
      mocks.validator.validate.mockResolvedValue(undefined);
      mocks.commandBuilder.build.mockReturnValue('xcodebuild ...');
      mocks.executor.execute.mockResolvedValue({
        exitCode: 1,
        stdout: 'Build failed',
        stderr: 'error output'
      });
      mocks.outputParser.parseBuildOutput.mockReturnValue({ issues });
      
      // Act
      const result = await sut.execute(request);
      
      // Assert
      expect(result.success).toBe(false);
      expect(mocks.logger.saveDebugData).toHaveBeenCalledWith(
        'build-failure',
        { exitCode: 1 },
        'project'
      );
    });
  });
  
  describe('platform-specific behavior', () => {
    it('should handle macOS platform without device ID', async () => {
      // Arrange
      const { sut, mocks } = createSUT();
      const request = createBuildRequest({
        platform: Platform.macOS,
        deviceId: undefined
      });
      
      mocks.validator.validate.mockResolvedValue(undefined);
      mocks.commandBuilder.build.mockReturnValue('xcodebuild ...');
      mocks.executor.execute.mockResolvedValue({
        exitCode: 0,
        stdout: 'Build succeeded',
        stderr: ''
      });
      
      // Act
      await sut.execute(request);
      
      // Assert
      expect(mocks.commandBuilder.build).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Boolean),
        expect.objectContaining({
          platform: Platform.macOS,
          deviceId: undefined
        })
      );
    });
  });
});