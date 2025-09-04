import { ZodError } from 'zod';
import { ErrorFormattingStrategy } from './ErrorFormattingStrategy.js';

/**
 * Formats Zod validation errors
 */
export class ZodErrorStrategy implements ErrorFormattingStrategy {
  canFormat(error: any): boolean {
    return !!(error instanceof ZodError || (error && error.name === 'ZodError'));
  }
  
  format(error: ZodError | any): string {
    const issues = error.issues || [];
    
    if (issues.length === 1) {
      // Single issue - just return the message without field name
      return issues[0].message;
    }
    
    // Multiple issues - list them without field names
    return 'Validation errors:\n' + issues.map((issue: any) => {
      return '  • ' + issue.message;
    }).join('\n');
  }
}