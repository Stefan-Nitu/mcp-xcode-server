/**
 * End-to-end tests for the Apple Simulator MCP Server
 * These tests spawn the actual server and communicate via stdio
 */

import { spawn, ChildProcess } from 'child_process';
import { Client } from '@modelcontextprotocol/sdk/client/index';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio';
import { 
  ListToolsResultSchema,
  CallToolResultSchema,
  ListToolsRequestSchema,
  CallToolRequestSchema
} from '@modelcontextprotocol/sdk/types';
import { describe, test, expect, beforeAll, afterAll, beforeEach, afterEach } from '@jest/globals';
import { existsSync, mkdirSync, writeFileSync, rmSync } from 'fs';
import { join } from 'path';

describe('Apple Simulator MCP Server E2E', () => {
  let serverProcess: ChildProcess;
  let client: Client;
  let transport: StdioClientTransport;
  const testProjectPath = '/tmp/test-mcp-project';
  const testArtifactsPath = join(process.cwd(), 'test_artifacts');
  
  beforeAll(async () => {
    // Clean up any leftover artifacts
    if (existsSync(testProjectPath)) {
      rmSync(testProjectPath, { recursive: true });
    }
    
    // Create a simple test Swift package
    mkdirSync(testProjectPath, { recursive: true });
    
    // Create Package.swift
    writeFileSync(join(testProjectPath, 'Package.swift'), `
// swift-tools-version: 6.0
import PackageDescription

let package = Package(
    name: "TestPackage",
    platforms: [
        .macOS(.v14),
        .iOS(.v17)
    ],
    products: [
        .library(
            name: "TestPackage",
            targets: ["TestPackage"]),
    ],
    targets: [
        .target(
            name: "TestPackage"),
        .testTarget(
            name: "TestPackageTests",
            dependencies: ["TestPackage"]),
    ]
)
`);
    
    // Create source file
    mkdirSync(join(testProjectPath, 'Sources', 'TestPackage'), { recursive: true });
    writeFileSync(join(testProjectPath, 'Sources', 'TestPackage', 'TestPackage.swift'), `
public struct TestPackage {
    public init() {}
    
    public func greet(name: String) -> String {
        return "Hello, \\(name)!"
    }
}
`);
    
    // Create test file using Swift Testing framework
    mkdirSync(join(testProjectPath, 'Tests', 'TestPackageTests'), { recursive: true });
    writeFileSync(join(testProjectPath, 'Tests', 'TestPackageTests', 'TestPackageTests.swift'), `
import Testing
@testable import TestPackage

@Test func testGreeting() {
    let package = TestPackage()
    #expect(package.greet(name: "World") == "Hello, World!")
}

@Test func testEmptyGreeting() {
    let package = TestPackage()
    #expect(package.greet(name: "") == "Hello, !")
}
`);
    
    // Build the server
    const { execSync } = await import('child_process');
    execSync('npm run build', { cwd: process.cwd() });
  }, 60000); // 1 minute timeout for setup
  
  afterAll(() => {
    // Clean up all test artifacts
    if (existsSync(testProjectPath)) {
      rmSync(testProjectPath, { recursive: true });
    }
    
    // Clean up any derived data created during tests
    const derivedDataPath = join(process.cwd(), 'DerivedData');
    if (existsSync(derivedDataPath)) {
      rmSync(derivedDataPath, { recursive: true });
    }
  });
  
  beforeEach(async () => {
    // Start the MCP server
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
  });
  
  describe('Tool Discovery', () => {
    test('should list all available tools', async () => {
      const response = await client.request({
        method: 'tools/list',
        params: {}
      }, ListToolsResultSchema);
      
      expect(response).toBeDefined();
      expect(response.tools).toBeInstanceOf(Array);
      
      const toolNames = response.tools.map((t: any) => t.name);
      expect(toolNames).toContain('list_simulators');
      expect(toolNames).toContain('boot_simulator');
      expect(toolNames).toContain('shutdown_simulator');
      expect(toolNames).toContain('build_project');
      expect(toolNames).toContain('run_project');
      expect(toolNames).toContain('test_project');
      expect(toolNames).toContain('test_spm_module');
      expect(toolNames).toContain('install_app');
      expect(toolNames).toContain('uninstall_app');
      expect(toolNames).toContain('view_simulator_screen');
      expect(toolNames).toContain('get_device_logs');
      
      // Should have exactly 11 tools
      expect(response.tools.length).toBe(11);
    });
  });
  
  describe('Simulator Management', () => {
    test('should list iOS simulators', async () => {
      const response = await client.request({
        method: 'tools/call',
        params: {
          name: 'list_simulators',
          arguments: {
            platform: 'iOS'
          }
        }
      }, CallToolResultSchema);
      
      expect(response).toBeDefined();
      expect(response.content).toBeDefined();
      expect(response.content[0].type).toBe('text');
      
      const devices = JSON.parse((response.content[0] as any).text);
      expect(devices).toBeInstanceOf(Array);
      
      // Should have at least one iOS simulator
      const iosDevices = devices.filter((d: any) => 
        d.runtime.toLowerCase().includes('ios')
      );
      expect(iosDevices.length).toBeGreaterThan(0);
    });
    
    test('should boot and shutdown a simulator', async () => {
      // First, get list of available simulators
      const listResponse = await client.request({
        method: 'tools/call',
        params: {
          name: 'list_simulators',
          arguments: {
            showAll: true,
            platform: 'iOS'
          }
        }
      }, CallToolResultSchema);
      
      const devices = JSON.parse((listResponse.content[0] as any).text);
      const shutdownDevice = devices.find((d: any) => 
        d.state === 'Shutdown' && d.isAvailable
      );
      
      if (shutdownDevice) {
        // Boot the simulator
        const bootResponse = await client.request({
          method: 'tools/call',
          params: {
            name: 'boot_simulator',
            arguments: {
              deviceId: shutdownDevice.udid
            }
          }
        }, CallToolResultSchema);
        
        expect((bootResponse.content[0] as any).text).toContain('Successfully booted');
        
        // Give it a moment to fully boot
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        // Shutdown the simulator
        const shutdownResponse = await client.request({
          method: 'tools/call',
          params: {
            name: 'shutdown_simulator',
            arguments: {
              deviceId: shutdownDevice.udid
            }
          }
        }, CallToolResultSchema);
        
        expect((shutdownResponse.content[0] as any).text).toContain('Successfully shutdown');
      }
    }, 60000); // 1 minute timeout
  });
  
  describe('Xcode Project Management', () => {
    test('should build XCTest project', async () => {
      const response = await client.request({
        method: 'tools/call',
        params: {
          name: 'build_project',
          arguments: {
            projectPath: join(testArtifactsPath, 'TestProjectXCTest/TestProjectXCTest.xcodeproj'),
            scheme: 'TestProjectXCTest',
            platform: 'iOS',
            configuration: 'Debug'
          }
        }
      }, CallToolResultSchema);
      
      expect(response).toBeDefined();
      expect(response.content[0].type).toBe('text');
      const text = (response.content[0] as any).text;
      expect(text).toContain('Successfully built project');
      expect(text).toContain('TestProjectXCTest');
      expect(text).toContain('Platform: iOS');
    }, 60000);

    test('should build Swift Testing project', async () => {
      const response = await client.request({
        method: 'tools/call',
        params: {
          name: 'build_project',
          arguments: {
            projectPath: join(testArtifactsPath, 'TestProjectSwiftTesting/TestProjectSwiftTesting.xcodeproj'),
            scheme: 'TestProjectSwiftTesting',
            platform: 'iOS',
            configuration: 'Debug'
          }
        }
      }, CallToolResultSchema);
      
      expect(response).toBeDefined();
      expect(response.content[0].type).toBe('text');
      const text = (response.content[0] as any).text;
      expect(text).toContain('Successfully built project');
      expect(text).toContain('TestProjectSwiftTesting');
    }, 60000);

    test('should build workspace', async () => {
      const response = await client.request({
        method: 'tools/call',
        params: {
          name: 'build_project',
          arguments: {
            projectPath: join(testArtifactsPath, 'Test.xcworkspace'),
            scheme: 'TestSPM',
            platform: 'iOS',
            configuration: 'Debug'
          }
        }
      }, CallToolResultSchema);
      
      expect(response).toBeDefined();
      expect(response.content[0].type).toBe('text');
      const text = (response.content[0] as any).text;
      expect(text).toContain('Successfully built project');
    }, 60000);

    test('should run XCTest project', async () => {
      const response = await client.request({
        method: 'tools/call',
        params: {
          name: 'run_project',
          arguments: {
            projectPath: join(testArtifactsPath, 'TestProjectXCTest/TestProjectXCTest.xcodeproj'),
            scheme: 'TestProjectXCTest',
            platform: 'iOS'
          }
        }
      }, CallToolResultSchema);
      
      expect(response).toBeDefined();
      expect(response.content[0].type).toBe('text');
      const text = (response.content[0] as any).text;
      expect(text).toContain('Successfully built and ran project');
      expect(text).toContain('App installed at');
    }, 90000); // 1.5 minute timeout for build and run

    test('should test XCTest project', async () => {
      const response = await client.request({
        method: 'tools/call',
        params: {
          name: 'test_project',
          arguments: {
            projectPath: join(testArtifactsPath, 'TestProjectXCTest/TestProjectXCTest.xcodeproj'),
            scheme: 'TestProjectXCTest',
            platform: 'iOS',
            testTarget: 'TestProjectXCTestTests'
          }
        }
      }, CallToolResultSchema);
      
      expect(response).toBeDefined();
      expect(response.content[0].type).toBe('text');
      const result = JSON.parse((response.content[0] as any).text);
      expect(result.success).toBe(true);
      expect(result.summary).toContain('Tests passed');
      expect(result.testTarget).toBe('TestProjectXCTestTests');
    }, 90000);

    test('should test Swift Testing project', async () => {
      const response = await client.request({
        method: 'tools/call',
        params: {
          name: 'test_project',
          arguments: {
            projectPath: join(testArtifactsPath, 'TestProjectSwiftTesting/TestProjectSwiftTesting.xcodeproj'),
            scheme: 'TestProjectSwiftTesting',
            platform: 'iOS',
            testTarget: 'TestProjectSwiftTestingTests'
          }
        }
      }, CallToolResultSchema);
      
      expect(response).toBeDefined();
      expect(response.content[0].type).toBe('text');
      const result = JSON.parse((response.content[0] as any).text);
      expect(result.success).toBe(true);
      expect(result.summary).toContain('Tests passed');
    }, 90000);

    test('should test workspace with XCTest project', async () => {
      // Test.xcworkspace now contains multiple projects including TestProjectXCTest
      const response = await client.request({
        method: 'tools/call',
        params: {
          name: 'test_project',
          arguments: {
            projectPath: join(testArtifactsPath, 'Test.xcworkspace'),
            scheme: 'TestProjectXCTest',
            platform: 'iOS',
            testTarget: 'TestProjectXCTestTests'
          }
        }
      }, CallToolResultSchema);
      
      expect(response).toBeDefined();
      expect(response.content[0].type).toBe('text');
      const result = JSON.parse((response.content[0] as any).text);
      expect(result.success).toBe(true);
      expect(result.summary).toContain('Tests passed');
      expect(result.testTarget).toBe('TestProjectXCTestTests');
    }, 90000);
  });

  describe('App Management', () => {
    test('should install and uninstall app', async () => {
      // First build an app to get the app path
      const buildResponse = await client.request({
        method: 'tools/call',
        params: {
          name: 'build_project',
          arguments: {
            projectPath: join(testArtifactsPath, 'TestProjectXCTest/TestProjectXCTest.xcodeproj'),
            scheme: 'TestProjectXCTest',
            platform: 'iOS',
            configuration: 'Debug'
          }
        }
      }, CallToolResultSchema);
      
      const buildText = (buildResponse.content[0] as any).text;
      // Extract app path from output
      const appPathMatch = buildText.match(/App path: (.+)/);
      
      if (appPathMatch && appPathMatch[1] !== 'N/A') {
        const appPath = appPathMatch[1];
        
        // Get a booted device
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
        let bootedDevice = devices.find((d: any) => d.state === 'Booted');
        
        // Boot a device if none are booted
        if (!bootedDevice) {
          const availableDevice = devices.find((d: any) => d.isAvailable);
          if (availableDevice) {
            await client.request({
              method: 'tools/call',
              params: {
                name: 'boot_simulator',
                arguments: {
                  deviceId: availableDevice.udid
                }
              }
            }, CallToolResultSchema);
            await new Promise(resolve => setTimeout(resolve, 5000));
            bootedDevice = availableDevice;
          }
        }
        
        if (bootedDevice) {
          // Install the app
          const installResponse = await client.request({
            method: 'tools/call',
            params: {
              name: 'install_app',
              arguments: {
                appPath: appPath,
                deviceId: bootedDevice.udid
              }
            }
          }, CallToolResultSchema);
          
          expect((installResponse.content[0] as any).text).toContain('Successfully installed app');
          
          // Uninstall the app
          const uninstallResponse = await client.request({
            method: 'tools/call',
            params: {
              name: 'uninstall_app',
              arguments: {
                bundleId: 'com.stefannitu.TestProjectXCTest',
                deviceId: bootedDevice.udid
              }
            }
          }, CallToolResultSchema);
          
          expect((uninstallResponse.content[0] as any).text).toContain('Successfully uninstalled app');
        }
      }
    }, 120000); // 2 minute timeout
  });

  describe('Swift Package Testing', () => {
    test('should test TestSPM package on macOS', async () => {
      const response = await client.request({
        method: 'tools/call',
        params: {
          name: 'test_spm_module',
          arguments: {
            packagePath: join(testArtifactsPath, 'TestSPM'),
            platform: 'macOS'
          }
        }
      }, CallToolResultSchema);
      
      expect(response).toBeDefined();
      expect(response.content[0].type).toBe('text');
      
      const result = JSON.parse((response.content[0] as any).text);
      expect(result.success).toBe(true);
      // TestSPM has 1 test using Swift Testing framework
      expect(result.summary).toContain('Tests passed');
      expect(result.summary).toContain('1 test');
      expect(result.platform).toBe('macOS');
    }, 60000);
  });
  
  describe('Device Logs', () => {
    test('should retrieve device logs', async () => {
      // First ensure we have a booted device
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
      const bootedDevice = devices.find((d: any) => d.state === 'Booted');
      
      if (bootedDevice) {
        const response = await client.request({
          method: 'tools/call',
          params: {
            name: 'get_device_logs',
            arguments: {
              deviceId: bootedDevice.udid,
              last: '1m'
            }
          }
        }, CallToolResultSchema);
        
        expect(response).toBeDefined();
        expect(response.content[0].type).toBe('text');
        expect((response.content[0] as any).text).toBeDefined();
      }
    });
  });
  
  describe('Screenshot Capture', () => {
    test('should capture and return screenshot as image data', async () => {
      // Get a booted device
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
      let bootedDevice = devices.find((d: any) => d.state === 'Booted');
      
      // Boot a device if none are booted
      if (!bootedDevice) {
        const availableDevice = devices.find((d: any) => d.isAvailable);
        if (availableDevice) {
          await client.request({
            method: 'tools/call',
            params: {
              name: 'boot_simulator',
              arguments: {
                deviceId: availableDevice.udid
              }
            }
          }, CallToolResultSchema);
          await new Promise(resolve => setTimeout(resolve, 5000));
          bootedDevice = availableDevice;
        }
      }
      
      if (bootedDevice) {
        const response = await client.request({
          method: 'tools/call',
          params: {
            name: 'view_simulator_screen',
            arguments: {
              deviceId: bootedDevice.udid
            }
          }
        }, CallToolResultSchema);
        
        // Verify we got image data back
        expect(response.content[0].type).toBe('image');
        const imageContent = response.content[0] as any;
        expect(imageContent.data).toBeDefined();
        expect(imageContent.mimeType).toBe('image/png');
        
        // Verify it's valid base64 data
        expect(imageContent.data).toMatch(/^[A-Za-z0-9+/]+={0,2}$/);
        expect(imageContent.data.length).toBeGreaterThan(1000); // Should be substantial data
      }
    }, 60000);
  });
});