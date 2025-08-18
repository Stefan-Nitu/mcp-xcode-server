/**
 * Xcode build and test functionality
 * Single Responsibility: Building and testing projects
 */

import { exec as nodeExec, ExecException } from 'child_process';
import { promisify } from 'util';
import { existsSync, rmSync } from 'fs';
import path from 'path';
import { BuildConfiguration, TestConfiguration, TestResult, Platform } from './types.js';
import { PlatformHandler } from './platformHandler.js';
import { SimulatorManager } from './simulatorManager.js';
import { createModuleLogger } from './logger.js';

const logger = createModuleLogger('XcodeBuilder');

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

    logger.info({ projectPath, scheme, platform, configuration }, 'Building project');
    logger.debug({ command }, 'Build command');
    
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
      logger.error({ error, projectPath, scheme }, 'Failed to build project');
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

    logger.info({ projectPath, scheme, platform, testTarget }, 'Running tests');
    logger.debug({ command }, 'Test command');
    
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
      logger.error({ error, projectPath, scheme }, 'Failed to run tests');
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

    logger.info({ packagePath, platform, testFilter }, 'Testing SPM module');
    logger.debug({ command }, 'SPM test command');

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
   * Clean build artifacts, DerivedData, or test results
   */
  async cleanProjectInstance(config: {
    projectPath?: string;
    scheme?: string;
    platform?: Platform;
    configuration?: string;
    cleanTarget?: 'build' | 'derivedData' | 'testResults' | 'all';
    derivedDataPath?: string;
  }): Promise<{ success: boolean; message: string }> {
    const { 
      projectPath, 
      scheme, 
      platform = Platform.iOS, 
      configuration = 'Debug',
      cleanTarget = 'build',
      derivedDataPath = './DerivedData'
    } = config;
    
    const messages: string[] = [];
    
    try {
      // Clean build folder using xcodebuild clean
      if (cleanTarget === 'build' || cleanTarget === 'all') {
        if (projectPath && existsSync(projectPath)) {
          const isWorkspace = projectPath.endsWith('.xcworkspace');
          const projectFlag = isWorkspace ? '-workspace' : '-project';
          
          let command = `xcodebuild clean ${projectFlag} "${projectPath}"`;
          
          if (scheme) {
            command += ` -scheme "${scheme}"`;
          }
          
          command += ` -configuration "${configuration}"`;
          
          logger.info({ projectPath, scheme, configuration }, 'Cleaning build folder');
          
          try {
            await this.execAsync(command);
            messages.push(`Cleaned build folder for ${scheme || path.basename(projectPath)}`);
          } catch (error: any) {
            logger.warn({ error, projectPath }, 'Failed to clean build folder');
            messages.push(`Warning: Could not clean build folder: ${error.message}`);
          }
        } else if (cleanTarget === 'build') {
          return {
            success: false,
            message: 'Project path required for cleaning build folder'
          };
        }
      }
      
      // Clean DerivedData folder
      if (cleanTarget === 'derivedData' || cleanTarget === 'testResults' || cleanTarget === 'all') {
        if (existsSync(derivedDataPath)) {
          if (cleanTarget === 'testResults') {
            // Only clean test results
            const testLogsPath = path.join(derivedDataPath, 'Logs', 'Test');
            if (existsSync(testLogsPath)) {
              rmSync(testLogsPath, { recursive: true, force: true });
              messages.push('Cleared test results');
              logger.info({ path: testLogsPath }, 'Cleared test results');
            } else {
              messages.push('No test results to clear');
            }
          } else {
            // Clean entire DerivedData
            rmSync(derivedDataPath, { recursive: true, force: true });
            messages.push(`Removed DerivedData at ${derivedDataPath}`);
            logger.info({ path: derivedDataPath }, 'Removed DerivedData');
          }
        } else {
          messages.push(`No DerivedData found at ${derivedDataPath}`);
        }
      }
      
      return {
        success: true,
        message: messages.length > 0 ? messages.join('. ') : 'Nothing to clean'
      };
      
    } catch (error: any) {
      logger.error({ error, projectPath, cleanTarget }, 'Failed to clean project');
      throw new Error(`Failed to clean project: ${error.message}`);
    }
  }

  /**
   * List available schemes in a project
   */
  async listSchemesInstance(projectPath: string, shared: boolean = true): Promise<string[]> {
    try {
      logger.info({ projectPath, shared }, 'Listing schemes');
      
      const projectType = projectPath.endsWith('.xcworkspace') ? 'workspace' : 'project';
      const projectFlag = projectType === 'workspace' ? '-workspace' : '-project';
      
      const { stdout } = await this.execAsync(
        `xcodebuild -list ${projectFlag} "${projectPath}" -json`
      );
      
      const data = JSON.parse(stdout);
      const schemes: string[] = [];
      
      // Get schemes from the project/workspace
      if (data.project?.schemes) {
        schemes.push(...data.project.schemes);
      }
      if (data.workspace?.schemes) {
        schemes.push(...data.workspace.schemes);
      }
      
      logger.info({ schemes: schemes.length }, 'Found schemes');
      return schemes;
    } catch (error: any) {
      logger.error({ error, projectPath }, 'Failed to list schemes');
      throw new Error(`Failed to list schemes: ${error.message}`);
    }
  }

  /**
   * Get build settings for a scheme
   */
  async getBuildSettingsInstance(
    projectPath: string,
    scheme: string,
    configuration?: string,
    platform?: Platform
  ): Promise<Record<string, string>> {
    try {
      logger.info({ projectPath, scheme, configuration, platform }, 'Getting build settings');
      
      const projectType = projectPath.endsWith('.xcworkspace') ? 'workspace' : 'project';
      const projectFlag = projectType === 'workspace' ? '-workspace' : '-project';
      
      let command = `xcodebuild -showBuildSettings ${projectFlag} "${projectPath}" -scheme "${scheme}"`;
      
      if (configuration) {
        command += ` -configuration "${configuration}"`;
      }
      
      if (platform) {
        const destination = PlatformHandler.getDestination(platform);
        command += ` -destination "${destination}"`;
      }
      
      const { stdout } = await this.execAsync(command);
      
      // Parse build settings
      const settings: Record<string, string> = {};
      const lines = stdout.split('\n');
      
      for (const line of lines) {
        const match = line.match(/^\s{4}(\w+)\s*=\s*(.*)$/);
        if (match) {
          settings[match[1]] = match[2];
        }
      }
      
      logger.info({ settingsCount: Object.keys(settings).length }, 'Retrieved build settings');
      return settings;
    } catch (error: any) {
      logger.error({ error, projectPath, scheme }, 'Failed to get build settings');
      throw new Error(`Failed to get build settings: ${error.message}`);
    }
  }

  /**
   * Get project information (bundle ID, version, etc.)
   */
  async getProjectInfoInstance(projectPath: string): Promise<any> {
    try {
      logger.info({ projectPath }, 'Getting project info');
      
      const projectType = projectPath.endsWith('.xcworkspace') ? 'workspace' : 'project';
      const projectFlag = projectType === 'workspace' ? '-workspace' : '-project';
      
      // Get list output in JSON format
      const { stdout } = await this.execAsync(
        `xcodebuild -list ${projectFlag} "${projectPath}" -json`
      );
      
      const data = JSON.parse(stdout);
      
      const info = {
        name: data.project?.name || data.workspace?.name,
        schemes: data.project?.schemes || data.workspace?.schemes || [],
        targets: data.project?.targets || [],
        configurations: data.project?.configurations || []
      };
      
      logger.info({ info }, 'Retrieved project info');
      return info;
    } catch (error: any) {
      logger.error({ error, projectPath }, 'Failed to get project info');
      throw new Error(`Failed to get project info: ${error.message}`);
    }
  }

  /**
   * List targets in a project
   */
  async listTargetsInstance(projectPath: string): Promise<string[]> {
    try {
      logger.info({ projectPath }, 'Listing targets');
      
      const projectType = projectPath.endsWith('.xcworkspace') ? 'workspace' : 'project';
      const projectFlag = projectType === 'workspace' ? '-workspace' : '-project';
      
      const { stdout } = await this.execAsync(
        `xcodebuild -list ${projectFlag} "${projectPath}" -json`
      );
      
      const data = JSON.parse(stdout);
      const targets = data.project?.targets || [];
      
      logger.info({ targets: targets.length }, 'Found targets');
      return targets;
    } catch (error: any) {
      logger.error({ error, projectPath }, 'Failed to list targets');
      throw new Error(`Failed to list targets: ${error.message}`);
    }
  }

  /**
   * Archive a project
   */
  async archiveProjectInstance(
    projectPath: string,
    scheme: string,
    platform: Platform,
    configuration: string,
    archivePath?: string
  ): Promise<string> {
    try {
      logger.info({ projectPath, scheme, platform, configuration }, 'Archiving project');
      
      const projectType = projectPath.endsWith('.xcworkspace') ? 'workspace' : 'project';
      const projectFlag = projectType === 'workspace' ? '-workspace' : '-project';
      
      // Default archive path if not specified
      const finalArchivePath = archivePath || 
        `${process.env.HOME}/Library/Developer/Xcode/Archives/${new Date().toISOString().split('T')[0]}/${scheme}.xcarchive`;
      
      let command = `xcodebuild archive ${projectFlag} "${projectPath}" -scheme "${scheme}" -configuration "${configuration}" -archivePath "${finalArchivePath}"`;
      
      // Add platform-specific destination
      const destination = PlatformHandler.getDestination(platform);
      command += ` -destination "${destination}"`;
      
      const { stdout } = await this.execAsync(command, { maxBuffer: 50 * 1024 * 1024 });
      
      logger.info({ archivePath: finalArchivePath }, 'Archive created successfully');
      return finalArchivePath;
    } catch (error: any) {
      logger.error({ error, projectPath, scheme }, 'Failed to archive project');
      throw new Error(`Failed to archive project: ${error.message}`);
    }
  }

  /**
   * Export IPA from archive
   */
  async exportIPAInstance(
    archivePath: string,
    exportPath?: string,
    exportMethod: string = 'development'
  ): Promise<string> {
    try {
      logger.info({ archivePath, exportMethod }, 'Exporting IPA');
      
      const finalExportPath = exportPath || `${process.cwd()}/Export`;
      
      // Create export options plist
      const exportOptionsPlist = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>method</key>
    <string>${exportMethod}</string>
    <key>compileBitcode</key>
    <false/>
</dict>
</plist>`;
      
      // Write export options to temp file
      const fs = require('fs');
      const tempPlistPath = `/tmp/exportOptions-${Date.now()}.plist`;
      fs.writeFileSync(tempPlistPath, exportOptionsPlist);
      
      try {
        const { stdout } = await this.execAsync(
          `xcodebuild -exportArchive -archivePath "${archivePath}" -exportPath "${finalExportPath}" -exportOptionsPlist "${tempPlistPath}"`
        );
        
        // Clean up temp file
        fs.unlinkSync(tempPlistPath);
        
        logger.info({ exportPath: finalExportPath }, 'IPA exported successfully');
        return finalExportPath;
      } catch (error) {
        // Clean up temp file on error
        fs.unlinkSync(tempPlistPath);
        throw error;
      }
    } catch (error: any) {
      logger.error({ error, archivePath }, 'Failed to export IPA');
      throw new Error(`Failed to export IPA: ${error.message}`);
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

  static async cleanProject(config: {
    projectPath?: string;
    scheme?: string;
    platform?: Platform;
    configuration?: string;
    cleanTarget?: 'build' | 'derivedData' | 'testResults' | 'all';
    derivedDataPath?: string;
  }): Promise<{ success: boolean; message: string }> {
    return XcodeBuilder.getDefaultInstance().cleanProjectInstance(config);
  }
}