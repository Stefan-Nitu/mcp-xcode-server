/**
 * E2E Test for Install App through MCP Protocol
 * 
 * Tests critical user journey: Installing an app on simulator through MCP
 * Following testing philosophy: E2E tests for critical paths only (10%)
 * 
 * Focus: MCP protocol interaction, not app installation logic
 * The controller tests already verify installation works with real simulators
 * This test verifies the MCP transport/serialization/protocol works
 * 
 * NO MOCKS - Uses real MCP server, real simulators, real apps
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from '@jest/globals';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { CallToolResultSchema } from '@modelcontextprotocol/sdk/types.js';
import { createAndConnectClient, cleanupClientAndTransport, bootAndWaitForSimulator } from '../utils/testHelpers.js';
import { TestProjectManager } from '../utils/TestProjectManager.js';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';

const execAsync = promisify(exec);

describe('Install App MCP E2E', () => {
  let client: Client;
  let transport: StdioClientTransport;
  let testManager: TestProjectManager;
  let testSimulatorId: string;
  let testAppPath: string;
  
  beforeAll(async () => {
    // Prepare test projects
    testManager = new TestProjectManager();
    await testManager.setup();
    
    // Build the server
    const { execSync } = await import('child_process');
    execSync('npm run build', { stdio: 'inherit' });
    
    // Build the test app
    await execAsync(
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
      `xcrun simctl create "TestSimulator-InstallAppMCP" "iPhone 15" "${iosRuntime.identifier}"`
    );
    testSimulatorId = createResult.stdout.trim();
    
    // Boot the simulator and wait for it to be ready
    await bootAndWaitForSimulator(testSimulatorId, 30);
  });
  
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
  
  beforeEach(async () => {
    ({ client, transport } = await createAndConnectClient());
  });
  
  afterEach(async () => {
    await cleanupClientAndTransport(client, transport);
  });
  
  it('should complete install workflow through MCP', async () => {
    // This tests the critical user journey:
    // User connects via MCP → calls install_app → receives result
    
    const result = await client.request(
      {
        method: 'tools/call',
        params: {
          name: 'install_app',
          arguments: {
            appPath: testAppPath,
            simulatorId: testSimulatorId
          }
        }
      },
      CallToolResultSchema
    );
    
    expect(result).toBeDefined();
    expect(result.content).toBeInstanceOf(Array);
    
    const textContent = result.content.find((c: any) => c.type === 'text');
    expect(textContent?.text).toContain('Successfully installed');
  });
});