import { ErrorFormattingStrategy } from './ErrorFormattingStrategy.js';

/**
 * Default strategy for plain error messages
 */
export class DefaultErrorStrategy implements ErrorFormattingStrategy {
  canFormat(_error: any): boolean {
    return true; // Always can format as fallback
  }
  
  format(error: any): string {
    if (error && error.message) {
      // Clean up common prefixes
      let message = error.message;
      message = message.replace(/^Error:\s*/i, '');
      message = message.replace(/^Invalid arguments:\s*/i, '');
      message = message.replace(/^Validation failed:\s*/i, '');
      return message;
    }
    return 'An error occurred';
  }
}