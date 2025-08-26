import { execAsync } from '../../utils.js';
import { createModuleLogger } from '../../logger.js';
import { existsSync, readFileSync, unlinkSync } from 'fs';
import { tmpdir } from 'os';
import path from 'path';

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
   * Build a Swift package
   */
  async build(
    packagePath: string,
    options: SwiftBuildOptions = {}
  ): Promise<{ success: boolean; output: string }> {
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
      
      logger.info({ packagePath, configuration }, 'Build succeeded');
      
      return {
        success: true,
        output
      };
    } catch (error: any) {
      logger.error({ error: error.message, packagePath }, 'Build failed');
      
      // Return error output for debugging
      const output = (error.stdout || '') + (error.stderr ? `\n${error.stderr}` : '');
      throw new Error(`Build failed: ${error.message}\n${output}`);
    }
  }
  
  /**
   * Run a Swift package executable
   */
  async run(
    packagePath: string,
    options: SwiftRunOptions = {}
  ): Promise<{ success: boolean; output: string }> {
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
      
      logger.info({ packagePath, executable }, 'Run succeeded');
      
      return {
        success: true,
        output
      };
    } catch (error: any) {
      logger.error({ error: error.message, packagePath }, 'Run failed');
      
      // Return error output
      const output = (error.stdout || '') + (error.stderr ? `\n${error.stderr}` : '');
      throw new Error(`Run failed: ${error.message}\n${output}`);
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
    failingTests?: string[];
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
    
    // Add xunit output for XCTest results
    command += ` --xunit-output "${xunitPath}"`;
    
    logger.debug({ command, xunitPath }, 'Test command with xunit output');
    
    let testResult = { passed: 0, failed: 0, success: false, failingTests: undefined as string[] | undefined };
    
    try {
      const { stdout, stderr } = await execAsync(command, {
        maxBuffer: 10 * 1024 * 1024
      });
      
      const output = stdout + (stderr ? `\n${stderr}` : '');
      
      // Parse xunit XML if it exists
      if (existsSync(xunitPath)) {
        try {
          const xmlContent = readFileSync(xunitPath, 'utf8');
          logger.debug({ xunitPath }, 'Found xunit output file');
          
          // Parse the xunit XML
          const testsMatch = xmlContent.match(/tests="(\d+)"/);
          const failuresMatch = xmlContent.match(/failures="(\d+)"/);
          
          if (testsMatch && failuresMatch) {
            const totalTests = parseInt(testsMatch[1], 10);
            const failures = parseInt(failuresMatch[1], 10);
            testResult.passed = totalTests - failures;
            testResult.failed = failures;
            testResult.success = failures === 0;
            
            // Extract failing test names
            const failingTestMatches = xmlContent.matchAll(/testcase[^>]+name="([^"]+)"[^>]*>\s*<failure/g);
            const failingTests: string[] = [];
            for (const match of failingTestMatches) {
              failingTests.push(match[1]);
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
      
      return {
        ...testResult,
        output
      };
    } catch (error: any) {
      logger.error({ error: error.message, packagePath }, 'Tests failed');
      
      // Try to parse xunit output even on failure
      const output = (error.stdout || '') + (error.stderr ? `\n${error.stderr}` : '');
      
      if (existsSync(xunitPath)) {
        try {
          const xmlContent = readFileSync(xunitPath, 'utf8');
          
          // Parse the xunit XML
          const testsMatch = xmlContent.match(/tests="(\d+)"/);
          const failuresMatch = xmlContent.match(/failures="(\d+)"/);
          
          if (testsMatch && failuresMatch) {
            const totalTests = parseInt(testsMatch[1], 10);
            const failures = parseInt(failuresMatch[1], 10);
            testResult.passed = totalTests - failures;
            testResult.failed = failures;
            
            // Extract failing test names
            const failingTestMatches = xmlContent.matchAll(/testcase[^>]+name="([^"]+)"[^>]*>\s*<failure/g);
            const failingTests: string[] = [];
            for (const match of failingTestMatches) {
              failingTests.push(match[1]);
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
      
      return {
        ...testResult,
        success: false,
        output
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