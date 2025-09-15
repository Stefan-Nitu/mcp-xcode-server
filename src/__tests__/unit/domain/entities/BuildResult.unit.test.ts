import { describe, it, expect } from '@jest/globals';
import { 
  BuildResult, 
  BuildOutcome,
  BuildCommandFailedError 
} from '../../../../domain/entities/BuildResult.js';
import { BuildIssue } from '../../../../domain/value-objects/BuildIssue.js';

describe('BuildResult', () => {
  describe('succeeded', () => {
    it('should create result with succeeded outcome', () => {
      // Arrange & Act
      const result = BuildResult.succeeded('/path/to/app.app');

      // Assert - test the behavior
      expect(result.outcome).toBe(BuildOutcome.Succeeded);
      expect(result.diagnostics.appPath).toBe('/path/to/app.app');
    });
    
    it('should include app and log path', () => {
      // Arrange & Act
      const result = BuildResult.succeeded(
        '/path/to/app.app',
        '/logs/build.log'
      );

      // Assert
      expect(result.diagnostics.appPath).toBe('/path/to/app.app');
      expect(result.diagnostics.logPath).toBe('/logs/build.log');
    });
    
    it('should handle warnings in successful build', () => {
      // Arrange
      const warning = BuildIssue.warning('Deprecated API');
      
      // Act
      const result = BuildResult.succeeded(
        '/path/to/app.app',
        undefined,
        [warning]
      );
      
      // Assert
      expect(result.outcome).toBe(BuildOutcome.Succeeded);
      expect(BuildResult.getWarnings(result)).toEqual([warning]);
      expect(BuildResult.hasErrors(result)).toBe(false);
    });
  });
  
  describe('failed', () => {
    it('should create result with failed outcome', () => {
      // Arrange
      const error = BuildIssue.error('Compilation error');
      
      // Act
      const result = BuildResult.failed([error], 1);
      
      // Assert
      expect(result.outcome).toBe(BuildOutcome.Failed);
      expect(result.diagnostics.exitCode).toBe(1);
    });
    
    it('should include build error details', () => {
      // Arrange
      const buildError = new BuildCommandFailedError('xcodebuild failed', 65);
      const issue = BuildIssue.error('Cannot find type');
      
      // Act
      const result = BuildResult.failed(
        [issue],
        65,
        '/logs/build.log',
        buildError
      );
      
      // Assert
      expect(result.diagnostics.error).toBe(buildError);
      expect(result.diagnostics.logPath).toBe('/logs/build.log');
      expect(BuildResult.getErrors(result)).toEqual([issue]);
    });
  });
  
  describe('helper methods', () => {
    it('should detect errors in issues', () => {
      // Arrange
      const error = BuildIssue.error('Syntax error');
      const warning = BuildIssue.warning('Unused variable');
      const result = BuildResult.failed([error, warning], 1);
      
      // Act & Assert
      expect(BuildResult.hasErrors(result)).toBe(true);
      expect(BuildResult.getErrors(result)).toEqual([error]);
    });
    
    it('should filter warnings from issues', () => {
      // Arrange
      const error = BuildIssue.error('Error');
      const warning1 = BuildIssue.warning('Warning 1');
      const warning2 = BuildIssue.warning('Warning 2');
      const result = BuildResult.failed([error, warning1, warning2], 1);
      
      // Act & Assert
      expect(BuildResult.getWarnings(result)).toEqual([warning1, warning2]);
    });
    
    it('should handle empty issues list', () => {
      // Arrange
      const result = BuildResult.succeeded('Success');
      
      // Act & Assert
      expect(BuildResult.hasErrors(result)).toBe(false);
      expect(BuildResult.getErrors(result)).toEqual([]);
      expect(BuildResult.getWarnings(result)).toEqual([]);
    });
  });
  
  describe('diagnostics metadata', () => {
    it('should include build metadata in diagnostics', () => {
      // Arrange & Act
      const result = BuildResult.succeeded(
        '/app.app',
        '/log.txt',
        [],
        {
          scheme: 'MyApp',
          configuration: 'Debug',
          platform: 'iOS'
        }
      );
      
      // Assert
      expect(result.diagnostics.scheme).toBe('MyApp');
      expect(result.diagnostics.configuration).toBe('Debug');
      expect(result.diagnostics.platform).toBe('iOS');
    });
  });
});