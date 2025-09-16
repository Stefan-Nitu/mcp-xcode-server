/**
 * E2E Test for ShutdownSimulatorController
 * 
 * Tests the controller with REAL simulators and REAL system commands
 * Following testing philosophy: E2E tests for critical paths only (10%)
 * 
 * NO MOCKS - Uses real xcrun simctl commands with actual simulators
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { MCPController } from '../../../../presentation/interfaces/MCPController.js';
import { ShutdownSimulatorControllerFactory } from '../../factories/ShutdownSimulatorControllerFactory.js';
import { exec } from 'child_process';
import { promisify } from 'util';
import { bootAndWaitForSimulator } from '../../../../shared/tests/utils/testHelpers.js';

const execAsync = promisify(exec);

describe('ShutdownSimulatorController E2E', () => {
  let controller: MCPController;
  let testDeviceId: string;
  let testSimulatorName: string;
  
  beforeAll(async () => {
    // Create controller with REAL components
    controller = ShutdownSimulatorControllerFactory.create();
    
    // Find or create a test simulator
    const listResult = await execAsync('xcrun simctl list devices --json');
    const devices = JSON.parse(listResult.stdout);
    
    // Look for an existing test simulator
    for (const runtime of Object.values(devices.devices) as any[]) {
      const testSim = runtime.find((d: any) => d.name.includes('TestSimulator-Shutdown'));
      if (testSim) {
        testDeviceId = testSim.udid;
        testSimulatorName = testSim.name;
        break;
      }
    }
    
    // Create one if not found
    if (!testDeviceId) {
      // Get available runtime
      const runtimesResult = await execAsync('xcrun simctl list runtimes --json');
      const runtimes = JSON.parse(runtimesResult.stdout);
      const iosRuntime = runtimes.runtimes.find((r: any) => r.platform === 'iOS');
      
      if (!iosRuntime) {
        throw new Error('No iOS runtime available. Please install Xcode with iOS simulator support.');
      }
      
      const createResult = await execAsync(
        `xcrun simctl create "TestSimulator-Shutdown" "com.apple.CoreSimulator.SimDeviceType.iPhone-15" "${iosRuntime.identifier}"`
      );
      testDeviceId = createResult.stdout.trim();
      testSimulatorName = 'TestSimulator-Shutdown';
    }
  });
  
  beforeEach(async () => {
    // Boot simulator before each test (to ensure we can shut it down)
    await bootAndWaitForSimulator(testDeviceId, 30);
  });
  
  afterAll(async () => {
    // Cleanup: shutdown the test simulator
    try {
      await execAsync(`xcrun simctl shutdown "${testDeviceId}"`);
    } catch {
      // Ignore if already shutdown
    }
  });

  describe('shutdown real simulators', () => {
    it('should shutdown a booted simulator', async () => {
      // Act
      const result = await controller.execute({
        deviceId: testSimulatorName
      });
      
      // Assert
      expect(result.content[0].text).toBe(`✅ Successfully shutdown simulator: ${testSimulatorName} (${testDeviceId})`);
      
      // Verify simulator is actually shutdown
      const listResult = await execAsync('xcrun simctl list devices --json');
      const devices = JSON.parse(listResult.stdout);
      let found = false;
      for (const runtime of Object.values(devices.devices) as any[]) {
        const device = runtime.find((d: any) => d.udid === testDeviceId);
        if (device) {
          expect(device.state).toBe('Shutdown');
          found = true;
          break;
        }
      }
      expect(found).toBe(true);
    });

    it('should handle already shutdown simulator', async () => {
      // Arrange - shutdown simulator first
      await execAsync(`xcrun simctl shutdown "${testDeviceId}"`);
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Act
      const result = await controller.execute({
        deviceId: testSimulatorName
      });
      
      // Assert
      expect(result.content[0].text).toBe(`✅ Simulator already shutdown: ${testSimulatorName} (${testDeviceId})`);
    });

    it('should shutdown simulator by UUID', async () => {
      // Act
      const result = await controller.execute({
        deviceId: testDeviceId
      });
      
      // Assert
      expect(result.content[0].text).toBe(`✅ Successfully shutdown simulator: ${testSimulatorName} (${testDeviceId})`);
      
      // Verify simulator is actually shutdown
      const listResult = await execAsync('xcrun simctl list devices --json');
      const devices = JSON.parse(listResult.stdout);
      let found = false;
      for (const runtime of Object.values(devices.devices) as any[]) {
        const device = runtime.find((d: any) => d.udid === testDeviceId);
        if (device) {
          expect(device.state).toBe('Shutdown');
          found = true;
          break;
        }
      }
      expect(found).toBe(true);
    });
  });

  describe('error handling', () => {
    it('should handle non-existent simulator', async () => {
      // Act
      const result = await controller.execute({
        deviceId: 'NonExistent-Simulator-That-Does-Not-Exist'
      });
      
      // Assert
      expect(result.content[0].text).toBe('❌ Simulator not found: NonExistent-Simulator-That-Does-Not-Exist');
    });
  });

  describe('complex scenarios', () => {
    it('should shutdown simulator that was booting', async () => {
      // Arrange - boot and immediately try to shutdown
      const bootPromise = execAsync(`xcrun simctl boot "${testDeviceId}"`);
      
      // Act - shutdown while booting
      const result = await controller.execute({
        deviceId: testSimulatorName
      });
      
      // Assert
      expect(result.content[0].text).toContain('✅');
      expect(result.content[0].text).toContain(testSimulatorName);
      
      // Wait for operations to complete
      try {
        await bootPromise;
      } catch {
        // Boot might fail if shutdown interrupted it, that's OK
      }
      
      // Verify final state is shutdown
      const listResult = await execAsync('xcrun simctl list devices --json');
      const devices = JSON.parse(listResult.stdout);
      for (const runtime of Object.values(devices.devices) as any[]) {
        const device = runtime.find((d: any) => d.udid === testDeviceId);
        if (device) {
          expect(device.state).toBe('Shutdown');
          break;
        }
      }
    });
  });
});