/**
 * Xcode build and test functionality
 * Single Responsibility: Building and testing projects
 */

import { exec as nodeExec, ExecException } from 'child_process';
import { promisify } from 'util';
import { existsSync } from 'fs';
import path from 'path';
import { BuildConfiguration, TestConfiguration, TestResult, Platform } from './types.js';
import { PlatformHandler } from './platformHandler.js';
import { SimulatorManager } from './simulatorManager.js';

// Type for the exec function and promisified version
export type ExecFunction = typeof nodeExec;
export type ExecAsyncFunction = (command: string, options?: any) => Promise<{ stdout: string; stderr: string }>;

/**
 * XcodeBuilder with dependency injection for testability
 */
export class XcodeBuilder {
  private static readonly DEFAULT_TIMEOUT = undefined; // No timeout for builds/tests
  private static readonly MAX_BUFFER = 10 * 1024 * 1024; // 10MB
  
  private readonly execAsync: ExecAsyncFunction;
  
  // Default instance for static method compatibility
  private static defaultInstance: XcodeBuilder;
  
  constructor(execFunc?: ExecFunction) {
    // Use provided exec or default to Node's exec
    const exec = execFunc || nodeExec;
    // Proper type assertion for promisified exec
    this.execAsync = promisify(exec) as unknown as ExecAsyncFunction;
  }
  
  /**
   * Get the default instance (singleton pattern)
   */
  private static getDefaultInstance(): XcodeBuilder {
    if (!XcodeBuilder.defaultInstance) {
      XcodeBuilder.defaultInstance = new XcodeBuilder();
    }
    return XcodeBuilder.defaultInstance;
  }

  /**
   * Build an Xcode project (instance method)
   */
  async buildProjectInstance(config: BuildConfiguration & { installApp?: boolean }): Promise<{ success: boolean; output: string; appPath?: string }> {
    const { projectPath, scheme, platform = Platform.iOS, deviceId, configuration = 'Debug' } = config;
    
    if (!existsSync(projectPath)) {
      throw new Error(`Project path does not exist: ${projectPath}`);
    }

    // Ensure simulator is booted if needed
    let bootedDevice = '';
    if (PlatformHandler.needsSimulator(platform)) {
      bootedDevice = await SimulatorManager.ensureSimulatorBooted(platform, deviceId);
    }

    const isWorkspace = projectPath.endsWith('.xcworkspace');
    const projectFlag = isWorkspace ? '-workspace' : '-project';
    
    let command = `xcodebuild ${projectFlag} "${projectPath}"`;
    
    if (scheme) {
      command += ` -scheme "${scheme}"`;
    }
    
    command += ` -configuration "${configuration}"`;
    
    // Add destination
    const destination = PlatformHandler.getDestination(platform, bootedDevice || deviceId);
    command += ` -destination '${destination}'`;
    
    command += ' -derivedDataPath ./DerivedData build';

    console.error(`Building project with command: ${command}`);
    
    try {
      const { stdout } = await this.execAsync(command, { maxBuffer: XcodeBuilder.MAX_BUFFER });
      
      // Try to find the built app
      const appPath = await this.findBuiltAppInstance(projectPath, scheme || 'App', configuration);
      
      // Install app if simulator was used and installApp is not false
      if (appPath && bootedDevice && config.installApp !== false) {
        await SimulatorManager.installApp(appPath, bootedDevice);
      }

      return {
        success: true,
        output: stdout,
        appPath: appPath || undefined
      };
    } catch (error: any) {
      throw new Error(`Failed to build project: ${error.message}`);
    }
  }

  /**
   * Test an Xcode project (instance method)
   */
  async testProjectInstance(config: TestConfiguration): Promise<TestResult> {
    const { 
      projectPath, 
      scheme, 
      platform = Platform.iOS, 
      deviceId, 
      configuration = 'Debug',
      testTarget,
      testFilter,
      parallelTesting = false
    } = config;
    
    if (!existsSync(projectPath)) {
      throw new Error(`Project path does not exist: ${projectPath}`);
    }

    // Ensure simulator is booted if needed
    let bootedDevice = '';
    if (PlatformHandler.needsSimulator(platform)) {
      bootedDevice = await SimulatorManager.ensureSimulatorBooted(platform, deviceId);
    }

    const isWorkspace = projectPath.endsWith('.xcworkspace');
    const projectFlag = isWorkspace ? '-workspace' : '-project';
    
    let command = `xcodebuild test ${projectFlag} "${projectPath}"`;
    
    if (scheme) {
      command += ` -scheme "${scheme}"`;
    }
    
    command += ` -configuration "${configuration}"`;
    
    // Add destination
    const destination = PlatformHandler.getDestination(platform, bootedDevice || deviceId);
    command += ` -destination '${destination}'`;
    
    // Add test target/filter if provided
    if (testTarget) {
      command += ` -only-testing:${testTarget}`;
    }
    if (testFilter && !testTarget) {
      command += ` -only-testing:${testFilter}`;
    } else if (testFilter && testTarget) {
      command += `/${testFilter}`;
    }
    
    // Add derived data path
    command += ' -derivedDataPath ./DerivedData';
    
    // Disable parallel testing if requested
    if (!parallelTesting) {
      command += ' -parallel-testing-enabled NO';
    }

    console.error(`Running tests with command: ${command}`);
    console.error(`Building and running tests... (this may take a while)`);
    
    try {
      const { stdout } = await this.execAsync(command, { 
        maxBuffer: XcodeBuilder.MAX_BUFFER
        // No timeout - let xcodebuild manage its own timeout
      });

      return XcodeBuilder.parseTestOutput(stdout);
    } catch (error: any) {
      const output = error.stdout || error.message;
      const testResult = XcodeBuilder.parseTestOutput(output);
      
      // Check if tests ran but some failed (non-zero exit code)
      if (error.stdout && error.stdout.includes('Executed')) {
        return {
          ...testResult,
          success: false
        };
      }
      
      // Build or other error
      throw new Error(`Failed to run tests: ${error.message}`);
    }
  }

  /**
   * Test a Swift Package Manager module (instance method)
   */
  async testSPMModuleInstance(
    packagePath: string,
    platform: Platform = Platform.macOS,
    testFilter?: string,
    osVersion?: string
  ): Promise<TestResult> {
    if (!existsSync(packagePath)) {
      throw new Error(`Package path does not exist: ${packagePath}`);
    }

    const packageFile = path.join(packagePath, 'Package.swift');
    if (!existsSync(packageFile)) {
      throw new Error(`No Package.swift found at: ${packagePath}`);
    }

    let command: string;

    if (platform === Platform.macOS) {
      // For macOS, use swift test directly
      command = `swift test --package-path "${packagePath}"`;
      if (testFilter) {
        command += ` --filter "${testFilter}"`;
      }
    } else {
      // For other platforms, use xcodebuild
      let destination = PlatformHandler.getDestination(platform);
      if (osVersion) {
        destination = destination.replace(')', `,OS=${osVersion})`);
      }

      command = `xcodebuild test -scheme "$(xcodebuild -list -json | jq -r '.project.schemes[0]')" -destination '${destination}' -enableCodeCoverage YES`;
      if (testFilter) {
        command += ` -only-testing:${testFilter}`;
      }
    }

    console.error(`Testing SPM module with command: ${command}`);

    try {
      const { stdout } = await this.execAsync(command, { 
        cwd: packagePath,
        maxBuffer: XcodeBuilder.MAX_BUFFER
      });

      return XcodeBuilder.parseTestOutput(stdout);
    } catch (error: any) {
      const output = error.stdout || error.message;
      return {
        ...XcodeBuilder.parseTestOutput(output),
        success: false,
        errors: error.message
      };
    }
  }

  /**
   * Find the built app in DerivedData (instance method)
   */
  private async findBuiltAppInstance(projectPath: string, scheme: string, configuration: string): Promise<string | null> {
    try {
      const derivedDataPath = './DerivedData';
      const { stdout } = await this.execAsync(`find "${derivedDataPath}" -name "*.app" -type d | head -1`);
      return stdout.trim() || null;
    } catch {
      return null;
    }
  }

  /**
   * Parse test output to extract results (static for easy testing)
   */
  static parseTestOutput(output: string): TestResult {
    const lines = output.split('\n');
    let testCount = 0;
    let failureCount = 0;
    let success = false;

    for (const line of lines) {
      // XCTest framework patterns
      if (line.includes('Test Suite') && line.includes('passed')) {
        success = true;
      }
      if (line.includes('Test Suite') && line.includes('failed')) {
        success = false;
      }
      
      // XCTest: "Executed N tests"
      const testMatch = line.match(/Executed (\d+) test/);
      if (testMatch) {
        testCount = parseInt(testMatch[1]);
      }
      
      // Swift Testing framework patterns (new framework in Xcode 16)
      // "✔ Test run with N test(s) passed"
      const swiftTestMatch = line.match(/Test run with (\d+) test/);
      if (swiftTestMatch) {
        testCount = parseInt(swiftTestMatch[1]);
        if (line.includes('passed')) {
          success = true;
        }
      }
      
      // XCTest failures
      const failureMatch = line.match(/(\d+) failure[s]?/);
      if (failureMatch) {
        failureCount = parseInt(failureMatch[1]);
      }
      
      // Swift Testing failures (look for ✗ symbol on individual test lines, not summary)
      if (line.includes('✗ Test') && line.includes('() failed')) {
        failureCount++;
      }
    }

    return {
      success,
      output, // Return FULL output - crucial for debugging in VS Code
      testCount,
      failureCount
    };
  }

  // Static methods for backward compatibility - delegate to default instance
  static async buildProject(config: BuildConfiguration & { installApp?: boolean }): Promise<{ success: boolean; output: string; appPath?: string }> {
    return XcodeBuilder.getDefaultInstance().buildProjectInstance(config);
  }

  static async testProject(config: TestConfiguration): Promise<TestResult> {
    return XcodeBuilder.getDefaultInstance().testProjectInstance(config);
  }

  static async testSPMModule(
    packagePath: string,
    platform: Platform = Platform.macOS,
    testFilter?: string,
    osVersion?: string
  ): Promise<TestResult> {
    return XcodeBuilder.getDefaultInstance().testSPMModuleInstance(packagePath, platform, testFilter, osVersion);
  }
}