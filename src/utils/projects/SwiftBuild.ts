import { execAsync } from '../../utils.js';
import { createModuleLogger } from '../../logger.js';
import { existsSync, readFileSync, unlinkSync } from 'fs';
import { tmpdir } from 'os';
import path from 'path';
import { XMLParser } from 'fast-xml-parser';
import { LogManager } from '../LogManager.js';
import { CompileError } from './XcodeBuild.js';
import { parseBuildErrors, BuildError } from '../buildErrorParsing.js';

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
  private parseCompileErrors(output: string): CompileError[] {
    const errors: CompileError[] = [];
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
            type: type as 'error' | 'warning'
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
  ): Promise<{ success: boolean; output: string; logPath?: string; compileErrors?: CompileError[]; buildErrors?: BuildError[] }> {
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
      
      // Parse compile errors
      const compileErrors = this.parseCompileErrors(output);
      
      // Parse build errors
      const buildErrors = parseBuildErrors(output);
      
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
  ): Promise<{ success: boolean; output: string; logPath?: string; compileErrors?: CompileError[]; buildErrors?: BuildError[] }> {
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
      
      // Get full output
      const output = (error.stdout || '') + (error.stderr ? `\n${error.stderr}` : '');
      
      // Save log
      const packageName = path.basename(packagePath);
      const logPath = LogManager.saveLog('run', output, packageName, {
        configuration,
        executable,
        arguments: args,
        exitCode: error.code || 1
      });
      
      // Parse compile errors (build might fail before run)
      const compileErrors = this.parseCompileErrors(output);
      
      // Parse build errors
      const buildErrors = parseBuildErrors(output);
      
      // Throw error with errors attached
      const runError: any = new Error('Run failed');
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
    compileErrors?: CompileError[];
    buildErrors?: BuildError[];
    logPath: string;
  }> {
    const { filter, configuration = 'Debug' } = options;
    
    // Generate unique xunit output file path
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const xunitPath = path.join(tmpdir(), `swift-test-${timestamp}.xml`);
    
    // Convert to lowercase for swift command
    const configFlag = configuration.toLowerCase();
    let command = `swift test --package-path "${packagePath}" -c ${configFlag}`;
    
    if (filter) {
      command += ` --filter "${filter}"`;
    }
    
    // Add xunit output for XCTest results - --parallel is required for xunit output to work
    command += ` --parallel --xunit-output "${xunitPath}"`;
    
    logger.debug({ command, xunitPath }, 'Test command with xunit output');
    
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
      
      // Parse xunit XML if it exists
      if (existsSync(xunitPath)) {
        try {
          const xmlContent = readFileSync(xunitPath, 'utf8');
          logger.debug({ xunitPath }, 'Found xunit output file');
          
          // Parse the xunit XML using proper parser
          const parser = new XMLParser({
            ignoreAttributes: false,
            attributeNamePrefix: '@_'
          });
          
          const result = parser.parse(xmlContent);
          const testsuites = result.testsuites;
          
          if (testsuites && testsuites['@_tests'] && testsuites['@_failures'] !== undefined) {
            const totalTests = parseInt(testsuites['@_tests'], 10);
            const failures = parseInt(testsuites['@_failures'], 10);
            testResult.passed = totalTests - failures;
            testResult.failed = failures;
            testResult.success = failures === 0;
            
            // Extract failing test names and reasons from nested testcase elements
            const failingTests: Array<{ identifier: string; reason: string }> = [];
            
            // Handle both single testsuite and multiple testsuites
            const suites = Array.isArray(testsuites.testsuite) ? testsuites.testsuite : [testsuites.testsuite];
            
            for (const suite of suites) {
              if (suite && suite.testcase) {
                const testcases = Array.isArray(suite.testcase) ? suite.testcase : [suite.testcase];
                for (const testcase of testcases) {
                  if (testcase && testcase.failure) {
                    // Build full test identifier from suite and test names
                    const suiteName = suite['@_name'] || '';
                    const testName = testcase['@_name'] || '';
                    const identifier = suiteName ? `${suiteName}.${testName}` : testName;
                    
                    // Extract failure reason from failure element
                    let reason = 'Test failed';
                    if (testcase.failure) {
                      const failure = testcase.failure;
                      if (typeof failure === 'string') {
                        reason = failure;
                      } else if (failure['@_message']) {
                        reason = failure['@_message'];
                        // Include the failure text content if available
                        if (failure['#text']) {
                          reason = `${reason}: ${failure['#text']}`;
                        }
                      } else if (failure['#text']) {
                        reason = failure['#text'];
                      }
                    }
                    
                    failingTests.push({ identifier, reason });
                  }
                }
              }
            }
            
            if (failingTests.length > 0) {
              testResult.failingTests = failingTests;
            }
            
            logger.info({ 
              packagePath, 
              passed: testResult.passed, 
              failed: testResult.failed,
              failingTests: testResult.failingTests
            }, 'Tests completed (parsed from xunit)');
          } else {
            // XML structure unexpected
            throw new Error('Failed to parse xunit XML: tests/failures attributes not found');
          }
        } catch (xmlError: any) {
          logger.error({ error: xmlError.message }, 'Failed to parse xunit file');
          throw new Error(`Failed to parse xunit output: ${xmlError.message}`);
        } finally {
          // Clean up xunit file
          try {
            unlinkSync(xunitPath);
            // Also clean up Swift Testing output file if it exists
            const swiftTestingPath = xunitPath.replace('.xml', '-swift-testing.xml');
            if (existsSync(swiftTestingPath)) {
              unlinkSync(swiftTestingPath);
            }
          } catch {
            // Ignore cleanup errors
          }
        }
      } else {
        // No xunit file created
        throw new Error('Swift test did not generate xunit output file');
      }
      
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
      
      // Try to parse xunit output even on failure
      output = (error.stdout || '') + (error.stderr ? `\n${error.stderr}` : '');
      exitCode = error.code || 1;
      
      if (existsSync(xunitPath)) {
        try {
          const xmlContent = readFileSync(xunitPath, 'utf8');
          
          // Parse the xunit XML using proper parser
          const parser = new XMLParser({
            ignoreAttributes: false,
            attributeNamePrefix: '@_'
          });
          
          const result = parser.parse(xmlContent);
          const testsuites = result.testsuites;
          
          if (testsuites && testsuites['@_tests'] && testsuites['@_failures'] !== undefined) {
            const totalTests = parseInt(testsuites['@_tests'], 10);
            const failures = parseInt(testsuites['@_failures'], 10);
            testResult.passed = totalTests - failures;
            testResult.failed = failures;
            
            // Extract failing test names and reasons from nested testcase elements
            const failingTests: Array<{ identifier: string; reason: string }> = [];
            
            // Handle both single testsuite and multiple testsuites
            const suites = Array.isArray(testsuites.testsuite) ? testsuites.testsuite : [testsuites.testsuite];
            
            for (const suite of suites) {
              if (suite && suite.testcase) {
                const testcases = Array.isArray(suite.testcase) ? suite.testcase : [suite.testcase];
                for (const testcase of testcases) {
                  if (testcase && testcase.failure) {
                    // Build full test identifier from suite and test names
                    const suiteName = suite['@_name'] || '';
                    const testName = testcase['@_name'] || '';
                    const identifier = suiteName ? `${suiteName}.${testName}` : testName;
                    
                    // Extract failure reason from failure element
                    let reason = 'Test failed';
                    if (testcase.failure) {
                      const failure = testcase.failure;
                      if (typeof failure === 'string') {
                        reason = failure;
                      } else if (failure['@_message']) {
                        reason = failure['@_message'];
                        // Include the failure text content if available
                        if (failure['#text']) {
                          reason = `${reason}: ${failure['#text']}`;
                        }
                      } else if (failure['#text']) {
                        reason = failure['#text'];
                      }
                    }
                    
                    failingTests.push({ identifier, reason });
                  }
                }
              }
            }
            
            if (failingTests.length > 0) {
              testResult.failingTests = failingTests;
            }
          } else {
            throw new Error('Failed to parse xunit XML: tests/failures attributes not found');
          }
        } catch (xmlError: any) {
          logger.error({ error: xmlError.message }, 'Failed to parse xunit file on test failure');
          // Return basic failure info
          testResult = { passed: 0, failed: 1, success: false, failingTests: undefined };
        } finally {
          // Clean up xunit file
          try {
            unlinkSync(xunitPath);
            // Also clean up Swift Testing output file if it exists
            const swiftTestingPath = xunitPath.replace('.xml', '-swift-testing.xml');
            if (existsSync(swiftTestingPath)) {
              unlinkSync(swiftTestingPath);
            }
          } catch {
            // Ignore cleanup errors
          }
        }
      } else {
        // No xunit file on failure - return basic failure info
        testResult = { passed: 0, failed: 1, success: false, failingTests: undefined };
      }
      
      // Parse compile errors if the build failed
      const compileErrors = this.parseCompileErrors(output);
      
      // Parse build errors
      const buildErrors = parseBuildErrors(output);
      
      // Save the test output to logs
      const logPath = LogManager.saveLog('test', output, packageName, {
        configuration,
        filter,
        exitCode,
        command,
        testResults: testResult,
        compileErrors: compileErrors.length > 0 ? compileErrors : undefined,
        buildErrors: buildErrors.length > 0 ? buildErrors : undefined
      });
      
      return {
        ...testResult,
        success: false,
        output,
        compileErrors: compileErrors.length > 0 ? compileErrors : undefined,
        buildErrors: buildErrors.length > 0 ? buildErrors : undefined,
        logPath
      };
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