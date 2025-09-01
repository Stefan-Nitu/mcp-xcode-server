/**
 * E2E tests for BootSimulatorTool
 * Tests real simulator booting functionality that cannot be unit tested
 */

import { describe, test, expect, beforeAll, beforeEach, afterEach, afterAll } from '@jest/globals';
import { execSync } from 'child_process';
import { Client } from '@modelcontextprotocol/sdk/client/index';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio';
import { CallToolResultSchema } from '@modelcontextprotocol/sdk/types';
import { createAndConnectClient, cleanupClientAndTransport } from '../../utils/testHelpers.js';
import { TestEnvironmentCleaner } from '../../utils/TestEnvironmentCleaner.js';

describe('BootSimulatorTool E2E Tests', () => {
  let client: Client;
  let transport: StdioClientTransport;
  let bootedSimulators: string[] = [];
  
  beforeAll(async () => {
    // Build the server
    execSync('npm run build', { cwd: process.cwd() });
    
    // Shutdown all simulators to start with clean state
    TestEnvironmentCleaner.shutdownAllSimulators();
  }, 180000);
  
  beforeEach(async () => {
    const setup = await createAndConnectClient();
    client = setup.client;
    transport = setup.transport;
  }, 180000);
  
  afterEach(async () => {
    await cleanupClientAndTransport(client, transport);
  });
  
  afterAll(() => {
    // Cleanup: shutdown any simulators we booted
    for (const deviceId of bootedSimulators) {
      try {
        TestEnvironmentCleaner.shutdownSimulator(deviceId);
      } catch (error) {
        console.warn(`Failed to shutdown simulator ${deviceId}:`, error);
      }
    }
  });

  describe('Core Functionality', () => {
    test('should boot a real simulator by UDID', async () => {
      // First, get a list of available simulators
      const listResponse = await client.request({
        method: 'tools/call',
        params: {
          name: 'list_simulators',
          arguments: {}
        }
      }, CallToolResultSchema, { timeout: 180000 });
      
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
      }, CallToolResultSchema, { timeout: 180000 });
      
      expect(response).toBeDefined();
      const text = (response.content[0] as any).text;
      expect(text).toContain('Successfully booted simulator');
      expect(text).toContain(shutdownDevice.name);
      
      bootedSimulators.push(shutdownDevice.udid);
      
      // Verify the simulator is actually booted
      const verifyResponse = await client.request({
        method: 'tools/call',
        params: {
          name: 'list_simulators',
          arguments: {}
        }
      }, CallToolResultSchema, { timeout: 180000 });
      
      const updatedDevices = JSON.parse((verifyResponse.content[0] as any).text);
      const bootedDevice = updatedDevices.find((d: any) => d.udid === shutdownDevice.udid);
      expect(bootedDevice.state).toBe('Booted');
    }, 30000);

    test('should handle already booted simulator gracefully', async () => {
      // Get a booted simulator or boot one
      const listResponse = await client.request({
        method: 'tools/call',
        params: {
          name: 'list_simulators',
          arguments: {}
        }
      }, CallToolResultSchema, { timeout: 180000 });
      
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
        }, CallToolResultSchema, { timeout: 180000 });
        
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
      }, CallToolResultSchema, { timeout: 180000 });
      
      expect(response).toBeDefined();
      const text = (response.content[0] as any).text;
      // Should either indicate success or that it's already booted
      expect(text.toLowerCase()).toMatch(/successfully booted|already booted/);
    }, 30000);

    test('should handle invalid deviceId gracefully', async () => {
      const response = await client.request({
        method: 'tools/call',
        params: {
          name: 'boot_simulator',
          arguments: {
            deviceId: 'NON-EXISTENT-DEVICE-UUID'
          }
        }
      }, CallToolResultSchema, { timeout: 180000 });
      
      const text = (response.content[0] as any).text;
      expect(text).toContain('Error');
      expect(text.toLowerCase()).toMatch(/device not found|invalid device|unable to find/);
    }, 30000);
  });
});