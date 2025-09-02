import { execAsync } from '../../utils.js';
import { execSync } from 'child_process';
import { createModuleLogger } from '../../logger.js';
import { Platform } from '../../types.js';
import { PlatformInfo } from '../../domain/value-objects/PlatformInfo.js';
import { existsSync, mkdirSync, rmSync } from 'fs';
import path from 'path';
import { config } from '../../config.js';
import { LogManager } from '../LogManager.js';
import { parseXcbeautifyOutput, formatParsedOutput } from '../errors/xcbeautify-parser.js';

const logger = createModuleLogger('XcodeBuild');

export interface BuildOptions {
  scheme?: string;
  configuration?: string;
  platform?: Platform;
  deviceId?: string;
  derivedDataPath?: string;
}

export interface TestOptions {
  scheme?: string;
  configuration?: string;
  platform?: Platform;
  deviceId?: string;
  testFilter?: string;
  testTarget?: string;
}

// Using unified xcbeautify parser for all error handling

/**
 * Handles xcodebuild commands for Xcode projects
 */
export class XcodeBuild {
  /**
   * Validates that a scheme supports the requested platform
   * @throws Error if the platform is not supported
   */
  private async validatePlatformSupport(
    projectPath: string,
    isWorkspace: boolean,
    scheme: string | undefined,
    platform: Platform
  ): Promise<void> {
    const projectFlag = isWorkspace ? '-workspace' : '-project';
    
    let command = `xcodebuild -showBuildSettings ${projectFlag} "${projectPath}"`;
    
    if (scheme) {
      command += ` -scheme "${scheme}"`;
    }
    
    // Use a generic destination to check platform support
    const platformInfo = PlatformInfo.fromPlatform(platform);
    const destination = platformInfo.generateGenericDestination();
    command += ` -destination '${destination}'`;
    
    try {
      logger.debug({ command }, 'Validating platform support');
      // Just check if the command succeeds - we don't need the output
      await execAsync(command, { 
        maxBuffer: 1024 * 1024, // 1MB is enough for validation
        timeout: 10000 // 10 second timeout for validation
      });
      logger.debug({ platform, scheme }, 'Platform validation succeeded');
    } catch (error: any) {
      const stderr = error.stderr || '';
      const stdout = error.stdout || '';
      
      // Check if error indicates platform mismatch
      if (stderr.includes('Available destinations for') || stdout.includes('Available destinations for')) {
        // Extract available platforms from the error message
        const availablePlatforms = this.extractAvailablePlatforms(stderr + stdout);
        throw new Error(
          `Platform '${platform}' is not supported by scheme '${scheme || 'default'}'. ` +
          `Available platforms: ${availablePlatforms.join(', ')}`
        );
      }
      
      // Some other error - let it pass through for now
      logger.warn({ error: error.message }, 'Platform validation check failed, continuing anyway');
    }
  }
  
  /**
   * Extracts available platforms from xcodebuild error output
   */
  private extractAvailablePlatforms(output: string): string[] {
    const platforms = new Set<string>();
    const lines = output.split('\n');
    
    for (const line of lines) {
      // Look for lines like "{ platform:watchOS" or "{ platform:iOS Simulator"
      const match = line.match(/\{ platform:([^,}]+)/);
      if (match) {
        let platform = match[1].trim();
        // Normalize platform names
        if (platform.includes('Simulator')) {
          platform = platform.replace(' Simulator', '');
        }
        platforms.add(platform);
      }
    }
    
    return Array.from(platforms);
  }
  /**
   * Build an Xcode project or workspace
   */
  async build(
    projectPath: string, 
    isWorkspace: boolean,
    options: BuildOptions = {}
  ): Promise<{ success: boolean; output: string; appPath?: string; logPath?: string; errors?: any[] }> {
    const {
      scheme,
      configuration = 'Debug',
      platform = Platform.iOS,
      deviceId,
      derivedDataPath = './DerivedData'
    } = options;
    
    // Validate platform support first
    await this.validatePlatformSupport(projectPath, isWorkspace, scheme, platform);
    
    const projectFlag = isWorkspace ? '-workspace' : '-project';
    let command = `xcodebuild ${projectFlag} "${projectPath}"`;
    
    if (scheme) {
      command += ` -scheme "${scheme}"`;
    }
    
    command += ` -configuration "${configuration}"`;
    
    // Determine destination
    const platformInfo = PlatformInfo.fromPlatform(platform);
    let destination: string;
    if (deviceId) {
      destination = platformInfo.generateDestination(deviceId);
    } else {
      destination = platformInfo.generateGenericDestination();
    }
    command += ` -destination '${destination}'`;
    
    command += ` -derivedDataPath "${derivedDataPath}" build`;
    
    // Pipe through xcbeautify for clean output
    command = `set -o pipefail && ${command} 2>&1 | xcbeautify`;
    
    logger.debug({ command }, 'Build command');
    
    let output = '';
    let exitCode = 0;
    const projectName = path.basename(projectPath, path.extname(projectPath));
    
    try {
      const { stdout, stderr } = await execAsync(command, { 
        maxBuffer: 50 * 1024 * 1024,
        shell: '/bin/bash'
      });
      
      output = stdout + (stderr ? `\n${stderr}` : '');
      
      // Try to find the built app using find command (more reliable than parsing output)
      let appPath: string | undefined;
      try {
        const { stdout: findOutput } = await execAsync(
          `find "${derivedDataPath}" -name "*.app" -type d | head -1`
        );
        appPath = findOutput.trim() || undefined;
        
        if (appPath) {
          logger.info({ appPath }, 'Found app at path');
          
          // Verify the app actually exists
          if (!existsSync(appPath)) {
            logger.error({ appPath }, 'App path does not exist!');
            appPath = undefined;
          }
        } else {
          logger.warn({ derivedDataPath }, 'No app found in DerivedData');
        }
      } catch (error: any) {
        logger.error({ error: error.message, derivedDataPath }, 'Error finding app path');
      }
      
      logger.info({ projectPath, scheme, configuration, platform }, 'Build succeeded');
      
      // Save the build output to logs
      const logPath = LogManager.saveLog('build', output, projectName, {
        scheme,
        configuration,
        platform,
        exitCode,
        command
      });
      
      return {
        success: true,
        output,
        appPath,
        logPath
      };
    } catch (error: any) {
      logger.error({ error: error.message, projectPath }, 'Build failed');
      
      output = (error.stdout || '') + (error.stderr ? `\n${error.stderr}` : '');
      exitCode = error.code || 1;
      
      // Parse errors using the unified xcbeautify parser
      const parsed = parseXcbeautifyOutput(output);
      
      // Log for debugging
      if (parsed.errors.length === 0 && output.toLowerCase().includes('error:')) {
        logger.warn({ outputSample: output.substring(0, 500) }, 'Output contains "error:" but no errors were parsed');
      }
      
      // Save the build output to logs
      const logPath = LogManager.saveLog('build', output, projectName, {
        scheme,
        configuration,
        platform,
        exitCode,
        command,
        errors: parsed.errors,
        warnings: parsed.warnings
      });
      
      // Save debug data with parsed errors
      if (parsed.errors.length > 0) {
        LogManager.saveDebugData('build-errors', parsed.errors, projectName);
        logger.info({ errorCount: parsed.errors.length, warningCount: parsed.warnings.length }, 'Parsed errors');
      }
      
      // Create error with parsed details
      const errorWithDetails = new Error(formatParsedOutput(parsed)) as any;
      errorWithDetails.output = output;
      errorWithDetails.parsed = parsed;
      errorWithDetails.logPath = logPath;
      
      throw errorWithDetails;
    }
  }
  
  /**
   * Run tests for an Xcode project
   */
  async test(
    projectPath: string,
    isWorkspace: boolean,
    options: TestOptions = {}
  ): Promise<{ 
    success: boolean; 
    output: string; 
    passed: number; 
    failed: number; 
    failingTests?: Array<{ identifier: string; reason: string }>;
    errors?: any[];
    warnings?: any[];
    logPath: string;
  }> {
    const {
      scheme,
      configuration = 'Debug',
      platform = Platform.iOS,
      deviceId,
      testFilter,
      testTarget
    } = options;
    
    // Create a unique result bundle path in DerivedData
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const derivedDataPath = config.getDerivedDataPath(projectPath);
    let resultBundlePath = path.join(
      derivedDataPath,
      'Logs',
      'Test',
      `Test-${scheme || 'tests'}-${timestamp}.xcresult`
    );
    
    // Ensure result directory exists
    const resultDir = path.dirname(resultBundlePath);
    if (!existsSync(resultDir)) {
      mkdirSync(resultDir, { recursive: true });
    }
    
    const projectFlag = isWorkspace ? '-workspace' : '-project';
    let command = `xcodebuild ${projectFlag} "${projectPath}"`;
    
    if (scheme) {
      command += ` -scheme "${scheme}"`;
    }
    
    command += ` -configuration "${configuration}"`;
    
    // Determine destination
    const platformInfo = PlatformInfo.fromPlatform(platform);
    let destination: string;
    if (deviceId) {
      destination = platformInfo.generateDestination(deviceId);
    } else {
      destination = platformInfo.generateGenericDestination();
    }
    command += ` -destination '${destination}'`;
    
    // Add test target/filter if provided
    if (testTarget) {
      command += ` -only-testing:${testTarget}`;
    }
    if (testFilter) {
      command += ` -only-testing:${testFilter}`;
    }
    
    // Disable parallel testing to avoid timeouts and multiple simulator instances
    command += ' -parallel-testing-enabled NO';
    
    // Add result bundle path
    command += ` -resultBundlePath "${resultBundlePath}"`;
    
    command += ' test';
    
    // Pipe through xcbeautify for clean output
    command = `set -o pipefail && ${command} 2>&1 | xcbeautify`;
    
    logger.debug({ command }, 'Test command');
    
    // Use execAsync instead of spawn to ensure the xcresult is fully written when we get the result
    let output = '';
    let code = 0;
    
    try {
      logger.info('Running tests...');
      const { stdout, stderr } = await execAsync(command, {
        maxBuffer: 50 * 1024 * 1024, // 50MB buffer for large test outputs
        timeout: 1800000, // 10 minute timeout for tests
        shell: '/bin/bash'
      });
      
      output = stdout + (stderr ? '\n' + stderr : '');
    } catch (error: any) {
      // Test failure is expected, capture the output
      output = (error.stdout || '') + (error.stderr ? '\n' + error.stderr : '');
      code = error.code || 1;
      logger.debug({ code }, 'Tests completed with failures');
    }
    
    // Parse compile errors and warnings using the central parser
    const parsed = parseXcbeautifyOutput(output);
    
    // Save the full test output to logs
    const projectName = path.basename(projectPath, path.extname(projectPath));
    const logPath = LogManager.saveLog('test', output, projectName, {
      scheme,
      configuration,
      platform,
      exitCode: code,
      command,
      errors: parsed.errors.length > 0 ? parsed.errors : undefined,
      warnings: parsed.warnings.length > 0 ? parsed.warnings : undefined
    });
    logger.debug({ logPath }, 'Test output saved to log file');
    
    // Parse the xcresult bundle for accurate test results
    let testResult = { 
      passed: 0, 
      failed: 0, 
      success: false, 
      failingTests: undefined as Array<{ identifier: string; reason: string }> | undefined,
      logPath
    };
    
    // Try to extract the actual xcresult path from the output
    const resultMatch = output.match(/Test session results.*?\n\s*(.+\.xcresult)/);
    if (resultMatch) {
      resultBundlePath = resultMatch[1].trim();
      logger.debug({ resultBundlePath }, 'Found xcresult path in output');
    }
    
    // Also check for the "Writing result bundle at path" message
    const writingMatch = output.match(/Writing result bundle at path:\s*(.+\.xcresult)/);
    if (!resultMatch && writingMatch) {
      resultBundlePath = writingMatch[1].trim();
      logger.debug({ resultBundlePath }, 'Found xcresult path from Writing message');
    }
    
    try {
          // Check if xcresult exists and wait for it to be fully written
          // Wait for the xcresult bundle to be created and fully written (up to 10 seconds)
          let waitTime = 0;
          const maxWaitTime = 10000;
          const checkInterval = 200;
          
          // Check both that the directory exists and has the Info.plist file
          const isXcresultReady = () => {
            if (!existsSync(resultBundlePath)) {
              return false;
            }
            // Check if Info.plist exists inside the bundle, which indicates it's fully written
            const infoPlistPath = path.join(resultBundlePath, 'Info.plist');
            return existsSync(infoPlistPath);
          };
          
          while (!isXcresultReady() && waitTime < maxWaitTime) {
            await new Promise(resolve => setTimeout(resolve, checkInterval));
            waitTime += checkInterval;
          }
          
          if (!isXcresultReady()) {
            logger.warn({ resultBundlePath, waitTime }, 'xcresult bundle not ready after waiting, using fallback parsing');
            throw new Error('xcresult bundle not ready');
          }
          
          // Give xcresulttool a moment to prepare for reading
          await new Promise(resolve => setTimeout(resolve, 300));
          
          logger.debug({ resultBundlePath, waitTime }, 'xcresult bundle is ready');
          
          let testReportJson;
          let totalPassed = 0;
          let totalFailed = 0;
          const failingTests: Array<{ identifier: string; reason: string }> = [];
          
          try {
            // Try the new format first (Xcode 16+)
            logger.debug({ resultBundlePath }, 'Attempting to parse xcresult with new format');
            testReportJson = execSync(
              `xcrun xcresulttool get test-results summary --path "${resultBundlePath}"`,
              { encoding: 'utf8', maxBuffer: 50 * 1024 * 1024 }
            );
            
            const summary = JSON.parse(testReportJson);
            logger.debug({ summary: { passedTests: summary.passedTests, failedTests: summary.failedTests } }, 'Got summary from xcresulttool');
            
            // The summary counts are not reliable for mixed XCTest/Swift Testing
            // We'll count from the detailed test nodes instead
            
            // Always get the detailed tests to count accurately
            try {
                const testsJson = execSync(
                  `xcrun xcresulttool get test-results tests --path "${resultBundlePath}"`,
                  { encoding: 'utf8', maxBuffer: 50 * 1024 * 1024 }
                );
                const testsData = JSON.parse(testsJson);
                
                // Helper function to count tests and extract failing tests with reasons
                const processTestNodes = (node: any, parentName: string = ''): void => {
                  if (!node) return;
                  
                  // Count test cases (including argument variations)
                  if (node.nodeType === 'Test Case') {
                    // Check if this test has argument variations
                    let hasArguments = false;
                    if (node.children && Array.isArray(node.children)) {
                      for (const child of node.children) {
                        if (child.nodeType === 'Arguments') {
                          hasArguments = true;
                          // Each argument variation is a separate test
                          if (child.result === 'Passed') {
                            totalPassed++;
                          } else if (child.result === 'Failed') {
                            totalFailed++;
                          }
                        }
                      }
                    }
                    
                    // If no arguments, count the test case itself
                    if (!hasArguments) {
                      if (node.result === 'Passed') {
                        totalPassed++;
                      } else if (node.result === 'Failed') {
                        totalFailed++;
                        
                        // Extract failure information
                        let testName = node.nodeIdentifier || node.name || parentName;
                        let failureReason = '';
                        
                        // Look for failure message in children
                        if (node.children && Array.isArray(node.children)) {
                          for (const child of node.children) {
                            if (child.nodeType === 'Failure Message') {
                              failureReason = child.details || child.name || 'Test failed';
                              break;
                            }
                          }
                        }
                        
                        // Add test as an object with identifier and reason
                        failingTests.push({
                          identifier: testName,
                          reason: failureReason || 'Test failed (no details available)'
                        });
                      }
                    }
                  }
                  
                  // Recurse through children
                  if (node.children && Array.isArray(node.children)) {
                    for (const child of node.children) {
                      processTestNodes(child, node.name || parentName);
                    }
                  }
                };
                
                // Parse the test nodes to count tests and extract failing test names with reasons
                if (testsData.testNodes && Array.isArray(testsData.testNodes)) {
                  for (const testNode of testsData.testNodes) {
                    processTestNodes(testNode);
                  }
                }
            } catch (detailsError: any) {
              logger.debug({ error: detailsError.message }, 'Could not extract failing test details');
            }
            
          } catch (newFormatError: any) {
            // Fall back to legacy format
            logger.debug('Falling back to legacy xcresulttool format');
            testReportJson = execSync(
              `xcrun xcresulttool get test-report --legacy --format json --path "${resultBundlePath}"`,
              { encoding: 'utf8', maxBuffer: 50 * 1024 * 1024 }
            );
            
            const testReport = JSON.parse(testReportJson);
            
            // Parse the legacy test report structure
            if (testReport.tests) {
              const countTests = (tests: any[]): void => {
                for (const test of tests) {
                  if (test.subtests) {
                    // This is a test suite, recurse into it
                    countTests(test.subtests);
                  } else if (test.testStatus) {
                    // This is an actual test
                    if (test.testStatus === 'Success') {
                      totalPassed++;
                    } else if (test.testStatus === 'Failure' || test.testStatus === 'Expected Failure') {
                      totalFailed++;
                      // Extract test name and failure details
                      if (test.identifier) {
                        const failureReason = test.failureMessage || test.message || 'Test failed (no details available)';
                        failingTests.push({
                          identifier: test.identifier,
                          reason: failureReason
                        });
                      }
                    }
                  }
                }
              };
              
              countTests(testReport.tests);
            }
          }
          
          testResult = {
            passed: totalPassed,
            failed: totalFailed,
            success: totalFailed === 0 && code === 0,
            failingTests: failingTests.length > 0 ? failingTests : undefined,
            logPath
          };
          
          // Save debug data for successful parsing
          LogManager.saveDebugData('test-xcresult-parsed', {
            passed: totalPassed,
            failed: totalFailed,
            failingTests,
            resultBundlePath
          }, projectName);
          
          logger.info({ 
            projectPath, 
            ...testResult, 
            exitCode: code,
            resultBundlePath 
          }, 'Tests completed (parsed from xcresult)');
          
        } catch (parseError: any) {
          logger.error({ 
            error: parseError.message,
            resultBundlePath,
            xcresultExists: existsSync(resultBundlePath) 
          }, 'Failed to parse xcresult bundle');
          
          // Save debug info about the failure
          LogManager.saveDebugData('test-xcresult-parse-error', {
            error: parseError.message,
            resultBundlePath,
            exists: existsSync(resultBundlePath)
          }, projectName);
          
          // If xcresulttool fails, try to parse counts from the text output
          const passedMatch = output.match(/Executed (\d+) tests?, with (\d+) failures?/);
          if (passedMatch) {
            const totalTests = parseInt(passedMatch[1], 10);
            const failures = parseInt(passedMatch[2], 10);
            testResult = {
              passed: totalTests - failures,
              failed: failures,
              success: failures === 0,
              failingTests: undefined,
              logPath
            };
          } else {
            // Last resort fallback
            testResult = {
              passed: 0,
              failed: code === 0 ? 0 : 1,
              success: code === 0,
              failingTests: undefined,
              logPath
            };
          }
        }
        
    // Parse build errors from output
    // Errors are already parsed by xcbeautify parser
    
    const result = {
      ...testResult,
      success: code === 0 && testResult.failed === 0,
      output,
      errors: parsed.errors.length > 0 ? parsed.errors : undefined,
      warnings: parsed.warnings.length > 0 ? parsed.warnings : undefined
    };
    
    // Clean up the result bundle if tests passed (keep failed results for debugging)
    if (result.success) {
      try {
        rmSync(resultBundlePath, { recursive: true, force: true });
      } catch {
        // Ignore cleanup errors
      }
    }
    
    return result;
  }
  
  /**
   * Clean build artifacts
   */
  async clean(
    projectPath: string,
    isWorkspace: boolean,
    options: { scheme?: string; configuration?: string } = {}
  ): Promise<void> {
    const { scheme, configuration = 'Debug' } = options;
    
    const projectFlag = isWorkspace ? '-workspace' : '-project';
    let command = `xcodebuild ${projectFlag} "${projectPath}"`;
    
    if (scheme) {
      command += ` -scheme "${scheme}"`;
    }
    
    command += ` -configuration "${configuration}" clean`;
    
    logger.debug({ command }, 'Clean command');
    
    try {
      await execAsync(command);
      logger.info({ projectPath }, 'Clean succeeded');
    } catch (error: any) {
      logger.error({ error: error.message, projectPath }, 'Clean failed');
      throw new Error(`Clean failed: ${error.message}`);
    }
  }
}