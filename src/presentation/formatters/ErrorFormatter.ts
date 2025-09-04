import { ZodError } from 'zod';
import { BuildIssue } from '../../domain/value-objects/BuildIssue.js';

/**
 * Strategy interface for formatting different types of errors
 */
interface ErrorFormattingStrategy {
  canFormat(error: any): boolean;
  format(error: any): string;
}

/**
 * Formats Zod validation errors
 */
class ZodErrorStrategy implements ErrorFormattingStrategy {
  canFormat(error: any): boolean {
    return error instanceof ZodError || error.name === 'ZodError';
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

/**
 * Formats build issues (errors and warnings)
 */
class BuildIssuesStrategy implements ErrorFormattingStrategy {
  canFormat(error: any): boolean {
    return error.issues && Array.isArray(error.issues) && 
           error.issues.some((i: any) => i instanceof BuildIssue);
  }
  
  format(error: any): string {
    const issues = error.issues as BuildIssue[];
    const errors = issues.filter(i => i.type === 'error');
    const warnings = issues.filter(i => i.type === 'warning');
    
    let message = '';
    if (errors.length > 0) {
      message += `❌ Errors (${errors.length}):\n`;
      message += errors.slice(0, 5).map(e => `  • ${e.toString()}`).join('\n');
      if (errors.length > 5) {
        message += `\n  ... and ${errors.length - 5} more errors`;
      }
    }
    
    if (warnings.length > 0) {
      if (message) message += '\n\n';
      message += `⚠️ Warnings (${warnings.length}):\n`;
      message += warnings.slice(0, 3).map(w => `  • ${w.toString()}`).join('\n');
      if (warnings.length > 3) {
        message += `\n  ... and ${warnings.length - 3} more warnings`;
      }
    }
    
    return message || error.message || 'Build failed';
  }
}

/**
 * Formats JSON embedded in error messages (from controller validation)
 */
class EmbeddedJsonStrategy implements ErrorFormattingStrategy {
  canFormat(error: any): boolean {
    return error.message && 
           typeof error.message === 'string' && 
           error.message.includes('[{');
  }
  
  format(error: any): string {
    const jsonData = this.extractJson(error.message);
    if (!jsonData) {
      return error.message;
    }
    
    // Format as validation issues
    const messages = jsonData
      .map((issue: any) => issue.message)
      .filter(Boolean);
    
    if (messages.length === 0) {
      return error.message;
    }
    
    // Format consistently with ZodErrorStrategy
    if (messages.length === 1) {
      return messages[0];
    }
    
    return 'Validation errors:\n' + messages.map((msg: string) => '  • ' + msg).join('\n');
  }
  
  private extractJson(message: string): any {
    try {
      // Look for JSON array in the message
      const jsonMatch = message.match(/\[{.*}\]/s);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      
      // Try parsing after "Invalid arguments:" prefix
      const prefix = 'Invalid arguments: ';
      if (message.startsWith(prefix)) {
        return JSON.parse(message.substring(prefix.length));
      }
    } catch {
      // JSON parsing failed
    }
    return null;
  }
}

/**
 * Default strategy for plain error messages
 */
class DefaultErrorStrategy implements ErrorFormattingStrategy {
  canFormat(_error: any): boolean {
    return true; // Always can format as fallback
  }
  
  format(error: any): string {
    if (error.message) {
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

/**
 * Main error formatter that uses strategies
 */
export class ErrorFormatter {
  private static strategies: ErrorFormattingStrategy[] = [
    new ZodErrorStrategy(),
    new BuildIssuesStrategy(),
    new EmbeddedJsonStrategy(),
    new DefaultErrorStrategy() // Must be last
  ];
  
  /**
   * Format any error into a user-friendly message
   */
  static format(error: Error | any): string {
    for (const strategy of this.strategies) {
      if (strategy.canFormat(error)) {
        return strategy.format(error);
      }
    }
    
    // Shouldn't reach here due to DefaultErrorStrategy
    return 'Unknown error';
  }
}