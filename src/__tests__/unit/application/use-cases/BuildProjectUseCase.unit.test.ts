import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { BuildProjectUseCase } from '../../../../application/use-cases/BuildProjectUseCase.js';
import { BuildRequest } from '../../../../domain/value-objects/BuildRequest.js';
import { BuildDestination } from '../../../../domain/value-objects/BuildDestination.js';
import { BuildResult, BuildOutcome } from '../../../../domain/entities/BuildResult.js';
import { ICommandExecutor, ExecutionResult, ExecutionOptions } from '../../../../application/ports/CommandPorts.js';
import { IAppLocator } from '../../../../application/ports/ArtifactPorts.js';
import { ILogManager } from '../../../../application/ports/LoggingPorts.js';
import { IOutputFormatter } from '../../../../application/ports/OutputFormatterPorts.js';

import { XcbeautifyOutputParserAdapter } from '../../../../infrastructure/adapters/XcbeautifyOutputParserAdapter.js';
import { BuildDestinationMapperAdapter } from '../../../../infrastructure/adapters/BuildDestinationMapperAdapter.js';
import { XcodeBuildCommandAdapter } from '../../../../infrastructure/adapters/XcodeBuildCommandAdapter.js';
import { SystemArchitectureDetector } from '../../../../infrastructure/services/SystemArchitectureDetector.js';
import { existsSync } from 'fs';

jest.mock('fs', () => ({
  existsSync: jest.fn<(path: string) => boolean>()
}));

const mockExistsSync = existsSync as jest.MockedFunction<typeof existsSync>;

/**
 * Sociable Unit tests for BuildProjectUseCase
 * 
 * Uses real collaborators except for external boundaries (subprocess, filesystem, I/O)
 */
describe('BuildProjectUseCase', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Default behavior for tests
    mockExistsSync.mockReturnValue(true);
  });
  
  function createSUT() {
    // Using single parameter function signature with @jest/globals
    const mockExecute = jest.fn<(command: string, options?: ExecutionOptions) => Promise<ExecutionResult>>();
    const mockExecutor: jest.Mocked<ICommandExecutor> = {
      execute: mockExecute
    };
    
    const mockArchExecute = jest.fn<(command: string, options?: ExecutionOptions) => Promise<ExecutionResult>>();
    mockArchExecute.mockResolvedValue({ stdout: 'arm64\n', stderr: '', exitCode: 0 });
    const mockArchExecutor: jest.Mocked<ICommandExecutor> = {
      execute: mockArchExecute
    };
    
    const mockFindApp = jest.fn<IAppLocator['findApp']>();
    const mockAppLocator: jest.Mocked<IAppLocator> = {
      findApp: mockFindApp
    };
    
    const mockSaveLog = jest.fn<ILogManager['saveLog']>();
    mockSaveLog.mockReturnValue('/path/to/log');
    const mockSaveDebugData = jest.fn<ILogManager['saveDebugData']>();
    mockSaveDebugData.mockReturnValue('/path/to/debug');
    const mockLogger: jest.Mocked<ILogManager> = {
      saveLog: mockSaveLog,
      saveDebugData: mockSaveDebugData
    };
    
    const mockFormat = jest.fn<IOutputFormatter['format']>();
    // By default, formatter just passes through the output
    mockFormat.mockImplementation(async (output) => output);
    const mockFormatter: IOutputFormatter = {
      format: mockFormat
    };
    
    const architectureDetector = new SystemArchitectureDetector(mockArchExecutor);
    const destinationMapper = new BuildDestinationMapperAdapter(architectureDetector);
    const commandBuilder = new XcodeBuildCommandAdapter();
    const outputParser = new XcbeautifyOutputParserAdapter();
    
    const sut = new BuildProjectUseCase(
      destinationMapper,
      commandBuilder,
      mockExecutor,
      mockAppLocator,
      mockLogger,
      outputParser,
      mockFormatter
    );
    
    return {
      sut,
      mockExecutor,
      mockAppLocator,
      mockLogger,
      mockFormat
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
      expect(result.outcome).toBe(BuildOutcome.Succeeded);
      expect(result.diagnostics.appPath).toBe('/path/to/DerivedData/MyApp.app');
      expect(result.diagnostics.logPath).toBe('/path/to/log');
      expect(BuildResult.hasErrors(result)).toBe(false);
      expect(result.diagnostics.output).toContain('Build succeeded');
      
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
    
    it('should extract warnings from successful build output', async () => {
      // Arrange
      const { sut, mockExecutor, mockAppLocator } = createSUT();
      const request = createBuildRequest();
      
      // Output with warnings in xcbeautify format
      mockExecutor.execute.mockResolvedValue({
        exitCode: 0,
        stdout: `⚠️  /Users/dev/MyApp/ViewController.swift:42:10: warning: 'oldMethod()' is deprecated
⚠️  /Users/dev/MyApp/AppDelegate.swift:15:5: warning: initialization of immutable value 'unused' was never used
** BUILD SUCCEEDED **`,
        stderr: ''
      });
      mockAppLocator.findApp.mockResolvedValue('/path/to/DerivedData/MyApp.app');
      
      // Act
      const result = await sut.execute(request);
      
      // Assert
      expect(result.outcome).toBe(BuildOutcome.Succeeded);
      expect(BuildResult.getWarnings(result)).toHaveLength(2);
      const warnings = BuildResult.getWarnings(result);
      expect(warnings[0].message).toContain('deprecated');
      expect(warnings[1].message).toContain('unused');
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
      expect(result.outcome).toBe(BuildOutcome.Succeeded);
      
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
      expect(result.outcome).toBe(BuildOutcome.Succeeded);
      expect(result.diagnostics.appPath).toBeUndefined();
      expect(BuildResult.hasErrors(result)).toBe(false);
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
      expect(result.outcome).toBe(BuildOutcome.Succeeded);
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
      expect(result.outcome).toBe(BuildOutcome.Failed);
      expect(result.diagnostics.exitCode).toBe(1);
      
      const errors = BuildResult.getErrors(result);
      const warnings = BuildResult.getWarnings(result);
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
      expect(result.outcome).toBe(BuildOutcome.Succeeded);
      expect(result.diagnostics.appPath).toBe('/path/to/MyApp.app');
      expect(BuildResult.getWarnings(result)).toHaveLength(0);
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
      expect(result.diagnostics.logPath).toBe('/path/to/log');
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
      expect(result.outcome).toBe(BuildOutcome.Failed);
      expect(mockLogger.saveDebugData).toHaveBeenCalledWith(
        'build-failure',
        { exitCode: 1 },
        'project'
      );
      
      const errors = BuildResult.getErrors(result);
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
      expect(result.outcome).toBe(BuildOutcome.Succeeded);
      
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
      expect(result.outcome).toBe(BuildOutcome.Succeeded);
      
      const executedCommand = mockExecutor.execute.mock.calls[0][0];
      expect(executedCommand).toContain('generic/platform=iOS');
      expect(executedCommand).not.toContain('ONLY_ACTIVE_ARCH');
    });
  });
});