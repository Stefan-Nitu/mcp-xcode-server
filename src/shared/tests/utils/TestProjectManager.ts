import { existsSync, rmSync, readdirSync, statSync } from 'fs';
import { join, resolve } from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { createModuleLogger } from '../../../logger';
import { config } from '../../../config';
import { TestEnvironmentCleaner } from './TestEnvironmentCleaner';
import { gitResetTestArtifacts } from './gitResetTestArtifacts';

const execAsync = promisify(exec);

const logger = createModuleLogger('TestProjectManager');

export class TestProjectManager {
  private testArtifactsDir: string;
  private xcodeProjectPath: string;
  private xcodeProjectSwiftTestingPath: string;
  private swiftPackageXCTestPath: string;
  private swiftPackageSwiftTestingPath: string;
  private workspacePath: string;
  private watchOSProjectPath: string;

  constructor() {
    // Use the actual test artifacts directory
    this.testArtifactsDir = resolve(process.cwd(), 'test_artifacts');
    
    // Set up paths to real test projects
    // Xcode projects
    this.xcodeProjectPath = join(this.testArtifactsDir, 'TestProjectXCTest', 'TestProjectXCTest.xcodeproj');
    this.xcodeProjectSwiftTestingPath = join(this.testArtifactsDir, 'TestProjectSwiftTesting', 'TestProjectSwiftTesting.xcodeproj');
    
    // Swift packages
    this.swiftPackageXCTestPath = join(this.testArtifactsDir, 'TestSwiftPackageXCTest');
    this.swiftPackageSwiftTestingPath = join(this.testArtifactsDir, 'TestSwiftPackageSwiftTesting');
    
    // Workspace and other projects
    this.workspacePath = join(this.testArtifactsDir, 'Test.xcworkspace');
    this.watchOSProjectPath = join(this.testArtifactsDir, 'TestProjectWatchOS', 'TestProjectWatchOS.xcodeproj');
  }

  get paths() {
    return {
      testProjectDir: this.testArtifactsDir,
      // Xcode projects
      xcodeProjectXCTestDir: join(this.testArtifactsDir, 'TestProjectXCTest'),
      xcodeProjectXCTestPath: this.xcodeProjectPath,
      xcodeProjectSwiftTestingDir: join(this.testArtifactsDir, 'TestProjectSwiftTesting'),
      xcodeProjectSwiftTestingPath: this.xcodeProjectSwiftTestingPath,
      // Swift packages
      swiftPackageXCTestDir: this.swiftPackageXCTestPath, // Default to XCTest for backward compat
      swiftPackageSwiftTestingDir: this.swiftPackageSwiftTestingPath,
      // Other
      workspaceDir: this.testArtifactsDir,
      derivedDataPath: join(this.testArtifactsDir, 'DerivedData'),
      workspacePath: this.workspacePath,
      watchOSProjectPath: this.watchOSProjectPath,
      watchOSProjectDir: join(this.testArtifactsDir, 'TestProjectWatchOS')
    };
  }

  get schemes() {
    return {
      xcodeProject: 'TestProjectXCTest',
      xcodeProjectSwiftTesting: 'TestProjectSwiftTesting',
      workspace: 'TestProjectXCTest',  // The workspace uses the same scheme
      swiftPackageXCTest: 'TestSwiftPackageXCTest',
      swiftPackageSwiftTesting: 'TestSwiftPackageSwiftTesting',
      watchOSProject: 'TestProjectWatchOS Watch App'  // The watchOS app scheme
    };
  }

  get targets() {
    return {
      xcodeProject: {
        app: 'TestProjectXCTest',
        unitTests: 'TestProjectXCTestTests',
        uiTests: 'TestProjectXCTestUITests'
      },
      xcodeProjectSwiftTesting: {
        app: 'TestProjectSwiftTesting',
        unitTests: 'TestProjectSwiftTestingTests',
        uiTests: 'TestProjectSwiftTestingUITests'
      },
      watchOSProject: {
        app: 'TestProjectWatchOS Watch App',
        tests: 'TestProjectWatchOS Watch AppTests'
      }
    };
  }

  async setup() {
    // Clean up any leftover build artifacts before starting
    this.cleanBuildArtifacts();
  }

  /**
   * Build a test app for simulator testing
   * Uses optimized settings to avoid hanging on code signing or large output
   * @param projectType Which test project to build (defaults to 'xcodeProject')
   * @returns Path to the built .app bundle
   */
  async buildApp(projectType: 'xcodeProject' | 'xcodeProjectSwiftTesting' | 'watchOSProject' = 'xcodeProject'): Promise<string> {
    let projectPath: string;
    let scheme: string;

    switch (projectType) {
      case 'xcodeProject':
        projectPath = this.xcodeProjectPath;
        scheme = this.schemes.xcodeProject;
        break;
      case 'xcodeProjectSwiftTesting':
        projectPath = this.xcodeProjectSwiftTestingPath;
        scheme = this.schemes.xcodeProjectSwiftTesting;
        break;
      case 'watchOSProject':
        projectPath = this.watchOSProjectPath;
        scheme = this.schemes.watchOSProject;
        break;
    }

    // Build with optimized settings for testing
    // Use generic/platform but with ONLY_ACTIVE_ARCH to build for current architecture only
    await execAsync(
      `xcodebuild -project "${projectPath}" ` +
      `-scheme "${scheme}" ` +
      `-configuration Debug ` +
      `-destination 'generic/platform=iOS Simulator' ` +
      `-derivedDataPath "${this.paths.derivedDataPath}" ` +
      `ONLY_ACTIVE_ARCH=YES ` +
      `CODE_SIGNING_ALLOWED=NO ` +
      `CODE_SIGNING_REQUIRED=NO ` +
      `build`,
      { maxBuffer: 50 * 1024 * 1024 }
    );

    // Find the built app
    const findResult = await execAsync(
      `find "${this.paths.derivedDataPath}" -name "*.app" -type d | head -1`
    );
    const appPath = findResult.stdout.trim();

    if (!appPath || !existsSync(appPath)) {
      throw new Error('Failed to find built app');
    }

    return appPath;
  }

  private cleanBuildArtifacts() {
    // Clean DerivedData
    TestEnvironmentCleaner.cleanupTestEnvironment()
    
    // Clean .build directories (for SPM)
    const buildDirs = [
      join(this.swiftPackageXCTestPath, '.build'),
      join(this.swiftPackageSwiftTestingPath, '.build'),
      join(this.testArtifactsDir, '.build')
    ];

    buildDirs.forEach(dir => {
      if (existsSync(dir)) {
        rmSync(dir, { recursive: true, force: true });
      }
    });

    // Clean xcresult bundles (test results)
    this.cleanTestResults();

    // Clean any .swiftpm directories
    const swiftpmDirs = this.findDirectories(this.testArtifactsDir, '.swiftpm');
    swiftpmDirs.forEach(dir => {
      rmSync(dir, { recursive: true, force: true });
    });

    // Clean build folders in Xcode projects
    const xcodeProjects = [
      join(this.testArtifactsDir, 'TestProjectXCTest'),
      join(this.testArtifactsDir, 'TestProjectSwiftTesting'),
      join(this.testArtifactsDir, 'TestProjectWatchOS')
    ];

    xcodeProjects.forEach(projectDir => {
      const buildDir = join(projectDir, 'build');
      if (existsSync(buildDir)) {
        rmSync(buildDir, { recursive: true, force: true });
      }
    });
  }

  cleanTestResults() {
    // Find and remove all .xcresult bundles
    const xcresultFiles = this.findFiles(this.testArtifactsDir, '.xcresult');
    xcresultFiles.forEach(file => {
      rmSync(file, { recursive: true, force: true });
    });

    // Clean test output files
    const testOutputFiles = [
      join(this.swiftPackageXCTestPath, 'test-output.txt'),
      join(this.swiftPackageSwiftTestingPath, 'test-output.txt'),
      join(this.testArtifactsDir, 'test-results.json')
    ];

    testOutputFiles.forEach(file => {
      if (existsSync(file)) {
        rmSync(file, { force: true });
      }
    });
  }

  cleanup() {
    // Use git to restore test_artifacts to pristine state
    gitResetTestArtifacts();
    
    // ALWAYS clean build artifacts including MCP-Xcode DerivedData
    this.cleanBuildArtifacts();
    
    // Also clean DerivedData in project root
    const projectDerivedData = join(process.cwd(), 'DerivedData');
    if (existsSync(projectDerivedData)) {
      rmSync(projectDerivedData, { recursive: true, force: true });
    }
  }

  private findFiles(dir: string, extension: string): string[] {
    const results: string[] = [];
    
    if (!existsSync(dir)) {
      return results;
    }

    try {
      const files = readdirSync(dir);
      
      for (const file of files) {
        const fullPath = join(dir, file);
        const stat = statSync(fullPath);
        
        if (stat.isDirectory()) {
          // Skip hidden directories and node_modules
          if (!file.startsWith('.') && file !== 'node_modules') {
            results.push(...this.findFiles(fullPath, extension));
          }
        } else if (file.endsWith(extension)) {
          results.push(fullPath);
        }
      }
    } catch (error) {
      logger.error({ error, dir }, 'Error scanning directory');
    }
    
    return results;
  }

  private findDirectories(dir: string, name: string): string[] {
    const results: string[] = [];
    
    if (!existsSync(dir)) {
      return results;
    }

    try {
      const files = readdirSync(dir);
      
      for (const file of files) {
        const fullPath = join(dir, file);
        const stat = statSync(fullPath);
        
        if (stat.isDirectory()) {
          if (file === name) {
            results.push(fullPath);
          } else if (!file.startsWith('.') && file !== 'node_modules') {
            // Recursively search subdirectories
            results.push(...this.findDirectories(fullPath, name));
          }
        }
      }
    } catch (error) {
      logger.error({ error, dir }, 'Error scanning directory');
    }
    
    return results;
  }
}