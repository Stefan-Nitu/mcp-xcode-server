/**
 * E2E tests for app installation and uninstallation lifecycle
 * Tests the complete flow: install -> verify -> uninstall -> verify
 */

import { describe, test, expect, beforeAll, afterAll, beforeEach, afterEach } from '@jest/globals';
import { execSync } from 'child_process';
import { Client } from '@modelcontextprotocol/sdk/client/index';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio';
import { CallToolResultSchema } from '@modelcontextprotocol/sdk/types';
import { TestProjectManager } from '../../utils/TestProjectManager';
import { TestEnvironmentCleaner } from '../../utils/TestEnvironmentCleaner';
import { createAndConnectClient, cleanupClientAndTransport } from '../../utils/testHelpers';

describe('App Installation and Uninstallation E2E Tests', () => {
  let client: Client;
  let transport: StdioClientTransport;
  let projectManager: TestProjectManager;
  
  // Track simulators we boot for cleanup
  const bootedSimulators: string[] = [];
  
  // Store built app paths
  let testApp1Path: string | null = null;
  let testApp2Path: string | null = null;
  const testApp1BundleId = 'com.TestProjectSwiftTesting';
  const testApp2BundleId = 'com.TestProjectXCTest';
  
  beforeAll(async () => {
    // Setup test project manager
    projectManager = new TestProjectManager();
    await projectManager.setup();
    
    // Build the server
    execSync('npm run build', { cwd: process.cwd() });
    
    // Build test apps once for all tests
    await buildTestApps();
  }, 180000); // 3 minutes for building apps
  
  afterAll(async () => {
    // Shutdown all simulators first (can't reset while booted)
    TestEnvironmentCleaner.shutdownAllSimulators();
    
    // Now reset the simulators we booted
    bootedSimulators.forEach(deviceId => {
      TestEnvironmentCleaner.resetSimulator(deviceId);
    });
    
    // Clean up using project manager
    await projectManager.cleanup();
  }, 60000); // 60 seconds for cleanup including simulator resets
  
  beforeEach(async () => {
    const connection = await createAndConnectClient();
    client = connection.client;
    transport = connection.transport;
  }, 30000);
  
  afterEach(async () => {
    // Only shutdown simulators, don't clean DerivedData as we need the built apps
    TestEnvironmentCleaner.shutdownAllSimulators();
    TestEnvironmentCleaner.killTestProjectApp();
    
    // Cleanup client and transport
    await cleanupClientAndTransport(client, transport);
  });

  /**
   * Helper to check if an app with exact bundle ID is installed
   * Uses regex to match exact bundle ID entry, not substrings (to avoid test runner confusion)
   */
  function isAppInstalled(appsList: string, bundleId: string): boolean {
    const pattern = new RegExp(`"${bundleId}"\\s*=\\s*\\{`);
    return pattern.test(appsList);
  }

  async function buildTestApps() {
    // Create a client just for building
    const { client: buildClient, transport: buildTransport } = await createAndConnectClient();
    
    try {
      // Build TestProjectSwiftTesting for iOS
      const buildResponse1 = await buildClient.request({
        method: 'tools/call',
        params: {
          name: 'build_xcode',
          arguments: {
            projectPath: projectManager.paths.xcodeProjectSwiftTestingPath,
            scheme: projectManager.schemes.xcodeProjectSwiftTesting,
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
        throw new Error('Failed to build TestProjectSwiftTesting - no app path found');
      }
      
      // Build TestProjectXCTest for iOS
      const buildResponse2 = await buildClient.request({
        method: 'tools/call',
        params: {
          name: 'build_xcode',
          arguments: {
            projectPath: projectManager.paths.xcodeProjectXCTestPath,
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
        throw new Error('Failed to build TestProjectXCTest - no app path found');
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
      TestEnvironmentCleaner.bootSimulator(device.udid);
      bootedSimulators.push(device.udid);
      
      // Wait for boot
      await new Promise(resolve => setTimeout(resolve, 5000));
      return device.udid;
    } catch {
      return null;
    }
  }

  async function ensureSimulator(): Promise<string> {
    let deviceId = await getBootedSimulator();
    if (!deviceId) {
      deviceId = await bootSimulator();
    } else {
      // Track already-booted simulator for cleanup
      if (!bootedSimulators.includes(deviceId)) {
        bootedSimulators.push(deviceId);
      }
    }
    
    if (!deviceId) {
      throw new Error('No simulator available');
    }
    
    return deviceId;
  }

  describe('Basic App Lifecycle', () => {
    test('should install and uninstall app successfully', async () => {
      const deviceId = await ensureSimulator();
      
      if (!testApp1Path) {
        throw new Error('Test app not built');
      }
      
      // Install app
      const installResponse = await client.request({
        method: 'tools/call',
        params: {
          name: 'install_app',
          arguments: {
            appPath: testApp1Path,
            deviceId: deviceId
          }
        }
      }, CallToolResultSchema);
      
      const installText = (installResponse.content[0] as any).text;
      expect(installText).toMatch(/^Successfully installed app: .+ on .+$/);
      expect(installText).toContain(testApp1Path);
      
      // Verify app is installed
      const installedApps = execSync(`xcrun simctl listapps "${deviceId}"`, { encoding: 'utf8' });
      expect(isAppInstalled(installedApps, testApp1BundleId)).toBe(true);
      
      // Uninstall app
      const uninstallResponse = await client.request({
        method: 'tools/call',
        params: {
          name: 'uninstall_app',
          arguments: {
            bundleId: testApp1BundleId,
            deviceId: deviceId
          }
        }
      }, CallToolResultSchema);
      
      const uninstallText = (uninstallResponse.content[0] as any).text;
      expect(uninstallText).toContain('Successfully uninstalled');
      expect(uninstallText).toContain(testApp1BundleId);
      expect(uninstallText).toContain(' from ');
      
      // Verify app is uninstalled
      const appsAfterUninstall = execSync(`xcrun simctl listapps "${deviceId}"`, { encoding: 'utf8' });
      expect(isAppInstalled(appsAfterUninstall, testApp1BundleId)).toBe(false);
    }, 60000);

    test('should handle install and uninstall without specifying device', async () => {
      const deviceId = await ensureSimulator();
      
      if (!testApp2Path) {
        throw new Error('Test app not built');
      }
      
      // Install without deviceId (uses booted device)
      const installResponse = await client.request({
        method: 'tools/call',
        params: {
          name: 'install_app',
          arguments: {
            appPath: testApp2Path
          }
        }
      }, CallToolResultSchema);
      
      const installText = (installResponse.content[0] as any).text;
      expect(installText).toMatch(/^Successfully installed app: .+ on .+$/);
      expect(installText).toContain(testApp2Path);
      
      // Verify installed
      const installedApps = execSync(`xcrun simctl listapps "${deviceId}"`, { encoding: 'utf8' });
      expect(isAppInstalled(installedApps, testApp2BundleId)).toBe(true);
      
      // Uninstall without deviceId (uses booted device)
      const uninstallResponse = await client.request({
        method: 'tools/call',
        params: {
          name: 'uninstall_app',
          arguments: {
            bundleId: testApp2BundleId
          }
        }
      }, CallToolResultSchema);
      
      const uninstallText = (uninstallResponse.content[0] as any).text;
      expect(uninstallText).toContain('Successfully uninstalled');
      expect(uninstallText).toContain(testApp2BundleId);
      
      // Verify uninstalled
      const appsAfterUninstall = execSync(`xcrun simctl listapps "${deviceId}"`, { encoding: 'utf8' });
      expect(isAppInstalled(appsAfterUninstall, testApp2BundleId)).toBe(false);
    }, 60000);

    test('should handle reinstallation (update) flow', async () => {
      const deviceId = await ensureSimulator();
      
      if (!testApp1Path) {
        throw new Error('Test app not built');
      }
      
      // First installation
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
      
      // Reinstall (should overwrite)
      const reinstallResponse = await client.request({
        method: 'tools/call',
        params: {
          name: 'install_app',
          arguments: {
            appPath: testApp1Path,
            deviceId
          }
        }
      }, CallToolResultSchema);
      
      const reinstallText = (reinstallResponse.content[0] as any).text;
      expect(reinstallText).toMatch(/^Successfully installed app: .+ on .+$/);
      
      // App should still be there
      const installedApps = execSync(`xcrun simctl listapps "${deviceId}"`, { encoding: 'utf8' });
      expect(isAppInstalled(installedApps, testApp1BundleId)).toBe(true);
      
      // Clean up
      await client.request({
        method: 'tools/call',
        params: {
          name: 'uninstall_app',
          arguments: {
            bundleId: testApp1BundleId,
            deviceId
          }
        }
      }, CallToolResultSchema);
    }, 60000);
  });

  describe('Multiple App Management', () => {
    test('should install and uninstall multiple apps', async () => {
      const deviceId = await ensureSimulator();
      
      if (!testApp1Path || !testApp2Path) {
        throw new Error('Test apps not built');
      }
      
      // Install both apps
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
      
      await client.request({
        method: 'tools/call',
        params: {
          name: 'install_app',
          arguments: {
            appPath: testApp2Path,
            deviceId
          }
        }
      }, CallToolResultSchema);
      
      // Verify both installed
      const installedApps = execSync(`xcrun simctl listapps "${deviceId}"`, { encoding: 'utf8' });
      expect(isAppInstalled(installedApps, testApp1BundleId)).toBe(true);
      expect(isAppInstalled(installedApps, testApp2BundleId)).toBe(true);
      
      // Uninstall first app
      await client.request({
        method: 'tools/call',
        params: {
          name: 'uninstall_app',
          arguments: {
            bundleId: testApp1BundleId,
            deviceId
          }
        }
      }, CallToolResultSchema);
      
      // Verify first is gone but second remains
      const appsAfterFirst = execSync(`xcrun simctl listapps "${deviceId}"`, { encoding: 'utf8' });
      expect(isAppInstalled(appsAfterFirst, testApp1BundleId)).toBe(false);
      expect(isAppInstalled(appsAfterFirst, testApp2BundleId)).toBe(true);
      
      // Uninstall second app
      await client.request({
        method: 'tools/call',
        params: {
          name: 'uninstall_app',
          arguments: {
            bundleId: testApp2BundleId,
            deviceId
          }
        }
      }, CallToolResultSchema);
      
      // Verify both are gone
      const appsAfterBoth = execSync(`xcrun simctl listapps "${deviceId}"`, { encoding: 'utf8' });
      expect(isAppInstalled(appsAfterBoth, testApp1BundleId)).toBe(false);
      expect(isAppInstalled(appsAfterBoth, testApp2BundleId)).toBe(false);
    }, 90000);
  });

  describe('Error Handling', () => {
    test('should handle installing non-existent app', async () => {
      const deviceId = await ensureSimulator();
      
      const response = await client.request({
        method: 'tools/call',
        params: {
          name: 'install_app',
          arguments: {
            appPath: '/non/existent/app.app',
            deviceId: deviceId
          }
        }
      }, CallToolResultSchema);
      
      const text = (response.content[0] as any).text;
      expect(text.toLowerCase()).toContain('error');
      expect(text).toContain('/non/existent/app.app');
    }, 30000);

    test('should handle uninstalling non-existent app', async () => {
      const deviceId = await ensureSimulator();
      
      const response = await client.request({
        method: 'tools/call',
        params: {
          name: 'uninstall_app',
          arguments: {
            bundleId: 'com.test.nonexistent',
            deviceId
          }
        }
      }, CallToolResultSchema);
      
      const text = (response.content[0] as any).text;
      expect(text.toLowerCase()).toMatch(/(error|failed|not found|unable)/);
      expect(text).toContain('com.test.nonexistent');
    }, 30000);

    test('should validate bundle ID format', async () => {
      const response = await client.request({
        method: 'tools/call',
        params: {
          name: 'uninstall_app',
          arguments: {
            bundleId: 'invalid bundle id with spaces'
          }
        }
      }, CallToolResultSchema);
      
      const text = (response.content[0] as any).text;
      expect(text.toLowerCase()).toContain('invalid bundle id format');
    }, 30000);

    test('should handle invalid device ID', async () => {
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
      
      const text = (response.content[0] as any).text;
      expect(text.toLowerCase()).toContain('error');
      expect(text).toContain('non-existent-device-id');
    }, 30000);

    test('should handle no booted devices for install', async () => {
      // Shutdown all simulators
      TestEnvironmentCleaner.shutdownAllSimulators();
      
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
      
      const text = (response.content[0] as any).text;
      expect(text.toLowerCase()).toMatch(/(no booted|simulator|device)/);
    }, 30000);

    test('should handle no booted devices for uninstall', async () => {
      // Shutdown all simulators
      TestEnvironmentCleaner.shutdownAllSimulators();
      
      const response = await client.request({
        method: 'tools/call',
        params: {
          name: 'uninstall_app',
          arguments: {
            bundleId: testApp1BundleId
            // No deviceId and no booted devices
          }
        }
      }, CallToolResultSchema);
      
      const text = (response.content[0] as any).text;
      expect(text.toLowerCase()).toMatch(/(no booted|simulator|device|error)/);
    }, 30000);
  });

  describe('Concurrent Operations', () => {
    test('should handle concurrent install and uninstall operations', async () => {
      const deviceId = await ensureSimulator();
      
      if (!testApp1Path || !testApp2Path) {
        throw new Error('Test apps not built');
      }
      
      // Install both apps concurrently
      const installs = await Promise.all([
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
      
      // Verify both installed successfully
      installs.forEach(response => {
        const text = (response.content[0] as any).text;
        expect(text).toMatch(/^Successfully installed app: .+ on .+$/);
      });
      
      // Verify both apps are installed
      const installedApps = execSync(`xcrun simctl listapps "${deviceId}"`, { encoding: 'utf8' });
      expect(isAppInstalled(installedApps, testApp1BundleId)).toBe(true);
      expect(isAppInstalled(installedApps, testApp2BundleId)).toBe(true);
      
      // Uninstall both apps concurrently
      const uninstalls = await Promise.all([
        client.request({
          method: 'tools/call',
          params: {
            name: 'uninstall_app',
            arguments: {
              bundleId: testApp1BundleId,
              deviceId
            }
          }
        }, CallToolResultSchema),
        
        client.request({
          method: 'tools/call',
          params: {
            name: 'uninstall_app',
            arguments: {
              bundleId: testApp2BundleId,
              deviceId
            }
          }
        }, CallToolResultSchema)
      ]);
      
      // Verify both uninstalled successfully
      uninstalls.forEach(response => {
        const text = (response.content[0] as any).text;
        expect(text).toContain('Successfully uninstalled');
      });
      
      // Verify both apps are gone
      const appsAfter = execSync(`xcrun simctl listapps "${deviceId}"`, { encoding: 'utf8' });
      expect(isAppInstalled(appsAfter, testApp1BundleId)).toBe(false);
      expect(isAppInstalled(appsAfter, testApp2BundleId)).toBe(false);
    }, 60000);
  });
});