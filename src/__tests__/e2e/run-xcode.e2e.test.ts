/**
 * E2E tests for RunXcodeTool
 * Tests building and running Xcode projects (not SPM)
 * Based on validated run-project.e2e.test.ts patterns
 */

import { describe, test, expect, beforeAll, afterAll, beforeEach, afterEach } from '@jest/globals';
import { execSync } from 'child_process';
import { Client } from '@modelcontextprotocol/sdk/client/index';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio';
import { CallToolResultSchema } from '@modelcontextprotocol/sdk/types';
import { TestProjectManager } from '../utils/TestProjectManager';
import { TestEnvironmentCleaner } from '../utils/TestEnvironmentCleaner';
import { createAndConnectClient, cleanupClientAndTransport } from '../utils/testHelpers';
import { createModuleLogger } from '../../logger';

const logger = createModuleLogger('run-xcode.e2e.test');

describe('RunXcodeTool E2E Tests', () => {
  let client: Client;
  let transport: StdioClientTransport;
  let projectManager: TestProjectManager;
  
  beforeAll(async () => {
    execSync('npm run build', { cwd: process.cwd() });
    projectManager = new TestProjectManager();
    await projectManager.setup();
  }, 120000);
  
  beforeEach(async () => {
    const connection = await createAndConnectClient();
    client = connection.client;
    transport = connection.transport;
  }, 30000);
  
  afterEach(async () => {
    TestEnvironmentCleaner.cleanupTestEnvironment();
    
    await cleanupClientAndTransport(client, transport);
    projectManager.cleanup();
  });

  /**
   * Helper to get available simulator
   */
  async function getAvailableSimulator(platform: string): Promise<string | null> {
    try {
      const output = execSync(`xcrun simctl list devices -j`, { encoding: 'utf8' });
      const data = JSON.parse(output);
      
      const platformKeys = Object.keys(data.devices).filter(key =>
        key.toLowerCase().includes(platform.toLowerCase())
      );
      
      if (platformKeys.length === 0) return null;
      
      const devices = platformKeys.flatMap(key => data.devices[key] as any[]);
      const availableDevice = devices.find(d => d.isAvailable);
      
      return availableDevice ? availableDevice.name : null;
    } catch (error) {
      logger.error({ error, platform }, 'Failed to get available simulator');
      return null;
    }
  }

  describe('iOS Platform', () => {
    test('should build and run iOS project with scheme', async () => {
      const response = await client.request({
        method: 'tools/call',
        params: {
          name: 'run_xcode',
          arguments: {
            projectPath: projectManager.paths.xcodeProjectXCTestPath,
            scheme: projectManager.schemes.xcodeProject,
            platform: 'iOS'
          }
        }
      }, CallToolResultSchema, { timeout: 180000 });
      
      const text = (response.content[0] as any).text;
      expect(text).toContain('Successfully built and ran project');
      expect(text).toContain('Platform: iOS');
      expect(text).toContain('App path:');
    }, 180000); // Increased timeout to 3 minutes

    test('should build and run with specific device', async () => {
      const deviceName = await getAvailableSimulator('iOS');
      
      if (!deviceName) {
        console.warn('No iOS simulator available, skipping test');
        return;
      }
      
      const response = await client.request({
        method: 'tools/call',
        params: {
          name: 'run_xcode',
          arguments: {
            projectPath: projectManager.paths.xcodeProjectXCTestPath,
            scheme: projectManager.schemes.xcodeProject,
            platform: 'iOS',
            deviceId: deviceName
          }
        }
      }, CallToolResultSchema);
      
      const text = (response.content[0] as any).text;
      expect(text).toContain('Successfully built and ran project');
      expect(text).toContain(`Device: ${deviceName}`);
    }, 120000);
  });

  describe('macOS Platform', () => {
    test('should build and run macOS project', async () => {
      const response = await client.request({
        method: 'tools/call',
        params: {
          name: 'run_xcode',
          arguments: {
            projectPath: projectManager.paths.xcodeProjectXCTestPath,
            scheme: projectManager.schemes.xcodeProject,
            platform: 'macOS'
          }
        }
      }, CallToolResultSchema);
      
      const text = (response.content[0] as any).text;
      // macOS may not be supported by all test projects
        expect(text).toContain('Successfully built and ran project');
        expect(text).toContain('Platform: macOS');
        expect(text).toContain('Device: N/A'); // macOS doesn't use devices
    }, 120000);
  });

  describe('Other Platforms', () => {
    test('should handle tvOS platform', async () => {
      const response = await client.request({
        method: 'tools/call',
        params: {
          name: 'run_xcode',
          arguments: {
            projectPath: projectManager.paths.xcodeProjectXCTestPath,
            scheme: projectManager.schemes.xcodeProject,
            platform: 'tvOS'
          }
        }
      }, CallToolResultSchema);
      
      const text = (response.content[0] as any).text;
      expect(text).toContain('Successfully built and ran project');
      expect(text).toContain('Platform: tvOS');
    }, 120000);

    test('should handle watchOS platform', async () => {
      const response = await client.request({
        method: 'tools/call',
        params: {
          name: 'run_xcode',
          arguments: {
            projectPath: projectManager.paths.watchOSProjectPath,
            scheme: projectManager.schemes.watchOSProject,
            platform: 'watchOS'
          }
        } 
      }, CallToolResultSchema);
      
      const text = (response.content[0] as any).text;
      expect(text).toContain('Successfully built and ran project');
      expect(text).toContain('Platform: watchOS');
    }, 120000);

    test('should handle visionOS platform', async () => {
      // Check if visionOS SDK is available
      let visionOSAvailable = false;
      try {
        execSync('xcodebuild -showsdks | grep visionOS', { stdio: 'pipe' });
        visionOSAvailable = true;
      } catch {
        visionOSAvailable = false;
      }
      
      if (!visionOSAvailable) {
        console.warn('visionOS SDK not available, skipping test');
        return;
      }
      
      const response = await client.request({
        method: 'tools/call',
        params: {
          name: 'run_xcode',
          arguments: {
            projectPath: projectManager.paths.xcodeProjectXCTestPath,
            scheme: projectManager.schemes.xcodeProject,
            platform: 'visionOS'
          }
        }
      }, CallToolResultSchema);
      
      const text = (response.content[0] as any).text;
      expect(text).toContain('Successfully built and ran project');
      expect(text).toContain('Platform: visionOS');
    }, 120000);
  });

  describe('Configuration Options', () => {
    test('should run with Debug configuration', async () => {
      const response = await client.request({
        method: 'tools/call',
        params: {
          name: 'run_xcode',
          arguments: {
            projectPath: projectManager.paths.xcodeProjectXCTestPath,
            scheme: projectManager.schemes.xcodeProject,
            platform: 'iOS',
            configuration: 'Debug'
          }
        }
      }, CallToolResultSchema);
      
      const text = (response.content[0] as any).text;
      expect(text).toContain('Configuration: Debug');
    }, 120000);

    test('should run with Release configuration', async () => {
      const response = await client.request({
        method: 'tools/call',
        params: {
          name: 'run_xcode',
          arguments: {
            projectPath: projectManager.paths.xcodeProjectXCTestPath,
            scheme: projectManager.schemes.xcodeProject,
            platform: 'iOS',
            configuration: 'Release'
          }
        }
      }, CallToolResultSchema);
      
      const text = (response.content[0] as any).text;
      expect(text).toContain('Configuration: Release');
    }, 120000);
  });

  describe('Workspace Support', () => {
    test('should run project from workspace', async () => {
      const response = await client.request({
        method: 'tools/call',
        params: {
          name: 'run_xcode',
          arguments: {
            projectPath: projectManager.paths.workspacePath,
            scheme: projectManager.schemes.workspace,
            platform: 'iOS'
          }
        }
      }, CallToolResultSchema);
      
      const text = (response.content[0] as any).text;
      expect(text).toContain('Successfully built and ran project');
    }, 120000);
  });

  describe('Error Handling', () => {
    test('should handle non-existent project', async () => {
      const response = await client.request({
        method: 'tools/call',
        params: {
          name: 'run_xcode',
          arguments: {
            projectPath: '/non/existent/project.xcodeproj',
            scheme: 'NonExistent'
          }
        }
      }, CallToolResultSchema);
      
      const text = (response.content[0] as any).text;
      expect(text).toContain('Run failed');
    }, 30000);

    test('should handle invalid scheme', async () => {
      const response = await client.request({
        method: 'tools/call',
        params: {
          name: 'run_xcode',
          arguments: {
            projectPath: projectManager.paths.xcodeProjectXCTestPath,
            scheme: 'InvalidScheme',
            platform: 'iOS'
          }
        }
      }, CallToolResultSchema);
      
      const text = (response.content[0] as any).text;
      expect(text).toContain('Run failed');
    }, 60000);

    test('should require scheme parameter', async () => {
      const response = await client.request({
        method: 'tools/call',
        params: {
          name: 'run_xcode',
          arguments: {
            projectPath: projectManager.paths.xcodeProjectXCTestPath,
            platform: 'iOS'
            // Missing required scheme parameter
          }
        }
      }, CallToolResultSchema);
      
      const text = (response.content[0] as any).text;
      // Should fail with validation error about missing required field
      expect(text.toLowerCase()).toContain('validation error');
      expect(text.toLowerCase()).toContain('scheme');
      expect(text.toLowerCase()).toContain('required');
    }, 60000);
  });
});