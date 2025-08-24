import { existsSync, rmSync, readdirSync, statSync } from 'fs';
import { join, resolve } from 'path';
import { createModuleLogger } from '../../logger';
import { config } from '../../config';

const logger = createModuleLogger('TestProjectManager');

export class TestProjectManager {
  private testArtifactsDir: string;
  private xcodeProjectPath: string;
  private swiftPackagePath: string;
  private workspacePath: string;
  private watchOSProjectPath: string;

  constructor() {
    // Use the actual test artifacts directory
    this.testArtifactsDir = resolve(process.cwd(), 'test_artifacts');
    
    // Set up paths to real test projects
    this.xcodeProjectPath = join(this.testArtifactsDir, 'TestProjectXCTest', 'TestProjectXCTest.xcodeproj');
    this.swiftPackagePath = join(this.testArtifactsDir, 'TestSPM');
    this.workspacePath = join(this.testArtifactsDir, 'Test.xcworkspace');
    this.watchOSProjectPath = join(this.testArtifactsDir, 'TestProjectWatchOS', 'TestProjectWatchOS.xcodeproj');
  }

  get paths() {
    return {
      testProjectDir: this.testArtifactsDir,
      xcodeProjectDir: join(this.testArtifactsDir, 'TestProjectXCTest'),
      swiftPackageDir: this.swiftPackagePath,
      workspaceDir: this.testArtifactsDir,
      derivedDataPath: join(this.testArtifactsDir, 'DerivedData'),
      xcodeProjectPath: this.xcodeProjectPath,
      workspacePath: this.workspacePath,
      watchOSProjectPath: this.watchOSProjectPath,
      watchOSProjectDir: join(this.testArtifactsDir, 'TestProjectWatchOS')
    };
  }

  get schemes() {
    return {
      xcodeProject: 'TestProjectXCTest',
      workspace: 'TestProjectXCTest',  // The workspace uses the same scheme
      swiftPackage: 'TestSPM',  // SPM packages use their package name as the scheme
      watchOSProject: 'TestProjectWatchOS Watch App'  // The watchOS app scheme
    };
  }

  async setup() {
    // Clean up any leftover build artifacts before starting
    this.cleanBuildArtifacts();
  }

  private cleanBuildArtifacts() {
    // Clean DerivedData
    const derivedDataPaths = [
      join(this.testArtifactsDir, 'DerivedData'),
      join(process.cwd(), 'DerivedData'),
      './DerivedData',
      // Clean new MCP-Xcode DerivedData location from config
      config.derivedDataBasePath
    ];

    derivedDataPaths.forEach(path => {
      if (existsSync(path)) {
        logger.debug({ path }, 'Cleaning DerivedData');
        rmSync(path, { recursive: true, force: true });
      }
    });

    // Clean .build directories (for SPM)
    const buildDirs = [
      join(this.swiftPackagePath, '.build'),
      join(this.testArtifactsDir, '.build')
    ];

    buildDirs.forEach(dir => {
      if (existsSync(dir)) {
        logger.debug({ dir }, 'Cleaning build directory');
        rmSync(dir, { recursive: true, force: true });
      }
    });

    // Clean xcresult bundles (test results)
    this.cleanTestResults();

    // Clean any .swiftpm directories
    const swiftpmDirs = this.findDirectories(this.testArtifactsDir, '.swiftpm');
    swiftpmDirs.forEach(dir => {
      logger.debug({ dir }, 'Cleaning .swiftpm directory');
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
        logger.debug({ buildDir }, 'Cleaning Xcode build directory');
        rmSync(buildDir, { recursive: true, force: true });
      }
    });
  }

  cleanTestResults() {
    // Find and remove all .xcresult bundles
    const xcresultFiles = this.findFiles(this.testArtifactsDir, '.xcresult');
    xcresultFiles.forEach(file => {
      logger.debug({ file }, 'Cleaning test result');
      rmSync(file, { recursive: true, force: true });
    });

    // Clean test output files
    const testOutputFiles = [
      join(this.swiftPackagePath, 'test-output.txt'),
      join(this.testArtifactsDir, 'test-results.json')
    ];

    testOutputFiles.forEach(file => {
      if (existsSync(file)) {
        logger.debug({ file }, 'Cleaning test output');
        rmSync(file, { force: true });
      }
    });
  }

  cleanup() {
    // Use git to restore test_artifacts to pristine state
    try {
      // Remove all untracked files and directories in test_artifacts
      const { execSync } = require('child_process');
      
      logger.debug('Restoring test_artifacts to pristine state');
      
      // Remove untracked files and directories (build artifacts)
      execSync('git clean -fdx test_artifacts/', { 
        cwd: resolve(process.cwd()),
        stdio: 'pipe'
      });
      
      // Reset any modified tracked files
      execSync('git checkout -- test_artifacts/', { 
        cwd: resolve(process.cwd()),
        stdio: 'pipe'
      });
      
      logger.debug('Test artifacts cleaned successfully');
    } catch (error) {
      logger.warn({ error }, 'Failed to use git clean');
    }
    
    // ALWAYS clean build artifacts including MCP-Xcode DerivedData
    this.cleanBuildArtifacts();
    
    // Also clean DerivedData in project root
    const projectDerivedData = join(process.cwd(), 'DerivedData');
    if (existsSync(projectDerivedData)) {
      logger.debug({ path: projectDerivedData }, 'Cleaning project DerivedData');
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