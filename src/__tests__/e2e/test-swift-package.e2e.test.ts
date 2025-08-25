/**
 * E2E tests for TestSwiftPackageTool
 * Tests running tests for Swift packages
 */

import { describe, test, expect, beforeAll, beforeEach, afterEach, afterAll } from '@jest/globals';
import { execSync } from 'child_process';
import { Client } from '@modelcontextprotocol/sdk/client/index';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio';
import { CallToolResultSchema } from '@modelcontextprotocol/sdk/types';
import { createAndConnectClient, cleanupClientAndTransport } from '../utils/testHelpers.js';
import { TestProjectManager } from '../utils/TestProjectManager.js';
import { TestEnvironmentCleaner } from '../utils/TestEnvironmentCleaner.js';

describe('TestSwiftPackageTool E2E Tests', () => {
  let client: Client;
  let transport: StdioClientTransport;
  let testProjectManager: TestProjectManager;
  
  beforeAll(async () => {
    execSync('npm run build', { cwd: process.cwd() });
    testProjectManager = new TestProjectManager();
    testProjectManager.setup();
  }, 120000);
  
  beforeEach(async () => {
    const setup = await createAndConnectClient();
    client = setup.client;
    transport = setup.transport;
  }, 30000);
  
  afterEach(async () => {
    TestEnvironmentCleaner.cleanupTestEnvironment();
    
    await cleanupClientAndTransport(client, transport);
    testProjectManager.cleanup();
  });

  afterAll(() => {
    TestEnvironmentCleaner.cleanupTestEnvironment();
  });

  describe('Running Swift Package Tests', () => {
    test('should run all tests in a Swift package', async () => {
      const response = await client.request({
        method: 'tools/call',
        params: {
          name: 'test_swift_package',
          arguments: {
            packagePath: testProjectManager.paths.swiftPackageDir
          }
        }
      }, CallToolResultSchema);
      
      const text = (response.content[0] as any).text;
      expect(text).toMatch(/Tests (passed|failed)/);
      expect(text).toContain('Package:');
      expect(text).toMatch(/\d+ passed, \d+ failed/);
      expect(text).toContain('Configuration: Debug');
    }, 60000);

    test('should run tests with Release configuration', async () => {
      const response = await client.request({
        method: 'tools/call',
        params: {
          name: 'test_swift_package',
          arguments: {
            packagePath: testProjectManager.paths.swiftPackageDir,
            configuration: 'Release'
          }
        }
      }, CallToolResultSchema);
      
      const text = (response.content[0] as any).text;
      expect(text).toContain('Configuration: Release');
      expect(text).toMatch(/Tests (passed|failed)/);
    }, 60000);

    test('should filter tests when specified', async () => {
      const response = await client.request({
        method: 'tools/call',
        params: {
          name: 'test_swift_package',
          arguments: {
            packagePath: testProjectManager.paths.swiftPackageDir,
            filter: 'TestProjectTests'
          }
        }
      }, CallToolResultSchema);
      
      const text = (response.content[0] as any).text;
      expect(text).toContain('Filter: TestProjectTests');
      expect(text).toMatch(/Tests (passed|failed)/);
    }, 60000);

    test('should handle Package.swift path directly', async () => {
      const packageSwiftPath = `${testProjectManager.paths.swiftPackageDir}/Package.swift`;
      const response = await client.request({
        method: 'tools/call',
        params: {
          name: 'test_swift_package',
          arguments: {
            packagePath: packageSwiftPath
          }
        }
      }, CallToolResultSchema);
      
      const text = (response.content[0] as any).text;
      expect(text).toMatch(/Tests (passed|failed)/);
      expect(text).toContain('Package:');
    }, 60000);

    test('should handle package not found error', async () => {
      const response = await client.request({
        method: 'tools/call',
        params: {
          name: 'test_swift_package',
          arguments: {
            packagePath: '/nonexistent/package'
          }
        }
      }, CallToolResultSchema);
      
      const text = (response.content[0] as any).text;
      expect(text).toContain('No Package.swift found');
    }, 30000);

    test('should reject invalid configuration values', async () => {
      const response = await client.request({
        method: 'tools/call',
        params: {
          name: 'test_swift_package',
          arguments: {
            packagePath: testProjectManager.paths.swiftPackageDir,
            configuration: 'InvalidConfig'
          }
        }
      }, CallToolResultSchema);
      
      const text = (response.content[0] as any).text;
      expect(text.toLowerCase()).toContain('validation error');
      expect(text).toMatch(/Debug.*Release/);
    }, 30000);
  });

  describe('Test Output', () => {
    test('should include full test output', async () => {
      const response = await client.request({
        method: 'tools/call',
        params: {
          name: 'test_swift_package',
          arguments: {
            packagePath: testProjectManager.paths.swiftPackageDir
          }
        }
      }, CallToolResultSchema);
      
      const text = (response.content[0] as any).text;
      expect(text).toContain('Full output:');
      // Swift test output typically includes these
      expect(text).toMatch(/(Test Suite|test|XCT|swift test)/i);
    }, 60000);
  });
});