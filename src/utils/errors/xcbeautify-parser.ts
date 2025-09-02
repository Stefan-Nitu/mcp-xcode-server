/**
 * Unified parser for xcbeautify output
 * 
 * This replaces all the complex parsers and handlers since all our output
 * goes through xcbeautify which already formats it nicely.
 * 
 * xcbeautify output format:
 * - ❌ for errors
 * - ⚠️ for warnings
 * - ✔ for test passes
 * - ✖ for test failures
 */

import { createModuleLogger } from '../../logger.js';

const logger = createModuleLogger('XcbeautifyParser');

export interface Issue {
  type: 'error' | 'warning';
  file?: string;
  line?: number;
  column?: number;
  message: string;
  rawLine: string;
}

export interface Test {
  name: string;
  passed: boolean;
  duration?: number;
  failureReason?: string;
}

export interface XcbeautifyOutput {
  errors: Issue[];
  warnings: Issue[];
  tests: Test[];
  buildSucceeded: boolean;
  testsPassed: boolean;
  totalTests: number;
  failedTests: number;
}


/**
 * Parse a line with error or warning from xcbeautify
 */
function parseErrorLine(line: string, isError: boolean): Issue {
  // Remove the emoji prefix (❌ or ⚠️) and any color codes
  const cleanLine = line
    .replace(/^[❌⚠]\s*/, '')  // Character class with individual emojis
    .replace(/^️\s*/, '')       // Remove any lingering emoji variation selectors
    .replace(/\x1b\[[0-9;]*m/g, ''); // Remove ANSI color codes
  
  // Try to extract file:line:column information
  // Format: /path/to/file.swift:10:15: error message
  const fileMatch = cleanLine.match(/^([^:]+):(\d+):(\d+):\s*(.*)$/);
  
  if (fileMatch) {
    const [, file, lineStr, columnStr, message] = fileMatch;
    
    return {
      type: isError ? 'error' : 'warning',
      file,
      line: parseInt(lineStr, 10),
      column: parseInt(columnStr, 10),
      message,
      rawLine: line
    };
  }
  
  // No file information
  return {
    type: isError ? 'error' : 'warning',
    message: cleanLine,
    rawLine: line
  };
}

/**
 * Parse test results from xcbeautify output
 */
function parseTestLine(line: string): Test | null {
  // Remove color codes
  const cleanLine = line.replace(/\x1b\[[0-9;]*m/g, '');
  
  // Test passed: ✔ testName (0.123 seconds)
  const passMatch = cleanLine.match(/✔\s+(\w+)\s*\(([0-9.]+)\s+seconds?\)/);
  if (passMatch) {
    return {
      name: passMatch[1],
      passed: true,
      duration: parseFloat(passMatch[2])
    };
  }
  
  // Test failed: ✖ testName, failure reason
  const failMatch = cleanLine.match(/✖\s+(\w+)(?:,\s*(.*))?/);
  if (failMatch) {
    return {
      name: failMatch[1],
      passed: false,
      failureReason: failMatch[2] || 'Test failed'
    };
  }
  
  // XCTest format: Test Case '-[ClassName testName]' passed/failed (X.XXX seconds)
  const xcTestMatch = cleanLine.match(/Test Case\s+'-\[(\w+)\s+(\w+)\]'\s+(passed|failed)\s*\(([0-9.]+)\s+seconds\)/);
  if (xcTestMatch) {
    return {
      name: `${xcTestMatch[1]}.${xcTestMatch[2]}`,
      passed: xcTestMatch[3] === 'passed',
      duration: parseFloat(xcTestMatch[4])
    };
  }
  
  return null;
}

/**
 * Main parser for xcbeautify output
 */
export function parseXcbeautifyOutput(output: string): XcbeautifyOutput {
  const lines = output.split('\n');
  
  // Use Maps to deduplicate errors/warnings (for multi-architecture builds)
  const errorMap = new Map<string, Issue>();
  const warningMap = new Map<string, Issue>();
  
  let buildSucceeded = true;
  let testsPassed = true;
  let totalTests = 0;
  let failedTests = 0;
  const tests: Test[] = [];
  
  for (const line of lines) {
    if (!line.trim()) continue;
    
    // Skip xcbeautify header
    if (line.includes('xcbeautify') || line.startsWith('---') || line.startsWith('Version:')) {
      continue;
    }
    
    // Parse errors (❌)
    if (line.includes('❌')) {
      const error = parseErrorLine(line, true);
      const key = `${error.file}:${error.line}:${error.column}:${error.message}`;
      errorMap.set(key, error);
      buildSucceeded = false;
    }
    // Parse warnings (⚠️)
    else if (line.includes('⚠️')) {
      const warning = parseErrorLine(line, false);
      const key = `${warning.file}:${warning.line}:${warning.column}:${warning.message}`;
      warningMap.set(key, warning);
    }
    // Parse test results (✔ or ✖)
    else if (line.includes('✔') || line.includes('✖')) {
      const test = parseTestLine(line);
      if (test) {
        tests.push(test);
        totalTests++;
        if (!test.passed) {
          failedTests++;
          testsPassed = false;
        }
      }
    }
    // Check for build/test failure indicators
    else if (line.includes('** BUILD FAILED **') || line.includes('BUILD FAILED')) {
      buildSucceeded = false;
    }
    else if (line.includes('** TEST FAILED **') || line.includes('TEST FAILED')) {
      testsPassed = false;
    }
    // Parse test summary: "Executed X tests, with Y failures"
    else if (line.includes('Executed') && line.includes('test')) {
      const summaryMatch = line.match(/Executed\s+(\d+)\s+tests?,\s+with\s+(\d+)\s+failures?/);
      if (summaryMatch) {
        totalTests = parseInt(summaryMatch[1], 10);
        failedTests = parseInt(summaryMatch[2], 10);
        testsPassed = failedTests === 0;
      }
    }
  }
  
  // Convert Maps to arrays
  const result: XcbeautifyOutput = {
    errors: Array.from(errorMap.values()),
    warnings: Array.from(warningMap.values()),
    tests,
    buildSucceeded,
    testsPassed,
    totalTests,
    failedTests
  };
  
  // Log summary
  logger.debug({
    errors: result.errors.length,
    warnings: result.warnings.length,
    tests: result.tests.length,
    buildSucceeded: result.buildSucceeded,
    testsPassed: result.testsPassed
  }, 'Parsed xcbeautify output');
  
  return result;
}

/**
 * Format parsed output for display
 */
export function formatParsedOutput(parsed: XcbeautifyOutput): string {
  const lines: string[] = [];
  
  // Build status
  if (!parsed.buildSucceeded) {
    lines.push(`❌ Build failed with ${parsed.errors.length} error${parsed.errors.length !== 1 ? 's' : ''}`);
  } else if (parsed.errors.length === 0 && parsed.warnings.length === 0) {
    lines.push('✅ Build succeeded');
  } else {
    lines.push(`⚠️ Build succeeded with ${parsed.warnings.length} warning${parsed.warnings.length !== 1 ? 's' : ''}`);
  }
  
  // Errors
  if (parsed.errors.length > 0) {
    lines.push('\nErrors:');
    for (const error of parsed.errors.slice(0, 10)) { // Show first 10
      if (error.file) {
        lines.push(`  ❌ ${error.file}:${error.line}:${error.column} - ${error.message}`);
      } else {
        lines.push(`  ❌ ${error.message}`);
      }
    }
    if (parsed.errors.length > 10) {
      lines.push(`  ... and ${parsed.errors.length - 10} more errors`);
    }
  }
  
  // Warnings (only show if no errors)
  if (parsed.errors.length === 0 && parsed.warnings.length > 0) {
    lines.push('\nWarnings:');
    for (const warning of parsed.warnings.slice(0, 5)) { // Show first 5
      if (warning.file) {
        lines.push(`  ⚠️ ${warning.file}:${warning.line}:${warning.column} - ${warning.message}`);
      } else {
        lines.push(`  ⚠️ ${warning.message}`);
      }
    }
    if (parsed.warnings.length > 5) {
      lines.push(`  ... and ${parsed.warnings.length - 5} more warnings`);
    }
  }
  
  // Test results
  if (parsed.tests.length > 0) {
    lines.push('\nTest Results:');
    if (parsed.testsPassed) {
      lines.push(`  ✅ All ${parsed.totalTests} tests passed`);
    } else {
      lines.push(`  ❌ ${parsed.failedTests} of ${parsed.totalTests} tests failed`);
      
      // Show failed tests
      const failedTests = parsed.tests.filter(t => !t.passed);
      for (const test of failedTests.slice(0, 5)) {
        lines.push(`    ✖ ${test.name}: ${test.failureReason || 'Failed'}`);
      }
      if (failedTests.length > 5) {
        lines.push(`    ... and ${failedTests.length - 5} more failures`);
      }
    }
  }
  
  return lines.join('\n');
}