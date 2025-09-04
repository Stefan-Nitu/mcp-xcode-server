import { BuildProjectUseCase } from '../../../../application/use-cases/BuildProjectUseCase.js';
import { BuildRequest } from '../../../../domain/value-objects/BuildRequest.js';
import { BuildDestination } from '../../../../domain/value-objects/BuildDestination.js';
import { ICommandExecutor } from '../../../../application/ports/CommandPorts.js';
import { IAppLocator } from '../../../../application/ports/ArtifactPorts.js';
import { ILogManager } from '../../../../application/ports/LoggingPorts.js';

import { XcbeautifyOutputParser } from '../../../../infrastructure/adapters/XcbeautifyOutputParser.js';
import { BuildDestinationMapper } from '../../../../infrastructure/adapters/BuildDestinationMapper.js';
import { XcodeBuildCommandBuilder } from '../../../../infrastructure/adapters/XcodeBuildCommandBuilder.js';
import { SystemArchitectureDetector } from '../../../../infrastructure/adapters/SystemArchitectureDetector.js';

jest.mock('fs', () => ({
  existsSync: jest.fn().mockReturnValue(true)
}));

/**
 * Sociable Unit tests for BuildProjectUseCase
 * 
 * Uses real collaborators except for external boundaries (subprocess, filesystem, I/O)
 */
describe('BuildProjectUseCase', () => {
  function createSUT() {
    const mockExecutor: jest.Mocked<ICommandExecutor> = {
      execute: jest.fn()
    };
    
    const mockArchExecutor: jest.Mocked<ICommandExecutor> = {
      execute: jest.fn().mockResolvedValue({ stdout: 'arm64\n', stderr: '', exitCode: 0 })
    };
    
    const mockAppLocator: jest.Mocked<IAppLocator> = {
      findApp: jest.fn()
    };
    
    const mockLogger: jest.Mocked<ILogManager> = {
      saveLog: jest.fn().mockReturnValue('/path/to/log'),
      saveDebugData: jest.fn().mockReturnValue('/path/to/debug')
    };
    
    const architectureDetector = new SystemArchitectureDetector(mockArchExecutor);
    const destinationMapper = new BuildDestinationMapper(architectureDetector);
    const commandBuilder = new XcodeBuildCommandBuilder();
    const outputParser = new XcbeautifyOutputParser();
    
    const sut = new BuildProjectUseCase(
      destinationMapper,
      commandBuilder,
      mockExecutor,
      mockAppLocator,
      mockLogger,
      outputParser
    );
    
    return {
      sut,
      mockExecutor,
      mockAppLocator,
      mockLogger
    };
  }
  
  function createBuildRequest(overrides: Partial<{
    projectPath: string;
    scheme: string;
    destination: BuildDestination;
    configuration: string;
    derivedDataPath: string;
  }> = {}) {
    return BuildRequest.create(
      overrides.projectPath || '/path/to/project.xcodeproj',
      overrides.scheme || 'MyApp',
      overrides.destination || BuildDestination.iOSSimulator,
      overrides.configuration || 'Debug',
      overrides.derivedDataPath || '/path/to/DerivedData'
    );
  }
  
  describe('successful build workflow', () => {
    it('should orchestrate a successful build with app artifact', async () => {
      // Arrange
      const { sut, mockExecutor, mockAppLocator, mockLogger } = createSUT();
      const request = createBuildRequest();
      
      mockExecutor.execute.mockResolvedValue({
        exitCode: 0,
        stdout: 'Build succeeded\nBuilding target MyApp',
        stderr: ''
      });
      mockAppLocator.findApp.mockResolvedValue('/path/to/DerivedData/MyApp.app');
      
      // Act
      const result = await sut.execute(request);
      
      // Assert
      expect(result.success).toBe(true);
      expect(result.appPath).toBe('/path/to/DerivedData/MyApp.app');
      expect(result.logPath).toBe('/path/to/log');
      expect(result.hasErrors()).toBe(false);
      expect(result.output).toContain('Build succeeded');
      
      expect(mockExecutor.execute).toHaveBeenCalled();
      expect(mockAppLocator.findApp).toHaveBeenCalled();
      expect(mockLogger.saveLog).toHaveBeenCalledWith(
        'build',
        expect.stringContaining('Build succeeded'),
        'project',
        expect.objectContaining({
          scheme: 'MyApp',
          configuration: 'Debug',
          destination: BuildDestination.iOSSimulator,
          exitCode: 0
        })
      );
    });
    
    it('should handle workspace projects correctly', async () => {
      // Arrange
      const { sut, mockExecutor } = createSUT();
      const request = createBuildRequest({
        projectPath: '/path/to/project.xcworkspace'
      });
      
      mockExecutor.execute.mockResolvedValue({
        exitCode: 0,
        stdout: 'Build succeeded',
        stderr: ''
      });
      
      // Act
      const result = await sut.execute(request);
      
      // Assert
      expect(result.success).toBe(true);
      
      const executedCommand = mockExecutor.execute.mock.calls[0][0];
      expect(executedCommand).toContain('-workspace');
      expect(executedCommand).toContain('/path/to/project.xcworkspace');
    });
    
    it('should succeed even when app artifact cannot be located', async () => {
      // Arrange
      const { sut, mockExecutor, mockAppLocator } = createSUT();
      const request = createBuildRequest();
      
      mockExecutor.execute.mockResolvedValue({
        exitCode: 0,
        stdout: 'Build succeeded',
        stderr: ''
      });
      mockAppLocator.findApp.mockResolvedValue(undefined);
      
      // Act
      const result = await sut.execute(request);
      
      // Assert
      expect(result.success).toBe(true);
      expect(result.appPath).toBeUndefined();
      expect(result.hasErrors()).toBe(false);
    });
    
    it('should use custom derived data path when provided', async () => {
      // Arrange
      const { sut, mockExecutor, mockAppLocator } = createSUT();
      const customPath = '/custom/derived/data';
      const request = createBuildRequest({ 
        derivedDataPath: customPath 
      });
      
      mockExecutor.execute.mockResolvedValue({
        exitCode: 0,
        stdout: 'Build succeeded',
        stderr: ''
      });
      
      // Act
      const result = await sut.execute(request);
      
      // Assert
      expect(result.success).toBe(true);
      expect(mockAppLocator.findApp).toHaveBeenCalledWith(customPath);
      
      const executedCommand = mockExecutor.execute.mock.calls[0][0];
      expect(executedCommand).toContain(`-derivedDataPath "${customPath}"`);
    });
  });
  
  describe('build failure scenarios', () => {
    it('should handle build execution failure with parsed issues', async () => {
      // Arrange
      const { sut, mockExecutor } = createSUT();
      const request = createBuildRequest();
      
      mockExecutor.execute.mockResolvedValue({
        exitCode: 1,
        stdout: '❌ /path/file.swift:10:5: no such module\n⚠️ /path/other.swift:20:8: deprecated API',
        stderr: 'Build failed'
      });
      
      // Act
      const result = await sut.execute(request);
      
      // Assert
      expect(result.success).toBe(false);
      expect(result.exitCode).toBe(1);
      
      const errors = result.getErrors();
      const warnings = result.getWarnings();
      expect(errors).toHaveLength(1);
      expect(warnings).toHaveLength(1);
      expect(errors[0].message).toBe('no such module');
      expect(warnings[0].message).toBe('deprecated API');
    });
    
    it('should handle command timeout', async () => {
      // Arrange
      const { sut, mockExecutor } = createSUT();
      const request = createBuildRequest();
      
      mockExecutor.execute.mockRejectedValue(
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
      const { sut, mockExecutor, mockAppLocator } = createSUT();
      const request = createBuildRequest();
      
      mockExecutor.execute.mockResolvedValue({
        exitCode: 0,
        stdout: 'Build succeeded with warnings',
        stderr: ''
      });
      mockAppLocator.findApp.mockResolvedValue('/path/to/MyApp.app');
      
      // Act
      const result = await sut.execute(request);
      
      // Assert
      expect(result.success).toBe(true);
      expect(result.appPath).toBe('/path/to/MyApp.app');
      expect(result.getWarnings()).toHaveLength(0);
    });
  });
  
  describe('logging behavior', () => {
    it('should save build output and debug data', async () => {
      // Arrange
      const { sut, mockExecutor, mockLogger } = createSUT();
      const request = createBuildRequest();
      const buildOutput = 'Detailed build output...';
      
      mockExecutor.execute.mockResolvedValue({
        exitCode: 0,
        stdout: buildOutput,
        stderr: ''
      });
      
      // Act
      const result = await sut.execute(request);
      
      // Assert
      const executedCommand = mockExecutor.execute.mock.calls[0][0];
      expect(mockLogger.saveDebugData).toHaveBeenCalledWith(
        'build-command',
        { command: executedCommand },
        'project'
      );
      expect(mockLogger.saveDebugData).toHaveBeenCalledWith(
        'build-success',
        expect.objectContaining({
          project: 'project',
          scheme: 'MyApp'
        }),
        'project'
      );
      expect(mockLogger.saveLog).toHaveBeenCalledWith(
        'build',
        buildOutput,
        'project',
        expect.objectContaining({
          scheme: 'MyApp',
          configuration: 'Debug',
          destination: BuildDestination.iOSSimulator,
          exitCode: 0,
          command: executedCommand
        })
      );
      expect(result.logPath).toBe('/path/to/log');
    });
    
    it('should log failure details', async () => {
      // Arrange
      const { sut, mockExecutor, mockLogger } = createSUT();
      const request = createBuildRequest();
      
      mockExecutor.execute.mockResolvedValue({
        exitCode: 1,
        stdout: '❌ Compilation failed',
        stderr: 'error output'
      });
      
      // Act
      const result = await sut.execute(request);
      
      // Assert
      expect(result.success).toBe(false);
      expect(mockLogger.saveDebugData).toHaveBeenCalledWith(
        'build-failure',
        { exitCode: 1 },
        'project'
      );
      
      const errors = result.getErrors();
      expect(errors.length).toBeGreaterThan(0);
    });
  });
  
  describe('destination-specific behavior', () => {
    it('should handle macOS destination', async () => {
      // Arrange
      const { sut, mockExecutor } = createSUT();
      const request = createBuildRequest({
        destination: BuildDestination.macOS
      });
      
      mockExecutor.execute.mockResolvedValue({
        exitCode: 0,
        stdout: 'Build succeeded',
        stderr: ''
      });
      
      // Act
      const result = await sut.execute(request);
      
      // Assert
      expect(result.success).toBe(true);
      
      const executedCommand = mockExecutor.execute.mock.calls[0][0];
      expect(executedCommand).toContain('platform=macOS');
    });
    
    it('should handle iOS device destination differently', async () => {
      // Arrange
      const { sut, mockExecutor } = createSUT();
      const request = createBuildRequest({
        destination: BuildDestination.iOSDevice
      });
      
      mockExecutor.execute.mockResolvedValue({
        exitCode: 0,
        stdout: 'Build succeeded',
        stderr: ''
      });
      
      // Act
      const result = await sut.execute(request);
      
      // Assert
      expect(result.success).toBe(true);
      
      const executedCommand = mockExecutor.execute.mock.calls[0][0];
      expect(executedCommand).toContain('generic/platform=iOS');
      expect(executedCommand).not.toContain('ONLY_ACTIVE_ARCH');
    });
  });
});