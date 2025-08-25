/**
 * E2E tests for TestXcodeTool
 * Tests running tests for Xcode projects
 */

import { describe, test, expect, beforeAll, beforeEach, afterEach, afterAll } from '@jest/globals';
import { execSync } from 'child_process';
import { Client } from '@modelcontextprotocol/sdk/client/index';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio';
import { CallToolResultSchema } from '@modelcontextprotocol/sdk/types';
import { createAndConnectClient, cleanupClientAndTransport } from '../utils/testHelpers.js';
import { TestProjectManager } from '../utils/TestProjectManager.js';
import { TestEnvironmentCleaner } from '../utils/TestEnvironmentCleaner.js';

describe('TestXcodeTool E2E Tests', () => {
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

  describe('Running Xcode Project Tests with XCTest', () => {

    test('should run tests for iOS project with scheme', async () => {
      const response = await client.request({
        method: 'tools/call',
        params: {
          name: 'test_xcode',
          arguments: {
            projectPath: testProjectManager.paths.xcodeProjectXCTestPath,
            scheme: testProjectManager.schemes.xcodeProject,
            platform: 'iOS'
          }
        }
      }, CallToolResultSchema, { timeout: 180000 });
      
      const text = (response.content[0] as any).text;
      expect(text).toMatch(/Tests (passed|failed)/);
      expect(text).toContain('Platform: iOS');
      expect(text).toMatch(/\d+ passed, \d+ failed/);
    }, 180000); // Increased timeout for simulator boot and test execution

    test('should require scheme parameter', async () => {
      const response = await client.request({
        method: 'tools/call',
        params: {
          name: 'test_xcode',
          arguments: {
            projectPath: testProjectManager.paths.xcodeProjectXCTestPath,
            platform: 'iOS'
          }
        }
      }, CallToolResultSchema, { timeout: 180000 });
      
      const text = (response.content[0] as any).text;
      expect(text.toLowerCase()).toContain('validation error');
      expect(text.toLowerCase()).toContain('scheme');
      expect(text.toLowerCase()).toContain('required');
    }, 180000);

    test('should run tests with Release configuration', async () => {
      const response = await client.request({
        method: 'tools/call',
        params: {
          name: 'test_xcode',
          arguments: {
            projectPath: testProjectManager.paths.xcodeProjectXCTestPath,
            scheme: testProjectManager.schemes.xcodeProject,
            platform: 'iOS',
            configuration: 'Release'
          }
        }
      }, CallToolResultSchema, { timeout: 180000 });
      
      const text = (response.content[0] as any).text;
      expect(text).toContain('Configuration: Release');
      expect(text).toMatch(/Tests (passed|failed)/);
    }, 180000);

    test('should filter tests when testTarget is specified', async () => {
      const response = await client.request({
        method: 'tools/call',
        params: {
          name: 'test_xcode',
          arguments: {
            projectPath: testProjectManager.paths.xcodeProjectXCTestPath,
            scheme: testProjectManager.schemes.xcodeProject,
            platform: 'iOS',
            testTarget: testProjectManager.targets.xcodeProject.unitTests
          }
        }
      }, CallToolResultSchema, { timeout: 180000 });
      
      const text = (response.content[0] as any).text;
      expect(text).toContain(`Test Target: ${testProjectManager.targets.xcodeProject.unitTests}`);
      expect(text).toMatch(/Tests (passed|failed)/);
    }, 180000);

    test('should filter tests with testFilter for specific test method', async () => {
      const testTarget = testProjectManager.targets.xcodeProject.unitTests;
      const testFilter = `${testTarget}/${testTarget}/testTargetForFilter`;
      
      const response = await client.request({
        method: 'tools/call',
        params: {
          name: 'test_xcode',
          arguments: {
            projectPath: testProjectManager.paths.xcodeProjectXCTestPath,
            scheme: testProjectManager.schemes.xcodeProject,
            platform: 'iOS',
            testFilter: testFilter
          }
        }
      }, CallToolResultSchema, { timeout: 180000 });
      
      const text = (response.content[0] as any).text;
      expect(text).toContain(`Filter: ${testFilter}`);
      expect(text).toMatch(/Tests passed: 1 passed/);
    }, 180000);
    
    test('should properly report failing tests', async () => {
      const testTarget = testProjectManager.targets.xcodeProject.unitTests;
      const testFilter = `${testTarget}/${testTarget}/testFailingTest`;
      
      const response = await client.request({
        method: 'tools/call',
        params: {
          name: 'test_xcode',
          arguments: {
            projectPath: testProjectManager.paths.xcodeProjectXCTestPath,
            scheme: testProjectManager.schemes.xcodeProject,
            platform: 'iOS',
            testFilter: testFilter
          }
        }
      }, CallToolResultSchema, { timeout: 180000 });
      
      const text = (response.content[0] as any).text;
      expect(text).toContain(`Filter: ${testFilter}`);
      expect(text).toMatch(/Tests failed: 0 passed, 1 failed/);
      expect(text).toContain('Test MCP failing test reporting');
    }, 180000);

    test('should filter tests with testFilter for specific test class', async () => {
      const testTarget = testProjectManager.targets.xcodeProject.unitTests;
      const testFilter = `${testTarget}/${testTarget}`;
      
      const response = await client.request({
        method: 'tools/call',
        params: {
          name: 'test_xcode',
          arguments: {
            projectPath: testProjectManager.paths.xcodeProjectXCTestPath,
            scheme: testProjectManager.schemes.xcodeProject,
            platform: 'iOS',
            testFilter: testFilter
          }
        }
      }, CallToolResultSchema, { timeout: 180000 });
      
      const text = (response.content[0] as any).text;
      expect(text).toContain(`Filter: ${testFilter}`);
      expect(text).toMatch(/Tests failed/);
      // Should run 4 tests now (testExample, testPerformanceExample, targetForFilterTest, failingTest)
      // 3 will pass, 1 will fail  
      expect(text).toContain('3 passed, 1 failed');
    }, 180000);

    test('should handle project not found error', async () => {
      const response = await client.request({
        method: 'tools/call',
        params: {
          name: 'test_xcode',
          arguments: {
            projectPath: '/nonexistent/project.xcodeproj',
            scheme: 'MyScheme',
            platform: 'iOS'
          }
        }
      }, CallToolResultSchema, { timeout: 180000 });
      
      const text = (response.content[0] as any).text;
      expect(text).toContain('Project path does not exist');
    }, 180000);

    test('should handle invalid scheme name', async () => {
      const response = await client.request({
        method: 'tools/call',
        params: {
          name: 'test_xcode',
          arguments: {
            projectPath: testProjectManager.paths.xcodeProjectXCTestPath,
            scheme: 'NonexistentScheme',
            platform: 'iOS'
          }
        }
      }, CallToolResultSchema);
      
      const text = (response.content[0] as any).text;
      // The error might vary based on xcodebuild version
      expect(text.toLowerCase()).toMatch(/(scheme|cannot find|not found|does not contain)/);
    }, 30000);
  });

  describe('Platform Support', () => {
    test('should support tvOS platform', async () => {
      const response = await client.request({
        method: 'tools/call',
        params: {
          name: 'test_xcode',
          arguments: {
            projectPath: testProjectManager.paths.xcodeProjectXCTestPath,
            scheme: testProjectManager.schemes.xcodeProject,
            platform: 'tvOS'
          }
        }
      }, CallToolResultSchema, { timeout: 180000 });
      
      const text = (response.content[0] as any).text;
      expect(text).toBeDefined();
      expect(text).toContain('Platform: tvOS');
      expect(text).toMatch(/Tests (passed|failed)/);
    }, 180000);

    test('should support visionOS platform', async () => {
      const response = await client.request({
        method: 'tools/call',
        params: {
          name: 'test_xcode',
          arguments: {
            projectPath: testProjectManager.paths.xcodeProjectXCTestPath,
            scheme: testProjectManager.schemes.xcodeProject,
            platform: 'visionOS'
          }
        }
      }, CallToolResultSchema, { timeout: 180000 });
      
      const text = (response.content[0] as any).text;
      expect(text).toBeDefined();
      expect(text).toContain('Platform: visionOS');
      expect(text).toMatch(/Tests (passed|failed)/);
    }, 180000);

    test('should support watchOS platform', async () => {
      const response = await client.request({
        method: 'tools/call',
        params: {
          name: 'test_xcode',
          arguments: {
            projectPath: testProjectManager.paths.watchOSProjectPath,
            scheme: testProjectManager.schemes.watchOSProject,
            platform: 'watchOS'
          }
        }
      }, CallToolResultSchema, { timeout: 180000 });
      
      const text = (response.content[0] as any).text;
      expect(text).toBeDefined();
      expect(text).toContain('Platform: watchOS');
      expect(text).toMatch(/Tests (passed|failed)/);
    }, 180000);
  });

  describe('Running Xcode Project Tests with Swift Testing', () => {
    test('should run tests for Swift Testing project', async () => {
      const response = await client.request({
        method: 'tools/call',
        params: {
          name: 'test_xcode',
          arguments: {
            projectPath: testProjectManager.paths.xcodeProjectSwiftTestingPath,
            scheme: testProjectManager.schemes.xcodeProjectSwiftTesting,
            platform: 'iOS'
          }
        }
      }, CallToolResultSchema, { timeout: 180000 });
      
      const text = (response.content[0] as any).text;
      expect(text).toMatch(/Tests (passed|failed)/);
      expect(text).toContain('Platform: iOS');
      expect(text).toMatch(/\d+ passed, \d+ failed/);
    }, 180000);

    test('should properly report Swift Testing failures', async () => {
      const response = await client.request({
        method: 'tools/call',
        params: {
          name: 'test_xcode',
          arguments: {
            projectPath: testProjectManager.paths.xcodeProjectSwiftTestingPath,
            scheme: testProjectManager.schemes.xcodeProjectSwiftTesting,
            platform: 'iOS'
          }
        }
      }, CallToolResultSchema, { timeout: 180000 });
      
      const text = (response.content[0] as any).text;
      // Should report test failure since we have testFailingTest
      expect(text).toContain('Tests failed');
      expect(text).toMatch(/1 passed, 1 failed/);
      expect(text).toContain('Failing tests:');
      expect(text).toContain('testFailingTest');
    }, 180000);
  });
});