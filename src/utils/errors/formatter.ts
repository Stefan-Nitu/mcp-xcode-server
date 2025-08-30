/**
 * Format structured errors for display
 */

import { CompileError, BuildError } from './types.js';
import { ErrorFormatterOptions } from './xcode/types.js';

/**
 * Format compile errors for display
 */
export function formatCompileErrors(errors: CompileError[], maxErrors: number = 10): { summary: string; errorList: string } {
  const errorCount = errors.filter(e => e.type === 'error').length;
  const warningCount = errors.filter(e => e.type === 'warning').length;
  
  // Create summary line
  const summary = `❌ Build failed with ${errorCount} error${errorCount !== 1 ? 's' : ''}${warningCount > 0 ? ` and ${warningCount} warning${warningCount !== 1 ? 's' : ''}` : ''}`;
  
  // Format individual errors
  const displayErrors = errors.slice(0, maxErrors);
  const errorList = displayErrors
    .map(error => {
      const location = error.file && error.line 
        ? `📍 ${error.file}:${error.line}:${error.column || 0}`
        : '';
      const icon = error.type === 'error' ? '❌' : error.type === 'warning' ? '⚠️' : 'ℹ️';
      return `${icon} ${error.type}: ${error.message}${location ? `\n   ${location}` : ''}`;
    })
    .join('\n\n');
  
  const remaining = errors.length - displayErrors.length;
  const moreText = remaining > 0 ? `\n\n... and ${remaining} more ${remaining === 1 ? 'issue' : 'issues'}` : '';
  
  return {
    summary,
    errorList: errorList + moreText
  };
}

/**
 * Format build errors for display
 */
export function formatBuildErrors(errors: BuildError[]): string {
  if (errors.length === 0) {
    return '';
  }
  
  let output = '❌ Build failed\n';
  
  for (const error of errors) {
    output += `\n📍 ${error.title}`;
    
    if (error.details) {
      output += `\n   ${error.details}`;
    }
    
    if (error.suggestion) {
      output += `\n   💡 ${error.suggestion}`;
    }
  }
  
  return output;
}

/**
 * Format error metadata (platform, config, scheme, log path)
 */
export function formatErrorMetadata(options: ErrorFormatterOptions): string {
  const { platform, configuration, scheme, logPath } = options;
  
  let metadata = `\n\nPlatform: ${platform}\nConfiguration: ${configuration}`;
  
  if (scheme) {
    metadata += `\nScheme: ${scheme}`;
  }
  
  if (logPath) {
    metadata += `\n\n📁 Full logs saved to: ${logPath}`;
  }
  
  return metadata;
}

/**
 * Create the complete formatted error response
 */
export function createErrorResponse(mainError: string, options: ErrorFormatterOptions): { content: Array<{ type: string; text: string }> } {
  const metadata = formatErrorMetadata(options);
  
  return {
    content: [{
      type: 'text',
      text: mainError + metadata
    }]
  };
}