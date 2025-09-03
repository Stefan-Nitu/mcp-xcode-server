import { describe, it, expect } from '@jest/globals';
import { BuildIssue } from '../../../../domain/value-objects/BuildIssue.js';

describe('BuildIssue', () => {
  // Factory method for creating SUT
  function createErrorIssue(
    message = 'Test error',
    file?: string,
    line?: number,
    column?: number
  ): BuildIssue {
    return BuildIssue.error(message, file, line, column);
  }
  
  function createWarningIssue(
    message = 'Test warning',
    file?: string,
    line?: number,
    column?: number
  ): BuildIssue {
    return BuildIssue.warning(message, file, line, column);
  }
  
  describe('when creating an error', () => {
    it('should identify itself as an error', () => {
      // Arrange & Act - visible setup
      const issue = BuildIssue.error('Undefined symbol');
      
      // Assert - behavior focused
      expect(issue.isError()).toBe(true);
      expect(issue.isWarning()).toBe(false);
    });
    
    it('should store the error message', () => {
      const message = 'Cannot find type Foo';
      const issue = BuildIssue.error(message);
      
      expect(issue.message).toBe(message);
    });
    
    it('should store file location when provided', () => {
      const issue = BuildIssue.error(
        'Type error',
        '/src/main.swift',
        42,
        15
      );
      
      expect(issue.file).toBe('/src/main.swift');
      expect(issue.line).toBe(42);
      expect(issue.column).toBe(15);
    });
  });
  
  describe('when creating a warning', () => {
    it('should identify itself as a warning', () => {
      const issue = BuildIssue.warning('Unused variable');
      
      expect(issue.isWarning()).toBe(true);
      expect(issue.isError()).toBe(false);
    });
    
    it('should store the warning message', () => {
      const message = 'Deprecated API usage';
      const issue = BuildIssue.warning(message);
      
      expect(issue.message).toBe(message);
    });
  });
  
  describe('when checking for location information', () => {
    it('should report having location when file is provided', () => {
      const issue = createErrorIssue('Error', '/path/file.swift');
      
      expect(issue.hasLocation()).toBe(true);
    });
    
    it('should report not having location when file is missing', () => {
      const issue = createErrorIssue('General error');
      
      expect(issue.hasLocation()).toBe(false);
    });
  });
  
  describe('when formatting as string', () => {
    it('should include file location in string when available', () => {
      const issue = BuildIssue.error(
        'Syntax error',
        '/src/app.swift',
        10,
        5
      );
      
      const result = issue.toString();
      
      expect(result).toBe('/src/app.swift:10:5: Syntax error');
    });
    
    it('should return just message when location is not available', () => {
      const issue = BuildIssue.warning('Global warning');
      
      const result = issue.toString();
      
      expect(result).toBe('Global warning');
    });
    
    it('should handle partial location info gracefully', () => {
      const issue = BuildIssue.error('Error', '/file.swift', 10);
      
      const result = issue.toString();
      
      // Should include what we have
      expect(result).toContain('/file.swift');
      expect(result).toContain('10');
      expect(result).toContain('Error');
    });
  });
  
  describe('when validating input', () => {
    it('should reject empty messages', () => {
      expect(() => BuildIssue.error('')).toThrow('message cannot be empty');
    });
    
    it('should reject whitespace-only messages', () => {
      expect(() => BuildIssue.error('   ')).toThrow('message cannot be empty');
    });
    
    it('should reject zero line numbers', () => {
      expect(() => BuildIssue.error('Error', 'file.swift', 0))
        .toThrow('Line number must be positive');
    });
    
    it('should reject negative line numbers', () => {
      expect(() => BuildIssue.error('Error', 'file.swift', -5))
        .toThrow('Line number must be positive');
    });
    
    it('should reject zero column numbers', () => {
      expect(() => BuildIssue.error('Error', 'file.swift', 1, 0))
        .toThrow('Column number must be positive');
    });
    
    it('should reject negative column numbers', () => {
      expect(() => BuildIssue.error('Error', 'file.swift', 1, -10))
        .toThrow('Column number must be positive');
    });
  });
  
  describe('when comparing for equality (value object pattern)', () => {
    it('should consider identical issues equal', () => {
      const issue1 = BuildIssue.error('Same error', 'file.swift', 10, 5);
      const issue2 = BuildIssue.error('Same error', 'file.swift', 10, 5);
      
      expect(issue1.equals(issue2)).toBe(true);
    });
    
    it('should consider issues with different messages unequal', () => {
      const issue1 = createErrorIssue('Error 1');
      const issue2 = createErrorIssue('Error 2');
      
      expect(issue1.equals(issue2)).toBe(false);
    });
    
    it('should consider error and warning with same message unequal', () => {
      const error = BuildIssue.error('Same message');
      const warning = BuildIssue.warning('Same message');
      
      expect(error.equals(warning)).toBe(false);
    });
    
    it('should consider issues with different files unequal', () => {
      const issue1 = BuildIssue.error('Error', 'file1.swift', 10);
      const issue2 = BuildIssue.error('Error', 'file2.swift', 10);
      
      expect(issue1.equals(issue2)).toBe(false);
    });
    
    it('should consider issues with different line numbers unequal', () => {
      const issue1 = BuildIssue.error('Error', 'file.swift', 10);
      const issue2 = BuildIssue.error('Error', 'file.swift', 20);
      
      expect(issue1.equals(issue2)).toBe(false);
    });
  });
  
  describe('when generating unique keys for deduplication', () => {
    it('should generate same key for identical issues', () => {
      const issue1 = BuildIssue.error('Error', 'file.swift', 10, 5);
      const issue2 = BuildIssue.error('Error', 'file.swift', 10, 5);
      
      expect(issue1.toKey()).toBe(issue2.toKey());
    });
    
    it('should generate different keys for different issues', () => {
      const error = BuildIssue.error('Error message');
      const warning = BuildIssue.warning('Warning message');
      
      expect(error.toKey()).not.toBe(warning.toKey());
    });
    
    it('should include all identifying information in key', () => {
      const issue = BuildIssue.error('Message', 'file.swift', 10, 5);
      const key = issue.toKey();
      
      // Key should be deterministic and include all info
      expect(key).toBe('error:file.swift:10:5:Message');
    });
    
    it('should handle missing location in key', () => {
      const issue = BuildIssue.warning('Warning');
      const key = issue.toKey();
      
      // Should have sensible defaults for missing values
      expect(key).toBe('warning::0:0:Warning');
    });
  });
});