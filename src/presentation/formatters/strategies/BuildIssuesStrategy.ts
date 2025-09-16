import { BuildIssue } from '../../../features/build/domain/BuildIssue.js';
import { ErrorFormattingStrategy } from './ErrorFormattingStrategy.js';

/**
 * Formats build issues (errors and warnings)
 */
export class BuildIssuesStrategy implements ErrorFormattingStrategy {
  canFormat(error: any): boolean {
    return !!(error && error.issues && Array.isArray(error.issues) && 
             error.issues.some((i: any) => i instanceof BuildIssue));
  }
  
  format(error: any): string {
    // Filter to only actual BuildIssue instances
    const issues = (error.issues as any[]).filter(i => i instanceof BuildIssue);
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