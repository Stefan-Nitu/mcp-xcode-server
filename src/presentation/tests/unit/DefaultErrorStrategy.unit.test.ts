import { DefaultErrorStrategy } from '../../formatters/strategies/DefaultErrorStrategy.js';

describe('DefaultErrorStrategy', () => {
  function createSUT(): DefaultErrorStrategy {
    return new DefaultErrorStrategy();
  }

  describe('canFormat', () => {
    it('should always return true as the fallback strategy', () => {
      const sut = createSUT();
      
      expect(sut.canFormat(new Error('Any error'))).toBe(true);
      expect(sut.canFormat({ message: 'Plain object' })).toBe(true);
      expect(sut.canFormat('String error')).toBe(true);
      expect(sut.canFormat(123)).toBe(true);
      expect(sut.canFormat(null)).toBe(true);
      expect(sut.canFormat(undefined)).toBe(true);
      expect(sut.canFormat({})).toBe(true);
      expect(sut.canFormat([])).toBe(true);
    });
  });

  describe('format', () => {
    describe('when formatting errors with messages', () => {
      it('should return plain message without modification', () => {
        const sut = createSUT();
        const error = new Error('Simple error message');
        
        const result = sut.format(error);
        
        expect(result).toBe('Simple error message');
      });

      it('should preserve message with special characters', () => {
        const sut = createSUT();
        const error = { message: 'Error: with @#$% special chars!' };
        
        const result = sut.format(error);
        
        expect(result).toBe('with @#$% special chars!');
      });

      it('should handle multiline messages', () => {
        const sut = createSUT();
        const error = new Error('First line\nSecond line\nThird line');
        
        const result = sut.format(error);
        
        expect(result).toBe('First line\nSecond line\nThird line');
      });
    });

    describe('when cleaning common prefixes', () => {
      it('should remove "Error:" prefix (case insensitive)', () => {
        const sut = createSUT();
        
        expect(sut.format(new Error('Error: Something went wrong'))).toBe('Something went wrong');
        expect(sut.format(new Error('error: lowercase prefix'))).toBe('lowercase prefix');
        expect(sut.format(new Error('ERROR: uppercase prefix'))).toBe('uppercase prefix');
        expect(sut.format(new Error('ErRoR: mixed case'))).toBe('mixed case');
      });

      it('should remove "Invalid arguments:" prefix (case insensitive)', () => {
        const sut = createSUT();
        
        expect(sut.format(new Error('Invalid arguments: Missing required field'))).toBe('Missing required field');
        expect(sut.format(new Error('invalid arguments: lowercase'))).toBe('lowercase');
        expect(sut.format(new Error('INVALID ARGUMENTS: uppercase'))).toBe('uppercase');
      });

      it('should remove "Validation failed:" prefix (case insensitive)', () => {
        const sut = createSUT();
        
        expect(sut.format(new Error('Validation failed: Bad input'))).toBe('Bad input');
        expect(sut.format(new Error('validation failed: lowercase'))).toBe('lowercase');
        expect(sut.format(new Error('VALIDATION FAILED: uppercase'))).toBe('uppercase');
      });

      it('should handle multiple spaces after prefix', () => {
        const sut = createSUT();
        
        expect(sut.format(new Error('Error:     Multiple spaces'))).toBe('Multiple spaces');
        expect(sut.format(new Error('Invalid arguments:   Extra spaces'))).toBe('Extra spaces');
      });

      it('should only remove prefix at start of message', () => {
        const sut = createSUT();
        const error = new Error('Something Error: in the middle');
        
        const result = sut.format(error);
        
        expect(result).toBe('Something Error: in the middle');
      });

      it('should handle messages that are only the prefix', () => {
        const sut = createSUT();
        
        expect(sut.format(new Error('Error:'))).toBe('');
        expect(sut.format(new Error('Error: '))).toBe('');
        expect(sut.format(new Error('Invalid arguments:'))).toBe('');
        expect(sut.format(new Error('Validation failed:'))).toBe('');
      });

      it('should clean all matching prefixes', () => {
        const sut = createSUT();
        const error = new Error('Error: Invalid arguments: Something');
        
        const result = sut.format(error);
        
        // Both "Error:" and "Invalid arguments:" are cleaned
        expect(result).toBe('Something');
      });
    });

    describe('when handling errors without messages', () => {
      it('should return default message for error without message property', () => {
        const sut = createSUT();
        const error = {};
        
        const result = sut.format(error);
        
        expect(result).toBe('An error occurred');
      });

      it('should return default message for null error', () => {
        const sut = createSUT();
        
        const result = sut.format(null);
        
        expect(result).toBe('An error occurred');
      });

      it('should return default message for undefined error', () => {
        const sut = createSUT();
        
        const result = sut.format(undefined);
        
        expect(result).toBe('An error occurred');
      });

      it('should return default message for non-object errors', () => {
        const sut = createSUT();
        
        expect(sut.format('string error')).toBe('An error occurred');
        expect(sut.format(123)).toBe('An error occurred');
        expect(sut.format(true)).toBe('An error occurred');
        expect(sut.format([])).toBe('An error occurred');
      });

      it('should handle error with null message', () => {
        const sut = createSUT();
        const error = { message: null };
        
        const result = sut.format(error);
        
        expect(result).toBe('An error occurred');
      });

      it('should handle error with undefined message', () => {
        const sut = createSUT();
        const error = { message: undefined };
        
        const result = sut.format(error);
        
        expect(result).toBe('An error occurred');
      });

      it('should handle error with empty string message', () => {
        const sut = createSUT();
        const error = { message: '' };
        
        const result = sut.format(error);
        
        expect(result).toBe('An error occurred');
      });

      it('should handle error with whitespace-only message', () => {
        const sut = createSUT();
        const error = { message: '   ' };
        
        const result = sut.format(error);
        
        expect(result).toBe('   '); // Preserves whitespace as it's truthy
      });
    });

    describe('when handling edge cases', () => {
      it('should handle very long messages', () => {
        const sut = createSUT();
        const longMessage = 'A'.repeat(10000);
        const error = new Error(longMessage);
        
        const result = sut.format(error);
        
        expect(result).toBe(longMessage);
      });

      it('should preserve unicode and emoji', () => {
        const sut = createSUT();
        const error = new Error('Error: Failed to process 你好 🚫');
        
        const result = sut.format(error);
        
        expect(result).toBe('Failed to process 你好 🚫');
      });

      it('should handle messages with only special characters', () => {
        const sut = createSUT();
        const error = new Error('@#$%^&*()');
        
        const result = sut.format(error);
        
        expect(result).toBe('@#$%^&*()');
      });

      it('should handle error-like objects with toString', () => {
        const sut = createSUT();
        const error = {
          message: 'Custom error',
          toString: () => 'ToString output'
        };
        
        const result = sut.format(error);
        
        expect(result).toBe('Custom error'); // Prefers message over toString
      });

      it('should not modify messages without known prefixes', () => {
        const sut = createSUT();
        const messages = [
          'Unknown prefix: Something',
          'Warning: Something else',
          'Notice: Important info',
          'Failed: Operation incomplete'
        ];
        
        messages.forEach(msg => {
          const error = new Error(msg);
          expect(sut.format(error)).toBe(msg);
        });
      });
    });
  });
});