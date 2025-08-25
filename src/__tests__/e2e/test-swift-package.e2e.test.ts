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

  describe('Running Swift Package Tests with XCTest', () => {
    test('should run all tests in XCTest package', async () => {
      const response = await client.request({
        method: 'tools/call',
        params: {
          name: 'test_swift_package',
          arguments: {
            packagePath: testProjectManager.paths.swiftPackageXCTestDir
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
            packagePath: testProjectManager.paths.swiftPackageXCTestDir,
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
            packagePath: testProjectManager.paths.swiftPackageXCTestDir,
            filter: 'TestSwiftPackageXCTestTests'
          }
        }
      }, CallToolResultSchema);
      
      const text = (response.content[0] as any).text;
      expect(text).toContain('Filter: TestSwiftPackageXCTestTests');
      expect(text).toMatch(/Tests (passed|failed)/);
    }, 60000);

    test('should handle Package.swift path directly', async () => {
      const packageSwiftPath = `${testProjectManager.paths.swiftPackageXCTestDir}/Package.swift`;
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
            packagePath: testProjectManager.paths.swiftPackageXCTestDir,
            configuration: 'InvalidConfig'
          }
        }
      }, CallToolResultSchema);
      
      const text = (response.content[0] as any).text;
      expect(text.toLowerCase()).toContain('validation error');
      expect(text).toMatch(/Debug.*Release/);
    }, 30000);

    test('should properly report failing tests', async () => {
      const response = await client.request({
        method: 'tools/call',
        params: {
          name: 'test_swift_package',
          arguments: {
            packagePath: testProjectManager.paths.swiftPackageXCTestDir,
            filter: 'TestSwiftPackageXCTestTests.testFailingTest'
          }
        }
      }, CallToolResultSchema);
      
      const text = (response.content[0] as any).text;
      expect(text).toContain('Filter: TestSwiftPackageXCTestTests.testFailingTest');
      expect(text).toMatch(/Tests failed: 0 passed, 1 failed/);
      expect(text).toContain('Failing tests:');
      expect(text).toContain('testFailingTest');
    }, 60000);
  });

  describe('Test Output', () => {
    test('should include full test output', async () => {
      const response = await client.request({
        method: 'tools/call',
        params: {
          name: 'test_swift_package',
          arguments: {
            packagePath: testProjectManager.paths.swiftPackageXCTestDir
          }
        }
      }, CallToolResultSchema);
      
      const text = (response.content[0] as any).text;
      expect(text).toContain('Test Results:');
      // Swift test output typically includes these
      expect(text).toMatch(/(Test Suite|test|XCT|swift test)/i);
    }, 60000);
  });

  describe('Running Swift Package Tests with Swift Testing', () => {
    test('should run all tests in Swift Testing package', async () => {
      const response = await client.request({
        method: 'tools/call',
        params: {
          name: 'test_swift_package',
          arguments: {
            packagePath: testProjectManager.paths.swiftPackageSwiftTestingDir
          }
        }
      }, CallToolResultSchema);
      
      const text = (response.content[0] as any).text;
      expect(text).toMatch(/Tests (passed|failed)/);
      expect(text).toContain('Package:');
      expect(text).toMatch(/\d+ passed, \d+ failed/);
      expect(text).toContain('Configuration: Debug');
    }, 60000);

    test('should parse Swift Testing output correctly', async () => {
      const response = await client.request({
        method: 'tools/call',
        params: {
          name: 'test_swift_package',
          arguments: {
            packagePath: testProjectManager.paths.swiftPackageSwiftTestingDir,
            filter: 'testExample' // Run a specific test
          }
        }
      }, CallToolResultSchema);
      
      const text = (response.content[0] as any).text;
      expect(text).toContain('Filter: testExample');
      expect(text).toMatch(/Tests (passed|failed)/);
      // The parser should correctly identify Swift Testing output
      expect(text).toMatch(/\d+ passed/);
    }, 60000);

    test('should handle Swift Testing with Release configuration', async () => {
      const response = await client.request({
        method: 'tools/call',
        params: {
          name: 'test_swift_package',
          arguments: {
            packagePath: testProjectManager.paths.swiftPackageSwiftTestingDir,
            configuration: 'Release'
          }
        }
      }, CallToolResultSchema);
      
      const text = (response.content[0] as any).text;
      expect(text).toContain('Configuration: Release');
      expect(text).toMatch(/Tests (passed|failed)/);
    }, 60000);
  });
});