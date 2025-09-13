/**
 * E2E Test for Build Xcode through MCP Protocol
 * 
 * Tests critical user journey: Building an Xcode project through MCP
 * Following testing philosophy: E2E tests for critical paths only (10%)
 * 
 * NO MOCKS - Uses real MCP server, real xcodebuild, real projects
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { CallToolResultSchema } from '@modelcontextprotocol/sdk/types.js';
import { createAndConnectClient, cleanupClientAndTransport } from '../utils/testHelpers.js';
import { TestProjectManager } from '../utils/TestProjectManager.js';

describe('Build Xcode MCP E2E', () => {
  let client: Client;
  let transport: StdioClientTransport;
  let testManager: TestProjectManager;
  
  beforeAll(async () => {
    // Prepare test projects
    testManager = new TestProjectManager();
    await testManager.setup();
    
    // Build the server
    const { execSync } = await import('child_process');
    execSync('npm run build', { stdio: 'inherit' });
  });
  
  afterAll(async () => {
    await testManager.cleanup();
  });
  
  beforeEach(async () => {
    ({ client, transport } = await createAndConnectClient());
  });
  
  afterEach(async () => {
    await cleanupClientAndTransport(client, transport);
  });
  
  it('should complete build workflow through MCP', async () => {
    // This tests the critical user journey:
    // User connects via MCP → calls build_xcode → receives result
    
    const result = await client.request(
      {
        method: 'tools/call',
        params: {
          name: 'build_xcode',
          arguments: {
            projectPath: testManager.paths.xcodeProjectXCTestPath,
            scheme: 'TestProjectXCTest',
            destination: 'iOSSimulator'
          }
        }
      },
      CallToolResultSchema
    );
    
    expect(result).toBeDefined();
    expect(result.content).toBeInstanceOf(Array);
    
    const textContent = result.content.find((c: any) => c.type === 'text');
    expect(textContent?.text).toContain('Build succeeded');
  });
});