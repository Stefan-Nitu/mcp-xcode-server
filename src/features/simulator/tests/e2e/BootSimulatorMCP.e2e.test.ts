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
import { createAndConnectClient, cleanupClientAndTransport } from '../../../../shared/tests/utils/testHelpers.js';
import { TestSimulatorManager } from '../../../../shared/tests/utils/TestSimulatorManager.js';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

describe('Boot Simulator MCP E2E', () => {
  let client: Client;
  let transport: StdioClientTransport;
  let testSimManager: TestSimulatorManager;
  
  beforeAll(async () => {
    // Build the server
    const { execSync } = await import('child_process');
    execSync('npm run build', { stdio: 'inherit' });

    // Set up test simulator
    testSimManager = new TestSimulatorManager();
    await testSimManager.getOrCreateSimulator('TestSimulator-BootMCP');

    // Connect to MCP server
    ({ client, transport } = await createAndConnectClient());
  });
  
  beforeEach(async () => {
    // Ensure simulator is shutdown before each test
    await testSimManager.shutdownAndWait(5);
  });
  
  afterAll(async () => {
    // Cleanup test simulator
    await testSimManager.cleanup();

    // Cleanup MCP connection
    await cleanupClientAndTransport(client, transport);
  });

  describe('boot simulator through MCP', () => {
    it('should boot simulator via MCP protocol', async () => {
      // Act - Call tool through MCP
      const result = await client.callTool({
        name: 'boot_simulator',
        arguments: {
          deviceId: testSimManager.getSimulatorName()
        }
      });
      
      // Assert - Verify MCP response
      const parsed = CallToolResultSchema.parse(result);
      expect(parsed.content[0].type).toBe('text');
      expect(parsed.content[0].text).toBe(`✅ Successfully booted simulator: ${testSimManager.getSimulatorName()} (${testSimManager.getSimulatorId()})`);
      
      // Verify simulator is actually booted
      const isBooted = await testSimManager.isBooted();
      expect(isBooted).toBe(true);
    });
    
    it('should handle already booted simulator via MCP', async () => {
      // Arrange - boot the simulator first
      await testSimManager.bootAndWait(5);
      await new Promise(resolve => setTimeout(resolve, 2000)); // Wait for boot
      
      // Act - Call tool through MCP
      const result = await client.callTool({
        name: 'boot_simulator',
        arguments: {
          deviceId: testSimManager.getSimulatorId()
        }
      });
      
      // Assert
      const parsed = CallToolResultSchema.parse(result);
      expect(parsed.content[0].text).toBe(`✅ Simulator already booted: ${testSimManager.getSimulatorName()} (${testSimManager.getSimulatorId()})`);
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
  });
});