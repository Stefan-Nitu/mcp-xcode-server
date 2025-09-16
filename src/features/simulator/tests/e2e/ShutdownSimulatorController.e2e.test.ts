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
import { TestSimulatorManager } from '../../../../shared/tests/utils/TestSimulatorManager.js';

const execAsync = promisify(exec);

describe('ShutdownSimulatorController E2E', () => {
  let controller: MCPController;
  let testSimManager: TestSimulatorManager;
  
  beforeAll(async () => {
    // Create controller with REAL components
    controller = ShutdownSimulatorControllerFactory.create();

    // Set up test simulator
    testSimManager = new TestSimulatorManager();
    await testSimManager.getOrCreateSimulator('TestSimulator-Shutdown');
  });
  
  beforeEach(async () => {
    // Boot simulator before each test (to ensure we can shut it down)
    await testSimManager.bootAndWait(30);
  });
  
  afterAll(async () => {
    // Cleanup test simulator
    await testSimManager.cleanup();
  });

  describe('shutdown real simulators', () => {
    it('should shutdown a booted simulator', async () => {
      // Act
      const result = await controller.execute({
        deviceId: testSimManager.getSimulatorName()
      });
      
      // Assert
      expect(result.content[0].text).toBe(`✅ Successfully shutdown simulator: ${testSimManager.getSimulatorName()} (${testSimManager.getSimulatorId()})`);
      
      // Verify simulator is actually shutdown
      const listResult = await execAsync('xcrun simctl list devices --json');
      const devices = JSON.parse(listResult.stdout);
      let found = false;
      for (const runtime of Object.values(devices.devices) as any[]) {
        const device = runtime.find((d: any) => d.udid === testSimManager.getSimulatorId());
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
      await testSimManager.shutdownAndWait(5);
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Act
      const result = await controller.execute({
        deviceId: testSimManager.getSimulatorName()
      });
      
      // Assert
      expect(result.content[0].text).toBe(`✅ Simulator already shutdown: ${testSimManager.getSimulatorName()} (${testSimManager.getSimulatorId()})`);
    });

    it('should shutdown simulator by UUID', async () => {
      // Act
      const result = await controller.execute({
        deviceId: testSimManager.getSimulatorId()
      });
      
      // Assert
      expect(result.content[0].text).toBe(`✅ Successfully shutdown simulator: ${testSimManager.getSimulatorName()} (${testSimManager.getSimulatorId()})`);
      
      // Verify simulator is actually shutdown
      const listResult = await execAsync('xcrun simctl list devices --json');
      const devices = JSON.parse(listResult.stdout);
      let found = false;
      for (const runtime of Object.values(devices.devices) as any[]) {
        const device = runtime.find((d: any) => d.udid === testSimManager.getSimulatorId());
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
      const bootPromise = testSimManager.bootAndWait(30);
      
      // Act - shutdown while booting
      const result = await controller.execute({
        deviceId: testSimManager.getSimulatorName()
      });
      
      // Assert
      expect(result.content[0].text).toContain('✅');
      expect(result.content[0].text).toContain(testSimManager.getSimulatorName());
      
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
        const device = runtime.find((d: any) => d.udid === testSimManager.getSimulatorId());
        if (device) {
          expect(device.state).toBe('Shutdown');
          break;
        }
      }
    });
  });
});