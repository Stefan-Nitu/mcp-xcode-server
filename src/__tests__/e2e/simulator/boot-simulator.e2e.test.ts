/**
 * E2E tests for BootSimulatorTool
 * Tests simulator booting functionality
 */

import { describe, test, expect, beforeAll, beforeEach, afterEach, afterAll } from '@jest/globals';
import { execSync } from 'child_process';
import { Client } from '@modelcontextprotocol/sdk/client/index';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio';
import { CallToolResultSchema } from '@modelcontextprotocol/sdk/types';
import { TestEnvironmentCleaner } from '../../utils/TestEnvironmentCleaner.js';
import { createAndConnectClient, cleanupClientAndTransport } from '../../utils/testHelpers.js';

describe('BootSimulatorTool E2E Tests', () => {
  let client: Client;
  let transport: StdioClientTransport;
  const bootedSimulators: string[] = [];
  
  beforeAll(async () => {
    // Build the server
    execSync('npm run build', { cwd: process.cwd() });
    
    // Shutdown all simulators to start with clean state
    TestEnvironmentCleaner.shutdownAllSimulators();
  }, 120000);
  
  afterAll(() => {
    // Clean up: shutdown any simulators we booted
    bootedSimulators.forEach(deviceId => {
      TestEnvironmentCleaner.resetSimulator(deviceId);
    });
  });
  
  beforeEach(async () => {
    const setup = await createAndConnectClient();
    client = setup.client;
    transport = setup.transport;
  }, 30000);
  
  afterEach(async () => {
    TestEnvironmentCleaner.cleanupTestEnvironment();
    
    await cleanupClientAndTransport(client, transport);
  });

  describe('Basic Booting', () => {
    test('should boot a simulator by UDID', async () => {
      // First, get a list of available simulators
      const listResponse = await client.request({
        method: 'tools/call',
        params: {
          name: 'list_simulators',
          arguments: {}
        }
      }, CallToolResultSchema);
      
      const devices = JSON.parse((listResponse.content[0] as any).text);
      const shutdownDevice = devices.find((d: any) => 
        d.state === 'Shutdown' && d.isAvailable && d.runtime.includes('iOS')
      );
      
      if (!shutdownDevice) {
        console.warn('No shutdown iOS simulators available for testing');
        return;
      }
      
      // Boot the simulator
      const response = await client.request({
        method: 'tools/call',
        params: {
          name: 'boot_simulator',
          arguments: {
            deviceId: shutdownDevice.udid
          }
        }
      }, CallToolResultSchema);
      
      expect(response).toBeDefined();
      expect(response.content[0].type).toBe('text');
      const text = (response.content[0] as any).text;
      expect(text).toContain('Successfully booted simulator');
      expect(text).toContain(shutdownDevice.udid);
      
      bootedSimulators.push(shutdownDevice.udid);
      
      // Verify the simulator is actually booted
      const verifyResponse = await client.request({
        method: 'tools/call',
        params: {
          name: 'list_simulators',
          arguments: {}
        }
      }, CallToolResultSchema);
      
      const verifyDevices = JSON.parse((verifyResponse.content[0] as any).text);
      const bootedDevice = verifyDevices.find((d: any) => d.udid === shutdownDevice.udid);
      expect(bootedDevice?.state).toBe('Booted');
    });

    test('should boot a simulator by name', async () => {
      // Get list of simulators
      const listResponse = await client.request({
        method: 'tools/call',
        params: {
          name: 'list_simulators',
          arguments: {}
        }
      }, CallToolResultSchema);
      
      const devices = JSON.parse((listResponse.content[0] as any).text);
      const shutdownDevice = devices.find((d: any) => 
        d.state === 'Shutdown' && d.isAvailable && d.name.includes('iPhone')
      );
      
      if (!shutdownDevice) {
        console.warn('No shutdown iPhone simulators available for testing');
        return;
      }
      
      // Boot by name
      const response = await client.request({
        method: 'tools/call',
        params: {
          name: 'boot_simulator',
          arguments: {
            deviceId: shutdownDevice.name
          }
        }
      }, CallToolResultSchema);
      
      expect(response).toBeDefined();
      const text = (response.content[0] as any).text;
      expect(text).toContain('Successfully booted simulator');
      
      bootedSimulators.push(shutdownDevice.udid);
    });
  });

  describe('Already Booted Handling', () => {
    test('should handle already booted simulator gracefully', async () => {
      // Get a booted simulator or boot one
      const listResponse = await client.request({
        method: 'tools/call',
        params: {
          name: 'list_simulators',
          arguments: {}
        }
      }, CallToolResultSchema);
      
      const devices = JSON.parse((listResponse.content[0] as any).text);
      let targetDevice = devices.find((d: any) => d.state === 'Booted');
      
      if (!targetDevice) {
        // Boot one first
        targetDevice = devices.find((d: any) => 
          d.state === 'Shutdown' && d.isAvailable
        );
        
        if (!targetDevice) {
          console.warn('No simulators available for testing');
          return;
        }
        
        await client.request({
          method: 'tools/call',
          params: {
            name: 'boot_simulator',
            arguments: {
              deviceId: targetDevice.udid
            }
          }
        }, CallToolResultSchema);
        
        bootedSimulators.push(targetDevice.udid);
      }
      
      // Try to boot the already booted simulator
      const response = await client.request({
        method: 'tools/call',
        params: {
          name: 'boot_simulator',
          arguments: {
            deviceId: targetDevice.udid
          }
        }
      }, CallToolResultSchema);
      
      expect(response).toBeDefined();
      const text = (response.content[0] as any).text;
      // Should either indicate success or that it's already booted
      expect(text.toLowerCase()).toMatch(/successfully booted|already booted/);
    });
  });

  describe('Error Handling', () => {
    test('should fail with missing deviceId', async () => {
      const response = await client.request({
        method: 'tools/call',
        params: {
          name: 'boot_simulator',
          arguments: {}
        }
      }, CallToolResultSchema);
      
      expect(response).toBeDefined();
      const text = (response.content[0] as any).text;
      expect(text.toLowerCase()).toContain('error');
      expect(text.toLowerCase()).toMatch(/required|missing/);
    });

    test('should fail with empty deviceId', async () => {
      const response = await client.request({
        method: 'tools/call',
        params: {
          name: 'boot_simulator',
          arguments: {
            deviceId: ''
          }
        }
      }, CallToolResultSchema);
      
      expect(response).toBeDefined();
      const text = (response.content[0] as any).text;
      expect(text.toLowerCase()).toContain('error');
    });

    test('should fail with non-existent device', async () => {
      const response = await client.request({
        method: 'tools/call',
        params: {
          name: 'boot_simulator',
          arguments: {
            deviceId: 'non-existent-device-12345'
          }
        }
      }, CallToolResultSchema);
      
      expect(response).toBeDefined();
      const text = (response.content[0] as any).text;
      expect(text.toLowerCase()).toContain('error');
      expect(text.toLowerCase()).toMatch(/invalid|not found|unable/);
    });
  });

  describe('Simulator App Opening', () => {
    test('should open Simulator.app when booting', async () => {
      // Get a shutdown simulator
      const listResponse = await client.request({
        method: 'tools/call',
        params: {
          name: 'list_simulators',
          arguments: {}
        }
      }, CallToolResultSchema);
      
      const devices = JSON.parse((listResponse.content[0] as any).text);
      const shutdownDevice = devices.find((d: any) => 
        d.state === 'Shutdown' && d.isAvailable
      );
      
      if (!shutdownDevice) {
        console.warn('No shutdown simulators available');
        return;
      }
      
      // Boot the simulator
      await client.request({
        method: 'tools/call',
        params: {
          name: 'boot_simulator',
          arguments: {
            deviceId: shutdownDevice.udid
          }
        }
      }, CallToolResultSchema);
      
      bootedSimulators.push(shutdownDevice.udid);
      
      // Check if Simulator.app is running
      let simulatorAppRunning = false;
      try {
        execSync('pgrep -x Simulator', { stdio: 'ignore' });
        simulatorAppRunning = true;
      } catch {
        simulatorAppRunning = false;
      }
      
      // We expect Simulator.app to be running after booting
      expect(simulatorAppRunning).toBe(true);
    });
  });

  describe('Multiple Simulators', () => {
    test('should boot multiple simulators sequentially', async () => {
      // Get list of simulators
      const listResponse = await client.request({
        method: 'tools/call',
        params: {
          name: 'list_simulators',
          arguments: {}
        }
      }, CallToolResultSchema);
      
      const devices = JSON.parse((listResponse.content[0] as any).text);
      const shutdownDevices = devices
        .filter((d: any) => d.state === 'Shutdown' && d.isAvailable)
        .slice(0, 2); // Get up to 2 devices
      
      if (shutdownDevices.length < 2) {
        console.warn('Not enough simulators for multiple boot test');
        return;
      }
      
      // Boot them sequentially
      for (const device of shutdownDevices) {
        const response = await client.request({
          method: 'tools/call',
          params: {
            name: 'boot_simulator',
            arguments: {
              deviceId: device.udid
            }
          }
        }, CallToolResultSchema);
        
        expect(response).toBeDefined();
        const text = (response.content[0] as any).text;
        expect(text).toContain('Successfully booted');
        
        bootedSimulators.push(device.udid);
      }
      
      // Verify all are booted
      const verifyResponse = await client.request({
        method: 'tools/call',
        params: {
          name: 'list_simulators',
          arguments: {}
        }
      }, CallToolResultSchema);
      
      const verifyDevices = JSON.parse((verifyResponse.content[0] as any).text);
      shutdownDevices.forEach((device: any) => {
        const bootedDevice = verifyDevices.find((d: any) => d.udid === device.udid);
        expect(bootedDevice?.state).toBe('Booted');
      });
    }, 30000);
  });

  describe('Performance', () => {
    test('should boot simulator within reasonable time', async () => {
      // Get a shutdown simulator
      const listResponse = await client.request({
        method: 'tools/call',
        params: {
          name: 'list_simulators',
          arguments: {}
        }
      }, CallToolResultSchema);
      
      const devices = JSON.parse((listResponse.content[0] as any).text);
      const shutdownDevice = devices.find((d: any) => 
        d.state === 'Shutdown' && d.isAvailable
      );
      
      if (!shutdownDevice) {
        console.warn('No shutdown simulators available');
        return;
      }
      
      const startTime = Date.now();
      
      const response = await client.request({
        method: 'tools/call',
        params: {
          name: 'boot_simulator',
          arguments: {
            deviceId: shutdownDevice.udid
          }
        }
      }, CallToolResultSchema);
      
      const duration = Date.now() - startTime;
      
      expect(response).toBeDefined();
      // Boot should complete within 30 seconds
      expect(duration).toBeLessThan(30000);
      
      bootedSimulators.push(shutdownDevice.udid);
    }, 30000);
  });
});