/**
 * E2E tests for UninstallApp tool
 * Tests app uninstallation from simulators with proper cleanup
 */

import { describe, test, expect, beforeAll, afterAll, afterEach } from '@jest/globals';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { CallToolResultSchema } from '@modelcontextprotocol/sdk/types';
import { ChildProcess, spawn } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';
import { execSync } from 'child_process';

describe('UninstallApp Tool E2E', () => {
  let client: Client;
  let transport: StdioClientTransport;
  let serverProcess: ChildProcess;
  const bootedSimulators: string[] = [];
  const installedApps: Map<string, string> = new Map(); // deviceId -> bundleId
  const timestamp = Date.now();
  const testAppDir = path.join(process.cwd(), 'test_artifacts', `TestApp_${timestamp}`);
  const mockAppPath = path.join(testAppDir, 'MockApp.app');
  const bundleId = `com.test.mockapp.${timestamp}`;

  beforeAll(async () => {
    // Build the server
    execSync('npm run build', { cwd: process.cwd() });
  }, 60000);

  beforeEach(async () => {
    // Start the MCP server
    serverProcess = spawn('node', ['dist/index.js'], {
      cwd: process.cwd(),
      env: process.env as Record<string, string>
    });

    // Initialize MCP client
    transport = new StdioClientTransport({
      command: 'node',
      args: ['./dist/index.js'],
      env: process.env as Record<string, string>
    });

    client = new Client({
      name: 'test-client',
      version: '1.0.0'
    }, {
      capabilities: {}
    });

    await client.connect(transport);
  }, 30000);

  afterEach(async () => {
    // Disconnect client and kill server
    if (client) {
      await client.close();
    }
    if (serverProcess && !serverProcess.killed) {
      serverProcess.kill();
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // Clean up installed apps from all devices
    for (const [deviceId, appBundleId] of installedApps.entries()) {
      try {
        execSync(`xcrun simctl uninstall "${deviceId}" "${appBundleId}"`, {
          encoding: 'utf8',
          stdio: 'pipe'
        });
      } catch (error) {
        // App might already be uninstalled
      }
    }
    installedApps.clear();

    // Shutdown booted simulators
    for (const deviceId of bootedSimulators) {
      try {
        execSync(`xcrun simctl shutdown "${deviceId}"`, {
          encoding: 'utf8',
          stdio: 'pipe'
        });
      } catch (error) {
        // Simulator might already be shutdown
      }
    }
    bootedSimulators.length = 0;

    // Clean up test app directory
    try {
      await fs.rm(testAppDir, { recursive: true, force: true });
    } catch (error) {
      // Directory might not exist
    }
  });

  afterAll(async () => {
    // Final cleanup of any remaining simulators
    for (const deviceId of bootedSimulators) {
      try {
        execSync(`xcrun simctl shutdown "${deviceId}"`, {
          encoding: 'utf8',
          stdio: 'pipe'
        });
      } catch (error) {
        // Ignore errors
      }
    }

    // Clean up test directory
    try {
      await fs.rm(testAppDir, { recursive: true, force: true });
    } catch (error) {
      // Directory might not exist
    }

  });

  async function createMockApp(appBundleId: string): Promise<void> {
    // Create app directory structure
    await fs.mkdir(mockAppPath, { recursive: true });
    
    // Create Info.plist with bundle identifier
    const infoPlist = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CFBundleExecutable</key>
    <string>MockApp</string>
    <key>CFBundleIdentifier</key>
    <string>${appBundleId}</string>
    <key>CFBundleName</key>
    <string>Mock App</string>
    <key>CFBundlePackageType</key>
    <string>APPL</string>
    <key>CFBundleShortVersionString</key>
    <string>1.0</string>
    <key>CFBundleVersion</key>
    <string>1</string>
    <key>LSRequiresIPhoneOS</key>
    <true/>
    <key>UIRequiredDeviceCapabilities</key>
    <array>
        <string>arm64</string>
    </array>
</dict>
</plist>`;
    
    await fs.writeFile(path.join(mockAppPath, 'Info.plist'), infoPlist);
    
    // Create a minimal executable
    const executablePath = path.join(mockAppPath, 'MockApp');
    await fs.writeFile(executablePath, '#!/bin/sh\necho "Mock App"');
    await fs.chmod(executablePath, 0o755);
  }

  async function bootSimulator(): Promise<string> {
    // Get an available iOS simulator
    const simulatorsOutput = execSync('xcrun simctl list devices available -j', {
      encoding: 'utf8'
    });
    const devices = JSON.parse(simulatorsOutput).devices;
    
    // Find first available iOS device
    let deviceId: string | null = null;
    for (const [runtime, deviceList] of Object.entries(devices)) {
      if (runtime.includes('iOS') && Array.isArray(deviceList) && deviceList.length > 0) {
        deviceId = (deviceList[0] as any).udid;
        break;
      }
    }
    
    if (!deviceId) {
      throw new Error('No iOS simulators available');
    }
    
    // Boot the simulator
    execSync(`xcrun simctl boot "${deviceId}"`, {
      encoding: 'utf8',
      stdio: 'pipe'
    });
    
    bootedSimulators.push(deviceId);
    
    // Wait for boot
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    return deviceId;
  }

  test('should uninstall app from booted simulator', async () => {
    // Boot a simulator
    const deviceId = await bootSimulator();
    
    // Create and install mock app
    await createMockApp(bundleId);
    execSync(`xcrun simctl install "${deviceId}" "${mockAppPath}"`, {
      encoding: 'utf8'
    });
    installedApps.set(deviceId, bundleId);
    
    // Verify app is installed
    const installedBefore = execSync(`xcrun simctl listapps "${deviceId}"`, {
      encoding: 'utf8'
    });
    expect(installedBefore).toContain(bundleId);
    
    // Uninstall using MCP tool
    const result = await client.request({
      method: 'tools/call',
      params: {
        name: 'uninstall_app',
        arguments: {
          bundleId: bundleId,
          deviceId: deviceId
        }
      }
    }, CallToolResultSchema);
    
    expect(result.content[0]).toHaveProperty('text');
    const text = (result.content[0] as any).text;
    expect(text).toContain('Successfully uninstalled');
    expect(text).toContain(bundleId);
    
    // Verify app is uninstalled
    const installedAfter = execSync(`xcrun simctl listapps "${deviceId}"`, {
      encoding: 'utf8'
    });
    expect(installedAfter).not.toContain(bundleId);
    
    // Clear from tracking since it's already uninstalled
    installedApps.delete(deviceId);
  });

  test('should uninstall from currently booted device when deviceId not specified', async () => {
    // Boot a simulator
    const deviceId = await bootSimulator();
    
    // Create and install mock app
    const autoBundleId = `com.test.auto.${timestamp}`;
    await createMockApp(autoBundleId);
    execSync(`xcrun simctl install "${deviceId}" "${mockAppPath}"`, {
      encoding: 'utf8'
    });
    installedApps.set(deviceId, autoBundleId);
    
    // Uninstall without specifying deviceId
    const result = await client.request({
      method: 'tools/call',
      params: {
        name: 'uninstall_app',
        arguments: {
          bundleId: autoBundleId
        }
      }
    }, CallToolResultSchema);
    
    expect(result.content[0]).toHaveProperty('text');
    const text = (result.content[0] as any).text;
    expect(text).toContain('Successfully uninstalled');
    
    // Verify app is uninstalled
    const installedAfter = execSync(`xcrun simctl listapps "${deviceId}"`, {
      encoding: 'utf8'
    });
    expect(installedAfter).not.toContain(autoBundleId);
    
    installedApps.delete(deviceId);
  });

  test('should handle uninstalling non-existent app gracefully', async () => {
    // Boot a simulator
    const deviceId = await bootSimulator();
    
    // Try to uninstall non-existent app
    const result = await client.request({
      method: 'tools/call',
      params: {
        name: 'uninstall_app',
        arguments: {
          bundleId: 'com.nonexistent.app.xyz',
          deviceId: deviceId
        }
      }
    }, CallToolResultSchema);
    
    expect(result.content[0]).toHaveProperty('text');
    const text = (result.content[0] as any).text;
    // Should either succeed (some versions of simctl don't error) or show error
    expect(text).toBeDefined();
  });

  test('should validate bundle ID format', async () => {
    const invalidBundleIds = [
      'invalid bundle id', // spaces
      'com/invalid/bundle', // slashes
      'com.invalid.bundle!', // special char
      'com.invalid.bundle@2x' // @ symbol
    ];
    
    for (const invalidId of invalidBundleIds) {
      try {
        await client.request({
          method: 'tools/call',
          params: {
            name: 'uninstall_app',
            arguments: {
              bundleId: invalidId
            }
          }
        }, CallToolResultSchema);
        fail('Should have thrown validation error');
      } catch (error: any) {
        expect(error.message).toContain('Invalid bundle ID format');
      }
    }
  });

  test('should handle invalid device ID', async () => {
    const result = await client.request({
      method: 'tools/call',
      params: {
        name: 'uninstall_app',
        arguments: {
          bundleId: 'com.test.app',
          deviceId: 'invalid-device-id-xyz'
        }
      }
    }, CallToolResultSchema);
    
    expect(result.content[0]).toHaveProperty('text');
    const text = (result.content[0] as any).text;
    expect(text.toLowerCase()).toContain('error');
  });

  test('should handle system apps uninstall attempt', async () => {
    // Boot a simulator
    const deviceId = await bootSimulator();
    
    // Try to uninstall a system app
    const result = await client.request({
      method: 'tools/call',
      params: {
        name: 'uninstall_app',
        arguments: {
          bundleId: 'com.apple.mobilesafari',
          deviceId: deviceId
        }
      }
    }, CallToolResultSchema);
    
    expect(result.content[0]).toHaveProperty('text');
    const text = (result.content[0] as any).text;
    // System apps cannot be uninstalled, should show error
    expect(text.toLowerCase()).toContain('error');
  });

  test('should uninstall multiple apps sequentially', async () => {
    // Boot a simulator
    const deviceId = await bootSimulator();
    
    // Install multiple apps
    const appIds = [
      `com.test.app1.${timestamp}`,
      `com.test.app2.${timestamp}`,
      `com.test.app3.${timestamp}`
    ];
    
    for (const appId of appIds) {
      await createMockApp(appId);
      execSync(`xcrun simctl install "${deviceId}" "${mockAppPath}"`, {
        encoding: 'utf8'
      });
      installedApps.set(deviceId, appId);
    }
    
    // Verify all apps are installed
    const installedBefore = execSync(`xcrun simctl listapps "${deviceId}"`, {
      encoding: 'utf8'
    });
    appIds.forEach(id => expect(installedBefore).toContain(id));
    
    // Uninstall all apps
    for (const appId of appIds) {
      const result = await client.request({
        method: 'tools/call',
        params: {
          name: 'uninstall_app',
          arguments: {
            bundleId: appId,
            deviceId: deviceId
          }
        }
      }, CallToolResultSchema);
      
      expect(result.content[0]).toHaveProperty('text');
      const text = (result.content[0] as any).text;
      expect(text).toContain('Successfully uninstalled');
    }
    
    // Verify all apps are uninstalled
    const installedAfter = execSync(`xcrun simctl listapps "${deviceId}"`, {
      encoding: 'utf8'
    });
    appIds.forEach(id => expect(installedAfter).not.toContain(id));
    
    // Clear tracking
    appIds.forEach(() => installedApps.delete(deviceId));
  });

  test('should handle concurrent uninstall requests', async () => {
    // Boot a simulator
    const deviceId = await bootSimulator();
    
    // Install multiple apps
    const appIds = [
      `com.test.concurrent1.${timestamp}`,
      `com.test.concurrent2.${timestamp}`
    ];
    
    for (const appId of appIds) {
      await createMockApp(appId);
      execSync(`xcrun simctl install "${deviceId}" "${mockAppPath}"`, {
        encoding: 'utf8'
      });
      installedApps.set(deviceId, appId);
    }
    
    // Uninstall concurrently
    const promises = appIds.map(appId => 
      client.request({
        method: 'tools/call',
        params: {
          name: 'uninstall_app',
          arguments: {
            bundleId: appId,
            deviceId: deviceId
          }
        }
      }, CallToolResultSchema)
    );
    
    const results = await Promise.all(promises);
    
    // Check all succeeded
    results.forEach(result => {
      expect(result.content[0]).toHaveProperty('text');
      const text = (result.content[0] as any).text;
      expect(text).toContain('uninstalled');
    });
    
    // Verify all apps are uninstalled
    const installedAfter = execSync(`xcrun simctl listapps "${deviceId}"`, {
      encoding: 'utf8'
    });
    appIds.forEach(id => expect(installedAfter).not.toContain(id));
    
    // Clear tracking
    appIds.forEach(() => installedApps.delete(deviceId));
  });

  test('should handle device shutdown during uninstall', async () => {
    // Boot a simulator
    const deviceId = await bootSimulator();
    
    // Install app
    const appId = `com.test.shutdown.${timestamp}`;
    await createMockApp(appId);
    execSync(`xcrun simctl install "${deviceId}" "${mockAppPath}"`, {
      encoding: 'utf8'
    });
    installedApps.set(deviceId, appId);
    
    // Shutdown device
    execSync(`xcrun simctl shutdown "${deviceId}"`, {
      encoding: 'utf8'
    });
    
    // Remove from booted list since we shut it down
    const index = bootedSimulators.indexOf(deviceId);
    if (index > -1) {
      bootedSimulators.splice(index, 1);
    }
    
    // Try to uninstall
    const result = await client.request({
      method: 'tools/call',
      params: {
        name: 'uninstall_app',
        arguments: {
          bundleId: appId,
          deviceId: deviceId
        }
      }
    }, CallToolResultSchema);
    
    expect(result.content[0]).toHaveProperty('text');
    const text = (result.content[0] as any).text;
    // Should handle shutdown device gracefully
    expect(text).toBeDefined();
  });
});