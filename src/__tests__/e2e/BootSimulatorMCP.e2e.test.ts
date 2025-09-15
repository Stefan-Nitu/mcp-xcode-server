/**
 * E2E Test for Boot Simulator through MCP Protocol
 * 
 * Tests critical user journey: Booting a simulator through MCP
 * Following testing philosophy: E2E tests for critical paths only (10%)
 * 
 * Focus: MCP protocol interaction, not simulator boot logic
 * The controller tests already verify boot works with real simulators
 * This test verifies the MCP transport/serialization/protocol works
 * 
 * NO MOCKS - Uses real MCP server, real simulators
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { CallToolResultSchema } from '@modelcontextprotocol/sdk/types.js';
import { createAndConnectClient, cleanupClientAndTransport } from '../utils/testHelpers.js';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

describe('Boot Simulator MCP E2E', () => {
  let client: Client;
  let transport: StdioClientTransport;
  let testDeviceId: string;
  let testSimulatorName: string;
  
  beforeAll(async () => {
    // Build the server
    const { execSync } = await import('child_process');
    execSync('npm run build', { stdio: 'inherit' });
    
    // Find or create a test simulator
    const listResult = await execAsync('xcrun simctl list devices --json');
    const devices = JSON.parse(listResult.stdout);
    
    // Look for an existing test simulator
    for (const runtime of Object.values(devices.devices) as any[]) {
      const testSim = runtime.find((d: any) => d.name.includes('TestSimulator-BootMCP'));
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
        `xcrun simctl create "TestSimulator-BootMCP" "com.apple.CoreSimulator.SimDeviceType.iPhone-15" "${iosRuntime.identifier}"`
      );
      testDeviceId = createResult.stdout.trim();
      testSimulatorName = 'TestSimulator-BootMCP';
    }
    
    // Connect to MCP server
    ({ client, transport } = await createAndConnectClient());
  });
  
  beforeEach(async () => {
    // Ensure simulator is shutdown before each test
    try {
      await execAsync(`xcrun simctl shutdown "${testDeviceId}"`);
    } catch {
      // Ignore if already shutdown
    }
    // Wait for shutdown to complete
    await new Promise(resolve => setTimeout(resolve, 1000));
  });
  
  afterAll(async () => {
    // Shutdown the test simulator
    try {
      await execAsync(`xcrun simctl shutdown "${testDeviceId}"`);
    } catch {
      // Ignore if already shutdown
    }
    
    // Cleanup MCP connection
    await cleanupClientAndTransport(client, transport);
  });

  describe('boot simulator through MCP', () => {
    it('should boot simulator via MCP protocol', async () => {
      // Act - Call tool through MCP
      const result = await client.callTool({
        name: 'boot_simulator',
        arguments: {
          deviceId: testSimulatorName
        }
      });
      
      // Assert - Verify MCP response
      const parsed = CallToolResultSchema.parse(result);
      expect(parsed.content[0].type).toBe('text');
      expect(parsed.content[0].text).toBe(`✅ Successfully booted simulator: ${testSimulatorName} (${testDeviceId})`);
      
      // Verify simulator is actually booted
      const listResult = await execAsync('xcrun simctl list devices --json');
      const devices = JSON.parse(listResult.stdout);
      let found = false;
      for (const runtime of Object.values(devices.devices) as any[]) {
        const device = runtime.find((d: any) => d.udid === testDeviceId);
        if (device) {
          expect(device.state).toBe('Booted');
          found = true;
          break;
        }
      }
      expect(found).toBe(true);
    });
    
    it('should handle already booted simulator via MCP', async () => {
      // Arrange - boot the simulator first
      await execAsync(`xcrun simctl boot "${testDeviceId}"`);
      await new Promise(resolve => setTimeout(resolve, 2000)); // Wait for boot
      
      // Act - Call tool through MCP
      const result = await client.callTool({
        name: 'boot_simulator',
        arguments: {
          deviceId: testDeviceId
        }
      });
      
      // Assert
      const parsed = CallToolResultSchema.parse(result);
      expect(parsed.content[0].text).toBe(`✅ Simulator already booted: ${testSimulatorName} (${testDeviceId})`);
    });
  });

  describe('error handling through MCP', () => {
    it('should return error for non-existent simulator', async () => {
      // Act
      const result = await client.callTool({
        name: 'boot_simulator',
        arguments: {
          deviceId: 'NonExistentSimulator-MCP'
        }
      });
      
      // Assert
      const parsed = CallToolResultSchema.parse(result);
      expect(parsed.content[0].text).toBe('❌ Simulator not found: NonExistentSimulator-MCP');
    });
    
    it('should validate empty deviceId', async () => {
      // Act
      const result = await client.callTool({
        name: 'boot_simulator',
        arguments: {
          deviceId: ''
        }
      });
      
      // Assert
      const parsed = CallToolResultSchema.parse(result);
      expect(parsed.content[0].text).toBe('❌ Device ID cannot be empty');
    });
  });
});