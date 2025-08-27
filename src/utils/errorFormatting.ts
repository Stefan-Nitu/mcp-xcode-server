import { CompileError } from './projects/XcodeBuild.js';

export interface FormattedCompileError {
  summary: string;
  errorList: string;
  errorCount: number;
  warningCount: number;
}

/**
 * Format compile errors for display in MCP output
 * @param errors Array of compile errors
 * @param maxErrors Maximum number of errors to show (default 10)
 * @returns Formatted error summary and list
 */
export function formatCompileErrors(errors: CompileError[], maxErrors: number = 10): FormattedCompileError {
  const errorCount = errors.filter(e => e.type === 'error').length;
  const warningCount = errors.filter(e => e.type === 'warning').length;
  
  // Format compile errors
  let errorList = '';
  const errorsToShow = errors.slice(0, maxErrors);
  
  for (const err of errorsToShow) {
    const icon = err.type === 'error' ? '❌' : '⚠️';
    const shortPath = err.file.split('/').slice(-2).join('/');
    errorList += `\n${icon} ${shortPath}:${err.line}:${err.column}\n   ${err.message}`;
  }
  
  if (errors.length > maxErrors) {
    errorList += `\n\n... and ${errors.length - maxErrors} more ${errors.length - maxErrors === 1 ? 'issue' : 'issues'}`;
  }
  
  const summary = `❌ Build failed with ${errorCount} error${errorCount !== 1 ? 's' : ''}${warningCount > 0 ? ` and ${warningCount} warning${warningCount !== 1 ? 's' : ''}` : ''}`;
  
  return {
    summary,
    errorList,
    errorCount,
    warningCount
  };
}