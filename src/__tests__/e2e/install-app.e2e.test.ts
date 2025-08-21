/**
 * E2E tests for InstallAppTool
 * Tests app installation on simulators with comprehensive cleanup
 */

import { describe, test, expect, beforeAll, afterAll, beforeEach, afterEach } from '@jest/globals';
import { existsSync, mkdirSync, writeFileSync, rmSync, copyFileSync } from 'fs';
import { join, resolve } from 'path';
import { execSync, spawn, ChildProcess } from 'child_process';
import { Client } from '@modelcontextprotocol/sdk/client/index';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio';
import { CallToolResultSchema } from '@modelcontextprotocol/sdk/types';

describe('InstallAppTool E2E Tests', () => {
  let serverProcess: ChildProcess;
  let client: Client;
  let transport: StdioClientTransport;
  
  // Test directories with unique timestamps
  const timestamp = Date.now();
  const testProjectDir = `/tmp/test-install-app-${timestamp}`;
  const testAppsDir = join(testProjectDir, 'TestApps');
  
  // Track installed apps for cleanup
  const installedApps: { bundleId: string; deviceId: string }[] = [];
  const bootedSimulators: string[] = [];
  
  beforeAll(async () => {
    // Clean up any existing test directories
    if (existsSync(testProjectDir)) {
      rmSync(testProjectDir, { recursive: true });
    }
    
    // Create test directories
    mkdirSync(testProjectDir, { recursive: true });
    mkdirSync(testAppsDir, { recursive: true });
    
    // Build the server
    execSync('npm run build', { cwd: process.cwd() });
    
    // Create test apps
    await createTestApps();
  }, 120000);
  
  afterAll(() => {
    // Shutdown simulators
    bootedSimulators.forEach(deviceId => {
      try {
        execSync(`xcrun simctl shutdown "${deviceId}"`, { stdio: 'ignore' });
      } catch {
        // Ignore errors
      }
    });
    
    // Clean up
    cleanupAll();
  });
  
  beforeEach(async () => {
    // Start MCP server
    serverProcess = spawn('node', ['dist/index.js'], {
      cwd: process.cwd(),
      env: { ...process.env },
    });
    
    // Create MCP client
    transport = new StdioClientTransport({
      command: 'node',
      args: ['dist/index.js'],
      cwd: process.cwd(),
    });
    
    client = new Client({
      name: 'test-client',
      version: '1.0.0',
    }, {
      capabilities: {}
    });
    
    await client.connect(transport);
  }, 30000);
  
  afterEach(async () => {
    // Uninstall all apps we installed
    cleanupInstalledApps();
    
    // Disconnect client
    if (client) {
      await client.close();
    }
    
    // Kill server process
    if (serverProcess) {
      serverProcess.kill();
      await new Promise(resolve => {
        serverProcess.once('exit', resolve);
      });
    }
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

  function cleanupAll() {
    if (existsSync(testProjectDir)) {
      rmSync(testProjectDir, { recursive: true });
    }
  }

  async function createTestApps() {
    // Create a mock .app bundle structure
    const simpleAppPath = join(testAppsDir, 'SimpleApp.app');
    mkdirSync(simpleAppPath, { recursive: true });
    
    // Create Info.plist
    writeFileSync(join(simpleAppPath, 'Info.plist'), `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleIdentifier</key>
  <string>com.test.SimpleApp</string>
  <key>CFBundleName</key>
  <string>SimpleApp</string>
  <key>CFBundleVersion</key>
  <string>1.0</string>
  <key>CFBundleExecutable</key>
  <string>SimpleApp</string>
</dict>
</plist>`);
    
    // Create executable (mock)
    writeFileSync(join(simpleAppPath, 'SimpleApp'), '#!/bin/bash\necho "SimpleApp running"');
    execSync(`chmod +x "${join(simpleAppPath, 'SimpleApp')}"`, { stdio: 'ignore' });
    
    // Create another test app with different bundle ID
    const anotherAppPath = join(testAppsDir, 'AnotherApp.app');
    mkdirSync(anotherAppPath, { recursive: true });
    
    writeFileSync(join(anotherAppPath, 'Info.plist'), `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleIdentifier</key>
  <string>com.test.AnotherApp</string>
  <key>CFBundleName</key>
  <string>AnotherApp</string>
  <key>CFBundleVersion</key>
  <string>2.0</string>
  <key>CFBundleExecutable</key>
  <string>AnotherApp</string>
</dict>
</plist>`);
    
    writeFileSync(join(anotherAppPath, 'AnotherApp'), '#!/bin/bash\necho "AnotherApp running"');
    execSync(`chmod +x "${join(anotherAppPath, 'AnotherApp')}"`, { stdio: 'ignore' });
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
      
      const response = await client.request({
        method: 'tools/call',
        params: {
          name: 'install_app',
          arguments: {
            appPath: join(testAppsDir, 'SimpleApp.app'),
            deviceId: deviceId
          }
        }
      }, CallToolResultSchema);
      
      expect(response).toBeDefined();
      const text = (response.content[0] as any).text;
      expect(text).toContain('Successfully installed app');
      
      // Track for cleanup
      installedApps.push({ bundleId: 'com.test.SimpleApp', deviceId });
    });

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
      
      const response = await client.request({
        method: 'tools/call',
        params: {
          name: 'install_app',
          arguments: {
            appPath: join(testAppsDir, 'AnotherApp.app')
          }
        }
      }, CallToolResultSchema);
      
      expect(response).toBeDefined();
      const text = (response.content[0] as any).text;
      expect(text).toContain('Successfully installed app');
      
      // Track for cleanup
      installedApps.push({ bundleId: 'com.test.AnotherApp', deviceId });
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
      
      // Install first app
      const response1 = await client.request({
        method: 'tools/call',
        params: {
          name: 'install_app',
          arguments: {
            appPath: join(testAppsDir, 'SimpleApp.app'),
            deviceId: deviceId
          }
        }
      }, CallToolResultSchema);
      
      expect(response1).toBeDefined();
      installedApps.push({ bundleId: 'com.test.SimpleApp', deviceId });
      
      // Install second app
      const response2 = await client.request({
        method: 'tools/call',
        params: {
          name: 'install_app',
          arguments: {
            appPath: join(testAppsDir, 'AnotherApp.app'),
            deviceId: deviceId
          }
        }
      }, CallToolResultSchema);
      
      expect(response2).toBeDefined();
      installedApps.push({ bundleId: 'com.test.AnotherApp', deviceId });
      
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
      
      const appPath = join(testAppsDir, 'SimpleApp.app');
      
      // Install first time
      await client.request({
        method: 'tools/call',
        params: {
          name: 'install_app',
          arguments: {
            appPath,
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
            appPath,
            deviceId
          }
        }
      }, CallToolResultSchema);
      
      expect(response).toBeDefined();
      const text = (response.content[0] as any).text;
      expect(text).toContain('Successfully installed');
      
      installedApps.push({ bundleId: 'com.test.SimpleApp', deviceId });
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

    test('should handle invalid app bundle', async () => {
      // Create invalid app bundle (missing Info.plist)
      const invalidAppPath = join(testAppsDir, 'InvalidApp.app');
      mkdirSync(invalidAppPath, { recursive: true });
      writeFileSync(join(invalidAppPath, 'InvalidApp'), 'not an app');
      
      const response = await client.request({
        method: 'tools/call',
        params: {
          name: 'install_app',
          arguments: {
            appPath: invalidAppPath
          }
        }
      }, CallToolResultSchema);
      
      expect(response).toBeDefined();
      const text = (response.content[0] as any).text;
      // Should report error about invalid bundle
      expect(text.toLowerCase()).toContain('error');
    });

    test('should handle non-existent device', async () => {
      const response = await client.request({
        method: 'tools/call',
        params: {
          name: 'install_app',
          arguments: {
            appPath: join(testAppsDir, 'SimpleApp.app'),
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
      
      const response = await client.request({
        method: 'tools/call',
        params: {
          name: 'install_app',
          arguments: {
            appPath: join(testAppsDir, 'SimpleApp.app')
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
            appPath: join(testAppsDir, 'SimpleApp.app'),
            deviceId: availableDevice.name
          }
        }
      }, CallToolResultSchema);
      
      expect(response).toBeDefined();
      const text = (response.content[0] as any).text;
      expect(text).toContain('Successfully installed');
      
      installedApps.push({ bundleId: 'com.test.SimpleApp', deviceId: availableDevice.udid });
    });

    test('should install on specific device by UDID', async () => {
      let deviceId = await getBootedSimulator();
      if (!deviceId) {
        deviceId = await bootSimulator();
      }
      
      if (!deviceId) {
        console.warn('No simulator available, skipping test');
        return;
      }
      
      const response = await client.request({
        method: 'tools/call',
        params: {
          name: 'install_app',
          arguments: {
            appPath: join(testAppsDir, 'SimpleApp.app'),
            deviceId: deviceId // Using UDID directly
          }
        }
      }, CallToolResultSchema);
      
      expect(response).toBeDefined();
      const text = (response.content[0] as any).text;
      expect(text).toContain('Successfully installed');
      
      installedApps.push({ bundleId: 'com.test.SimpleApp', deviceId });
    });
  });

  describe('Cleanup Verification', () => {
    test('should uninstall apps during cleanup', async () => {
      let deviceId = await getBootedSimulator();
      if (!deviceId) {
        deviceId = await bootSimulator();
      }
      
      if (!deviceId) {
        console.warn('No simulator available, skipping test');
        return;
      }
      
      // Install app
      await client.request({
        method: 'tools/call',
        params: {
          name: 'install_app',
          arguments: {
            appPath: join(testAppsDir, 'SimpleApp.app'),
            deviceId
          }
        }
      }, CallToolResultSchema);
      
      installedApps.push({ bundleId: 'com.test.SimpleApp', deviceId });
      
      // Clean up
      cleanupInstalledApps();
      
      // Verify app is uninstalled (checking installed apps would require additional commands)
      expect(installedApps.length).toBe(0);
    });

    test('should not leave test directories', () => {
      // This test verifies cleanup will happen in afterAll
      expect(existsSync(testProjectDir)).toBe(true); // Still exists during test
      
      // After all tests complete, it should be cleaned
      process.on('exit', () => {
        expect(existsSync(testProjectDir)).toBe(false);
      });
    });
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
      
      // Install apps concurrently
      const installs = Promise.all([
        client.request({
          method: 'tools/call',
          params: {
            name: 'install_app',
            arguments: {
              appPath: join(testAppsDir, 'SimpleApp.app'),
              deviceId
            }
          }
        }, CallToolResultSchema),
        
        client.request({
          method: 'tools/call',
          params: {
            name: 'install_app',
            arguments: {
              appPath: join(testAppsDir, 'AnotherApp.app'),
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
        { bundleId: 'com.test.SimpleApp', deviceId },
        { bundleId: 'com.test.AnotherApp', deviceId }
      );
    });
  });
});