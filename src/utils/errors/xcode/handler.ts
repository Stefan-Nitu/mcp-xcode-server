/**
 * Main error handler for Xcode build/test/run operations
 */

import { parseCompileErrors, parseBuildErrors } from './parser.js';
import { formatCompileErrors, formatBuildErrors, createErrorResponse } from '../formatter.js';
import { XcodeError, ErrorFormatterOptions } from './types.js';
import { FormattedError } from '../types.js';

/**
 * Handle Xcode errors with proper prioritization:
 * 1. Compile errors (most specific - actual code errors)
 * 2. Pre-parsed build errors (from error object)
 * 3. Parsed build errors (from error message)
 * 4. Fallback to raw error message
 */
export function handleXcodeError(error: any, options: ErrorFormatterOptions): FormattedError {
  const xcodeError = error as XcodeError;
  const errorLogPath = options.logPath || xcodeError.logPath;
  const formatterOptions = { ...options, logPath: errorLogPath };
  
  // 1. Check for compile errors first (these are most specific)
  if (xcodeError.compileErrors && xcodeError.compileErrors.length > 0) {
    const hasActualErrors = xcodeError.compileErrors.some(e => e.type === 'error');
    if (hasActualErrors) {
      const { summary, errorList } = formatCompileErrors(xcodeError.compileErrors, options.maxErrors);
      return createErrorResponse(`${summary}\n${errorList}`, formatterOptions);
    }
  }
  
  // 2. Check for pre-parsed build errors
  if (xcodeError.buildErrors && xcodeError.buildErrors.length > 0) {
    const buildErrorText = formatBuildErrors(xcodeError.buildErrors);
    return createErrorResponse(buildErrorText, formatterOptions);
  }
  
  // 3. Try to parse build errors from error message
  const errorMessage = error.message || error.toString() || 'Unknown error';
  
  // First try to parse compile errors from the message
  const compileErrors = parseCompileErrors(errorMessage);
  if (compileErrors.length > 0 && compileErrors.some(e => e.type === 'error')) {
    const { summary, errorList } = formatCompileErrors(compileErrors, options.maxErrors);
    return createErrorResponse(`${summary}\n${errorList}`, formatterOptions);
  }
  
  // Then try to parse build configuration errors
  const parsedBuildErrors = parseBuildErrors(errorMessage);
  if (parsedBuildErrors.length > 0) {
    const errorText = formatBuildErrors(parsedBuildErrors);
    return createErrorResponse(errorText, formatterOptions);
  }
  
  // 4. Check if this is already a well-formatted error from xcode.open()
  if (errorMessage.startsWith('No Xcode project found at:') || 
      errorMessage.startsWith('No project found at:')) {
    return createErrorResponse(`❌ ${errorMessage}`, formatterOptions);
  }
  
  // 5. Fallback - show raw error with some intelligent parsing
  const displayMessage = formatFallbackError(errorMessage, options.scheme);
  return createErrorResponse(displayMessage, formatterOptions);
}

/**
 * Format fallback error when no specific error type is detected
 */
function formatFallbackError(errorMessage: string, scheme?: string): string {
  // Check for common patterns
  const isProjectNotFound = errorMessage.includes('does not exist') && errorMessage.includes('project');
  const isSchemeNotFound = errorMessage.includes('scheme') && errorMessage.includes('not found');
  const isAppPathNotFound = errorMessage.includes('Build succeeded but could not find app path');
  
  let displayMessage = '❌ ';
  
  if (isProjectNotFound) {
    // Try to match quoted path first, then unquoted path
    const quotedMatch = errorMessage.match(/["']([^"']+\.xcodeproj|[^"']+\.xcworkspace)["']/);
    const unquotedMatch = errorMessage.match(/:\s*(\/[^\s]+\.(?:xcodeproj|xcworkspace))/);
    const projectPath = quotedMatch?.[1] || unquotedMatch?.[1] || 'unknown';
    displayMessage += `No project found at: ${projectPath}`;
  } else if (isSchemeNotFound) {
    displayMessage += `Scheme '${scheme || 'unknown'}' not found in project`;
  } else if (isAppPathNotFound) {
    displayMessage += `Run failed\n\n📍 Build succeeded but the app bundle could not be located`;
  } else {
    // Show first line of error
    displayMessage += `Build failed\n\n📍 ${errorMessage.split('\n')[0]}`;
  }
  
  return displayMessage;
}