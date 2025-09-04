import { ErrorFormatter } from '../../../../presentation/formatters/ErrorFormatter.js';
import { ZodError } from 'zod';
import { BuildIssue } from '../../../../domain/value-objects/BuildIssue.js';

describe('ErrorFormatter', () => {
  describe('formatting ZodErrors', () => {
    it('should format single validation error without field name prefix', () => {
      const zodError = new ZodError([{
        code: 'custom',
        message: 'Project path must be an .xcodeproj or .xcworkspace file',
        path: ['projectPath']
      }]);
      
      const result = ErrorFormatter.format(zodError);
      
      // We WANT clean messages without technical field names
      expect(result).toBe('Project path must be an .xcodeproj or .xcworkspace file');
    });
    
    it('should format multiple validation errors as a list', () => {
      const zodError = new ZodError([
        {
          code: 'too_small',
          message: 'Scheme is required',
          path: ['scheme'],
          minimum: 1,
          inclusive: true,
          type: 'string'
        },
        {
          code: 'invalid_enum_value',
          message: 'Invalid destination',
          path: ['destination'],
          received: 'Android',
          options: ['iOS', 'macOS']
        }
      ]);
      
      const result = ErrorFormatter.format(zodError);
      
      // We WANT a clean list without field names
      const expected = 
`Validation errors:
  • Scheme is required
  • Invalid destination`;
      
      expect(result).toBe(expected);
    });
    
    it('should handle nested path gracefully', () => {
      const zodError = new ZodError([{
        code: 'custom',
        message: 'Invalid value',
        path: ['config', 'build', 'settings']
      }]);
      
      const result = ErrorFormatter.format(zodError);
      
      // For nested paths, we still just want the message
      expect(result).toBe('Invalid value');
    });
    
    it('should handle empty path', () => {
      const zodError = new ZodError([{
        code: 'custom',
        message: 'General validation error',
        path: []
      }]);
      
      const result = ErrorFormatter.format(zodError);
      
      expect(result).toBe('General validation error');
    });
  });
  
  describe('formatting BuildIssues', () => {
    it('should format build errors clearly', () => {
      const error = {
        issues: [
          BuildIssue.error('Cannot find module', 'src/main.ts', 10, 5),
          BuildIssue.error('Type mismatch', 'src/utils.ts', 20, 3)
        ]
      };
      
      const result = ErrorFormatter.format(error);
      
      const expected = 
`❌ Errors (2):
  • src/main.ts:10:5: Cannot find module
  • src/utils.ts:20:3: Type mismatch`;
      
      expect(result).toBe(expected);
    });
    
    it('should limit errors to 5 and show count', () => {
      const issues = Array.from({ length: 10 }, (_, i) => 
        BuildIssue.error(`Error ${i + 1}`, `file${i}.ts`)
      );
      const error = { issues };
      
      const result = ErrorFormatter.format(error);
      
      const expected = 
`❌ Errors (10):
  • file0.ts: Error 1
  • file1.ts: Error 2
  • file2.ts: Error 3
  • file3.ts: Error 4
  • file4.ts: Error 5
  ... and 5 more errors`;
      
      expect(result).toBe(expected);
    });
    
    it('should handle warnings separately', () => {
      const error = {
        issues: [
          BuildIssue.error('Error message'),
          BuildIssue.warning('Warning message')
        ]
      };
      
      const result = ErrorFormatter.format(error);
      
      const expected = 
`❌ Errors (1):
  • Error message

⚠️ Warnings (1):
  • Warning message`;
      
      expect(result).toBe(expected);
    });
  });
  
  describe('formatting embedded JSON in messages', () => {
    it('should extract and format JSON array in message', () => {
      const error = new Error('[{"code": "custom", "message": "Scheme is required", "path": ["scheme"]}]');
      
      const result = ErrorFormatter.format(error);
      
      // Should extract just the message
      expect(result).toBe('Scheme is required');
    });
    
    it('should handle "Invalid arguments:" prefix', () => {
      const error = new Error('Invalid arguments: [{"message": "Device ID is required"}]');
      
      const result = ErrorFormatter.format(error);
      
      expect(result).toBe('Device ID is required');
    });
    
    it('should handle multiple messages in JSON', () => {
      const error = new Error('[{"message": "First error"}, {"message": "Second error"}]');
      
      const result = ErrorFormatter.format(error);
      
      const expected = 
`Validation errors:
  • First error
  • Second error`;
      
      expect(result).toBe(expected);
    });
    
    it('should return original message if JSON parsing fails', () => {
      const error = new Error('Not a JSON: [broken json}');
      
      const result = ErrorFormatter.format(error);
      
      expect(result).toBe('Not a JSON: [broken json}');
    });
  });
  
  describe('formatting plain errors', () => {
    it('should pass through simple error messages', () => {
      const error = new Error('Project not found');
      
      const result = ErrorFormatter.format(error);
      
      expect(result).toBe('Project not found');
    });
    
    it('should handle errors without message', () => {
      const error = {};
      
      const result = ErrorFormatter.format(error);
      
      expect(result).toBe('An error occurred');
    });
    
    it('should clean up common prefixes', () => {
      const error1 = new Error('Error: Something went wrong');
      const error2 = new Error('Validation failed: Bad input');
      
      expect(ErrorFormatter.format(error1)).toBe('Something went wrong');
      expect(ErrorFormatter.format(error2)).toBe('Bad input');
    });
  });
});