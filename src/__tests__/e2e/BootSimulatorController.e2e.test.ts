/**
 * E2E Test for BootSimulatorController
 * 
 * Tests the controller with REAL simulators and REAL system commands
 * Following testing philosophy: E2E tests for critical paths only (10%)
 * 
 * NO MOCKS - Uses real xcrun simctl commands with actual simulators
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { BootSimulatorController } from '../../presentation/controllers/BootSimulatorController.js';
import { BootSimulatorControllerFactory } from '../../factories/BootSimulatorControllerFactory.js';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

describe('BootSimulatorController E2E', () => {
  let controller: BootSimulatorController;
  let testSimulatorId: string;
  let testSimulatorName: string;
  
  beforeAll(async () => {
    // Create controller with REAL components
    controller = BootSimulatorControllerFactory.create();
    
    // Find or create a test simulator
    const listResult = await execAsync('xcrun simctl list devices --json');
    const devices = JSON.parse(listResult.stdout);
    
    // Look for an existing test simulator
    for (const runtime of Object.values(devices.devices) as any[]) {
      const testSim = runtime.find((d: any) => d.name.includes('TestSimulator-Boot'));
      if (testSim) {
        testSimulatorId = testSim.udid;
        testSimulatorName = testSim.name;
        break;
      }
    }
    
    // Create one if not found
    if (!testSimulatorId) {
      // Get available runtime
      const runtimesResult = await execAsync('xcrun simctl list runtimes --json');
      const runtimes = JSON.parse(runtimesResult.stdout);
      const iosRuntime = runtimes.runtimes.find((r: any) => r.platform === 'iOS');
      
      if (!iosRuntime) {
        throw new Error('No iOS runtime available. Please install Xcode with iOS simulator support.');
      }
      
      const createResult = await execAsync(
        `xcrun simctl create "TestSimulator-Boot" "com.apple.CoreSimulator.SimDeviceType.iPhone-15" "${iosRuntime.identifier}"`
      );
      testSimulatorId = createResult.stdout.trim();
      testSimulatorName = 'TestSimulator-Boot';
    }
  }, 30000);
  
  beforeEach(async () => {
    // Ensure simulator is shutdown before each test
    try {
      await execAsync(`xcrun simctl shutdown "${testSimulatorId}"`);
    } catch {
      // Ignore if already shutdown
    }
    // Wait for shutdown to complete
    await new Promise(resolve => setTimeout(resolve, 1000));
  });
  
  afterAll(async () => {
    // Shutdown the test simulator
    try {
      await execAsync(`xcrun simctl shutdown "${testSimulatorId}"`);
    } catch {
      // Ignore if already shutdown
    }
  });

  describe('boot real simulators', () => {
    it('should boot a shutdown simulator', async () => {
      // Act
      const result = await controller.execute({
        deviceId: testSimulatorName
      });
      
      // Assert
      expect(result.content[0].text).toBe(`✅ Successfully booted simulator: ${testSimulatorName} (${testSimulatorId})`);
      
      // Verify simulator is actually booted
      const listResult = await execAsync('xcrun simctl list devices --json');
      const devices = JSON.parse(listResult.stdout);
      let found = false;
      for (const runtime of Object.values(devices.devices) as any[]) {
        const device = runtime.find((d: any) => d.udid === testSimulatorId);
        if (device) {
          expect(device.state).toBe('Booted');
          found = true;
          break;
        }
      }
      expect(found).toBe(true);
    }, 30000);
    
    it('should handle already booted simulator', async () => {
      // Arrange - boot the simulator first
      await execAsync(`xcrun simctl boot "${testSimulatorId}"`);
      await new Promise(resolve => setTimeout(resolve, 2000)); // Wait for boot
      
      // Act
      const result = await controller.execute({
        deviceId: testSimulatorId
      });
      
      // Assert
      expect(result.content[0].text).toBe(`✅ Simulator already booted: ${testSimulatorName} (${testSimulatorId})`);
    }, 30000);
    
    it('should boot simulator by UUID', async () => {
      // Act - use UUID directly
      const result = await controller.execute({
        deviceId: testSimulatorId
      });
      
      // Assert
      expect(result.content[0].text).toBe(`✅ Successfully booted simulator: ${testSimulatorName} (${testSimulatorId})`);
    }, 30000);
  });

  describe('error handling with real simulators', () => {
    it('should fail when simulator does not exist', async () => {
      // Act
      const result = await controller.execute({
        deviceId: 'NonExistentSimulator-12345'
      });
      
      // Assert
      expect(result.content[0].text).toBe('❌ Simulator not found: NonExistentSimulator-12345');
    });
  });

  describe('input validation', () => {
    it('should reject empty deviceId', async () => {
      // Act
      const result = await controller.execute({
        deviceId: ''
      });
      
      // Assert
      expect(result.content[0].text).toBe('❌ Device ID cannot be empty');
    });
    
    it('should reject whitespace-only deviceId', async () => {
      // Act
      const result = await controller.execute({
        deviceId: '   '
      });
      
      // Assert
      expect(result.content[0].text).toBe('❌ Device ID cannot be whitespace only');
    });
  });
});