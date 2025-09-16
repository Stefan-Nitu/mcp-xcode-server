import { execSync } from 'child_process';
import { createModuleLogger } from '../../../logger';

const logger = createModuleLogger('TestEnvironmentCleaner');

/**
 * Utility class for cleaning up test environment (simulators, processes, etc.)
 * Separate from TestProjectManager to maintain single responsibility
 */
export class TestEnvironmentCleaner {
  /**
   * Shutdown all running simulators
   * Faster than erasing simulators, just powers them off
   */
  static shutdownAllSimulators(): void {
    try {
      execSync('xcrun simctl shutdown all', { stdio: 'ignore' });
    } catch (error) {
      logger.debug('No simulators to shutdown or shutdown failed (normal)');
    }
  }

  /**
   * Kill a running macOS app by name
   * @param appName Name of the app process to kill
   */
  static killMacOSApp(appName: string): void {
    try {
      execSync(`pkill -f ${appName}`, { stdio: 'ignore' });
    } catch (error) {
      // Ignore errors - app might not be running
    }
  }

  /**
   * Kill the test project app if it's running on macOS
   */
  static killTestProjectApp(): void {
    this.killMacOSApp('TestProjectXCTest');
  }

  /**
   * Clean DerivedData and SPM build artifacts for test projects
   */
  static cleanDerivedData(): void {
    try {
      // Clean MCP-Xcode DerivedData location (where our tests actually write)
      // This includes Logs/Test/*.xcresult files
      execSync('rm -rf ~/Library/Developer/Xcode/DerivedData/MCP-Xcode/TestProjectSwiftTesting', { 
        shell: '/bin/bash',
        stdio: 'ignore' 
      });
      
      execSync('rm -rf ~/Library/Developer/Xcode/DerivedData/MCP-Xcode/TestProjectXCTest', { 
        shell: '/bin/bash',
        stdio: 'ignore' 
      });
      
      execSync('rm -rf ~/Library/Developer/Xcode/DerivedData/MCP-Xcode/TestSwiftPackage*', { 
        shell: '/bin/bash',
        stdio: 'ignore' 
      });
      
      // Also clean standard Xcode DerivedData locations (in case xcodebuild uses them directly)
      execSync('rm -rf ~/Library/Developer/Xcode/DerivedData/TestProjectSwiftTesting-*', { 
        shell: '/bin/bash',
        stdio: 'ignore' 
      });
      
      execSync('rm -rf ~/Library/Developer/Xcode/DerivedData/TestProjectXCTest-*', { 
        shell: '/bin/bash',
        stdio: 'ignore' 
      });
      
      execSync('rm -rf ~/Library/Developer/Xcode/DerivedData/TestSwiftPackage-*', { 
        shell: '/bin/bash',
        stdio: 'ignore' 
      });
      
      // Clean SPM .build directories in test artifacts
      const testArtifactsDir = process.cwd() + '/test_artifacts';
      execSync(`find ${testArtifactsDir} -name .build -type d -exec rm -rf {} + 2>/dev/null || true`, {
        shell: '/bin/bash',
        stdio: 'ignore'
      });
      
      // Clean .swiftpm directories
      execSync(`find ${testArtifactsDir} -name .swiftpm -type d -exec rm -rf {} + 2>/dev/null || true`, {
        shell: '/bin/bash',
        stdio: 'ignore'
      });
      
    } catch (error) {
      logger.debug('DerivedData cleanup failed or nothing to clean (normal)');
    }
  }

  /**
   * Full cleanup of test environment
   * Shuts down simulators, kills test apps, and cleans DerivedData
   */
  static cleanupTestEnvironment(): void {
    // Shutdown all simulators
    this.shutdownAllSimulators();
    
    // Kill any running test apps
    this.killTestProjectApp();
    
    // Clean DerivedData for test projects
    this.cleanDerivedData();
  }

  /**
   * Reset a specific simulator by erasing its contents
   * @param deviceId The simulator device ID to reset
   */
  static resetSimulator(deviceId: string): void {
    try {
      execSync(`xcrun simctl erase "${deviceId}"`);
    } catch (error: any) {
      // Log the actual error message for debugging
      logger.warn({ deviceId, error: error.message, stderr: error.stderr?.toString() }, 'Failed to erase simulator');
    }
  }

  /**
   * Boot a specific simulator
   * @param deviceId The simulator device ID to boot
   */
  static bootSimulator(deviceId: string): void {
    try {
      execSync(`xcrun simctl boot "${deviceId}"`, { stdio: 'ignore' });
    } catch (error) {
      logger.warn({ deviceId }, 'Simulator already booted or boot failed');
    }
  }

  /**
   * Shutdown a specific simulator
   * @param deviceId The simulator device ID to boot
   */
  static shutdownSimulator(deviceId: string): void {
    try {
      execSync(`xcrun simctl shutdown "${deviceId}"`, { stdio: 'ignore' });
    } catch (error) {
      logger.warn({ deviceId }, 'Simulator already booted or boot failed');
    }
  }
}