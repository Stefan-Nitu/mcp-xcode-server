/**
 * Swift Package Manager error parsing
 */

import { CompileError, BuildError } from '../types.js';

/**
 * Parse Swift compiler errors from build output
 * Format: /path/to/file.swift:10:15: error: message here
 */
export function parseSwiftCompileErrors(output: string): CompileError[] {
  const errors: CompileError[] = [];
  const lines = output.split('\n');
  
  // Swift compiler error format:
  // /path/to/file.swift:10:15: error: message here
  // /path/to/file.swift:20:8: warning: message here
  const errorRegex = /^(.+):(\d+):(\d+):\s+(error|warning|note):\s+(.+)$/;
  
  // Track unique errors to avoid duplicates
  const seenErrors = new Set<string>();
  
  for (const line of lines) {
    const match = line.match(errorRegex);
    if (match) {
      const [, file, lineNum, column, type, message] = match;
      
      // Create unique key to avoid duplicates
      const errorKey = `${file}:${lineNum}:${column}:${message}`;
      
      if (!seenErrors.has(errorKey)) {
        seenErrors.add(errorKey);
        errors.push({
          file,
          line: parseInt(lineNum, 10),
          column: parseInt(column, 10),
          message,
          type: type as 'error' | 'warning' | 'note'
        });
      }
    }
  }
  
  return errors;
}

/**
 * Parse Swift Package Manager build errors
 * These are typically dependency resolution, manifest parsing errors etc.
 */
export function parseSwiftBuildErrors(output: string): BuildError[] {
  const errors: BuildError[] = [];
  
  // Check for dependency resolution errors
  if (output.includes('error: Dependencies could not be resolved')) {
    errors.push({
      type: 'dependency',
      title: 'Dependency resolution failed',
      details: 'Swift Package Manager could not resolve package dependencies',
      suggestion: 'Run "swift package resolve" to see detailed errors'
    });
  }
  
  // Check for manifest parsing errors
  if (output.includes('error: manifest parse error')) {
    errors.push({
      type: 'configuration',
      title: 'Package.swift parse error',
      details: 'The Package.swift file contains syntax errors',
      suggestion: 'Check Package.swift for syntax errors'
    });
  }
  
  // Check for missing target
  if (output.includes('error: no such target')) {
    const targetMatch = output.match(/error: no such target '([^']+)'/);
    errors.push({
      type: 'configuration',
      title: `Target not found: ${targetMatch?.[1] || 'unknown'}`,
      details: 'The specified target does not exist in Package.swift',
      suggestion: 'Check available targets with "swift package describe"'
    });
  }
  
  // Check for missing product
  if (output.includes('error: no such product')) {
    const productMatch = output.match(/error: no such product '([^']+)'/);
    errors.push({
      type: 'configuration',
      title: `Product not found: ${productMatch?.[1] || 'unknown'}`,
      details: 'The specified product does not exist in Package.swift',
      suggestion: 'Check available products with "swift package describe"'
    });
  }
  
  // Check for invalid configuration
  if (output.includes('error: invalid configuration')) {
    errors.push({
      type: 'configuration',
      title: 'Invalid build configuration',
      details: 'Swift Package Manager only supports Debug and Release configurations',
      suggestion: 'Use either --configuration debug or --configuration release'
    });
  }
  
  return errors;
}