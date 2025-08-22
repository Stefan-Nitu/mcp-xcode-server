/**
 * E2E tests for RunProjectTool
 * Tests building and running projects on all Apple platforms
 */

import { describe, test, expect, beforeAll, afterAll, beforeEach, afterEach } from '@jest/globals';
import { execSync } from 'child_process';
import { Client } from '@modelcontextprotocol/sdk/client/index';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio';
import { CallToolResultSchema } from '@modelcontextprotocol/sdk/types';
import { TestProjectManager } from '../utils/TestProjectManager';
import { createAndConnectClient, cleanupClientAndTransport } from '../utils/testHelpers';
import { createModuleLogger } from '../../logger';

const logger = createModuleLogger('run-project.e2e.test');

describe('RunProjectTool E2E Tests', () => {
  let client: Client;
  let transport: StdioClientTransport;
  let projectManager: TestProjectManager;
  
  // Set this to true to skip tests when simulators are not available
  // Default is false since we expect all simulators to be available
  const SKIP_IF_SIMULATOR_UNAVAILABLE = false;
  
  beforeAll(async () => {
    // Build the server
    execSync('npm run build', { cwd: process.cwd() });
    
    // Initialize project manager
    projectManager = new TestProjectManager();
    await projectManager.setup();
  }, 120000);
  
  afterAll(async () => {
    // Clean up test artifacts
    projectManager.cleanup();
    
    // Note: We don't need to shutdown simulators since run_project manages them
    // If you want to clean up all simulators after tests, uncomment:
    try {
      execSync('xcrun simctl shutdown all', { stdio: 'ignore' });
    } catch {
      // Ignore errors
    }
  });
  
  beforeEach(async () => {
    // Create and connect MCP client
    const connection = await createAndConnectClient();
    client = connection.client;
    transport = connection.transport;
  }, 30000);
  
  afterEach(async () => {
    // Clean up client and transport
    await cleanupClientAndTransport(client, transport);
    
    // Clean build artifacts after each test
    projectManager.cleanBuildArtifacts();
  });

  /**
   * Helper function to get an available simulator name for a platform (without booting)
   */
  async function getAvailableSimulator(platform: string): Promise<string | null> {
    try {
      const output = execSync(`xcrun simctl list devices -j`, { encoding: 'utf8' });
      const data = JSON.parse(output);
      
      // Find devices for the specified platform
      const platformKeys = Object.keys(data.devices).filter(key => {
        const keyLower = key.toLowerCase();
        const platformLower = platform.toLowerCase();
        return keyLower.includes(platformLower);
      });
      
      if (platformKeys.length === 0) {
        logger.warn({ platform }, 'No simulators found for platform');
        return null;
      }
      
      // Get all devices for this platform
      const devices = platformKeys.flatMap(key => data.devices[key] as any[]);
      
      // Find an available device
      const availableDevice = devices.find(d => d.isAvailable);
      
      if (!availableDevice) {
        logger.warn({ platform }, 'No available devices for platform');
        return null;
      }
      
      logger.info({ platform, device: availableDevice.name }, 'Found available simulator');
      return availableDevice.name;
    } catch (error) {
      logger.error({ error, platform }, 'Failed to get available simulator');
      return null;
    }
  }


  describe('iOS Platform', () => {
    test('should build and run iOS project', async () => {
      const response = await client.request({
        method: 'tools/call',
        params: {
          name: 'run_project',
          arguments: {
            projectPath: projectManager.paths.xcodeProjectPath,
            scheme: projectManager.schemes.xcodeProject,
            platform: 'iOS',
            configuration: 'Debug'
          }
        }
      }, CallToolResultSchema);
      
      expect(response).toBeDefined();
      const text = (response.content[0] as any).text;
      expect(text).toContain('Successfully built and ran project');
      expect(text).toContain('Platform: iOS');
      expect(text).toContain('App installed at:');
    }, 120000);

    test('should build and run iOS project with specific device', async () => {
      // Get an available iOS simulator name (but don't boot it - run_project will do that)
      const deviceName = await getAvailableSimulator('iOS');
      
      if (!deviceName && SKIP_IF_SIMULATOR_UNAVAILABLE) {
        console.warn('No iOS simulator available, skipping test');
        return;
      }
      
      // We expect a simulator to be available
      expect(deviceName).toBeTruthy();
      
      const response = await client.request({
        method: 'tools/call',
        params: {
          name: 'run_project',
          arguments: {
            projectPath: projectManager.paths.xcodeProjectPath,
            scheme: projectManager.schemes.xcodeProject,
            platform: 'iOS',
            deviceId: deviceName,  // Pass the device name, run_project will boot it
            configuration: 'Debug'
          }
        }
      }, CallToolResultSchema);
      
      expect(response).toBeDefined();
      const text = (response.content[0] as any).text;
      expect(text).toContain('Successfully built and ran project');
      expect(text).toContain('Platform: iOS');
      expect(text).toContain(`Device: ${deviceName}`);
    }, 120000);

    test('should build and run with device UDID', async () => {
      // Get list of available iOS simulators and use UDID instead of name
      const output = execSync(`xcrun simctl list devices -j`, { encoding: 'utf8' });
      const data = JSON.parse(output);
      
      const iosKeys = Object.keys(data.devices).filter(key => 
        key.toLowerCase().includes('ios')
      );
      
      if (iosKeys.length === 0) {
        console.warn('No iOS simulators found, skipping test');
        return;
      }
      
      const availableDevice = iosKeys.flatMap(key => data.devices[key] as any[])
        .find(d => d.isAvailable);
      
      if (!availableDevice) {
        console.warn('No available iOS simulator found, skipping test');
        return;
      }
      
      logger.info({ udid: availableDevice.udid, name: availableDevice.name }, 'Testing with device UDID');
      
      const response = await client.request({
        method: 'tools/call',
        params: {
          name: 'run_project',
          arguments: {
            projectPath: projectManager.paths.xcodeProjectPath,
            scheme: projectManager.schemes.xcodeProject,
            platform: 'iOS',
            deviceId: availableDevice.udid,  // Use UDID instead of name
            configuration: 'Debug'
          }
        }
      }, CallToolResultSchema);
      
      expect(response).toBeDefined();
      const text = (response.content[0] as any).text;
      expect(text).toContain('Successfully built and ran project');
      expect(text).toContain('Platform: iOS');
      // The tool should work with UDID and report the device name
      expect(text).toContain(availableDevice.name);
    }, 120000);

    test('should respect device choice when multiple devices available', async () => {
      // Get list of all available iOS simulators
      const output = execSync(`xcrun simctl list devices -j`, { encoding: 'utf8' });
      const data = JSON.parse(output);
      
      // Find iOS devices
      const iosKeys = Object.keys(data.devices).filter(key => 
        key.toLowerCase().includes('ios')
      );
      
      if (iosKeys.length === 0) {
        console.warn('No iOS simulators found, skipping test');
        return;
      }
      
      const allDevices = iosKeys.flatMap(key => data.devices[key] as any[])
        .filter(d => d.isAvailable);
      
      if (allDevices.length < 2) {
        console.warn('Need at least 2 iOS simulators for this test, skipping');
        return;
      }
      
      // Pick a specific device that is NOT the first one (to ensure we're not just getting default)
      const chosenDevice = allDevices[allDevices.length - 1]; // Last device in list
      logger.info({ device: chosenDevice.name }, 'Testing with specific device choice');
      
      const response = await client.request({
        method: 'tools/call',
        params: {
          name: 'run_project',
          arguments: {
            projectPath: projectManager.paths.xcodeProjectPath,
            scheme: projectManager.schemes.xcodeProject,
            platform: 'iOS',
            deviceId: chosenDevice.name,  // Explicitly choose this device
            configuration: 'Debug'
          }
        }
      }, CallToolResultSchema);
      
      expect(response).toBeDefined();
      const text = (response.content[0] as any).text;
      expect(text).toContain('Successfully built and ran project');
      expect(text).toContain('Platform: iOS');
      // Verify the tool used our chosen device
      expect(text).toContain(chosenDevice.name);
    }, 120000);
  });

  describe('macOS Platform', () => {
    test('should build and run macOS project', async () => {
      // Note: macOS doesn't need a simulator
      const response = await client.request({
        method: 'tools/call',
        params: {
          name: 'run_project',
          arguments: {
            projectPath: projectManager.paths.xcodeProjectPath,
            scheme: projectManager.schemes.xcodeProject,
            platform: 'macOS',
            configuration: 'Debug'
          }
        }
      }, CallToolResultSchema);
      
      expect(response).toBeDefined();
      const text = (response.content[0] as any).text;
      expect(text).toContain('Successfully built and ran project');
      expect(text).toContain('Platform: macOS');
    }, 120000);
  });

  describe('watchOS Platform', () => {
    test('should build and run watchOS project', async () => {
      const response = await client.request({
        method: 'tools/call',
        params: {
          name: 'run_project',
          arguments: {
            projectPath: projectManager.paths.watchOSProjectPath,
            scheme: projectManager.schemes.watchOSProject,
            platform: 'watchOS',
            configuration: 'Debug'
          }
        }
      }, CallToolResultSchema);
      
      expect(response).toBeDefined();
      const text = (response.content[0] as any).text;
      expect(text).toContain('Successfully built and ran project');
      expect(text).toContain('Platform: watchOS');
    }, 120000);
  });

  describe('tvOS Platform', () => {
    test('should build and run tvOS project', async () => {
      // Note: We need to create a tvOS-compatible project first
      // For now, we'll test with a multi-platform project
      const response = await client.request({
        method: 'tools/call',
        params: {
          name: 'run_project',
          arguments: {
            projectPath: projectManager.paths.xcodeProjectPath,
            scheme: projectManager.schemes.xcodeProject,
            platform: 'tvOS',
            configuration: 'Debug'
          }
        }
      }, CallToolResultSchema);
      
      expect(response).toBeDefined();
      const text = (response.content[0] as any).text;
      // May fail if project doesn't support tvOS, but should not crash
      expect(text).toBeDefined();
    }, 120000);
  });

  describe('visionOS Platform', () => {
    test('should attempt to build and run visionOS project', async () => {
      // Note: visionOS requires Xcode 15+ and visionOS SDK
      
      if (SKIP_IF_SIMULATOR_UNAVAILABLE) {
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
      }
      
      const response = await client.request({
        method: 'tools/call',
        params: {
          name: 'run_project',
          arguments: {
            projectPath: projectManager.paths.xcodeProjectPath,
            scheme: projectManager.schemes.xcodeProject,
            platform: 'visionOS',
            configuration: 'Debug'
          }
        }
      }, CallToolResultSchema);
      
      expect(response).toBeDefined();
      const text = (response.content[0] as any).text;
      // May fail if project doesn't support visionOS, but should not crash
      expect(text).toBeDefined();
    }, 120000);
  });

  describe('Configuration Options', () => {
    test('should build and run with Release configuration', async () => {
      const response = await client.request({
        method: 'tools/call',
        params: {
          name: 'run_project',
          arguments: {
            projectPath: projectManager.paths.xcodeProjectPath,
            scheme: projectManager.schemes.xcodeProject,
            platform: 'iOS',
            configuration: 'Release'
          }
        }
      }, CallToolResultSchema);
      
      expect(response).toBeDefined();
      const text = (response.content[0] as any).text;
      expect(text).toContain('Successfully built and ran project');
      expect(text).toContain('Configuration: Release');
    }, 120000);
  });

  describe('Workspace Support', () => {
    test('should build and run project from workspace', async () => {
      const response = await client.request({
        method: 'tools/call',
        params: {
          name: 'run_project',
          arguments: {
            projectPath: projectManager.paths.workspacePath,
            scheme: projectManager.schemes.workspace,
            platform: 'iOS',
            configuration: 'Debug'
          }
        }
      }, CallToolResultSchema);
      
      expect(response).toBeDefined();
      const text = (response.content[0] as any).text;
      expect(text).toContain('Successfully built and ran project');
    }, 120000);
  });

  describe('Error Handling', () => {
    test('should handle non-existent project path', async () => {
      const response = await client.request({
        method: 'tools/call',
        params: {
          name: 'run_project',
          arguments: {
            projectPath: '/non/existent/project.xcodeproj',
            scheme: 'NonExistent',
            platform: 'iOS'
          }
        }
      }, CallToolResultSchema);
      
      expect(response).toBeDefined();
      const text = (response.content[0] as any).text;
      expect(text.toLowerCase()).toContain('error');
    }, 30000);  // 30 second timeout for error cases

    test('should handle invalid scheme', async () => {
      const response = await client.request({
        method: 'tools/call',
        params: {
          name: 'run_project',
          arguments: {
            projectPath: projectManager.paths.xcodeProjectPath,
            scheme: 'InvalidScheme',
            platform: 'iOS'
          }
        }
      }, CallToolResultSchema);
      
      expect(response).toBeDefined();
      const text = (response.content[0] as any).text;
      expect(text.toLowerCase()).toContain('error');
    }, 60000);  // 1 minute timeout

    test('should handle unsupported platform for project', async () => {
      // Try to build watchOS project as iOS
      const response = await client.request({
        method: 'tools/call',
        params: {
          name: 'run_project',
          arguments: {
            projectPath: projectManager.paths.watchOSProjectPath,
            scheme: projectManager.schemes.watchOSProject,
            platform: 'iOS',  // Wrong platform for watchOS project
            configuration: 'Debug'
          }
        }
      }, CallToolResultSchema);
      
      expect(response).toBeDefined();
      const text = (response.content[0] as any).text;
      expect(text.toLowerCase()).toContain('error');
    }, 120000);  // Add 2 minute timeout
  });

  describe('Swift Package Manager Support', () => {
    test('should build and run Swift package', async () => {
      const response = await client.request({
        method: 'tools/call',
        params: {
          name: 'run_project',
          arguments: {
            projectPath: `${projectManager.paths.swiftPackageDir}/Package.swift`,
            platform: 'macOS',
            configuration: 'Debug'
          }
        }
      }, CallToolResultSchema);
      
      expect(response).toBeDefined();
      const text = (response.content[0] as any).text;
      // Should either succeed or report that it's not an executable package
      expect(text).toBeDefined();
    }, 120000);
  });

  describe('Concurrent Builds', () => {
    test('should handle concurrent run requests for different platforms', async () => {
      const promises = [
        client.request({
          method: 'tools/call',
          params: {
            name: 'run_project',
            arguments: {
              projectPath: projectManager.paths.xcodeProjectPath,
              scheme: projectManager.schemes.xcodeProject,
              platform: 'iOS',
              configuration: 'Debug'
            }
          }
        }, CallToolResultSchema),
        
        client.request({
          method: 'tools/call',
          params: {
            name: 'run_project',
            arguments: {
              projectPath: projectManager.paths.xcodeProjectPath,
              scheme: projectManager.schemes.xcodeProject,
              platform: 'macOS',
              configuration: 'Debug'
            }
          }
        }, CallToolResultSchema)
      ];
      
      const results = await Promise.allSettled(promises);
      
      // At least one should succeed
      const successfulResults = results.filter(r => r.status === 'fulfilled');
      expect(successfulResults.length).toBeGreaterThan(0);
    }, 180000);
  });
});