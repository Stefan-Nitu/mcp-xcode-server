/**
 * Swift Package Manager error handler
 */

import { parseSwiftCompileErrors, parseSwiftBuildErrors } from './parser.js';
import { formatCompileErrors, formatBuildErrors } from '../formatter.js';
import { SwiftPackageError, SwiftPackageErrorOptions } from './types.js';
import { FormattedError } from '../types.js';

/**
 * Handle Swift Package Manager errors
 */
export function handleSwiftPackageError(error: any, options: SwiftPackageErrorOptions): FormattedError {
  const swiftError = error as SwiftPackageError;
  const logPath = options.logPath || swiftError.logPath;
  
  // 1. Check for pre-parsed compile errors
  if (swiftError.compileErrors && swiftError.compileErrors.length > 0) {
    const hasActualErrors = swiftError.compileErrors.some(e => e.type === 'error');
    if (hasActualErrors) {
      const { summary, errorList } = formatCompileErrors(swiftError.compileErrors, options.maxErrors);
      return createSwiftPackageErrorResponse(`${summary}\n${errorList}`, options, logPath);
    }
  }
  
  // 2. Check for pre-parsed build errors
  if (swiftError.buildErrors && swiftError.buildErrors.length > 0) {
    const buildErrorText = formatBuildErrors(swiftError.buildErrors);
    return createSwiftPackageErrorResponse(buildErrorText, options, logPath);
  }
  
  // 3. Try to parse errors from error message
  const errorMessage = error.message || error.toString() || 'Unknown error';
  
  // Parse Swift compile errors from the message
  const compileErrors = parseSwiftCompileErrors(errorMessage);
  if (compileErrors.length > 0 && compileErrors.some(e => e.type === 'error')) {
    const { summary, errorList } = formatCompileErrors(compileErrors, options.maxErrors);
    return createSwiftPackageErrorResponse(`${summary}\n${errorList}`, options, logPath);
  }
  
  // Parse Swift build errors from the message
  const buildErrors = parseSwiftBuildErrors(errorMessage);
  if (buildErrors.length > 0) {
    const errorText = formatBuildErrors(buildErrors);
    return createSwiftPackageErrorResponse(errorText, options, logPath);
  }
  
  // 4. Fallback - show raw error
  const displayMessage = formatFallbackError(errorMessage);
  return createSwiftPackageErrorResponse(displayMessage, options, logPath);
}

/**
 * Create Swift Package error response with proper metadata
 */
function createSwiftPackageErrorResponse(errorText: string, options: SwiftPackageErrorOptions, logPath?: string): FormattedError {
  let metadata = `\n\nConfiguration: ${options.configuration}`;
  
  if (options.target) {
    metadata += `\nTarget: ${options.target}`;
  }
  
  if (options.product) {
    metadata += `\nProduct: ${options.product}`;
  }
  
  if (options.executable) {
    metadata += `\nExecutable: ${options.executable}`;
  }
  
  if (logPath) {
    metadata += `\n\n📁 Full logs saved to: ${logPath}`;
  }
  
  return {
    content: [
      {
        type: 'text',
        text: errorText + metadata
      }
    ]
  };
}

/**
 * Format fallback error for Swift packages
 */
function formatFallbackError(errorMessage: string): string {
  // Check for common Swift package patterns
  const isPackageNotFound = errorMessage.includes('No Package.swift found');
  const isDependencyError = errorMessage.includes('dependencies') || errorMessage.includes('resolve');
  
  let displayMessage = '❌ ';
  
  if (isPackageNotFound) {
    const pathMatch = errorMessage.match(/at:\s*(.+)$/);
    displayMessage += `No Package.swift found${pathMatch ? ` at: ${pathMatch[1]}` : ''}`;
  } else if (isDependencyError) {
    displayMessage += 'Package dependency error';
  } else {
    // Show first line of error
    displayMessage += `Build failed\n\n📍 ${errorMessage.split('\n')[0]}`;
  }
  
  return displayMessage;
}