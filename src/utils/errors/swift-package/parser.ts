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
  
  // Check for missing executable product
  if (output.includes('error: no executable product named')) {
    const execMatch = output.match(/error: no executable product named '([^']+)'/);
    const execName = execMatch ? execMatch[1] : 'unknown';
    errors.push({
      type: 'configuration', 
      title: `Executable not found: ${execName}`,
      details: `No executable product named '${execName}' in Package.swift`,
      suggestion: 'Check available executables with "swift package describe --type executable"'
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
  
  // Check for repository clone failures
  if (output.includes('Failed to clone repository')) {
    const repoMatch = output.match(/Failed to clone repository (https?:\/\/[^\s:]+)/);
    const repoUrl = repoMatch ? repoMatch[1].trim() : 'unknown repository';
    errors.push({
      type: 'dependency',
      title: 'Failed to clone repository',
      details: `Could not fetch dependency from ${repoUrl}`,
      suggestion: 'Verify the repository URL exists and is accessible'
    });
  }
  // Check for repository not found
  else if (output.includes('fatal: repository') && output.includes('not found')) {
    const repoMatch = output.match(/repository '([^']+)' not found/);
    const repoUrl = repoMatch ? repoMatch[1] : 'unknown repository';
    errors.push({
      type: 'dependency',
      title: 'Repository not found',
      details: `Dependency repository does not exist: ${repoUrl}`,
      suggestion: 'Check the repository URL in Package.swift dependencies'
    });
  }
  
  // Check for Swift tools version errors
  if (output.includes('is using Swift tools version') && output.includes('which is no longer supported')) {
    // Extract old version - between "Swift tools version " and " which"
    let oldVersion = 'unknown';
    const versionStart = output.indexOf('is using Swift tools version');
    if (versionStart !== -1) {
      const afterVersion = output.substring(versionStart + 'is using Swift tools version'.length).trim();
      const whichIndex = afterVersion.indexOf(' which');
      if (whichIndex !== -1) {
        oldVersion = afterVersion.substring(0, whichIndex);
      }
    }
    
    // Extract suggested version - between "swift-tools-version: " and the closing quote
    let suggestedVersion = 'latest';
    const suggestedStart = output.indexOf('swift-tools-version: ');
    if (suggestedStart !== -1) {
      const afterSuggested = output.substring(suggestedStart + 'swift-tools-version: '.length);
      const quoteIndex = afterSuggested.indexOf("'");
      if (quoteIndex !== -1) {
        suggestedVersion = afterSuggested.substring(0, quoteIndex);
      }
    }
    
    errors.push({
      type: 'configuration',
      title: 'Outdated Swift tools version',
      details: `Package.swift is using Swift tools version ${oldVersion} which is no longer supported`,
      suggestion: `Add '// swift-tools-version: ${suggestedVersion}' at the top of your Package.swift file`
    });
  }
  
  return errors;
}