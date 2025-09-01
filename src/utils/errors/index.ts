/**
 * Export types and functions from xcbeautify parser
 */

export {
  Issue,
  Test,
  XcbeautifyOutput,
  parseXcbeautifyOutput,
  formatParsedOutput
} from './xcbeautify-parser.js';

import { Issue, parseXcbeautifyOutput as parseOutput } from './xcbeautify-parser.js';

// Error handlers for tools
// These return MCP format for tools
export function handleSwiftPackageError(error: unknown, context?: any): { content: { type: string; text: string }[] } {
  // Convert error to string and parse with xcbeautify parser
  const message = error instanceof Error ? error.message : String(error);
  const { errors } = parseOutput(message);
  
  // Format for MCP response
  const errorMessages = errors.length > 0 
    ? errors.map(e => `❌ ${e.type === 'warning' ? 'Warning' : 'Error'}: ${e.message}`).join('\n')
    : `❌ ${message}`;
  
  const contextInfo = context 
    ? Object.entries(context)
        .filter(([_, v]) => v !== undefined)
        .map(([k, v]) => `${k}: ${v}`)
        .join(', ')
    : '';
  
  // Check if error has a logPath property
  const logPath = (error as any)?.logPath;
  const logInfo = logPath ? `\n\n📁 Full logs saved to: ${logPath}` : '';
  
  return {
    content: [{
      type: 'text',
      text: contextInfo ? `${errorMessages}\n\nContext: ${contextInfo}${logInfo}` : `${errorMessages}${logInfo}`
    }]
  };
}

export function handleXcodeError(error: unknown, context?: any): { content: { type: string; text: string }[] } {
  // Convert error to string and parse with xcbeautify parser
  const message = error instanceof Error ? error.message : String(error);
  const { errors } = parseOutput(message);
  
  // Format for MCP response
  const errorMessages = errors.length > 0 
    ? errors.map(e => `❌ ${e.type === 'warning' ? 'Warning' : 'Error'}: ${e.message}`).join('\n')
    : `❌ ${message}`;
  
  const contextInfo = context 
    ? Object.entries(context)
        .filter(([_, v]) => v !== undefined)
        .map(([k, v]) => `${k}: ${v}`)
        .join(', ')
    : '';
  
  // Check if error has a logPath property
  const logPath = (error as any)?.logPath;
  const logInfo = logPath ? `\n\n📁 Full logs saved to: ${logPath}` : '';
  
  return {
    content: [{
      type: 'text',
      text: contextInfo ? `${errorMessages}\n\nContext: ${contextInfo}${logInfo}` : `${errorMessages}${logInfo}`
    }]
  };
}

// Backward compatibility for tests
export function parseBuildErrors(output: string): Issue[] {
  const { errors, warnings } = parseOutput(output);
  return [...errors, ...warnings];
}

export function formatBuildErrors(errors: Issue[]): string {
  return errors.map(e => `${e.file ? `${e.file}:${e.line}:${e.column} - ` : ''}${e.message}`).join('\n');
}