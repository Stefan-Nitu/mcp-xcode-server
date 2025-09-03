import { describe, it, expect } from '@jest/globals';
import { BuildResult } from '../../../../domain/entities/BuildResult.js';
import { BuildIssue } from '../../../../domain/value-objects/BuildIssue.js';

describe('BuildResult', () => {
  // Factory methods for test data - DAMP over DRY
  function createSuccessResult(
    output = 'Build succeeded',
    appPath?: string,
    logPath?: string
  ): BuildResult {
    return BuildResult.success(output, appPath, logPath);
  }
  
  function createFailureResult(
    output = 'Build failed',
    issues: BuildIssue[] = [],
    exitCode = 1,
    logPath?: string
  ): BuildResult {
    return BuildResult.failure(output, issues, exitCode, logPath);
  }
  
  function createTestError(message = 'Test error', file?: string): BuildIssue {
    return BuildIssue.error(message, file);
  }
  
  function createTestWarning(message = 'Test warning', file?: string): BuildIssue {
    return BuildIssue.warning(message, file);
  }
  
  describe('when build succeeds', () => {
    it('should indicate success', () => {
      // Arrange & Act - all visible in test
      const result = BuildResult.success('Build completed', '/path/to/app.app');
      
      // Assert - test the behavior
      expect(result.success).toBe(true);
    });
    
    it('should provide the built artifact path', () => {
      const appPath = '/path/to/app.app';
      const result = BuildResult.success('Build completed', appPath);
      
      expect(result.appPath).toBe(appPath);
    });
    
    it('should have no compilation issues', () => {
      const result = createSuccessResult();
      
      expect(result.hasErrors()).toBe(false);
      expect(result.getErrors()).toEqual([]);
      expect(result.getWarnings()).toEqual([]);
    });
  });
  
  describe('when build fails', () => {
    it('should indicate failure', () => {
      const result = BuildResult.failure('Compilation failed', [], 1);
      
      expect(result.success).toBe(false);
    });
    
    it('should not have an artifact path', () => {
      const result = createFailureResult();
      
      expect(result.appPath).toBeUndefined();
    });
    
    it('should report compilation errors', () => {
      const error = createTestError('Cannot find type "Foo"');
      const result = BuildResult.failure('Compilation failed', [error], 1);
      
      expect(result.hasErrors()).toBe(true);
      expect(result.getErrors()).toEqual([error]);
    });
  });
  
  describe('when build has warnings', () => {
    it('should report warnings separately from errors', () => {
      const error = createTestError('Syntax error');
      const warning = createTestWarning('Deprecated API usage');
      const result = BuildResult.failure('Build failed', [error, warning], 1);
      
      expect(result.getErrors()).toEqual([error]);
      expect(result.getWarnings()).toEqual([warning]);
    });
    
    it('should allow successful builds with warnings', () => {
      const warning = createTestWarning('Unused variable');
      const result = new BuildResult(
        true, 
        'Build succeeded with warnings',
        '/path/to/app.app',
        undefined,
        [warning],
        0
      );
      
      expect(result.success).toBe(true);
      expect(result.getWarnings()).toEqual([warning]);
      expect(result.hasErrors()).toBe(false);
    });
  });
  
  describe('when accessing build output', () => {
    it('should preserve the build output', () => {
      const output = 'Compiling main.swift...\nLinking...';
      const result = BuildResult.success(output);
      
      expect(result.output).toBe(output);
    });
    
    it('should provide log file path when available', () => {
      const logPath = '/var/logs/build-12345.log';
      const result = createSuccessResult('Build completed', undefined, logPath);
      
      expect(result.logPath).toBe(logPath);
    });
  });
  
  describe('when tracking exit codes', () => {
    it('should track the process exit code', () => {
      const exitCode = 139;
      const result = BuildResult.failure('Segmentation fault', [], exitCode);
      
      expect(result.exitCode).toBe(exitCode);
    });
    
    it('should use exit code 0 for success', () => {
      const result = createSuccessResult();
      
      expect(result.exitCode).toBe(0);
    });
  });
});