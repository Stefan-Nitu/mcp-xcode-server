import { execAsync } from '../../utils.js';
import { createModuleLogger } from '../../logger.js';
import path from 'path';
import { existsSync, readFileSync, unlinkSync } from 'fs';
import { tmpdir } from 'os';
import { XMLParser } from 'fast-xml-parser';
import { LogManager } from '../LogManager.js';
import { parseXcbeautifyOutput, formatParsedOutput, Issue, XcbeautifyOutput } from '../errors/xcbeautify-parser.js';

const logger = createModuleLogger('SwiftBuild');

export interface SwiftBuildOptions {
  configuration?: 'Debug' | 'Release';
  product?: string;
  target?: string;
}

export interface SwiftRunOptions {
  executable?: string;
  arguments?: string[];
  configuration?: 'Debug' | 'Release';
}

export interface SwiftTestOptions {
  filter?: string;
  configuration?: 'Debug' | 'Release';
}

/**
 * Handles Swift package commands (build, run, test)
 */
export class SwiftBuild {
  /**
   * Parse compile errors from Swift compiler output
   */
  private parseCompileErrors(output: string): Issue[] {
    const errors: Issue[] = [];
    const lines = output.split('\n');
    
    // Swift compiler error format:
    // /path/to/file.swift:10:15: error: message here
    // /path/to/file.swift:20:8: warning: message here
    const errorRegex = /^(.+):(\d+):(\d+):\s+(error|warning):\s+(.+)$/;
    
    // Track unique errors (same as XcodeBuild to avoid duplicates)
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
            type: type as 'error' | 'warning',
            rawLine: line
          });
        }
      }
    }
    
    return errors;
  }
  /**
   * Build a Swift package
   */
  async build(
    packagePath: string,
    options: SwiftBuildOptions = {}
  ): Promise<{ success: boolean; output: string; logPath?: string; errors?: Issue[]; warnings?: Issue[] }> {
    const { configuration = 'Debug', product, target } = options;
    
    // Convert to lowercase for swift command
    const configFlag = configuration.toLowerCase();
    let command = `swift build --package-path "${packagePath}" -c ${configFlag}`;
    
    if (product) {
      command += ` --product "${product}"`;
    }
    
    if (target) {
      command += ` --target "${target}"`;
    }
    
    logger.debug({ command }, 'Build command');
    
    try {
      const { stdout, stderr } = await execAsync(command, {
        maxBuffer: 10 * 1024 * 1024
      });
      
      const output = stdout + (stderr ? `\n${stderr}` : '');
      
      // Save log
      const packageName = path.basename(packagePath);
      const logPath = LogManager.saveLog('build', output, packageName, {
        configuration,
        product,
        target
      });
      
      logger.info({ packagePath, configuration, logPath }, 'Build succeeded');
      
      return {
        success: true,
        output,
        logPath
      };
    } catch (error: any) {
      logger.error({ error: error.message, packagePath }, 'Build failed');
      
      // Get full output
      const output = (error.stdout || '') + (error.stderr ? `\n${error.stderr}` : '');
      
      // Save log
      const packageName = path.basename(packagePath);
      const logPath = LogManager.saveLog('build', output, packageName, {
        configuration,
        product,
        target,
        exitCode: error.code || 1
      });
      
      // Parse errors using unified xcbeautify parser
      const parsed = parseXcbeautifyOutput(output);
      const compileErrors = parsed.errors;
      const buildErrors: Issue[] = [];
      
      // Throw error with errors attached
      const buildError: any = new Error('Build failed');
      buildError.compileErrors = compileErrors;
      buildError.buildErrors = buildErrors;
      buildError.logPath = logPath;
      buildError.output = output;
      throw buildError;
    }
  }
  
  /**
   * Run a Swift package executable
   */
  async run(
    packagePath: string,
    options: SwiftRunOptions = {}
  ): Promise<{ success: boolean; output: string; logPath?: string; errors?: Issue[]; warnings?: Issue[] }> {
    const { executable, arguments: args = [], configuration = 'Debug' } = options;
    
    // Convert to lowercase for swift command
    const configFlag = configuration.toLowerCase();
    let command = `swift run --package-path "${packagePath}" -c ${configFlag}`;
    
    if (executable) {
      command += ` "${executable}"`;
    }
    
    if (args.length > 0) {
      command += ` ${args.map(arg => `"${arg}"`).join(' ')}`;
    }
    
    logger.debug({ command }, 'Run command');
    
    try {
      const { stdout, stderr } = await execAsync(command, {
        maxBuffer: 10 * 1024 * 1024
      });
      
      const output = stdout + (stderr ? `\n${stderr}` : '');
      
      // Save log
      const packageName = path.basename(packagePath);
      const logPath = LogManager.saveLog('run', output, packageName, {
        configuration,
        executable,
        arguments: args
      });
      
      logger.info({ packagePath, executable, logPath }, 'Run succeeded');
      
      return {
        success: true,
        output,
        logPath
      };
    } catch (error: any) {
      logger.error({ error: error.message, packagePath }, 'Run failed');
      
      // Get full output - for swift run, build output is in stderr, executable output is in stdout
      // We want to show them in chronological order: build first, then executable
      const output = (error.stderr || '') + (error.stdout ? `\n${error.stdout}` : '');
      
      // Save log
      const packageName = path.basename(packagePath);
      const logPath = LogManager.saveLog('run', output, packageName, {
        configuration,
        executable,
        arguments: args,
        exitCode: error.code || 1
      });
      
      // Parse errors using unified xcbeautify parser
      const parsed = parseXcbeautifyOutput(output);
      const compileErrors = parsed.errors;
      const buildErrors: Issue[] = [];
      
      // Check if build succeeded but executable failed
      // If the build completed and we have output from the executable, use that as the error
      let errorMessage = output.trim() || 'Run failed';
      
      if (output.includes('Build of product') && output.includes('complete!')) {
        // Build succeeded, executable failed
        // In swift run output, build comes first, then executable output after "complete!"
        // Format is: "Build of product 'name' complete! (X.XXs)\n[executable output]"
        const completeLineEnd = output.indexOf('\n', output.lastIndexOf('complete!'));
        if (completeLineEnd !== -1) {
          // Get everything after the build completion line
          const executableOutput = output.substring(completeLineEnd + 1).trim();
          
          if (executableOutput) {
            errorMessage = `Executable failed with exit code ${error.code || 1}:\n${executableOutput}`;
          } else {
            errorMessage = `Executable failed with exit code ${error.code || 1}`;
          }
        } else {
          errorMessage = `Executable failed with exit code ${error.code || 1}`;
        }
      }
      
      // Throw error with errors attached
      const runError: any = new Error(errorMessage);
      runError.compileErrors = compileErrors;
      runError.buildErrors = buildErrors;
      runError.logPath = logPath;
      runError.output = output;
      throw runError;
    }
  }
  
  /**
   * Test a Swift package
   */
  async test(
    packagePath: string,
    options: SwiftTestOptions = {}
  ): Promise<{ 
    success: boolean; 
    output: string;
    passed: number;
    failed: number;
    failingTests?: Array<{ identifier: string; reason: string }>;
    errors?: Issue[];
    warnings?: Issue[];
    logPath: string;
  }> {
    const { filter, configuration = 'Debug' } = options;
    
    
    // Convert to lowercase for swift command
    const configFlag = configuration.toLowerCase();
    
    // Generate unique xunit output file in temp directory
    const xunitPath = path.join(tmpdir(), `test-${Date.now()}-${Math.random().toString(36).substring(7)}.xml`);
    const swiftTestingXunitPath = xunitPath.replace('.xml', '-swift-testing.xml');
    
    let command = `swift test --package-path "${packagePath}" -c ${configFlag}`;
    
    if (filter) {
      command += ` --filter "${filter}"`;
    }
    
    // Add parallel and xunit output for better results
    command += ` --parallel --xunit-output "${xunitPath}"`;
    
    logger.debug({ command, xunitPath, swiftTestingXunitPath }, 'Test command');
    
    // Extract package name for logging
    const packageName = path.basename(packagePath);
    
    let testResult = { passed: 0, failed: 0, success: false, failingTests: undefined as Array<{ identifier: string; reason: string }> | undefined };
    let output = '';
    let exitCode = 0;
    
    try {
      const { stdout, stderr } = await execAsync(command, {
        maxBuffer: 10 * 1024 * 1024
      });
      
      output = stdout + (stderr ? `\n${stderr}` : '');
      
      // Parse XUnit files for test results
      const xunitResults = this.parseXunitFiles(xunitPath, swiftTestingXunitPath, output);
      
      // Use XUnit results if available
      if (xunitResults) {
        testResult = { ...testResult, ...xunitResults };
      } else {
        // Fallback to console parsing if XUnit fails
        const parsedResults = this.parseTestOutput(output);
        testResult = { ...testResult, ...parsedResults };
      }
      
      testResult.success = exitCode === 0 && testResult.failed === 0;
      
      // Clean up XUnit files
      this.cleanupXunitFiles(xunitPath, swiftTestingXunitPath);
      
      logger.info({ 
        packagePath, 
        passed: testResult.passed, 
        failed: testResult.failed,
        failingTests: testResult.failingTests,
        source: xunitResults ? 'xunit' : 'console'
      }, 'Tests completed');
      
      // Save the test output to logs
      const logPath = LogManager.saveLog('test', output, packageName, {
        configuration,
        filter,
        exitCode,
        command,
        testResults: testResult
      });
      
      return {
        ...testResult,
        output,
        logPath
      };
    } catch (error: any) {
      logger.error({ error: error.message, packagePath }, 'Tests failed');
      
      // Extract output from error
      output = (error.stdout || '') + (error.stderr ? `\n${error.stderr}` : '');
      exitCode = error.code || 1;
      
      // Parse XUnit files for test results
      const xunitResults = this.parseXunitFiles(xunitPath, swiftTestingXunitPath, output);
      
      // Use XUnit results if available
      if (xunitResults) {
        testResult = { ...testResult, ...xunitResults };
      } else {
        // Fallback to console parsing if XUnit fails
        const parsedResults = this.parseTestOutput(output);
        testResult = { ...testResult, ...parsedResults };
      }
      
      // Clean up XUnit files
      this.cleanupXunitFiles(xunitPath, swiftTestingXunitPath);
      
      // Parse errors using unified xcbeautify parser
      const parsed = parseXcbeautifyOutput(output);
      
      // Save the test output to logs
      const logPath = LogManager.saveLog('test', output, packageName, {
        configuration,
        filter,
        exitCode,
        command,
        testResults: testResult,
        errors: parsed.errors.length > 0 ? parsed.errors : undefined,
        warnings: parsed.warnings.length > 0 ? parsed.warnings : undefined
      });
      
      return {
        ...testResult,
        success: false,
        output,
        errors: parsed.errors.length > 0 ? parsed.errors : undefined,
        warnings: parsed.warnings.length > 0 ? parsed.warnings : undefined,
        logPath
      };
    }
  }

  /**
   * Parse test output from console
   */
  private parseTestOutput(output: string): { passed?: number; failed?: number; failingTests?: Array<{ identifier: string; reason: string }> } {
    const result: { passed?: number; failed?: number; failingTests?: Array<{ identifier: string; reason: string }> } = {};
    
    // Parse test counts
    const counts = this.parseTestCounts(output);
    if (counts) {
      result.passed = counts.passed;
      result.failed = counts.failed;
    }
    
    // Parse failing tests
    const failingTests = this.parseFailingTests(output);
    if (failingTests.length > 0) {
      result.failingTests = failingTests;
    }
    
    return result;
  }

  /**
   * Parse test counts from output
   */
  private parseTestCounts(output: string): { passed: number; failed: number } | null {
    // XCTest format: "Executed 1 test, with 1 failure"
    // Look for the last occurrence to get the summary
    const xcTestMatches = [...output.matchAll(/Executed (\d+) test(?:s)?, with (\d+) failure/g)];
    if (xcTestMatches.length > 0) {
      const lastMatch = xcTestMatches[xcTestMatches.length - 1];
      const totalTests = parseInt(lastMatch[1], 10);
      const failures = parseInt(lastMatch[2], 10);
      
      // If we found XCTest results with actual tests, use them
      if (totalTests > 0) {
        return {
          passed: totalTests - failures,
          failed: failures
        };
      }
    }
    
    // Swift Testing format: "✘ Test run with 1 test failed after..." or "✔ Test run with X tests passed after..."
    const swiftTestingMatch = output.match(/[✘✔] Test run with (\d+) test(?:s)? (passed|failed)/);
    if (swiftTestingMatch) {
      const testCount = parseInt(swiftTestingMatch[1], 10);
      const status = swiftTestingMatch[2];
      
      // Only use Swift Testing results if we have actual tests
      if (testCount > 0) {
        if (status === 'failed') {
          return { passed: 0, failed: testCount };
        } else {
          return { passed: testCount, failed: 0 };
        }
      }
    }
    
    return null;
  }

  /**
   * Parse failing test details from output
   */
  private parseFailingTests(output: string): Array<{ identifier: string; reason: string }> {
    const failingTests: Array<{ identifier: string; reason: string }> = [];
    
    // Parse XCTest failures
    const xcTestFailures = this.parseXCTestFailures(output);
    failingTests.push(...xcTestFailures);
    
    // Parse Swift Testing failures
    const swiftTestingFailures = this.parseSwiftTestingFailures(output);
    
    // Add Swift Testing failures, avoiding duplicates
    for (const failure of swiftTestingFailures) {
      if (!failingTests.some(t => t.identifier === failure.identifier)) {
        failingTests.push(failure);
      }
    }
    
    logger.debug({ failingTestsCount: failingTests.length, failingTests }, 'Parsed failing tests from console output');
    return failingTests;
  }

  /**
   * Parse XCTest failure details
   */
  private parseXCTestFailures(output: string): Array<{ identifier: string; reason: string }> {
    const failures: Array<{ identifier: string; reason: string }> = [];
    const pattern = /Test Case '-\[(\S+)\s+(\w+)\]' failed/g;
    let match;
    
    while ((match = pattern.exec(output)) !== null) {
      const className = match[1];
      const methodName = match[2];
      const identifier = `${className}.${methodName}`;
      const reason = this.extractXCTestFailureReason(output, className, methodName);
      
      failures.push({ identifier, reason });
    }
    
    return failures;
  }

  /**
   * Extract failure reason for a specific XCTest
   */
  private extractXCTestFailureReason(output: string, className: string, testName: string): string {
    const lines = output.split('\n');
    
    // Try both formats: full class name and just test name
    const patterns = [
      `Test Case '-[${className} ${testName}]' failed`,
      `Test Case '-[${className.split('.').pop()} ${testName}]' failed`
    ];
    
    for (const pattern of patterns) {
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes(pattern)) {
          // Check the previous line for error details
          if (i > 0) {
            const prevLine = lines[i-1];
            
            // XCTFail format: "error: ... : failed - <message>"
            if (prevLine.includes('failed -')) {
              const failedMatch = prevLine.match(/failed\s*-\s*(.+)$/);
              if (failedMatch) {
                return failedMatch[1].trim();
              }
            }
            
            // XCTAssert format: may have the full error with escaped quotes
            if (prevLine.includes('error:')) {
              // Try to extract custom message after the last dash
              const customMessageMatch = prevLine.match(/\s-\s([^-]+)$/);
              if (customMessageMatch) {
                return customMessageMatch[1].trim();
              }
              
              // Try to extract the assertion type
              if (prevLine.includes('XCTAssertEqual failed')) {
                // Clean up the XCTAssertEqual format
                const assertMatch = prevLine.match(/XCTAssertEqual failed:.*?-\s*(.+)$/);
                if (assertMatch) {
                  return assertMatch[1].trim();
                }
                // If no custom message, return a generic one
                return 'Values are not equal';
              }
              
              // Generic error format: extract everything after "error: ... :"
              const errorMatch = prevLine.match(/error:\s*[^:]+:\s*(.+)$/);
              if (errorMatch) {
                let reason = errorMatch[1].trim();
                // Clean up escaped quotes and format
                reason = reason.replace(/\\"/g, '"');
                // Remove the redundant class/method prefix if present
                reason = reason.replace(new RegExp(`^-?\\[${className.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[^\\]]*\\]\\s*:\\s*`, 'i'), '');
                return reason.trim();
              }
            }
          }
          break;
        }
      }
    }
    
    return 'Test failed';
  }

  /**
   * Parse Swift Testing failure details
   */
  private parseSwiftTestingFailures(output: string): Array<{ identifier: string; reason: string }> {
    const failures: Array<{ identifier: string; reason: string }> = [];
    const pattern = /✘ Test (\w+)\(\) (?:failed|recorded an issue)/g;
    let match;
    
    // Try to find the suite name from the output
    let suiteName: string | null = null;
    const suiteMatch = output.match(/◇ Suite (\w+) started\./);
    if (suiteMatch) {
      suiteName = suiteMatch[1];
    }
    
    while ((match = pattern.exec(output)) !== null) {
      const testName = match[1];
      
      // Build identifier with module.suite.test format to match XCTest
      let identifier = testName;
      const issuePattern = new RegExp(`✘ Test ${testName}\\(\\) recorded an issue at (\\w+)\\.swift`, 'm');
      const issueMatch = output.match(issuePattern);
      if (issueMatch) {
        const fileName = issueMatch[1];
        // If we have a suite name, use module.suite.test format
        // Otherwise fall back to module.test
        if (suiteName) {
          identifier = `${fileName}.${suiteName}.${testName}`;
        } else {
          identifier = `${fileName}.${testName}`;
        }
      }
      
      const reason = this.extractSwiftTestingFailureReason(output, testName);
      
      failures.push({ identifier, reason });
    }
    
    return failures;
  }

  /**
   * Extract failure reason for a specific Swift test
   */
  private extractSwiftTestingFailureReason(output: string, testName: string): string {
    const lines = output.split('\n');
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      if (line.includes(`✘ Test ${testName}() recorded an issue`)) {
        // Extract the expectation failure message from the same line
        // Format: "✘ Test testFailingTest() recorded an issue at TestSwiftPackageSwiftTestingTests.swift:12:5: Expectation failed: 1 == 2"
        const issueMatch = line.match(/recorded an issue at .*?:\d+:\d+:\s*(.+)$/);
        if (issueMatch) {
          let reason = issueMatch[1];
          
          // Check if there's a message on the following lines (marked with ↳)
          // Collect all lines between ↳ and the next ✘ marker
          const messageLines: string[] = [];
          let inMessage = false;
          
          for (let j = i + 1; j < lines.length && j < i + 20; j++) {
            const nextLine = lines[j];
            
            // Stop when we hit the next test marker
            if (nextLine.includes('✘')) {
              break;
            }
            
            // Start capturing after we see ↳ (but skip comment lines)
            if (nextLine.includes('↳')) {
              if (!nextLine.includes('//')) {
                const messageMatch = nextLine.match(/↳\s*(.+)$/);
                if (messageMatch) {
                  messageLines.push(messageMatch[1].trim());
                  inMessage = true;
                }
              }
            } else if (inMessage && nextLine.trim()) {
              // Capture continuation lines (indented lines without ↳)
              messageLines.push(nextLine.trim());
            }
          }
          
          // If we found message lines, append them to the reason
          if (messageLines.length > 0) {
            reason = `${reason} - ${messageLines.join(' ')}`;
          }
          
          return reason;
        }
        // Fallback to simpler pattern
        const simpleMatch = line.match(/recorded an issue.*?:\s*(.+)$/);
        if (simpleMatch) {
          return simpleMatch[1];
        }
        break;
      } else if (line.includes(`✘ Test ${testName}() failed`)) {
        // Check if there was an issue line before this
        if (i > 0 && lines[i-1].includes('recorded an issue')) {
          const issueMatch = lines[i-1].match(/recorded an issue.*?:\d+:\d+:\s*(.+)$/);
          if (issueMatch) {
            return issueMatch[1];
          }
        }
        break;
      }
    }
    
    return 'Test failed';
  }
  
  /**
   * Parse XUnit files from both XCTest and Swift Testing
   */
  private parseXunitFiles(xunitPath: string, swiftTestingPath: string, consoleOutput: string): {
    passed: number;
    failed: number;
    failingTests?: Array<{ identifier: string; reason: string }>;
  } | null {
    try {
      const parser = new XMLParser({
        ignoreAttributes: false,
        attributeNamePrefix: '@_'
      });
      
      let totalPassed = 0;
      let totalFailed = 0;
      const allFailingTests: Array<{ identifier: string; reason: string }> = [];
      
      // Parse XCTest XUnit file
      if (existsSync(xunitPath)) {
        const xcTestXml = readFileSync(xunitPath, 'utf8');
        const xcTestResult = parser.parse(xcTestXml);
        const xcTestSuite = xcTestResult.testsuites?.testsuite;
        
        if (xcTestSuite && xcTestSuite['@_tests']) {
          const totalTests = parseInt(xcTestSuite['@_tests'], 10);
          const failures = parseInt(xcTestSuite['@_failures'] || '0', 10);
          
          if (totalTests > 0) {
            totalPassed += totalTests - failures;
            totalFailed += failures;
            
            // Extract failing test identifiers (but not reasons - they're just "failed")
            const testcases = Array.isArray(xcTestSuite.testcase) 
              ? xcTestSuite.testcase 
              : xcTestSuite.testcase ? [xcTestSuite.testcase] : [];
            
            for (const testcase of testcases) {
              if (testcase && testcase.failure) {
                const className = testcase['@_classname'] || '';
                const testName = testcase['@_name'] || '';
                const identifier = `${className}.${testName}`;
                
                // Extract reason from console output
                const reason = this.extractXCTestFailureReason(consoleOutput, className, testName);
                allFailingTests.push({ identifier, reason });
              }
            }
          }
        }
      }
      
      // Parse Swift Testing XUnit file
      if (existsSync(swiftTestingPath)) {
        const swiftTestingXml = readFileSync(swiftTestingPath, 'utf8');
        const swiftTestingResult = parser.parse(swiftTestingXml);
        const swiftTestingSuite = swiftTestingResult.testsuites?.testsuite;
        
        if (swiftTestingSuite && swiftTestingSuite['@_tests']) {
          const totalTests = parseInt(swiftTestingSuite['@_tests'], 10);
          const failures = parseInt(swiftTestingSuite['@_failures'] || '0', 10);
          
          if (totalTests > 0) {
            totalPassed += totalTests - failures;
            totalFailed += failures;
            
            // Extract failing tests with full error messages
            const testcases = Array.isArray(swiftTestingSuite.testcase) 
              ? swiftTestingSuite.testcase 
              : swiftTestingSuite.testcase ? [swiftTestingSuite.testcase] : [];
            
            for (const testcase of testcases) {
              if (testcase && testcase.failure) {
                const className = testcase['@_classname'] || '';
                const testName = testcase['@_name'] || '';
                const identifier = `${className}.${testName}`;
                
                // Swift Testing XUnit includes the full error message!
                const failureElement = testcase.failure;
                let reason = 'Test failed';
                if (typeof failureElement === 'object' && failureElement['@_message']) {
                  reason = failureElement['@_message'];
                  // Decode HTML entities
                  reason = reason
                    .replace(/&amp;/g, '&')
                    .replace(/&lt;/g, '<')
                    .replace(/&gt;/g, '>')
                    .replace(/&quot;/g, '"')
                    .replace(/&#10;/g, '\n')
                    .replace(/&#8594;/g, '→');
                  // Replace newlines with space for single-line display
                  reason = reason.replace(/\n+/g, ' ').trim();
                }
                
                allFailingTests.push({ identifier, reason });
              }
            }
          }
        }
      }
      
      // Return results if we found any tests
      if (totalPassed > 0 || totalFailed > 0) {
        logger.debug({ 
          totalPassed, 
          totalFailed, 
          failingTests: allFailingTests,
          xcTestExists: existsSync(xunitPath),
          swiftTestingExists: existsSync(swiftTestingPath)
        }, 'XUnit parsing successful');
        
        return {
          passed: totalPassed,
          failed: totalFailed,
          failingTests: allFailingTests.length > 0 ? allFailingTests : undefined
        };
      }
      
      return null;
    } catch (error: any) {
      logger.error({ error: error.message }, 'Failed to parse XUnit files');
      return null;
    }
  }
  
  /**
   * Clean up XUnit files after parsing
   */
  private cleanupXunitFiles(xunitPath: string, swiftTestingPath: string): void {
    try {
      if (existsSync(xunitPath)) {
        unlinkSync(xunitPath);
      }
      if (existsSync(swiftTestingPath)) {
        unlinkSync(swiftTestingPath);
      }
    } catch (error: any) {
      logger.debug({ error: error.message }, 'Failed to clean up XUnit files');
    }
  }
  
  /**
   * Clean Swift package build artifacts
   */
  async clean(packagePath: string): Promise<void> {
    const command = `swift package clean --package-path "${packagePath}"`;
    
    logger.debug({ command }, 'Clean command');
    
    try {
      await execAsync(command);
      logger.info({ packagePath }, 'Clean succeeded');
    } catch (error: any) {
      logger.error({ error: error.message, packagePath }, 'Clean failed');
      throw new Error(`Clean failed: ${error.message}`);
    }
  }
}