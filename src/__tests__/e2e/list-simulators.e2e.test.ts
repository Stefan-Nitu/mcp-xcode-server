/**
 * E2E tests for ListSimulatorsTool
 * Tests simulator listing functionality with various filters
 * Note: Tests are designed to be robust against changing simulator configurations
 */

import { describe, test, expect, beforeAll, beforeEach, afterEach, afterAll } from '@jest/globals';
import { execSync } from 'child_process';
import { Client } from '@modelcontextprotocol/sdk/client/index';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio';
import { CallToolResultSchema } from '@modelcontextprotocol/sdk/types';
import { createAndConnectClient, cleanupClientAndTransport } from '../utils/testHelpers.js';
import { TestEnvironmentCleaner } from '../utils/TestEnvironmentCleaner.js';

describe('ListSimulatorsTool E2E Tests', () => {
  let client: Client;
  let transport: StdioClientTransport;
  
  beforeAll(async () => {
    // Build the server
    execSync('npm run build', { cwd: process.cwd() });
  }, 120000);
  
  beforeEach(async () => {
    const setup = await createAndConnectClient();
    client = setup.client;
    transport = setup.transport;
  }, 30000);
  
  afterEach(async () => {
    TestEnvironmentCleaner.cleanupTestEnvironment();
    
    await cleanupClientAndTransport(client, transport);
  });

  afterAll(() => {
    TestEnvironmentCleaner.cleanupTestEnvironment();
  });

  describe('Basic Listing', () => {
    test('should list simulators and return valid structure', async () => {
      const response = await client.request({
        method: 'tools/call',
        params: {
          name: 'list_simulators',
          arguments: {}
        }
      }, CallToolResultSchema);
      
      expect(response).toBeDefined();
      expect(response.content).toBeDefined();
      expect(response.content[0].type).toBe('text');
      
      const devices = JSON.parse((response.content[0] as any).text);
      expect(Array.isArray(devices)).toBe(true);
      
      // If there are devices, verify structure
      if (devices.length > 0) {
        const device = devices[0];
        expect(device).toHaveProperty('name');
        expect(device).toHaveProperty('udid');
        expect(device).toHaveProperty('state');
        expect(device).toHaveProperty('runtime');
        expect(device).toHaveProperty('deviceTypeIdentifier');
        expect(device).toHaveProperty('isAvailable');
        
        // Verify types
        expect(typeof device.name).toBe('string');
        expect(typeof device.udid).toBe('string');
        expect(typeof device.state).toBe('string');
        expect(typeof device.runtime).toBe('string');
        expect(typeof device.deviceTypeIdentifier).toBe('string');
        expect(typeof device.isAvailable).toBe('boolean');
        
        // State should be one of known values
        expect(['Shutdown', 'Booted', 'Booting', 'Shutting Down']).toContain(device.state);
      }
      
      // By default should only show available devices
      devices.forEach((d: any) => {
        expect(d.isAvailable).toBe(true);
      });
    }, 30000);

    test('should show all simulators including unavailable when requested', async () => {
      const availableResponse = await client.request({
        method: 'tools/call',
        params: {
          name: 'list_simulators',
          arguments: {
            showAll: false
          }
        }
      }, CallToolResultSchema);
      
      const allResponse = await client.request({
        method: 'tools/call',
        params: {
          name: 'list_simulators',
          arguments: {
            showAll: true
          }
        }
      }, CallToolResultSchema);
      
      const availableDevices = JSON.parse((availableResponse.content[0] as any).text);
      const allDevices = JSON.parse((allResponse.content[0] as any).text);
      
      // All devices list should be >= available devices list
      expect(allDevices.length).toBeGreaterThanOrEqual(availableDevices.length);
      
      // Available devices should all have isAvailable: true
      availableDevices.forEach((d: any) => {
        expect(d.isAvailable).toBe(true);
      });
    }, 30000);
  });

  describe('Platform Filtering', () => {
    test('should filter simulators by iOS platform', async () => {
      const response = await client.request({
        method: 'tools/call',
        params: {
          name: 'list_simulators',
          arguments: {
            platform: 'iOS'
          }
        }
      }, CallToolResultSchema);
      
      expect(response).toBeDefined();
      const devices = JSON.parse((response.content[0] as any).text);
      
      // All returned devices should be iOS
      devices.forEach((device: any) => {
        expect(device.runtime.toLowerCase()).toContain('ios');
      });
      
      // iOS devices typically have iPhone or iPad in the name
      if (devices.length > 0) {
        const hasIOSDevice = devices.some((d: any) => 
          d.name.includes('iPhone') || d.name.includes('iPad')
        );
        expect(hasIOSDevice).toBe(true);
      }
    }, 30000);

    test('should filter simulators by each platform type', async () => {
      const platforms = ['iOS', 'tvOS', 'watchOS', 'visionOS'];
      
      for (const platform of platforms) {
        const response = await client.request({
          method: 'tools/call',
          params: {
            name: 'list_simulators',
            arguments: {
              platform
            }
          }
        }, CallToolResultSchema);
        
        expect(response).toBeDefined();
        const devices = JSON.parse((response.content[0] as any).text);
        expect(Array.isArray(devices)).toBe(true);
        
        // Verify platform filtering works
        if (devices.length > 0) {
          devices.forEach((device: any) => {
            const runtimeLower = device.runtime.toLowerCase();
            // visionOS uses 'xros' internally
            const expectedPlatform = platform === 'visionOS' ? 'xros' : platform.toLowerCase();
            expect(runtimeLower).toContain(expectedPlatform);
          });
        }
      }
    }, 30000);

    test('should reject invalid platform', async () => {
      const response = await client.request({
        method: 'tools/call',
        params: {
          name: 'list_simulators',
          arguments: {
            platform: 'InvalidPlatform'
          }
        }
      }, CallToolResultSchema);
      
      expect(response).toBeDefined();
      const text = (response.content[0] as any).text;
      expect(text.toLowerCase()).toContain('error');
    }, 30000);

    test('should return empty array for macOS platform since it has no simulators', async () => {
      const response = await client.request({
        method: 'tools/call',
        params: {
          name: 'list_simulators',
          arguments: {
            platform: 'macOS'
          }
        }
      }, CallToolResultSchema);
      
      expect(response).toBeDefined();
      const devices = JSON.parse((response.content[0] as any).text);
      // macOS doesn't use simulators, so should return empty array
      expect(Array.isArray(devices)).toBe(true);
      expect(devices.length).toBe(0);
    }, 30000);
  });

  describe('Combined Filters', () => {
    test('should handle platform and showAll together', async () => {
      const response = await client.request({
        method: 'tools/call',
        params: {
          name: 'list_simulators',
          arguments: {
            platform: 'iOS',
            showAll: true
          }
        }
      }, CallToolResultSchema);
      
      expect(response).toBeDefined();
      const devices = JSON.parse((response.content[0] as any).text);
      
      // Should be iOS devices only (if any exist)
      devices.forEach((device: any) => {
        expect(device.runtime.toLowerCase()).toContain('ios');
      });
    }, 30000);
  });

  describe('Output Format', () => {
    test('should return properly formatted JSON', async () => {
      const response = await client.request({
        method: 'tools/call',
        params: {
          name: 'list_simulators',
          arguments: {}
        }
      }, CallToolResultSchema);
      
      expect(response).toBeDefined();
      expect(response.content[0].type).toBe('text');
      
      const text = (response.content[0] as any).text;
      // Should be valid JSON
      expect(() => JSON.parse(text)).not.toThrow();
      
      // Should be prettified (contains newlines and indentation)
      expect(text).toContain('\n');
      expect(text).toMatch(/\s{2,}/); // Has indentation
    }, 30000);
  });

  describe('Edge Cases', () => {
    test('should handle empty arguments', async () => {
      const response = await client.request({
        method: 'tools/call',
        params: {
          name: 'list_simulators',
          arguments: {}
        }
      }, CallToolResultSchema);
      
      expect(response).toBeDefined();
      const devices = JSON.parse((response.content[0] as any).text);
      expect(Array.isArray(devices)).toBe(true);
    }, 30000);

    test('should handle extra unknown parameters gracefully', async () => {
      const response = await client.request({
        method: 'tools/call',
        params: {
          name: 'list_simulators',
          arguments: {
            platform: 'iOS',
            unknownParam: 'test',
            anotherParam: 123
          }
        }
      }, CallToolResultSchema);
      
      expect(response).toBeDefined();
      // Should work normally, ignoring unknown params
      const devices = JSON.parse((response.content[0] as any).text);
      expect(Array.isArray(devices)).toBe(true);
    }, 30000);
  });

  describe('Runtime Verification', () => {
    test('should format runtime strings correctly', async () => {
      const response = await client.request({
        method: 'tools/call',
        params: {
          name: 'list_simulators',
          arguments: {}
        }
      }, CallToolResultSchema);
      
      const devices = JSON.parse((response.content[0] as any).text);
      
      if (devices.length > 0) {
        devices.forEach((device: any) => {
          // Runtime should not contain the full identifier prefix
          expect(device.runtime).not.toContain('com.apple.CoreSimulator.SimRuntime.');
          // Should be in a readable format like "iOS-17-2"
          expect(device.runtime).toMatch(/^(iOS|tvOS|watchOS|xrOS)-[\d-]+$/);
        });
      }
    }, 30000);
  });

  describe('Performance', () => {
    test('should complete within reasonable time', async () => {
      const startTime = Date.now();
      
      const response = await client.request({
        method: 'tools/call',
        params: {
          name: 'list_simulators',
          arguments: {}
        }
      }, CallToolResultSchema);
      
      const duration = Date.now() - startTime;
      
      expect(response).toBeDefined();
      // Should complete within 5 seconds
      expect(duration).toBeLessThan(5000);
    }, 10000);
  });
});