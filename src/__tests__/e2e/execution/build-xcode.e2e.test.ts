/**
 * E2E tests for BuildXcodeTool
 * Tests building Xcode projects and workspaces
 */

import { describe, test, expect, beforeAll, beforeEach, afterEach, afterAll } from '@jest/globals';
import { execSync } from 'child_process';
import { Client } from '@modelcontextprotocol/sdk/client/index';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio';
import { CallToolResultSchema } from '@modelcontextprotocol/sdk/types';
import { createAndConnectClient, cleanupClientAndTransport } from '../../utils/testHelpers.js';
import { TestProjectManager } from '../../utils/TestProjectManager.js';
import { TestEnvironmentCleaner } from '../../utils/TestEnvironmentCleaner.js';
import { Devices } from '../../../utils/devices/Devices.js';
import { Platform } from '../../../types.js';

describe('BuildXcodeTool E2E Tests', () => {
  let client: Client;
  let transport: StdioClientTransport;
  let testProjectManager: TestProjectManager;
  
  beforeAll(async () => {
    execSync('npm run build', { cwd: process.cwd() });
    testProjectManager = new TestProjectManager();
    testProjectManager.setup();
  }, 180000);
  
  beforeEach(async () => {
    const setup = await createAndConnectClient();
    client = setup.client;
    transport = setup.transport;
  }, 180000);
  
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
            projectPath: testProjectManager.paths.xcodeProjectXCTestPath,
            scheme: testProjectManager.schemes.xcodeProject,
            platform: 'iOS'
          }
        }
      }, CallToolResultSchema, { timeout: 180000 });
      
      const text = (response.content[0] as any).text;
      expect(text).toContain('Build succeeded');
      expect(text).toContain('Platform: iOS');
    }, 180000);

    test('should require scheme parameter', async () => {
      const response = await client.request({
        method: 'tools/call',
        params: {
          name: 'build_xcode',
          arguments: {
            projectPath: testProjectManager.paths.xcodeProjectXCTestPath,
            platform: 'iOS'
          }
        }
      }, CallToolResultSchema, { timeout: 180000 });
      
      const text = (response.content[0] as any).text;
      // Should fail with validation error
      expect(text).toContain('Validation error: Scheme is required');
    }, 180000);

    test('should build with Release configuration', async () => {
      const response = await client.request({
        method: 'tools/call',
        params: {
          name: 'build_xcode',
          arguments: {
            projectPath: testProjectManager.paths.xcodeProjectXCTestPath,
            scheme: testProjectManager.schemes.xcodeProject,
            platform: 'iOS',
            configuration: 'Release'
          }
        }
      }, CallToolResultSchema, { timeout: 180000 });
      
      const text = (response.content[0] as any).text;
      expect(text).toContain('Build succeeded');
      expect(text).toContain('Configuration: Release');
    }, 180000);

    test('should build with specific device', async () => {
      // Use Devices class to find a compatible iOS device (prefers newer iOS versions)
      const devices = new Devices();
      const device = await devices.findForPlatform(Platform.iOS);
      
      // Device should always be available in test environment
      expect(device).toBeDefined();
      expect(device).not.toBeNull();
      
      const response = await client.request({
        method: 'tools/call',
        params: {
          name: 'build_xcode',
          arguments: {
            projectPath: testProjectManager.paths.xcodeProjectXCTestPath,
            scheme: testProjectManager.schemes.xcodeProject,
            platform: 'iOS',
            deviceId: device!.id
          }
        }
      }, CallToolResultSchema, { timeout: 180000 });
      
      const text = (response.content[0] as any).text;
      expect(text).toContain('Build succeeded');
    }, 180000);
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
      }, CallToolResultSchema, { timeout: 180000 });
      
      const text = (response.content[0] as any).text;
      expect(text).toContain('Build succeeded');
    }, 180000);
  });

  describe('Platform Support', () => {
    test('should handle iOS platform (default)', async () => {
      const response = await client.request({
        method: 'tools/call',
        params: {
          name: 'build_xcode',
          arguments: {
            projectPath: testProjectManager.paths.xcodeProjectXCTestPath,
            scheme: testProjectManager.schemes.xcodeProject
            // iOS is default platform
          }
        }
      }, CallToolResultSchema, { timeout: 180000 });
      
      const text = (response.content[0] as any).text;
      expect(text).toContain('Build succeeded');
      expect(text).toContain('Platform: iOS');
    }, 180000);

    test('should handle macOS platform', async () => {
      const response = await client.request({
        method: 'tools/call',
        params: {
          name: 'build_xcode',
          arguments: {
            projectPath: testProjectManager.paths.xcodeProjectXCTestPath,
            scheme: testProjectManager.schemes.xcodeProject,
            platform: 'macOS'
          }
        }
      }, CallToolResultSchema, { timeout: 180000 });
      
      const text = (response.content[0] as any).text;
      // Either succeeds or reports platform not supported
      expect(text).toContain('Build succeeded');
      expect(text).toContain('Platform: macOS');
    }, 180000);

    test('should handle tvOS platform', async () => {
      const response = await client.request({
        method: 'tools/call',
        params: {
          name: 'build_xcode',
          arguments: {
            projectPath: testProjectManager.paths.xcodeProjectXCTestPath,
            scheme: testProjectManager.schemes.xcodeProject,
            platform: 'tvOS'
          }
        }
      }, CallToolResultSchema, { timeout: 180000 });
      
      const text = (response.content[0] as any).text;
      expect(text).toContain('Build succeeded');
      expect(text).toContain('Platform: tvOS');
    }, 180000);

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
      }, CallToolResultSchema, { timeout: 180000 });
      
      const text = (response.content[0] as any).text;
      expect(text).toContain('Build succeeded');
      expect(text).toContain('Platform: watchOS');
    }, 180000);

    test('should handle visionOS platform', async () => {
      const response = await client.request({
        method: 'tools/call',
        params: {
          name: 'build_xcode',
          arguments: {
            projectPath: testProjectManager.paths.xcodeProjectXCTestPath,
            scheme: testProjectManager.schemes.xcodeProject,
            platform: 'visionOS'
          }
        }
      }, CallToolResultSchema, { timeout: 180000 });
      
      const text = (response.content[0] as any).text;
      expect(text).toContain('Build succeeded');
      expect(text).toContain('Platform: visionOS');
    }, 180000);
  });

  describe('Error Handling', () => {
    test('should handle non-existent project', async () => {
      const response = await client.request({
        method: 'tools/call',
        params: {
          name: 'build_xcode',
          arguments: {
            projectPath: '/non/existent/project.xcodeproj',
            scheme: 'NonExistentScheme'
          }
        }
      }, CallToolResultSchema, { timeout: 180000 });
      
      const text = (response.content[0] as any).text;
      expect(text).toContain('No Xcode project found at: /non/existent/project.xcodeproj');
    });

    test('should handle invalid scheme', async () => {
      const response = await client.request({
        method: 'tools/call',
        params: {
          name: 'build_xcode',
          arguments: {
            projectPath: testProjectManager.paths.xcodeProjectXCTestPath,
            scheme: 'NonExistentScheme',
            platform: 'iOS'
          }
        }
      }, CallToolResultSchema, { timeout: 180000 });
      
      const text = (response.content[0] as any).text;
      expect(text).toContain('❌ Build failed');
      expect(text.toLowerCase()).toContain('scheme not found');
      expect(text).toContain('Check available schemes with list_schemes tool');
    }, 180000);

    test('should handle custom configuration gracefully', async () => {
      const response = await client.request({
        method: 'tools/call',
        params: {
          name: 'build_xcode',
          arguments: {
            projectPath: testProjectManager.paths.xcodeProjectXCTestPath,
            scheme: testProjectManager.schemes.xcodeProject,
            platform: 'iOS',
            configuration: 'Beta'
          }
        }
      }, CallToolResultSchema, { timeout: 180000 });
      
      const text = (response.content[0] as any).text;
      expect(text).toContain('Build succeeded');
      expect(text).toMatch(/Configuration: (Beta)/);
    }, 180000);
  });
});