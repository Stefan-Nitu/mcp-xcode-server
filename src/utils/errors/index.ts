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
  const message = error instanceof Error ? error.message : String(error);
  
  // Add ❌ prefix if message doesn't already have xcbeautify formatting
  const formattedMessage = message.includes('❌') || message.includes('⚠️') || message.includes('✅') 
    ? message 
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
      text: contextInfo ? `${formattedMessage}\n\nContext: ${contextInfo}${logInfo}` : `${formattedMessage}${logInfo}`
    }]
  };
}

export function handleXcodeError(error: unknown, context?: any): { content: { type: string; text: string }[] } {
  const message = error instanceof Error ? error.message : String(error);
  
  // Add ❌ prefix if message doesn't already have xcbeautify formatting
  const formattedMessage = message.includes('❌') || message.includes('⚠️') || message.includes('✅') 
    ? message 
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
      text: contextInfo ? `${formattedMessage}\n\nContext: ${contextInfo}${logInfo}` : `${formattedMessage}${logInfo}`
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