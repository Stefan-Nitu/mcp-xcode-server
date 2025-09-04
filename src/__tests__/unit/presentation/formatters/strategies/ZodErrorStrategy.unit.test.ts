import { ZodError } from 'zod';
import { ZodErrorStrategy } from '../../../../../presentation/formatters/strategies/ZodErrorStrategy.js';

describe('ZodErrorStrategy', () => {
  function createSUT(): ZodErrorStrategy {
    return new ZodErrorStrategy();
  }

  describe('canFormat', () => {
    it('should return true for ZodError instances', () => {
      const sut = createSUT();
      const zodError = new ZodError([]);
      
      const result = sut.canFormat(zodError);
      
      expect(result).toBe(true);
    });

    it('should return true for objects with name "ZodError"', () => {
      const sut = createSUT();
      const errorLikeZod = { name: 'ZodError', issues: [] };
      
      const result = sut.canFormat(errorLikeZod);
      
      expect(result).toBe(true);
    });

    it('should return false for regular Error instances', () => {
      const sut = createSUT();
      const regularError = new Error('Regular error');
      
      const result = sut.canFormat(regularError);
      
      expect(result).toBe(false);
    });

    it('should return false for plain objects without ZodError name', () => {
      const sut = createSUT();
      const plainError = { message: 'Some error' };
      
      const result = sut.canFormat(plainError);
      
      expect(result).toBe(false);
    });

    it('should return false for null or undefined', () => {
      const sut = createSUT();
      
      expect(sut.canFormat(null)).toBe(false);
      expect(sut.canFormat(undefined)).toBe(false);
    });
  });

  describe('format', () => {
    describe('when formatting single issue', () => {
      it('should return only the message without field name', () => {
        const sut = createSUT();
        const zodError = new ZodError([{
          code: 'custom',
          message: 'Project path must be an .xcodeproj or .xcworkspace file',
          path: ['projectPath']
        }]);
        
        const result = sut.format(zodError);
        
        expect(result).toBe('Project path must be an .xcodeproj or .xcworkspace file');
      });

      it('should handle nested paths correctly', () => {
        const sut = createSUT();
        const zodError = new ZodError([{
          code: 'custom',
          message: 'Invalid build configuration',
          path: ['config', 'build', 'settings']
        }]);
        
        const result = sut.format(zodError);
        
        expect(result).toBe('Invalid build configuration');
      });

      it('should handle empty path correctly', () => {
        const sut = createSUT();
        const zodError = new ZodError([{
          code: 'custom',
          message: 'General validation error',
          path: []
        }]);
        
        const result = sut.format(zodError);
        
        expect(result).toBe('General validation error');
      });
    });

    describe('when formatting multiple issues', () => {
      it('should format as bulleted list with header', () => {
        const sut = createSUT();
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
        
        const result = sut.format(zodError);
        
        const expected = 
`Validation errors:
  • Scheme is required
  • Invalid destination`;
        
        expect(result).toBe(expected);
      });

      it('should handle many validation errors', () => {
        const sut = createSUT();
        const issues = Array.from({ length: 5 }, (_, i) => ({
          code: 'custom' as const,
          message: `Error ${i + 1}`,
          path: [`field${i}`]
        }));
        const zodError = new ZodError(issues);
        
        const result = sut.format(zodError);
        
        expect(result).toContain('Validation errors:');
        expect(result).toContain('Error 1');
        expect(result).toContain('Error 5');
        expect(result.split('\n')).toHaveLength(6); // Header + 5 errors
      });
    });

    describe('when handling edge cases', () => {
      it('should handle empty issues array', () => {
        const sut = createSUT();
        const zodError = new ZodError([]);
        
        const result = sut.format(zodError);
        
        expect(result).toBe('Validation errors:\n');
      });

      it('should handle error-like object with issues property', () => {
        const sut = createSUT();
        const errorLike = {
          name: 'ZodError',
          issues: [
            { message: 'First error' },
            { message: 'Second error' }
          ]
        };
        
        const result = sut.format(errorLike);
        
        const expected = 
`Validation errors:
  • First error
  • Second error`;
        
        expect(result).toBe(expected);
      });

      it('should handle missing issues property gracefully', () => {
        const sut = createSUT();
        const errorLike = { name: 'ZodError' };
        
        const result = sut.format(errorLike);
        
        expect(result).toBe('Validation errors:\n');
      });

      it('should handle issues with missing message property', () => {
        const sut = createSUT();
        const errorLike = {
          name: 'ZodError',
          issues: [
            { message: 'Valid message' },
            { code: 'custom' }, // Missing message
            { message: 'Another valid message' }
          ]
        };
        
        const result = sut.format(errorLike);
        
        const expected = 
`Validation errors:
  • Valid message
  • undefined
  • Another valid message`;
        
        expect(result).toBe(expected);
      });
    });
  });
});