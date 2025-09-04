import { ErrorFormatter } from '../../../../presentation/formatters/ErrorFormatter.js';
import { ZodError } from 'zod';
import { BuildIssue } from '../../../../domain/value-objects/BuildIssue.js';

describe('ErrorFormatter', () => {
  describe('strategy delegation', () => {
    it('should delegate ZodError to ZodErrorStrategy', () => {
      const zodError = new ZodError([{
        code: 'custom',
        message: 'Test error',
        path: ['field']
      }]);
      
      const result = ErrorFormatter.format(zodError);
      
      // Should return formatted result (not testing the exact format - that's the strategy's job)
      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });

    it('should delegate error with BuildIssues to BuildIssuesStrategy', () => {
      const error = {
        issues: [
          BuildIssue.error('Test error')
        ]
      };
      
      const result = ErrorFormatter.format(error);
      
      // Should return formatted result
      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });

    it('should delegate plain Error to DefaultErrorStrategy', () => {
      const error = new Error('Plain error message');
      
      const result = ErrorFormatter.format(error);
      
      // Should return formatted result
      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });

    it('should delegate unknown objects to DefaultErrorStrategy', () => {
      const error = { someField: 'value' };
      
      const result = ErrorFormatter.format(error);
      
      // Should return formatted result (DefaultErrorStrategy handles everything)
      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });

    it('should handle null by delegating to DefaultErrorStrategy', () => {
      const result = ErrorFormatter.format(null);
      
      // DefaultErrorStrategy should handle null
      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });

    it('should handle undefined by delegating to DefaultErrorStrategy', () => {
      const result = ErrorFormatter.format(undefined);
      
      // DefaultErrorStrategy should handle undefined
      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });
  });
});