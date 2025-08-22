/**
 * E2E tests for InstallAppTool
 * Tests app installation on simulators using real built apps
 */

import { describe, test, expect, beforeAll, afterAll, beforeEach, afterEach } from '@jest/globals';
import { join } from 'path';
import { execSync } from 'child_process';
import { Client } from '@modelcontextprotocol/sdk/client/index';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio';
import { CallToolResultSchema } from '@modelcontextprotocol/sdk/types';
import { TestProjectManager } from '../utils/TestProjectManager';
import { createAndConnectClient, cleanupClientAndTransport } from '../utils/testHelpers';

describe('InstallAppTool E2E Tests', () => {
  let client: Client;
  let transport: StdioClientTransport;
  let projectManager: TestProjectManager;
  
  // Track installed apps for cleanup
  const installedApps: { bundleId: string; deviceId: string }[] = [];
  const bootedSimulators: string[] = [];
  
  // Store built app paths
  let testApp1Path: string | null = null;
  let testApp2Path: string | null = null;
  
  beforeAll(async () => {
    // Setup test project manager
    projectManager = new TestProjectManager();
    await projectManager.setup();
    
    // Build the server
    execSync('npm run build', { cwd: process.cwd() });
    
    // Build test apps using the build tool
    await buildTestApps();
  }, 180000); // 3 minutes for building apps
  
  afterAll(() => {
    // Shutdown simulators
    bootedSimulators.forEach(deviceId => {
      try {
        execSync(`xcrun simctl shutdown "${deviceId}"`, { stdio: 'ignore' });
      } catch {
        // Ignore errors
      }
    });
    
    // Clean up using project manager
    projectManager.cleanup();
  });
  
  beforeEach(async () => {
    const connection = await createAndConnectClient();
    client = connection.client;
    transport = connection.transport;
  }, 30000);
  
  afterEach(async () => {
    // Uninstall all apps we installed
    cleanupInstalledApps();
    
    // Cleanup client and transport
    await cleanupClientAndTransport(client, transport);
  });

  function cleanupInstalledApps() {
    installedApps.forEach(({ bundleId, deviceId }) => {
      try {
        execSync(`xcrun simctl uninstall "${deviceId}" "${bundleId}"`, { stdio: 'ignore' });
      } catch {
        // App might already be uninstalled
      }
    });
    installedApps.length = 0;
  }

  async function buildTestApps() {
    // Create a client just for building
    const { client: buildClient, transport: buildTransport } = await createAndConnectClient();
    
    try {
      // Build TestProjectSwiftTesting for iOS
      const buildResponse1 = await buildClient.request({
        method: 'tools/call',
        params: {
          name: 'build',
          arguments: {
            projectPath: join(projectManager.paths.testProjectDir, 'TestProjectSwiftTesting', 'TestProjectSwiftTesting.xcodeproj'),
            scheme: 'TestProjectSwiftTesting',
            platform: 'iOS',
            configuration: 'Debug'
          }
        }
      }, CallToolResultSchema);
      
      // Extract app path from response
      const buildText1 = (buildResponse1.content[0] as any).text;
      const appPathMatch1 = buildText1.match(/App path: (.+)$/m);
      testApp1Path = appPathMatch1 ? appPathMatch1[1].trim() : null;
      
      if (!testApp1Path || testApp1Path === 'N/A') {
        throw new Error('Failed to build TestProjectSwiftTesting');
      }
      
      // Build TestProjectXCTest for iOS
      const buildResponse2 = await buildClient.request({
        method: 'tools/call',
        params: {
          name: 'build',
          arguments: {
            projectPath: projectManager.paths.xcodeProjectPath,
            scheme: projectManager.schemes.xcodeProject,
            platform: 'iOS',
            configuration: 'Debug'
          }
        }
      }, CallToolResultSchema);
      
      // Extract app path from response
      const buildText2 = (buildResponse2.content[0] as any).text;
      const appPathMatch2 = buildText2.match(/App path: (.+)$/m);
      testApp2Path = appPathMatch2 ? appPathMatch2[1].trim() : null;
      
      if (!testApp2Path || testApp2Path === 'N/A') {
        throw new Error('Failed to build TestProjectXCTest');
      }
      
    } finally {
      await cleanupClientAndTransport(buildClient, buildTransport);
    }
  }

  async function getBootedSimulator(): Promise<string | null> {
    try {
      const output = execSync('xcrun simctl list devices booted -j', { encoding: 'utf8' });
      const data = JSON.parse(output);
      const devices = Object.values(data.devices).flat() as any[];
      const booted = devices.find(d => d.state === 'Booted');
      return booted?.udid || null;
    } catch {
      return null;
    }
  }

  async function bootSimulator(): Promise<string | null> {
    try {
      // Get available iOS simulators
      const output = execSync('xcrun simctl list devices available -j', { encoding: 'utf8' });
      const data = JSON.parse(output);
      const iosDevices = Object.entries(data.devices)
        .filter(([key]) => key.includes('iOS'))
        .flatMap(([, devices]) => devices as any[])
        .filter(d => d.isAvailable);
      
      if (iosDevices.length === 0) return null;
      
      const device = iosDevices[0];
      execSync(`xcrun simctl boot "${device.udid}"`, { stdio: 'ignore' });
      bootedSimulators.push(device.udid);
      
      // Wait for boot
      await new Promise(resolve => setTimeout(resolve, 5000));
      return device.udid;
    } catch {
      return null;
    }
  }

  describe('Basic Installation', () => {
    test('should install app on booted simulator', async () => {
      // Ensure we have a booted simulator
      let deviceId = await getBootedSimulator();
      if (!deviceId) {
        deviceId = await bootSimulator();
      }
      
      if (!deviceId) {
        console.warn('No simulator available, skipping test');
        return;
      }
      
      if (!testApp1Path) {
        throw new Error('Test app not built');
      }
      
      const response = await client.request({
        method: 'tools/call',
        params: {
          name: 'install_app',
          arguments: {
            appPath: testApp1Path,
            deviceId: deviceId
          }
        }
      }, CallToolResultSchema);
      
      expect(response).toBeDefined();
      const text = (response.content[0] as any).text;
      expect(text).toContain('Successfully installed app');
      
      // Track for cleanup
      installedApps.push({ bundleId: 'com.test.TestProjectSwiftTesting', deviceId });
    }, 30000);

    test('should install app without specifying device (uses booted)', async () => {
      // Ensure we have a booted simulator
      let deviceId = await getBootedSimulator();
      if (!deviceId) {
        deviceId = await bootSimulator();
      }
      
      if (!deviceId) {
        console.warn('No simulator available, skipping test');
        return;
      }
      
      if (!testApp2Path) {
        throw new Error('Test app not built');
      }
      
      const response = await client.request({
        method: 'tools/call',
        params: {
          name: 'install_app',
          arguments: {
            appPath: testApp2Path
          }
        }
      }, CallToolResultSchema);
      
      expect(response).toBeDefined();
      const text = (response.content[0] as any).text;
      expect(text).toContain('Successfully installed app');
      
      // Track for cleanup
      installedApps.push({ bundleId: 'com.test.TestProjectXCTest', deviceId });
    });

    test('should install multiple apps on same device', async () => {
      let deviceId = await getBootedSimulator();
      if (!deviceId) {
        deviceId = await bootSimulator();
      }
      
      if (!deviceId) {
        console.warn('No simulator available, skipping test');
        return;
      }
      
      if (!testApp1Path || !testApp2Path) {
        throw new Error('Test apps not built');
      }
      
      // Install first app
      const response1 = await client.request({
        method: 'tools/call',
        params: {
          name: 'install_app',
          arguments: {
            appPath: testApp1Path,
            deviceId: deviceId
          }
        }
      }, CallToolResultSchema);
      
      expect(response1).toBeDefined();
      installedApps.push({ bundleId: 'com.test.TestProjectSwiftTesting', deviceId });
      
      // Install second app
      const response2 = await client.request({
        method: 'tools/call',
        params: {
          name: 'install_app',
          arguments: {
            appPath: testApp2Path,
            deviceId: deviceId
          }
        }
      }, CallToolResultSchema);
      
      expect(response2).toBeDefined();
      installedApps.push({ bundleId: 'com.test.TestProjectXCTest', deviceId });
      
      // Both should succeed
      expect((response1.content[0] as any).text).toContain('Successfully installed');
      expect((response2.content[0] as any).text).toContain('Successfully installed');
    });
  });

  describe('Reinstallation', () => {
    test('should handle reinstalling same app', async () => {
      let deviceId = await getBootedSimulator();
      if (!deviceId) {
        deviceId = await bootSimulator();
      }
      
      if (!deviceId) {
        console.warn('No simulator available, skipping test');
        return;
      }
      
      if (!testApp1Path) {
        throw new Error('Test app not built');
      }
      
      // Install first time
      await client.request({
        method: 'tools/call',
        params: {
          name: 'install_app',
          arguments: {
            appPath: testApp1Path,
            deviceId
          }
        }
      }, CallToolResultSchema);
      
      // Install again (should overwrite)
      const response = await client.request({
        method: 'tools/call',
        params: {
          name: 'install_app',
          arguments: {
            appPath: testApp1Path,
            deviceId
          }
        }
      }, CallToolResultSchema);
      
      expect(response).toBeDefined();
      const text = (response.content[0] as any).text;
      expect(text).toContain('Successfully installed');
      
      installedApps.push({ bundleId: 'com.test.TestProjectSwiftTesting', deviceId });
    });
  });

  describe('Error Handling', () => {
    test('should handle non-existent app path', async () => {
      const response = await client.request({
        method: 'tools/call',
        params: {
          name: 'install_app',
          arguments: {
            appPath: '/non/existent/app.app'
          }
        }
      }, CallToolResultSchema);
      
      expect(response).toBeDefined();
      const text = (response.content[0] as any).text;
      expect(text.toLowerCase()).toContain('error');
    });

    test('should handle invalid app path format', async () => {
      // Try to install a non-.app file
      const response = await client.request({
        method: 'tools/call',
        params: {
          name: 'install_app',
          arguments: {
            appPath: projectManager.paths.xcodeProjectPath // .xcodeproj instead of .app
          }
        }
      }, CallToolResultSchema);
      
      expect(response).toBeDefined();
      const text = (response.content[0] as any).text;
      expect(text.toLowerCase()).toContain('error');
    });

    test('should handle non-existent device', async () => {
      if (!testApp1Path) {
        throw new Error('Test app not built');
      }
      
      const response = await client.request({
        method: 'tools/call',
        params: {
          name: 'install_app',
          arguments: {
            appPath: testApp1Path,
            deviceId: 'non-existent-device-id'
          }
        }
      }, CallToolResultSchema);
      
      expect(response).toBeDefined();
      const text = (response.content[0] as any).text;
      expect(text.toLowerCase()).toContain('error');
    });

    test('should handle no booted devices', async () => {
      // Shutdown all simulators
      try {
        execSync('xcrun simctl shutdown all', { stdio: 'ignore' });
      } catch {
        // Ignore errors
      }
      
      if (!testApp1Path) {
        throw new Error('Test app not built');
      }
      
      const response = await client.request({
        method: 'tools/call',
        params: {
          name: 'install_app',
          arguments: {
            appPath: testApp1Path
            // No deviceId and no booted devices
          }
        }
      }, CallToolResultSchema);
      
      expect(response).toBeDefined();
      const text = (response.content[0] as any).text;
      expect(text.toLowerCase()).toContain('error');
    });

    test('should handle path traversal attempts', async () => {
      const response = await client.request({
        method: 'tools/call',
        params: {
          name: 'install_app',
          arguments: {
            appPath: '../../../etc/passwd'
          }
        }
      }, CallToolResultSchema);
      
      expect(response).toBeDefined();
      // Should be rejected by validation
      const text = (response.content[0] as any).text;
      expect(text.toLowerCase()).toContain('error');
    });
  });

  describe('Device Selection', () => {
    test('should install on specific device by name', async () => {
      // Get available devices
      const listResponse = await client.request({
        method: 'tools/call',
        params: {
          name: 'list_simulators',
          arguments: {
            platform: 'iOS'
          }
        }
      }, CallToolResultSchema);
      
      const devices = JSON.parse((listResponse.content[0] as any).text);
      const availableDevice = devices.find((d: any) => d.isAvailable);
      
      if (!availableDevice) {
        console.warn('No available devices, skipping test');
        return;
      }
      
      if (!testApp1Path) {
        throw new Error('Test app not built');
      }
      
      // Boot if needed
      if (availableDevice.state !== 'Booted') {
        execSync(`xcrun simctl boot "${availableDevice.udid}"`, { stdio: 'ignore' });
        bootedSimulators.push(availableDevice.udid);
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
      
      const response = await client.request({
        method: 'tools/call',
        params: {
          name: 'install_app',
          arguments: {
            appPath: testApp1Path,
            deviceId: availableDevice.name
          }
        }
      }, CallToolResultSchema);
      
      expect(response).toBeDefined();
      const text = (response.content[0] as any).text;
      expect(text).toContain('Successfully installed');
      
      installedApps.push({ bundleId: 'com.test.TestProjectSwiftTesting', deviceId: availableDevice.udid });
    }, 60000);

    test('should install on specific device by UDID', async () => {
      let deviceId = await getBootedSimulator();
      if (!deviceId) {
        deviceId = await bootSimulator();
      }
      
      if (!deviceId) {
        console.warn('No simulator available, skipping test');
        return;
      }
      
      if (!testApp2Path) {
        throw new Error('Test app not built');
      }
      
      const response = await client.request({
        method: 'tools/call',
        params: {
          name: 'install_app',
          arguments: {
            appPath: testApp2Path,
            deviceId: deviceId // Using UDID directly
          }
        }
      }, CallToolResultSchema);
      
      expect(response).toBeDefined();
      const text = (response.content[0] as any).text;
      expect(text).toContain('Successfully installed');
      
      installedApps.push({ bundleId: 'com.test.TestProjectXCTest', deviceId });
    }, 30000);
  });

  describe('Concurrent Installations', () => {
    test('should handle concurrent install requests', async () => {
      let deviceId = await getBootedSimulator();
      if (!deviceId) {
        deviceId = await bootSimulator();
      }
      
      if (!deviceId) {
        console.warn('No simulator available, skipping test');
        return;
      }
      
      if (!testApp1Path || !testApp2Path) {
        throw new Error('Test apps not built');
      }
      
      // Install apps concurrently
      const installs = Promise.all([
        client.request({
          method: 'tools/call',
          params: {
            name: 'install_app',
            arguments: {
              appPath: testApp1Path,
              deviceId
            }
          }
        }, CallToolResultSchema),
        
        client.request({
          method: 'tools/call',
          params: {
            name: 'install_app',
            arguments: {
              appPath: testApp2Path,
              deviceId
            }
          }
        }, CallToolResultSchema)
      ]);
      
      const results = await installs;
      
      expect(results).toHaveLength(2);
      results.forEach(response => {
        expect(response).toBeDefined();
        const text = (response.content[0] as any).text;
        expect(text).toContain('Successfully installed');
      });
      
      // Track for cleanup
      installedApps.push(
        { bundleId: 'com.test.TestProjectSwiftTesting', deviceId },
        { bundleId: 'com.test.TestProjectXCTest', deviceId }
      );
    }, 30000);
  });
});