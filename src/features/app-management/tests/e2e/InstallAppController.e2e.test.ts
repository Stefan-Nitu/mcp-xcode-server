/**
 * E2E Test for InstallAppController
 * 
 * Tests CRITICAL USER PATH with REAL simulators:
 * - Can the controller actually install apps on real simulators?
 * - Does it properly validate inputs through Clean Architecture layers?
 * - Does error handling work with real simulator failures?
 * 
 * NO MOCKS - uses real simulators and real test apps
 * This is an E2E test (10% of test suite) for critical user journeys
 * 
 * NOTE: This test requires Xcode and iOS simulators to be installed
 * It may be skipped in CI environments without proper setup
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { MCPController } from '../../../../presentation/interfaces/MCPController.js';
import { InstallAppControllerFactory } from '../../factories/InstallAppControllerFactory.js';
import { TestProjectManager } from '../../../../__tests__/utils/TestProjectManager.js';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';
import { SimulatorState } from '../../../simulator/domain/SimulatorState.js';
import { bootAndWaitForSimulator } from '../../../../__tests__/utils/testHelpers.js';

const execAsync = promisify(exec);

describe('InstallAppController E2E', () => {
  let controller: MCPController;
  let testManager: TestProjectManager;
  let testDeviceId: string;
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
    
    // Get the latest iOS runtime
    const runtimesResult = await execAsync('xcrun simctl list runtimes --json');
    const runtimes = JSON.parse(runtimesResult.stdout);
    const iosRuntime = runtimes.runtimes.find((r: { platform: string }) => r.platform === 'iOS');
    
    if (!iosRuntime) {
      throw new Error('No iOS runtime found. Please install an iOS simulator runtime.');
    }
    
    // Create and boot a test simulator
    const createResult = await execAsync(
      `xcrun simctl create "TestSimulator-InstallApp" "iPhone 15" "${iosRuntime.identifier}"`
    );
    testDeviceId = createResult.stdout.trim();
    
    // Boot the simulator and wait for it to be ready
    await bootAndWaitForSimulator(testDeviceId, 30);
  });
  
  afterAll(async () => {
    // Clean up simulator
    if (testDeviceId) {
      try {
        await execAsync(`xcrun simctl shutdown "${testDeviceId}"`);
        await execAsync(`xcrun simctl delete "${testDeviceId}"`);
      } catch (error) {
        // Ignore cleanup errors
      }
    }
    
    // Clean up test project
    await testManager.cleanup();
  });
  
  beforeEach(() => {
    // Create controller with all real dependencies
    controller = InstallAppControllerFactory.create();
  });

  describe('install real apps on simulators', () => {
    it('should successfully install app on booted simulator', async () => {
      // Arrange - simulator is already booted from beforeAll
      
      // Act
      const result = await controller.execute({
        appPath: testAppPath,
        simulatorId: testDeviceId
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
        `xcrun simctl listapps "${testDeviceId}" | grep -i test || true`
      );
      expect(listAppsResult.stdout).toBeTruthy();
    });

    it('should install app on booted simulator when no ID specified', async () => {
      // Arrange - ensure our test simulator is the only booted one
      const devicesResult = await execAsync('xcrun simctl list devices --json');
      const devices = JSON.parse(devicesResult.stdout);
      
      // Shutdown all other booted simulators
      interface Device {
        state: string;
        udid: string;
      }
      for (const runtime of Object.values(devices.devices) as Device[][]) {
        for (const device of runtime) {
          if (device.state === SimulatorState.Booted && device.udid !== testDeviceId) {
            await execAsync(`xcrun simctl shutdown "${device.udid}"`);
          }
        }
      }
      
      // Act - install without specifying simulator ID
      const result = await controller.execute({
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
    });

    it('should boot and install when simulator is shutdown', async () => {
      // Arrange - get iOS runtime for creating simulator
      const runtimesResult = await execAsync('xcrun simctl list runtimes --json');
      const runtimes = JSON.parse(runtimesResult.stdout);
      const iosRuntime = runtimes.runtimes.find((r: { platform: string }) => r.platform === 'iOS');

      // Create a new shutdown simulator
      const createResult = await execAsync(
        `xcrun simctl create "TestSimulator-Shutdown" "iPhone 14" "${iosRuntime.identifier}"`
      );
      const shutdownSimId = createResult.stdout.trim();

      try {
        // Act
        const result = await controller.execute({
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
        expect(stateResult.stdout.trim()).toBe(SimulatorState.Booted);
      } finally {
        // Clean up
        await execAsync(`xcrun simctl shutdown "${shutdownSimId}" || true`);
        await execAsync(`xcrun simctl delete "${shutdownSimId}"`);
      }
    }, 300000);
  });

  describe('error handling with real simulators', () => {
    it('should fail when app path does not exist', async () => {
      // Arrange
      const nonExistentPath = '/path/that/does/not/exist.app';
      
      // Act
      const result = await controller.execute({
        appPath: nonExistentPath,
        simulatorId: testDeviceId
      });
      
      // Assert - error message from xcrun simctl install (multi-line in real E2E)
      expect(result.content[0].text).toContain('❌');
      expect(result.content[0].text).toContain('No such file or directory');  
    });

    it('should fail when app path is not an app bundle', async () => {
      // Arrange - use a regular file instead of .app
      const invalidAppPath = testManager.paths.xcodeProjectXCTestPath;
      
      // Act
      const result = await controller.execute({
        appPath: invalidAppPath,
        simulatorId: testDeviceId
      });
      
      // Assert - validation error formatted with ❌
      expect(result.content[0].text).toBe('❌ App path must end with .app');
    });

    it('should fail when simulator does not exist', async () => {
      // Arrange
      const nonExistentSimulator = 'non-existent-simulator-id';
      
      // Act
      const result = await controller.execute({
        appPath: testAppPath,
        simulatorId: nonExistentSimulator
      });
      
      // Assert
      expect(result.content[0].text).toBe('❌ Simulator not found: non-existent-simulator-id');
    });

    it('should fail when no booted simulator and no ID specified', async () => {
      // Arrange - shutdown all simulators
      await execAsync('xcrun simctl shutdown all');
      
      try {
        // Act
        const result = await controller.execute({
          appPath: testAppPath
        });
        
        // Assert
        expect(result.content[0].text).toBe('❌ No booted simulator found. Please boot a simulator first or specify a simulator ID.');
      } finally {
        // Re-boot our test simulator for other tests
        await execAsync(`xcrun simctl boot "${testDeviceId}"`);
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
    });
  });

  describe('input validation', () => {
    it('should reject invalid app paths', async () => {
      // Act - path traversal attempt triggers multiple validation errors
      const result = await controller.execute({
        appPath: '../../../etc/passwd',
        simulatorId: testDeviceId
      });
      
      // Assert - domain validation fails fast on first error
      expect(result.content[0].text).toBe('❌ App path cannot contain directory traversal');
    });

    it('should handle simulator specified by name', async () => {
      // Act - use simulator name instead of UUID
      const result = await controller.execute({
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