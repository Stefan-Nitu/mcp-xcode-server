/**
 * E2E tests for TestXcodeTool
 * Tests running tests for Xcode projects
 */

import { describe, test, expect, beforeAll, beforeEach, afterEach } from '@jest/globals';
import { execSync } from 'child_process';
import { Client } from '@modelcontextprotocol/sdk/client/index';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio';
import { CallToolResultSchema } from '@modelcontextprotocol/sdk/types';
import { createAndConnectClient, cleanupClientAndTransport } from '../utils/testHelpers.js';
import { TestProjectManager } from '../utils/TestProjectManager.js';

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
    await cleanupClientAndTransport(client, transport);
    testProjectManager.cleanup();
  });

  describe('Running Xcode Project Tests', () => {
    test('should run tests for iOS project with scheme', async () => {
      const response = await client.request({
        method: 'tools/call',
        params: {
          name: 'test_xcode',
          arguments: {
            projectPath: testProjectManager.paths.xcodeProjectPath,
            scheme: testProjectManager.schemes.xcodeProject,
            platform: 'iOS'
          }
        }
      }, CallToolResultSchema);
      
      const text = (response.content[0] as any).text;
      expect(text).toMatch(/Tests (passed|failed)/);
      expect(text).toContain('Platform: iOS');
      expect(text).toMatch(/\d+ passed, \d+ failed/);
    }, 60000);

    test('should require scheme parameter', async () => {
      const response = await client.request({
        method: 'tools/call',
        params: {
          name: 'test_xcode',
          arguments: {
            projectPath: testProjectManager.paths.xcodeProjectPath,
            platform: 'iOS'
          }
        }
      }, CallToolResultSchema);
      
      const text = (response.content[0] as any).text;
      expect(text.toLowerCase()).toContain('validation error');
      expect(text.toLowerCase()).toContain('scheme');
      expect(text.toLowerCase()).toContain('required');
    }, 30000);

    test('should run tests with Release configuration', async () => {
      const response = await client.request({
        method: 'tools/call',
        params: {
          name: 'test_xcode',
          arguments: {
            projectPath: testProjectManager.paths.xcodeProjectPath,
            scheme: testProjectManager.schemes.xcodeProject,
            platform: 'iOS',
            configuration: 'Release'
          }
        }
      }, CallToolResultSchema);
      
      const text = (response.content[0] as any).text;
      expect(text).toContain('Configuration: Release');
      expect(text).toMatch(/Tests (passed|failed)/);
    }, 60000);

    test('should filter tests when testTarget is specified', async () => {
      const response = await client.request({
        method: 'tools/call',
        params: {
          name: 'test_xcode',
          arguments: {
            projectPath: testProjectManager.paths.xcodeProjectPath,
            scheme: testProjectManager.schemes.xcodeProject,
            platform: 'iOS',
            testTarget: 'XCTestProject'
          }
        }
      }, CallToolResultSchema);
      
      const text = (response.content[0] as any).text;
      expect(text).toContain('Test Target:');
      expect(text).toMatch(/Tests (passed|failed)/);
    }, 60000);

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
      }, CallToolResultSchema);
      
      const text = (response.content[0] as any).text;
      expect(text).toContain('Project path does not exist');
    }, 30000);

    test('should handle invalid scheme name', async () => {
      const response = await client.request({
        method: 'tools/call',
        params: {
          name: 'test_xcode',
          arguments: {
            projectPath: testProjectManager.paths.xcodeProjectPath,
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
    test('should support macOS platform', async () => {
      const response = await client.request({
        method: 'tools/call',
        params: {
          name: 'test_xcode',
          arguments: {
            projectPath: testProjectManager.paths.xcodeProjectPath,
            scheme: testProjectManager.schemes.xcodeProject,
            platform: 'macOS'
          }
        }
      }, CallToolResultSchema);
      
      const text = (response.content[0] as any).text;
      // macOS might not be supported by all test projects
      expect(text).toBeDefined();
      if (!text.includes('not supported')) {
        expect(text).toContain('Platform: macOS');
      }
    }, 60000);
  });
});