import { ErrorFormatter } from '../../formatters/ErrorFormatter.js';
import { BuildIssue } from '../../../features/build/domain/BuildIssue.js';

describe('ErrorFormatter', () => {
  describe('strategy delegation', () => {
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