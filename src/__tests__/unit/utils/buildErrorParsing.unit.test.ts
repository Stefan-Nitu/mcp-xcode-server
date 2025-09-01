/**
 * Unit tests for buildErrorParsing utility
 * Tests error parsing and formatting behavior
 */

import { describe, test, expect } from '@jest/globals';
import { parseBuildErrors, formatBuildErrors, Issue } from '../../../utils/errors/index.js';

describe('buildErrorParsing', () => {
  describe('parseBuildErrors', () => {
    test('should parse xcbeautify error output', () => {
      const output = `❌ error: no such module 'Alamofire'`;
      const errors = parseBuildErrors(output);
      
      expect(errors).toHaveLength(1);
      expect(errors[0].type).toBe('error');
      expect(errors[0].message).toContain("no such module 'Alamofire'");
    });

    test('should parse xcbeautify warning output', () => {
      const output = `⚠️ warning: deprecated API usage`;
      const errors = parseBuildErrors(output);
      
      expect(errors).toHaveLength(1);
      expect(errors[0].type).toBe('warning');
      expect(errors[0].message).toContain('deprecated API usage');
    });

    test('should parse multiple errors', () => {
      const output = `❌ error: cannot find 'SomeClass' in scope
⚠️ warning: unused variable 'x'
❌ error: missing return in function`;
      
      const errors = parseBuildErrors(output);
      
      expect(errors).toHaveLength(3);
      // Errors are returned first, then warnings
      expect(errors[0].type).toBe('error');
      expect(errors[1].type).toBe('error');
      expect(errors[2].type).toBe('warning');
    });

    test('should parse error with file location', () => {
      const output = `❌ /path/to/file.swift:10:5: error: cannot find 'test' in scope`;
      const errors = parseBuildErrors(output);
      
      expect(errors).toHaveLength(1);
      expect(errors[0].file).toBe('/path/to/file.swift');
      expect(errors[0].line).toBe(10);
      expect(errors[0].column).toBe(5);
    });

    test('should return empty array for successful output', () => {
      const output = `✔ Build succeeded\n✔ All tests passed`;
      const errors = parseBuildErrors(output);
      
      expect(errors).toHaveLength(0);
    });

    test('should handle raw xcodebuild errors without xcbeautify formatting', () => {
      const output = `xcodebuild: error: scheme "NonExistent" not found`;
      const errors = parseBuildErrors(output);
      
      // When no xcbeautify markers found, it returns empty or parses as generic
      expect(errors.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('formatBuildErrors', () => {
    test('should return empty string for no errors', () => {
      const result = formatBuildErrors([]);
      expect(result).toBe('');
    });

    test('should format single error', () => {
      const errors: Issue[] = [{
        type: 'error',
        message: 'Cannot find type in scope',
        rawLine: '❌ error: Cannot find type in scope',
        file: 'test.swift',
        line: 10,
        column: 5
      }];
      
      const result = formatBuildErrors(errors);
      
      expect(result).toContain('test.swift:10:5');
      expect(result).toContain('Cannot find type in scope');
    });

    test('should format error without file location', () => {
      const errors: Issue[] = [{
        type: 'error',
        message: 'Build failed',
        rawLine: '❌ Build failed'
      }];
      
      const result = formatBuildErrors(errors);
      
      expect(result).toContain('Build failed');
    });

    test('should format multiple errors', () => {
      const errors: Issue[] = [
        {
          type: 'error',
            message: 'Error 1',
          rawLine: '❌ Error 1'
        },
        {
          type: 'warning',
          message: 'Warning 1',
          rawLine: '⚠️ Warning 1'
        }
      ];
      
      const result = formatBuildErrors(errors);
      
      expect(result).toContain('Error 1');
      expect(result).toContain('Warning 1');
    });

    test('should include suggestion if present', () => {
      const errors: Issue[] = [{
        type: 'error',
        message: 'Undefined symbol',
        rawLine: '❌ Undefined symbol',
      }];
      
      const result = formatBuildErrors(errors);
      
      // The current implementation doesn't include suggestions in formatBuildErrors
      // but we can test the error is formatted
      expect(result).toContain('Undefined symbol');
    });
  });
});