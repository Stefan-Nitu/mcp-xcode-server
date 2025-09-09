/**
 * Integration Test for InstallAppTool
 * 
 * Tests BEHAVIOR with REAL simulator interactions:
 * - Can the tool actually install apps on real simulators?
 * - Does it properly validate inputs through Clean Architecture layers?
 * - Does error handling work with real simulator failures?
 * 
 * NO MOCKS - uses real simulators and real test apps
 * Direct tool calls - does NOT test through MCP protocol
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { InstallAppTool } from '../../../tools/InstallAppTool.js';
import { createInstallAppTool } from '../../../factories/InstallAppToolFactory.js';
import { TestProjectManager } from '../../utils/TestProjectManager.js';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';

const execAsync = promisify(exec);

describe('InstallAppTool Integration', () => {
  let tool: InstallAppTool;
  let testManager: TestProjectManager;
  let testSimulatorId: string;
  let testAppPath: string;
  
  beforeAll(async () => {
    // Set up test project with built app
    testManager = new TestProjectManager();
    await testManager.setup();
    
    // Build the test app first
    const buildResult = await execAsync(
      `xcodebuild -project "${testManager.paths.xcodeProjectXCTestPath}" ` +
      `-scheme TestProjectXCTest ` +
      `-configuration Debug ` +
      `-destination 'generic/platform=iOS Simulator' ` +
      `-derivedDataPath "${testManager.paths.derivedDataPath}" ` +
      `build`,
      { maxBuffer: 50 * 1024 * 1024 }
    );
    
    // Find the built app
    const findResult = await execAsync(
      `find "${testManager.paths.derivedDataPath}" -name "*.app" -type d | head -1`
    );
    testAppPath = findResult.stdout.trim();
    
    if (!testAppPath || !fs.existsSync(testAppPath)) {
      throw new Error('Failed to build test app');
    }
    
    // Create and boot a test simulator
    const createResult = await execAsync(
      `xcrun simctl create "TestSimulator-InstallApp" "iPhone 15" "iOS"`
    );
    testSimulatorId = createResult.stdout.trim();
    
    // Boot the simulator
    await execAsync(`xcrun simctl boot "${testSimulatorId}"`);
    
    // Wait for boot to complete
    await new Promise(resolve => setTimeout(resolve, 5000));
  }, 120000); // Building and booting can take time
  
  afterAll(async () => {
    // Clean up simulator
    if (testSimulatorId) {
      try {
        await execAsync(`xcrun simctl shutdown "${testSimulatorId}"`);
        await execAsync(`xcrun simctl delete "${testSimulatorId}"`);
      } catch (error) {
        // Ignore cleanup errors
      }
    }
    
    // Clean up test project
    await testManager.cleanup();
  });
  
  beforeEach(() => {
    // Create tool with all real dependencies
    tool = createInstallAppTool();
  });

  describe('install real apps on simulators', () => {
    it('should successfully install app on booted simulator', async () => {
      // Arrange - simulator is already booted from beforeAll
      
      // Act
      const result = await tool.execute({
        appPath: testAppPath,
        simulatorId: testSimulatorId
      });

      // Assert
      expect(result).toMatchObject({
        content: expect.arrayContaining([
          expect.objectContaining({
            type: 'text',
            text: expect.stringContaining('Successfully installed')
          })
        ])
      });
      
      // Verify app is actually installed
      const listAppsResult = await execAsync(
        `xcrun simctl listapps "${testSimulatorId}" | grep -i test || true`
      );
      expect(listAppsResult.stdout).toBeTruthy();
    }, 30000);

    it('should install app on booted simulator when no ID specified', async () => {
      // Arrange - ensure our test simulator is the only booted one
      const devicesResult = await execAsync('xcrun simctl list devices --json');
      const devices = JSON.parse(devicesResult.stdout);
      
      // Shutdown all other booted simulators
      for (const runtime of Object.values(devices.devices) as any[]) {
        for (const device of runtime) {
          if (device.state === 'Booted' && device.udid !== testSimulatorId) {
            await execAsync(`xcrun simctl shutdown "${device.udid}"`);
          }
        }
      }
      
      // Act - install without specifying simulator ID
      const result = await tool.execute({
        appPath: testAppPath
      });

      // Assert
      expect(result).toMatchObject({
        content: expect.arrayContaining([
          expect.objectContaining({
            type: 'text',
            text: expect.stringContaining('Successfully installed')
          })
        ])
      });
    }, 30000);

    it('should boot and install when simulator is shutdown', async () => {
      // Arrange - create a new shutdown simulator
      const createResult = await execAsync(
        `xcrun simctl create "TestSimulator-Shutdown" "iPhone 14" "iOS"`
      );
      const shutdownSimId = createResult.stdout.trim();
      
      try {
        // Act
        const result = await tool.execute({
          appPath: testAppPath,
          simulatorId: shutdownSimId
        });

        // Assert
        expect(result).toMatchObject({
          content: expect.arrayContaining([
            expect.objectContaining({
              type: 'text',
              text: expect.stringContaining('Successfully installed')
            })
          ])
        });
        
        // Verify simulator was booted
        const stateResult = await execAsync(
          `xcrun simctl list devices --json | jq -r '.devices[][] | select(.udid=="${shutdownSimId}") | .state'`
        );
        expect(stateResult.stdout.trim()).toBe('Booted');
      } finally {
        // Clean up
        await execAsync(`xcrun simctl shutdown "${shutdownSimId}" || true`);
        await execAsync(`xcrun simctl delete "${shutdownSimId}"`);
      }
    }, 30000);
  });

  describe('error handling with real simulators', () => {
    it('should fail when app path does not exist', async () => {
      // Arrange
      const nonExistentPath = '/path/that/does/not/exist.app';
      
      // Act & Assert
      await expect(tool.execute({
        appPath: nonExistentPath,
        simulatorId: testSimulatorId
      })).rejects.toThrow('does not exist');
    });

    it('should fail when app path is not an app bundle', async () => {
      // Arrange - use a regular file instead of .app
      const invalidAppPath = testManager.paths.xcodeProjectXCTestPath;
      
      // Act & Assert
      await expect(tool.execute({
        appPath: invalidAppPath,
        simulatorId: testSimulatorId
      })).rejects.toThrow();
    });

    it('should fail when simulator does not exist', async () => {
      // Arrange
      const nonExistentSimulator = 'non-existent-simulator-id';
      
      // Act & Assert
      await expect(tool.execute({
        appPath: testAppPath,
        simulatorId: nonExistentSimulator
      })).rejects.toThrow('not found');
    });

    it('should fail when no booted simulator and no ID specified', async () => {
      // Arrange - shutdown all simulators
      await execAsync('xcrun simctl shutdown all');
      
      try {
        // Act & Assert
        await expect(tool.execute({
          appPath: testAppPath
        })).rejects.toThrow('No booted simulator');
      } finally {
        // Re-boot our test simulator for other tests
        await execAsync(`xcrun simctl boot "${testSimulatorId}"`);
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
    });
  });

  describe('input validation', () => {
    it('should reject invalid app paths', async () => {
      // Act & Assert - path traversal attempt
      await expect(tool.execute({
        appPath: '../../../etc/passwd',
        simulatorId: testSimulatorId
      })).rejects.toThrow();
    });

    it('should handle simulator specified by name', async () => {
      // Act - use simulator name instead of UUID
      const result = await tool.execute({
        appPath: testAppPath,
        simulatorId: 'TestSimulator-InstallApp'
      });

      // Assert
      expect(result).toMatchObject({
        content: expect.arrayContaining([
          expect.objectContaining({
            type: 'text',
            text: expect.stringContaining('Successfully installed')
          })
        ])
      });
    });
  });
});