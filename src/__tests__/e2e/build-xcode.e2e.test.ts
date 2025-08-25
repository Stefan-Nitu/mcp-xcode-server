/**
 * E2E tests for BuildXcodeTool
 * Tests building Xcode projects and workspaces
 */

import { describe, test, expect, beforeAll, beforeEach, afterEach, afterAll } from '@jest/globals';
import { execSync } from 'child_process';
import { Client } from '@modelcontextprotocol/sdk/client/index';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio';
import { CallToolResultSchema } from '@modelcontextprotocol/sdk/types';
import { createAndConnectClient, cleanupClientAndTransport } from '../utils/testHelpers.js';
import { TestProjectManager } from '../utils/TestProjectManager.js';
import { TestEnvironmentCleaner } from '../utils/TestEnvironmentCleaner.js';

describe('BuildXcodeTool E2E Tests', () => {
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

  describe('Xcode Project Builds', () => {
    test('should build iOS project with scheme', async () => {
      const response = await client.request({
        method: 'tools/call',
        params: {
          name: 'build_xcode',
          arguments: {
            projectPath: testProjectManager.paths.xcodeProjectPath,
            scheme: testProjectManager.schemes.xcodeProject,
            platform: 'iOS'
          }
        }
      }, CallToolResultSchema);
      
      const text = (response.content[0] as any).text;
      expect(text).toContain('Build succeeded');
      expect(text).toContain('Platform: iOS');
    }, 30000);

    test('should require scheme parameter', async () => {
      const response = await client.request({
        method: 'tools/call',
        params: {
          name: 'build_xcode',
          arguments: {
            projectPath: testProjectManager.paths.xcodeProjectPath,
            platform: 'iOS'
          }
        }
      }, CallToolResultSchema);
      
      const text = (response.content[0] as any).text;
      // Should fail with validation error
      expect(text.toLowerCase()).toContain('validation error');
      expect(text.toLowerCase()).toContain('scheme');
      expect(text.toLowerCase()).toContain('required');
    }, 30000);

    test('should build with Release configuration', async () => {
      const response = await client.request({
        method: 'tools/call',
        params: {
          name: 'build_xcode',
          arguments: {
            projectPath: testProjectManager.paths.xcodeProjectPath,
            scheme: testProjectManager.schemes.xcodeProject,
            platform: 'iOS',
            configuration: 'Release'
          }
        }
      }, CallToolResultSchema);
      
      const text = (response.content[0] as any).text;
      expect(text).toContain('Build succeeded');
      expect(text).toContain('Configuration: Release');
    }, 30000);

    test('should build with specific device', async () => {
      // Get a simulator first
      const listResponse = await client.request({
        method: 'tools/call',
        params: {
          name: 'list_simulators',
          arguments: {
            platform: 'iOS'
          }
        }
      }, CallToolResultSchema);
      
      const simulators = JSON.parse((listResponse.content[0] as any).text);
      const availableSimulator = simulators.find((s: any) => s.isAvailable);
      
      if (availableSimulator) {
        const response = await client.request({
          method: 'tools/call',
          params: {
            name: 'build_xcode',
            arguments: {
              projectPath: testProjectManager.paths.xcodeProjectPath,
              scheme: testProjectManager.schemes.xcodeProject,
              platform: 'iOS',
              deviceId: availableSimulator.udid
            }
          }
        }, CallToolResultSchema);
        
        const text = (response.content[0] as any).text;
        expect(text).toContain('Build succeeded');
      }
    }, 60000);
  });

  describe('Workspace Builds', () => {
    test('should build workspace with scheme', async () => {
      const response = await client.request({
        method: 'tools/call',
        params: {
          name: 'build_xcode',
          arguments: {
            projectPath: testProjectManager.paths.workspacePath,
            scheme: testProjectManager.schemes.xcodeProject,
            platform: 'iOS'
          }
        }
      }, CallToolResultSchema);
      
      const text = (response.content[0] as any).text;
      expect(text).toContain('Build succeeded');
    }, 30000);
  });

  describe('Platform Support', () => {
    test('should handle iOS platform (default)', async () => {
      const response = await client.request({
        method: 'tools/call',
        params: {
          name: 'build_xcode',
          arguments: {
            projectPath: testProjectManager.paths.xcodeProjectPath,
            scheme: testProjectManager.schemes.xcodeProject
            // iOS is default platform
          }
        }
      }, CallToolResultSchema);
      
      const text = (response.content[0] as any).text;
      expect(text).toContain('Build succeeded');
      expect(text).toContain('Platform: iOS');
    }, 30000);

    test('should handle macOS platform', async () => {
      const response = await client.request({
        method: 'tools/call',
        params: {
          name: 'build_xcode',
          arguments: {
            projectPath: testProjectManager.paths.xcodeProjectPath,
            scheme: testProjectManager.schemes.xcodeProject,
            platform: 'macOS'
          }
        }
      }, CallToolResultSchema);
      
      const text = (response.content[0] as any).text;
      // Either succeeds or reports platform not supported
      expect(text).toContain('Build succeeded');
      expect(text).toContain('Platform: macOS');
    }, 30000);

    test('should handle tvOS platform', async () => {
      const response = await client.request({
        method: 'tools/call',
        params: {
          name: 'build_xcode',
          arguments: {
            projectPath: testProjectManager.paths.xcodeProjectPath,
            scheme: testProjectManager.schemes.xcodeProject,
            platform: 'tvOS'
          }
        }
      }, CallToolResultSchema);
      
      const text = (response.content[0] as any).text;
      expect(text).toContain('Build succeeded');
      expect(text).toContain('Platform: tvOS');
    }, 30000);

    test('should handle watchOS platform', async () => {
      const response = await client.request({
        method: 'tools/call',
        params: {
          name: 'build_xcode',
          arguments: {
            projectPath: testProjectManager.paths.watchOSProjectPath,
            scheme: testProjectManager.schemes.watchOSProject,
            platform: 'watchOS'
          }
        }
      }, CallToolResultSchema);
      
      const text = (response.content[0] as any).text;
      expect(text).toContain('Build succeeded');
      expect(text).toContain('Platform: watchOS');
    }, 30000);

    test('should handle visionOS platform', async () => {
      const response = await client.request({
        method: 'tools/call',
        params: {
          name: 'build_xcode',
          arguments: {
            projectPath: testProjectManager.paths.xcodeProjectPath,
            scheme: testProjectManager.schemes.xcodeProject,
            platform: 'visionOS'
          }
        }
      }, CallToolResultSchema);
      
      const text = (response.content[0] as any).text;
      expect(text).toContain('Build succeeded');
      expect(text).toContain('Platform: visionOS');
    }, 30000);
  });

  describe('Error Handling', () => {
    test('should handle non-existent project', async () => {
      const response = await client.request({
        method: 'tools/call',
        params: {
          name: 'build_xcode',
          arguments: {
            projectPath: '/non/existent/project.xcodeproj'
          }
        }
      }, CallToolResultSchema);
      
      const text = (response.content[0] as any).text;
      expect(text).toContain('Project path does not exist');
    });

    test('should handle invalid scheme', async () => {
      const response = await client.request({
        method: 'tools/call',
        params: {
          name: 'build_xcode',
          arguments: {
            projectPath: testProjectManager.paths.xcodeProjectPath,
            scheme: 'NonExistentScheme',
            platform: 'iOS'
          }
        }
      }, CallToolResultSchema);
      
      const text = (response.content[0] as any).text;
      expect(text.toLowerCase()).toContain('error');
      // Xcode will report scheme not found
    }, 30000);

    test('should handle custom configuration gracefully', async () => {
      const response = await client.request({
        method: 'tools/call',
        params: {
          name: 'build_xcode',
          arguments: {
            projectPath: testProjectManager.paths.xcodeProjectPath,
            scheme: testProjectManager.schemes.xcodeProject,
            platform: 'iOS',
            configuration: 'Beta'
          }
        }
      }, CallToolResultSchema);
      
      const text = (response.content[0] as any).text;
      expect(text).toContain('Build succeeded');
      expect(text).toMatch(/Configuration: (Beta)/);
    }, 30000);
  });
});