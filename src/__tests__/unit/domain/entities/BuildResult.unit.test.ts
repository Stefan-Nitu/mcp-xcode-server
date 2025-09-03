import { describe, it, expect } from '@jest/globals';
import { BuildResult } from '../../../../domain/entities/BuildResult.js';
import { BuildIssue } from '../../../../domain/value-objects/BuildIssue.js';

describe('BuildResult', () => {
  describe('when build succeeds', () => {
    it('should indicate success', () => {
      // Given a successful build
      const result = BuildResult.success('Build completed', '/path/to/app.app');
      
      // Then it should be marked as successful
      expect(result.success).toBe(true);
    });
    
    it('should provide the built artifact path', () => {
      // Given a successful build with an app
      const result = BuildResult.success('Build completed', '/path/to/app.app');
      
      // Then we should be able to get the app path
      expect(result.appPath).toBe('/path/to/app.app');
    });
    
    it('should have no compilation issues', () => {
      // Given a successful build
      const result = BuildResult.success('Build completed');
      
      // Then there should be no errors
      expect(result.hasErrors()).toBe(false);
      expect(result.getErrors()).toEqual([]);
      expect(result.getWarnings()).toEqual([]);
    });
  });
  
  describe('when build fails', () => {
    it('should indicate failure', () => {
      // Given a failed build
      const result = BuildResult.failure('Compilation failed', [], 1);
      
      // Then it should be marked as failed
      expect(result.success).toBe(false);
    });
    
    it('should not have an artifact path', () => {
      // Given a failed build
      const result = BuildResult.failure('Compilation failed', [], 1);
      
      // Then there should be no app path
      expect(result.appPath).toBeUndefined();
    });
    
    it('should report compilation errors', () => {
      // Given a build that failed with errors
      const error = BuildIssue.error('Cannot find type "Foo"');
      const result = BuildResult.failure('Compilation failed', [error], 1);
      
      // Then we should be able to check for errors
      expect(result.hasErrors()).toBe(true);
      
      // And retrieve the errors
      const errors = result.getErrors();
      expect(errors).toHaveLength(1);
      expect(errors[0]).toBe(error);
    });
  });
  
  describe('when build has warnings', () => {
    it('should report warnings separately from errors', () => {
      // Given a build with both errors and warnings
      const error = BuildIssue.error('Syntax error');
      const warning = BuildIssue.warning('Deprecated API usage');
      const result = BuildResult.failure('Build failed', [error, warning], 1);
      
      // Then we should be able to get them separately
      expect(result.getErrors()).toEqual([error]);
      expect(result.getWarnings()).toEqual([warning]);
    });
    
    it('should allow successful builds with warnings', () => {
      // Given a build that succeeded but had warnings
      const warning = BuildIssue.warning('Unused variable');
      const result = new BuildResult(
        true, 
        'Build succeeded with warnings',
        '/path/to/app.app',
        undefined,
        [warning],
        0
      );
      
      // Then it should still be successful
      expect(result.success).toBe(true);
      
      // But we should know about the warnings
      expect(result.getWarnings()).toEqual([warning]);
      expect(result.hasErrors()).toBe(false);
    });
  });
  
  describe('build output', () => {
    it('should preserve the build output', () => {
      // Given any build result
      const output = 'Compiling main.swift...\nLinking...';
      const result = BuildResult.success(output);
      
      // Then we should be able to access the output
      expect(result.output).toBe(output);
    });
    
    it('should provide log file path when available', () => {
      // Given a build with logs saved to disk
      const logPath = '/var/logs/build-12345.log';
      const result = BuildResult.success('Build completed', undefined, logPath);
      
      // Then we should be able to get the log path
      expect(result.logPath).toBe(logPath);
    });
  });
  
  describe('exit codes', () => {
    it('should track the process exit code', () => {
      // Given a failed build with specific exit code
      const result = BuildResult.failure('Segmentation fault', [], 139);
      
      // Then we should know the exit code
      expect(result.exitCode).toBe(139);
    });
    
    it('should use exit code 0 for success', () => {
      // Given a successful build
      const result = BuildResult.success('Build completed');
      
      // Then exit code should be 0
      expect(result.exitCode).toBe(0);
    });
  });
});