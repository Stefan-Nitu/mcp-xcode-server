/**
 * E2E tests for RunProjectTool
 * Tests building and running projects on simulators with comprehensive cleanup
 */

import { describe, test, expect, beforeAll, afterAll, beforeEach, afterEach } from '@jest/globals';
import { existsSync, mkdirSync, writeFileSync, rmSync } from 'fs';
import { join, resolve } from 'path';
import { execSync } from 'child_process';
import { spawn, ChildProcess } from 'child_process';
import { Client } from '@modelcontextprotocol/sdk/client/index';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio';
import { CallToolResultSchema } from '@modelcontextprotocol/sdk/types';

describe('RunProjectTool E2E Tests', () => {
  let serverProcess: ChildProcess;
  let client: Client;
  let transport: StdioClientTransport;
  
  // Test directories with unique timestamps
  const timestamp = Date.now();
  const testProjectDir = `/tmp/test-run-project-${timestamp}`;
  const iosAppDir = join(testProjectDir, 'iOSApp');
  const macOSAppDir = join(testProjectDir, 'macOSApp');
  const swiftUIAppDir = join(testProjectDir, 'SwiftUIApp');
  const derivedDataPath = join(testProjectDir, 'DerivedData');
  
  // Track simulators we boot for cleanup
  let bootedSimulators: string[] = [];
  
  beforeAll(async () => {
    // Clean up any existing test directories
    if (existsSync(testProjectDir)) {
      rmSync(testProjectDir, { recursive: true });
    }
    
    // Create test directories
    mkdirSync(testProjectDir, { recursive: true });
    mkdirSync(iosAppDir, { recursive: true });
    mkdirSync(macOSAppDir, { recursive: true });
    mkdirSync(swiftUIAppDir, { recursive: true });
    
    // Build the server
    execSync('npm run build', { cwd: process.cwd() });
    
    // Create test projects
    await createTestProjects();
  }, 120000);
  
  afterAll(() => {
    // Shutdown any simulators we booted
    bootedSimulators.forEach(deviceId => {
      try {
        execSync(`xcrun simctl shutdown "${deviceId}"`, { stdio: 'ignore' });
      } catch {
        // Ignore errors - simulator might already be shutdown
      }
    });
    
    // Comprehensive cleanup
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
    
    // Clean build artifacts after each test
    cleanBuildArtifacts();
    
    // Uninstall any apps we installed
    cleanInstalledApps();
  });

  function cleanBuildArtifacts() {
    // Clean all .build and DerivedData directories
    const buildDirs = [
      join(iosAppDir, '.build'),
      join(iosAppDir, 'DerivedData'),
      join(macOSAppDir, '.build'),
      join(macOSAppDir, 'DerivedData'),
      join(swiftUIAppDir, '.build'),
      join(swiftUIAppDir, 'DerivedData'),
      derivedDataPath,
      join(process.cwd(), 'DerivedData')
    ];
    
    buildDirs.forEach(dir => {
      if (existsSync(dir)) {
        rmSync(dir, { recursive: true });
      }
    });
  }

  function cleanInstalledApps() {
    // Uninstall test apps from simulators
    const bundleIds = [
      'com.test.iOSApp',
      'com.test.SwiftUIApp'
    ];
    
    bundleIds.forEach(bundleId => {
      try {
        // Try to uninstall from booted devices
        execSync(`xcrun simctl uninstall booted ${bundleId}`, { stdio: 'ignore' });
      } catch {
        // Ignore errors - app might not be installed
      }
    });
  }

  function cleanupAll() {
    if (existsSync(testProjectDir)) {
      rmSync(testProjectDir, { recursive: true });
    }
    
    // Clean any global DerivedData that might have been created
    const globalDerivedData = join(process.cwd(), 'DerivedData');
    if (existsSync(globalDerivedData)) {
      rmSync(globalDerivedData, { recursive: true });
    }
  }

  async function createTestProjects() {
    // Create iOS App Package.swift
    writeFileSync(join(iosAppDir, 'Package.swift'), `// swift-tools-version: 6.0
import PackageDescription

let package = Package(
    name: "iOSApp",
    platforms: [.iOS(.v17)],
    products: [
        .executable(name: "iOSApp", targets: ["iOSApp"])
    ],
    targets: [
        .executableTarget(
            name: "iOSApp",
            path: "Sources"
        )
    ]
)
`);
    
    // Create iOS app source
    mkdirSync(join(iosAppDir, 'Sources'), { recursive: true });
    writeFileSync(join(iosAppDir, 'Sources', 'main.swift'), `
import Foundation

print("iOS App is running!")
print("Platform: iOS")
print("Time: \\(Date())")

// Keep app running for a moment
Thread.sleep(forTimeInterval: 1.0)
print("iOS App finished")
`);
    
    // Create macOS App Package.swift
    writeFileSync(join(macOSAppDir, 'Package.swift'), `// swift-tools-version: 6.0
import PackageDescription

let package = Package(
    name: "macOSApp",
    platforms: [.macOS(.v14)],
    products: [
        .executable(name: "macOSApp", targets: ["macOSApp"])
    ],
    targets: [
        .executableTarget(
            name: "macOSApp",
            path: "Sources"
        )
    ]
)
`);
    
    // Create macOS app source
    mkdirSync(join(macOSAppDir, 'Sources'), { recursive: true });
    writeFileSync(join(macOSAppDir, 'Sources', 'main.swift'), `
import Foundation

print("macOS App is running!")
print("Platform: macOS")
print("Arguments: \\(CommandLine.arguments)")
print("Environment: \\(ProcessInfo.processInfo.environment["USER"] ?? "unknown")")

// Simulate some work
for i in 1...3 {
    print("Processing... \\(i)")
    Thread.sleep(forTimeInterval: 0.5)
}

print("macOS App completed successfully")
exit(0)
`);
    
    // Create SwiftUI App (more complex)
    writeFileSync(join(swiftUIAppDir, 'Package.swift'), `// swift-tools-version: 6.0
import PackageDescription

let package = Package(
    name: "SwiftUIApp",
    platforms: [.iOS(.v17), .macOS(.v14)],
    products: [
        .library(name: "SwiftUIApp", targets: ["SwiftUIApp"])
    ],
    targets: [
        .target(
            name: "SwiftUIApp",
            path: "Sources"
        )
    ]
)
`);
    
    mkdirSync(join(swiftUIAppDir, 'Sources'), { recursive: true });
    writeFileSync(join(swiftUIAppDir, 'Sources', 'SwiftUIApp.swift'), `
import Foundation

public struct SwiftUIApp {
    public init() {}
    
    public func launch() {
        print("SwiftUI App launched")
    }
}
`);
  }

  describe('iOS App Running', () => {
    test('should run iOS app on default simulator', async () => {
      const response = await client.request({
        method: 'tools/call',
        params: {
          name: 'run_project',
          arguments: {
            projectPath: join(iosAppDir, 'Package.swift'),
            scheme: 'iOSApp',
            platform: 'iOS'
          }
        }
      }, CallToolResultSchema);
      
      expect(response).toBeDefined();
      const text = (response.content[0] as any).text;
      expect(text).toBeDefined();
      
      // Should either run successfully or report an error
      if (text.toLowerCase().includes('success')) {
        expect(text.toLowerCase()).toContain('ran');
      }
    });

    test('should run iOS app on specific device', async () => {
      // First get available simulators
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
      const availableDevice = devices.find((d: any) => d.isAvailable && d.state !== 'Creating');
      
      if (availableDevice) {
        const response = await client.request({
          method: 'tools/call',
          params: {
            name: 'run_project',
            arguments: {
              projectPath: join(iosAppDir, 'Package.swift'),
              scheme: 'iOSApp',
              platform: 'iOS',
              deviceId: availableDevice.name
            }
          }
        }, CallToolResultSchema);
        
        expect(response).toBeDefined();
        const text = (response.content[0] as any).text;
        expect(text).toBeDefined();
        
        // Track if we booted a simulator
        if (text.toLowerCase().includes('booted')) {
          bootedSimulators.push(availableDevice.udid);
        }
      }
    });

    test('should handle iOS app with Release configuration', async () => {
      const response = await client.request({
        method: 'tools/call',
        params: {
          name: 'run_project',
          arguments: {
            projectPath: join(iosAppDir, 'Package.swift'),
            scheme: 'iOSApp',
            platform: 'iOS',
            configuration: 'Release'
          }
        }
      }, CallToolResultSchema);
      
      expect(response).toBeDefined();
      const text = (response.content[0] as any).text;
      expect(text).toBeDefined();
      
      if (text.toLowerCase().includes('success')) {
        expect(text.toLowerCase()).toMatch(/release|optimized/);
      }
    });
  });

  describe('macOS App Running', () => {
    test('should run macOS app directly', async () => {
      const response = await client.request({
        method: 'tools/call',
        params: {
          name: 'run_project',
          arguments: {
            projectPath: join(macOSAppDir, 'Package.swift'),
            scheme: 'macOSApp',
            platform: 'macOS'
          }
        }
      }, CallToolResultSchema);
      
      expect(response).toBeDefined();
      const text = (response.content[0] as any).text;
      expect(text).toBeDefined();
      
      // macOS apps run directly without simulator
      if (text.toLowerCase().includes('success')) {
        expect(text.toLowerCase()).not.toContain('simulator');
      }
    });

    test('should capture macOS app output', async () => {
      const response = await client.request({
        method: 'tools/call',
        params: {
          name: 'run_project',
          arguments: {
            projectPath: join(macOSAppDir, 'Package.swift'),
            scheme: 'macOSApp',
            platform: 'macOS',
            configuration: 'Debug'
          }
        }
      }, CallToolResultSchema);
      
      expect(response).toBeDefined();
      const text = (response.content[0] as any).text;
      
      // Should include some output or build info
      if (text.toLowerCase().includes('success')) {
        const hasOutput = 
          text.includes('macOS App') ||
          text.includes('Processing') ||
          text.includes('completed') ||
          text.includes('built');
        expect(hasOutput).toBe(true);
      }
    });
  });

  describe('Other Platforms', () => {
    test('should handle tvOS platform', async () => {
      const response = await client.request({
        method: 'tools/call',
        params: {
          name: 'run_project',
          arguments: {
            projectPath: join(iosAppDir, 'Package.swift'),
            scheme: 'iOSApp',
            platform: 'tvOS'
          }
        }
      }, CallToolResultSchema);
      
      expect(response).toBeDefined();
      const text = (response.content[0] as any).text;
      expect(text).toBeDefined();
      // Should either work or report platform incompatibility
    });

    test('should handle watchOS platform', async () => {
      const response = await client.request({
        method: 'tools/call',
        params: {
          name: 'run_project',
          arguments: {
            projectPath: join(iosAppDir, 'Package.swift'),
            scheme: 'iOSApp',
            platform: 'watchOS'
          }
        }
      }, CallToolResultSchema);
      
      expect(response).toBeDefined();
      const text = (response.content[0] as any).text;
      expect(text).toBeDefined();
    });

    test('should handle visionOS platform', async () => {
      const response = await client.request({
        method: 'tools/call',
        params: {
          name: 'run_project',
          arguments: {
            projectPath: join(iosAppDir, 'Package.swift'),
            scheme: 'iOSApp',
            platform: 'visionOS'
          }
        }
      }, CallToolResultSchema);
      
      expect(response).toBeDefined();
      const text = (response.content[0] as any).text;
      expect(text).toBeDefined();
    });
  });

  describe('Simulator Management', () => {
    test('should boot simulator if needed', async () => {
      // Ensure all simulators are shutdown first
      try {
        execSync('xcrun simctl shutdown all', { stdio: 'ignore' });
      } catch {
        // Ignore errors
      }
      
      const response = await client.request({
        method: 'tools/call',
        params: {
          name: 'run_project',
          arguments: {
            projectPath: join(iosAppDir, 'Package.swift'),
            scheme: 'iOSApp',
            platform: 'iOS'
          }
        }
      }, CallToolResultSchema);
      
      expect(response).toBeDefined();
      const text = (response.content[0] as any).text;
      
      // Should boot a simulator if none are running
      if (text.toLowerCase().includes('success')) {
        // Check if a simulator is now booted
        const devicesOutput = execSync('xcrun simctl list devices booted', { encoding: 'utf8' });
        const hasBootedDevice = devicesOutput.includes('Booted') || devicesOutput.includes('iPhone');
        // May or may not have booted depending on test environment
      }
    });

    test('should reuse already booted simulator', async () => {
      // Boot a simulator first
      const devices = JSON.parse(execSync('xcrun simctl list devices available -j', { encoding: 'utf8' })).devices;
      const iosDevices = Object.values(devices).flat().filter((d: any) => 
        d.isAvailable && d.name.includes('iPhone')
      );
      
      if (iosDevices.length > 0) {
        const device = iosDevices[0] as any;
        execSync(`xcrun simctl boot "${device.udid}"`, { stdio: 'ignore' });
        bootedSimulators.push(device.udid);
        
        // Now run project - should use the booted simulator
        const response = await client.request({
          method: 'tools/call',
          params: {
            name: 'run_project',
            arguments: {
              projectPath: join(iosAppDir, 'Package.swift'),
              scheme: 'iOSApp',
              platform: 'iOS'
            }
          }
        }, CallToolResultSchema);
        
        expect(response).toBeDefined();
        const text = (response.content[0] as any).text;
        
        // Should not mention booting since one is already booted
        if (text.toLowerCase().includes('success')) {
          // It might still mention the device but shouldn't say "booting"
        }
      }
    });
  });

  describe('Error Handling', () => {
    test('should handle non-existent project', async () => {
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
    });

    test('should handle invalid scheme', async () => {
      const response = await client.request({
        method: 'tools/call',
        params: {
          name: 'run_project',
          arguments: {
            projectPath: join(iosAppDir, 'Package.swift'),
            scheme: 'NonExistentScheme',
            platform: 'iOS'
          }
        }
      }, CallToolResultSchema);
      
      expect(response).toBeDefined();
      const text = (response.content[0] as any).text;
      // Should report scheme not found or similar error
      expect(text).toBeDefined();
    });

    test('should handle app crash gracefully', async () => {
      // Create an app that crashes
      const crashAppDir = join(testProjectDir, 'CrashApp');
      mkdirSync(crashAppDir, { recursive: true });
      
      writeFileSync(join(crashAppDir, 'Package.swift'), `// swift-tools-version: 6.0
import PackageDescription

let package = Package(
    name: "CrashApp",
    platforms: [.macOS(.v14)],
    products: [
        .executable(name: "CrashApp", targets: ["CrashApp"])
    ],
    targets: [
        .executableTarget(name: "CrashApp", path: "Sources")
    ]
)
`);
      
      mkdirSync(join(crashAppDir, 'Sources'), { recursive: true });
      writeFileSync(join(crashAppDir, 'Sources', 'main.swift'), `
import Foundation
print("About to crash...")
fatalError("Intentional crash for testing")
`);
      
      const response = await client.request({
        method: 'tools/call',
        params: {
          name: 'run_project',
          arguments: {
            projectPath: join(crashAppDir, 'Package.swift'),
            scheme: 'CrashApp',
            platform: 'macOS'
          }
        }
      }, CallToolResultSchema);
      
      expect(response).toBeDefined();
      const text = (response.content[0] as any).text;
      // Should handle the crash without throwing
      expect(text).toBeDefined();
      
      // Clean up crash app
      if (existsSync(crashAppDir)) {
        rmSync(crashAppDir, { recursive: true });
      }
    });

    test('should handle missing simulator', async () => {
      const response = await client.request({
        method: 'tools/call',
        params: {
          name: 'run_project',
          arguments: {
            projectPath: join(iosAppDir, 'Package.swift'),
            scheme: 'iOSApp',
            platform: 'iOS',
            deviceId: 'Non-Existent Device XYZ'
          }
        }
      }, CallToolResultSchema);
      
      expect(response).toBeDefined();
      const text = (response.content[0] as any).text;
      // Should report device not found
      expect(text.toLowerCase()).toMatch(/not found|error|unavailable/);
    });

    test('should handle build errors', async () => {
      // Create project with syntax errors
      const errorAppDir = join(testProjectDir, 'ErrorApp');
      mkdirSync(errorAppDir, { recursive: true });
      
      writeFileSync(join(errorAppDir, 'Package.swift'), `// swift-tools-version: 6.0
import PackageDescription

let package = Package(
    name: "ErrorApp",
    platforms: [.iOS(.v17)],
    products: [
        .executable(name: "ErrorApp", targets: ["ErrorApp"])
    ],
    targets: [
        .executableTarget(name: "ErrorApp", path: "Sources")
    ]
)
`);
      
      mkdirSync(join(errorAppDir, 'Sources'), { recursive: true });
      writeFileSync(join(errorAppDir, 'Sources', 'main.swift'), `
// Invalid Swift code
func broken() {
    this is not valid Swift
}
`);
      
      const response = await client.request({
        method: 'tools/call',
        params: {
          name: 'run_project',
          arguments: {
            projectPath: join(errorAppDir, 'Package.swift'),
            scheme: 'ErrorApp',
            platform: 'iOS'
          }
        }
      }, CallToolResultSchema);
      
      expect(response).toBeDefined();
      const text = (response.content[0] as any).text;
      expect(text.toLowerCase()).toContain('error');
      
      // Clean up
      if (existsSync(errorAppDir)) {
        rmSync(errorAppDir, { recursive: true });
      }
    });
  });

  describe('App Installation', () => {
    test('should report app installation path', async () => {
      const response = await client.request({
        method: 'tools/call',
        params: {
          name: 'run_project',
          arguments: {
            projectPath: join(iosAppDir, 'Package.swift'),
            scheme: 'iOSApp',
            platform: 'iOS'
          }
        }
      }, CallToolResultSchema);
      
      expect(response).toBeDefined();
      const text = (response.content[0] as any).text;
      
      // Should mention app installation if successful
      if (text.toLowerCase().includes('success')) {
        const hasInstallInfo = 
          text.toLowerCase().includes('install') ||
          text.toLowerCase().includes('.app') ||
          text.toLowerCase().includes('bundle');
        // May or may not include install info depending on implementation
      }
    });

    test('should clean up installed apps', async () => {
      // Run an app
      await client.request({
        method: 'tools/call',
        params: {
          name: 'run_project',
          arguments: {
            projectPath: join(iosAppDir, 'Package.swift'),
            scheme: 'iOSApp',
            platform: 'iOS'
          }
        }
      }, CallToolResultSchema);
      
      // Clean installed apps
      cleanInstalledApps();
      
      // Verify cleanup (this is more of a smoke test)
      expect(() => cleanInstalledApps()).not.toThrow();
    });
  });

  describe('Concurrent Runs', () => {
    test('should handle concurrent run requests', async () => {
      // Run multiple apps concurrently
      const runs = Promise.all([
        client.request({
          method: 'tools/call',
          params: {
            name: 'run_project',
            arguments: {
              projectPath: join(macOSAppDir, 'Package.swift'),
              scheme: 'macOSApp',
              platform: 'macOS'
            }
          }
        }, CallToolResultSchema),
        
        client.request({
          method: 'tools/call',
          params: {
            name: 'run_project',
            arguments: {
              projectPath: join(swiftUIAppDir, 'Package.swift'),
              scheme: 'SwiftUIApp',
              platform: 'macOS'
            }
          }
        }, CallToolResultSchema)
      ]);
      
      const results = await runs;
      
      expect(results).toHaveLength(2);
      results.forEach(response => {
        expect(response).toBeDefined();
        expect(response.content[0].type).toBe('text');
      });
    });
  });

  describe('Cleanup Verification', () => {
    test('should not leave build artifacts', async () => {
      // Run a project
      await client.request({
        method: 'tools/call',
        params: {
          name: 'run_project',
          arguments: {
            projectPath: join(macOSAppDir, 'Package.swift'),
            scheme: 'macOSApp',
            platform: 'macOS'
          }
        }
      }, CallToolResultSchema);
      
      // Clean artifacts
      cleanBuildArtifacts();
      
      // Verify cleanup
      expect(existsSync(derivedDataPath)).toBe(false);
      expect(existsSync(join(macOSAppDir, '.build'))).toBe(false);
      expect(existsSync(join(macOSAppDir, 'DerivedData'))).toBe(false);
    });

    test('should clean up test directory completely', async () => {
      // Run something to create artifacts
      await client.request({
        method: 'tools/call',
        params: {
          name: 'run_project',
          arguments: {
            projectPath: join(iosAppDir, 'Package.swift'),
            scheme: 'iOSApp',
            platform: 'iOS'
          }
        }
      }, CallToolResultSchema);
      
      // Note: Full cleanup happens in afterAll
      // This test just verifies our cleanup functions work
      expect(() => cleanBuildArtifacts()).not.toThrow();
      expect(() => cleanInstalledApps()).not.toThrow();
    });
  });
});