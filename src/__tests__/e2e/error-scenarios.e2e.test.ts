/**
 * Exhaustive error scenario tests for MCP Xcode Server
 * Tests various edge cases and error conditions across all tools
 */

import { describe, test, expect, beforeAll, afterAll, afterEach } from '@jest/globals';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { CallToolResultSchema } from '@modelcontextprotocol/sdk/types';
import { ChildProcess, spawn } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';
import { execSync } from 'child_process';

describe('Error Scenarios E2E', () => {
  let client: Client;
  let transport: StdioClientTransport;
  let serverProcess: ChildProcess;
  const timestamp = Date.now();
  const testDir = path.join(process.cwd(), 'test_artifacts', `ErrorTests_${timestamp}`);
  const bootedSimulators: string[] = [];
  const createdDirs: string[] = [];

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

    // Clean up created directories
    for (const dir of createdDirs) {
      try {
        await fs.rm(dir, { recursive: true, force: true });
      } catch (error) {
        // Directory might not exist
      }
    }
    createdDirs.length = 0;
  });

  afterAll(async () => {
    // Final cleanup
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch (error) {
      // Directory might not exist
    }

  });

  describe('File System Errors', () => {
    test('should handle non-existent project files', async () => {
      const tools = [
        { name: 'build_project', args: { projectPath: '/nonexistent/project.xcodeproj' } },
        { name: 'run_project', args: { projectPath: '/nonexistent/project.xcodeproj' } },
        { name: 'test_project', args: { projectPath: '/nonexistent/project.xcodeproj' } },
        { name: 'list_schemes', args: { projectPath: '/nonexistent/project.xcodeproj' } },
        { name: 'get_project_info', args: { projectPath: '/nonexistent/project.xcodeproj' } },
        { name: 'list_targets', args: { projectPath: '/nonexistent/project.xcodeproj' } },
        { name: 'archive_project', args: { projectPath: '/nonexistent/project.xcodeproj', scheme: 'Test' } },
        { name: 'install_app', args: { appPath: '/nonexistent/app.app' } },
        { name: 'export_ipa', args: { archivePath: '/nonexistent/archive.xcarchive' } }
      ];

      for (const tool of tools) {
        const result = await client.request({
          method: 'tools/call',
          params: {
            name: tool.name,
            arguments: tool.args
          }
        }, CallToolResultSchema);

        expect(result.content[0]).toHaveProperty('text');
        const text = (result.content[0] as any).text;
        expect(text.toLowerCase()).toMatch(/error|fail|not found|does not exist/);
      }
    });

    test('should handle permission denied errors', async () => {
      // Create a protected directory
      const protectedDir = path.join(testDir, 'protected');
      await fs.mkdir(protectedDir, { recursive: true });
      createdDirs.push(testDir);
      
      // Create a file and make it read-only
      const protectedFile = path.join(protectedDir, 'readonly.xcodeproj');
      await fs.writeFile(protectedFile, 'test');
      await fs.chmod(protectedFile, 0o444);

      // Try to clean a protected directory
      const result = await client.request({
      method: 'tools/call',
      params: {
        name: 'clean_build',
        arguments: {
          cleanTarget: 'derivedData',
          derivedDataPath: protectedDir
        }
        }
      }, CallToolResultSchema);

      expect(result.content[0]).toHaveProperty('text');
      const text = (result.content[0] as any).text;
      expect(text).toBeDefined();
      
      // Restore permissions for cleanup
      await fs.chmod(protectedFile, 0o644);
    });

    test('should handle corrupted project files', async () => {
      // Create a corrupted xcodeproj
      const corruptedProj = path.join(testDir, 'Corrupted.xcodeproj');
      await fs.mkdir(corruptedProj, { recursive: true });
      createdDirs.push(testDir);
      
      // Create an invalid pbxproj file
      await fs.writeFile(
        path.join(corruptedProj, 'project.pbxproj'),
        'This is not valid pbxproj content'
      );

      const result = await client.request({
      method: 'tools/call',
      params: {
        name: 'build_project',
        arguments: {
          projectPath: corruptedProj
        }
        }
      }, CallToolResultSchema);

      expect(result.content[0]).toHaveProperty('text');
      const text = (result.content[0] as any).text;
      expect(text.toLowerCase()).toContain('error');
    });
  });

  describe('Simulator Errors', () => {
    test('should handle invalid device IDs', async () => {
      const invalidDeviceId = 'INVALID-DEVICE-ID-12345';
      
      const tools = [
        { name: 'boot_simulator', args: { deviceId: invalidDeviceId } },
        { name: 'shutdown_simulator', args: { deviceId: invalidDeviceId } },
        { name: 'view_simulator_screen', args: { deviceId: invalidDeviceId } },
        { name: 'get_device_logs', args: { deviceId: invalidDeviceId } },
        { name: 'install_app', args: { appPath: '/test.app', deviceId: invalidDeviceId } },
        { name: 'uninstall_app', args: { bundleId: 'com.test', deviceId: invalidDeviceId } }
      ];

      for (const tool of tools) {
        const result = await client.request({
          method: 'tools/call',
          params: {
            name: tool.name,
            arguments: tool.args
          }
        }, CallToolResultSchema);

        expect(result.content[0]).toHaveProperty('text');
        const text = (result.content[0] as any).text;
        expect(text.toLowerCase()).toContain('error');
      }
    });

    test('should handle already booted simulator', async () => {
      // Get a simulator and boot it
      const simulatorsOutput = execSync('xcrun simctl list devices available -j', {
        encoding: 'utf8'
      });
      const devices = JSON.parse(simulatorsOutput).devices;
      
      let availableDevice: any = null;
      for (const [runtime, deviceList] of Object.entries(devices)) {
        if (runtime.includes('iOS') && Array.isArray(deviceList) && deviceList.length > 0) {
          availableDevice = (deviceList[0] as any);
          break;
        }
      }

      if (availableDevice) {
        // Boot the simulator
        execSync(`xcrun simctl boot "${availableDevice.udid}"`, {
          encoding: 'utf8',
          stdio: 'pipe'
        });
        bootedSimulators.push(availableDevice.udid);

        // Wait for boot
        await new Promise(resolve => setTimeout(resolve, 3000));

        // Try to boot again
        const result = await client.request({
      method: 'tools/call',
      params: {
          name: 'boot_simulator',
          arguments: {
            deviceId: availableDevice.udid
          }
          }
        }, CallToolResultSchema);

        expect(result.content[0]).toHaveProperty('text');
        const text = (result.content[0] as any).text;
        expect(text.toLowerCase()).toMatch(/already booted|error|state/);
      }
    });

    test('should handle shutdown on already shutdown simulator', async () => {
      // Get a shutdown simulator
      const simulatorsOutput = execSync('xcrun simctl list devices available -j', {
        encoding: 'utf8'
      });
      const devices = JSON.parse(simulatorsOutput).devices;
      
      let shutdownDevice: any = null;
      for (const [runtime, deviceList] of Object.entries(devices)) {
        if (runtime.includes('iOS') && Array.isArray(deviceList)) {
          const device = deviceList.find((d: any) => d.state === 'Shutdown');
          if (device) {
            shutdownDevice = device;
            break;
          }
        }
      }

      if (shutdownDevice) {
        const result = await client.request({
      method: 'tools/call',
      params: {
          name: 'shutdown_simulator',
          arguments: {
            deviceId: shutdownDevice.udid
          }
          }
        }, CallToolResultSchema);

        expect(result.content[0]).toHaveProperty('text');
        const text = (result.content[0] as any).text;
        // Should handle gracefully
        expect(text).toBeDefined();
      }
    });
  });

  describe('Build and Compilation Errors', () => {
    test('should handle invalid schemes', async () => {
      const testProjectPath = path.join(process.cwd(), 'test_artifacts', 'TestProjectXCTest', 'TestProjectXCTest.xcodeproj');
      
      const result = await client.request({
      method: 'tools/call',
      params: {
        name: 'build_project',
        arguments: {
          projectPath: testProjectPath,
          scheme: 'NonExistentScheme'
        }
        }
      }, CallToolResultSchema);

      expect(result.content[0]).toHaveProperty('text');
      const text = (result.content[0] as any).text;
      expect(text.toLowerCase()).toContain('error');
    });

    test('should handle invalid platforms', async () => {
      try {
        await client.request({
      method: 'tools/call',
      params: {
          name: 'build_project',
          arguments: {
            projectPath: '/test/project.xcodeproj',
            platform: 'androidOS' // Invalid platform
          }
          }
        }, CallToolResultSchema);
        fail('Should have thrown validation error');
      } catch (error: any) {
        expect(error.message).toBeDefined();
      }
    });

    test('should handle circular dependencies', async () => {
      // Create a package with circular dependency
      const circularPkgDir = path.join(testDir, 'CircularPackage');
      await fs.mkdir(path.join(circularPkgDir, 'Sources', 'CircularPackage'), { recursive: true });
      createdDirs.push(testDir);
      
      const packageSwift = `// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "CircularPackage",
    dependencies: [
        .package(url: "https://github.com/nonexistent/package.git", from: "1.0.0")
    ],
    targets: [
        .target(
            name: "CircularPackage",
            dependencies: ["CircularPackage"]) // Circular dependency
    ]
)`;
      await fs.writeFile(path.join(circularPkgDir, 'Package.swift'), packageSwift);

      const result = await client.request({
      method: 'tools/call',
      params: {
        name: 'manage_dependencies',
        arguments: {
          action: 'resolve',
          packagePath: path.join(circularPkgDir, 'Package.swift')
        }
        }
      }, CallToolResultSchema);

      expect(result.content[0]).toHaveProperty('text');
      const text = (result.content[0] as any).text;
      expect(text.toLowerCase()).toContain('error');
    });
  });

  describe('Input Validation Errors', () => {
    test('should reject command injection attempts', async () => {
      const maliciousInputs = [
        '"; rm -rf /',
        '`rm -rf /`',
        '$(rm -rf /)',
        '| rm -rf /',
        '&& rm -rf /'
      ];

      for (const input of maliciousInputs) {
        try {
          await client.request({
            method: 'tools/call',
            params: {
              name: 'build_project',
              arguments: {
                projectPath: `/path/with${input}`
              }
            }
          }, CallToolResultSchema);
          fail('Should have thrown validation error');
        } catch (error: any) {
          expect(error.message).toContain('Command injection patterns are not allowed');
        }
      }
    });

    test('should reject path traversal attempts', async () => {
      const traversalPaths = [
        '../../../etc/passwd',
        '/path/../../../etc/passwd',
        '~/../../etc/passwd',
        '/path/with/../../../traversal'
      ];

      for (const path of traversalPaths) {
        try {
          await client.request({
            method: 'tools/call',
            params: {
              name: 'build_project',
              arguments: {
                projectPath: path
              }
            }
          }, CallToolResultSchema);
          fail('Should have thrown validation error');
        } catch (error: any) {
          expect(error.message).toContain('Path traversal patterns are not allowed');
        }
      }
    });

    test('should validate required parameters', async () => {
      // Test missing required parameters
      try {
        await client.request({
      method: 'tools/call',
      params: {
          name: 'boot_simulator',
          arguments: {} // Missing deviceId
          }
        }, CallToolResultSchema);
        fail('Should have thrown validation error');
      } catch (error: any) {
        expect(error.message).toContain('Device ID is required');
      }

      try {
        await client.request({
      method: 'tools/call',
      params: {
          name: 'uninstall_app',
          arguments: {} // Missing bundleId
          }
        }, CallToolResultSchema);
        fail('Should have thrown validation error');
      } catch (error: any) {
        expect(error.message).toBeDefined();
      }
    });

    test('should validate format constraints', async () => {
      // Invalid bundle ID format
      try {
        await client.request({
      method: 'tools/call',
      params: {
          name: 'uninstall_app',
          arguments: {
            bundleId: 'invalid bundle id with spaces!'
          }
          }
        }, CallToolResultSchema);
        fail('Should have thrown validation error');
      } catch (error: any) {
        expect(error.message).toContain('Invalid bundle ID format');
      }

      // Invalid OS version format
      try {
        await client.request({
      method: 'tools/call',
      params: {
          name: 'test_spm_module',
          arguments: {
            packagePath: '/test/Package.swift',
            osVersion: '17.0.1' // Should be X.Y format
          }
          }
        }, CallToolResultSchema);
        fail('Should have thrown validation error');
      } catch (error: any) {
        expect(error.message).toContain('OS version must be in format');
      }

      // Invalid time interval format
      try {
        await client.request({
      method: 'tools/call',
      params: {
          name: 'get_device_logs',
          arguments: {
            last: '5minutes' // Should be 5m
          }
          }
        }, CallToolResultSchema);
        fail('Should have thrown validation error');
      } catch (error: any) {
        expect(error.message).toContain('Time interval must be in format');
      }
    });
  });

  describe('Dependency Management Errors', () => {
    test('should handle invalid package URLs', async () => {
      const pkgDir = path.join(testDir, 'InvalidURLPackage');
      await fs.mkdir(path.join(pkgDir, 'Sources', 'TestPkg'), { recursive: true });
      createdDirs.push(testDir);
      
      const packageSwift = `// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "TestPkg",
    targets: [.target(name: "TestPkg")]
)`;
      await fs.writeFile(path.join(pkgDir, 'Package.swift'), packageSwift);

      const result = await client.request({
      method: 'tools/call',
      params: {
        name: 'manage_dependencies',
        arguments: {
          action: 'add',
          packagePath: path.join(pkgDir, 'Package.swift'),
          packageURL: 'not-a-valid-url',
          version: '1.0.0'
        }
        }
      }, CallToolResultSchema);

      expect(result.content[0]).toHaveProperty('text');
      const text = (result.content[0] as any).text;
      expect(text.toLowerCase()).toContain('error');
    });

    test('should handle non-existent dependencies', async () => {
      const pkgDir = path.join(testDir, 'NonExistentDepPackage');
      await fs.mkdir(path.join(pkgDir, 'Sources', 'TestPkg'), { recursive: true });
      createdDirs.push(testDir);
      
      const packageSwift = `// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "TestPkg",
    targets: [.target(name: "TestPkg")]
)`;
      await fs.writeFile(path.join(pkgDir, 'Package.swift'), packageSwift);

      const result = await client.request({
      method: 'tools/call',
      params: {
        name: 'manage_dependencies',
        arguments: {
          action: 'add',
          packagePath: path.join(pkgDir, 'Package.swift'),
          packageURL: 'https://github.com/nonexistent-org-xyz123/nonexistent-package-abc456.git',
          version: '1.0.0'
        }
        }
      }, CallToolResultSchema);

      expect(result.content[0]).toHaveProperty('text');
      const text = (result.content[0] as any).text;
      // Should complete but may warn about resolution
      expect(text).toBeDefined();
    });

    test('should handle removing non-existent dependency', async () => {
      const pkgDir = path.join(testDir, 'RemoveDepPackage');
      await fs.mkdir(path.join(pkgDir, 'Sources', 'TestPkg'), { recursive: true });
      createdDirs.push(testDir);
      
      const packageSwift = `// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "TestPkg",
    targets: [.target(name: "TestPkg")]
)`;
      await fs.writeFile(path.join(pkgDir, 'Package.swift'), packageSwift);

      const result = await client.request({
      method: 'tools/call',
      params: {
        name: 'manage_dependencies',
        arguments: {
          action: 'remove',
          packagePath: path.join(pkgDir, 'Package.swift'),
          packageURL: 'https://github.com/nonexistent/package.git'
        }
        }
      }, CallToolResultSchema);

      expect(result.content[0]).toHaveProperty('text');
      const text = (result.content[0] as any).text;
      expect(text).toContain('not found');
    });
  });

  describe('Archive and Export Errors', () => {
    test('should handle invalid export methods', async () => {
      try {
        await client.request({
      method: 'tools/call',
      params: {
          name: 'export_ipa',
          arguments: {
            archivePath: '/test/archive.xcarchive',
            exportMethod: 'invalid-method'
          }
          }
        }, CallToolResultSchema);
        fail('Should have thrown validation error');
      } catch (error: any) {
        expect(error.message).toBeDefined();
      }
    });

    test('should handle non-archive directories', async () => {
      // Create a regular directory (not an archive)
      const fakeArchive = path.join(testDir, 'NotAnArchive');
      await fs.mkdir(fakeArchive, { recursive: true });
      createdDirs.push(testDir);

      const result = await client.request({
      method: 'tools/call',
      params: {
        name: 'export_ipa',
        arguments: {
          archivePath: fakeArchive
        }
        }
      }, CallToolResultSchema);

      expect(result.content[0]).toHaveProperty('text');
      const text = (result.content[0] as any).text;
      expect(text.toLowerCase()).toContain('error');
    });
  });

  describe('Concurrent Operation Errors', () => {
    test('should handle concurrent builds of same project', async () => {
      const testProject = path.join(process.cwd(), 'test_artifacts', 'TestProjectXCTest', 'TestProjectXCTest.xcodeproj');
      
      // Start multiple builds concurrently
      const builds = Array(3).fill(null).map(() => 
        client.request({
          method: 'tools/call',
          params: {
            name: 'build_project',
            arguments: {
              projectPath: testProject,
              scheme: 'TestProjectXCTest',
              platform: 'iOS'
            }
          }
        }, CallToolResultSchema)
      );

      const results = await Promise.allSettled(builds);
      
      // At least one should succeed
      const succeeded = results.filter(r => r.status === 'fulfilled');
      expect(succeeded.length).toBeGreaterThan(0);
      
      // Some might fail due to lock contention
      results.forEach(result => {
        if (result.status === 'fulfilled') {
          expect(result.value.content[0]).toHaveProperty('text');
        }
      });
    });

    test('should handle race conditions in simulator operations', async () => {
      // Get an available simulator
      const simulatorsOutput = execSync('xcrun simctl list devices available -j', {
        encoding: 'utf8'
      });
      const devices = JSON.parse(simulatorsOutput).devices;
      
      let deviceId: string | null = null;
      for (const [runtime, deviceList] of Object.entries(devices)) {
        if (runtime.includes('iOS') && Array.isArray(deviceList) && deviceList.length > 0) {
          deviceId = (deviceList[0] as any).udid;
          break;
        }
      }

      if (deviceId) {
        // Try to boot and shutdown simultaneously
        const operations = [
          client.request({
            method: 'tools/call',
            params: {
              name: 'boot_simulator',
              arguments: { deviceId }
            }
          }, CallToolResultSchema),
          client.request({
            method: 'tools/call',
            params: {
              name: 'shutdown_simulator',
              arguments: { deviceId }
            }
          }, CallToolResultSchema)
        ];

        const results = await Promise.allSettled(operations);
        
        // Both should complete without crashing
        results.forEach(result => {
          expect(result.status).toBe('fulfilled');
          if (result.status === 'fulfilled') {
            expect(result.value.content[0]).toHaveProperty('text');
          }
        });

        // Clean up - ensure simulator is shutdown
        try {
          execSync(`xcrun simctl shutdown "${deviceId}"`, {
            encoding: 'utf8',
            stdio: 'pipe'
          });
        } catch {
          // Already shutdown
        }
      }
    });
  });

  describe('Resource Exhaustion Errors', () => {
    test('should handle very long file paths', async () => {
      // Create a very long path (but still valid)
      const longName = 'a'.repeat(200);
      const longPath = `/tmp/${longName}.xcodeproj`;

      const result = await client.request({
      method: 'tools/call',
      params: {
        name: 'build_project',
        arguments: {
          projectPath: longPath
        }
        }
      }, CallToolResultSchema);

      expect(result.content[0]).toHaveProperty('text');
      const text = (result.content[0] as any).text;
      expect(text.toLowerCase()).toContain('error');
    });

    test('should handle very large test filters', async () => {
      // Create a huge test filter string
      const hugeFilter = Array(100).fill('testMethod').join('|');

      const result = await client.request({
      method: 'tools/call',
      params: {
        name: 'test_project',
        arguments: {
          projectPath: path.join(process.cwd(), 'test_artifacts', 'TestProjectXCTest', 'TestProjectXCTest.xcodeproj'),
          testFilter: hugeFilter
        }
        }
      }, CallToolResultSchema);

      expect(result.content[0]).toHaveProperty('text');
      // Should handle gracefully
      expect(result.content[0]).toBeDefined();
    });
  });

  describe('State Consistency Errors', () => {
    test('should handle missing app for uninstall', async () => {
      // Get a booted simulator
      const simulatorsOutput = execSync('xcrun simctl list devices booted -j', {
        encoding: 'utf8'
      });
      const devices = JSON.parse(simulatorsOutput).devices;
      
      let bootedDevice: any = null;
      for (const [runtime, deviceList] of Object.entries(devices)) {
        if (runtime.includes('iOS') && Array.isArray(deviceList) && deviceList.length > 0) {
          bootedDevice = deviceList[0];
          break;
        }
      }

      if (!bootedDevice) {
        // Boot one if needed
        const availableOutput = execSync('xcrun simctl list devices available -j', {
          encoding: 'utf8'
        });
        const availableDevices = JSON.parse(availableOutput).devices;
        
        for (const [runtime, deviceList] of Object.entries(availableDevices)) {
          if (runtime.includes('iOS') && Array.isArray(deviceList) && deviceList.length > 0) {
            const device = deviceList[0] as any;
            execSync(`xcrun simctl boot "${device.udid}"`, {
              encoding: 'utf8',
              stdio: 'pipe'
            });
            bootedSimulators.push(device.udid);
            bootedDevice = device;
            await new Promise(resolve => setTimeout(resolve, 5000));
            break;
          }
        }
      }

      if (bootedDevice) {
        // Try to uninstall non-existent app
        const result = await client.request({
      method: 'tools/call',
      params: {
          name: 'uninstall_app',
          arguments: {
            bundleId: 'com.nonexistent.app.xyz123456',
            deviceId: bootedDevice.udid
          }
          }
        }, CallToolResultSchema);

        expect(result.content[0]).toHaveProperty('text');
        // Should handle gracefully
        expect(result.content[0]).toBeDefined();
      }
    });

    test('should handle stale derived data', async () => {
      // Clean non-existent derived data
      const result = await client.request({
      method: 'tools/call',
      params: {
        name: 'clean_build',
        arguments: {
          cleanTarget: 'derivedData',
          derivedDataPath: `/tmp/nonexistent-derived-data-${timestamp}`
        }
        }
      }, CallToolResultSchema);

      expect(result.content[0]).toHaveProperty('text');
      const text = (result.content[0] as any).text;
      expect(text).toMatch(/No DerivedData found|Removed DerivedData/);
    });
  });

  describe('Network and External Dependency Errors', () => {
    test('should handle network timeout for dependencies', async () => {
      const pkgDir = path.join(testDir, 'NetworkTimeoutPackage');
      await fs.mkdir(path.join(pkgDir, 'Sources', 'TestPkg'), { recursive: true });
      createdDirs.push(testDir);
      
      const packageSwift = `// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "TestPkg",
    dependencies: [
        // This URL should timeout or be unreachable
        .package(url: "https://192.0.2.1/timeout/package.git", from: "1.0.0")
    ],
    targets: [.target(name: "TestPkg")]
)`;
      await fs.writeFile(path.join(pkgDir, 'Package.swift'), packageSwift);

      const result = await client.request({
      method: 'tools/call',
      params: {
        name: 'manage_dependencies',
        arguments: {
          action: 'resolve',
          packagePath: path.join(pkgDir, 'Package.swift')
        }
        }
      }, CallToolResultSchema);

      expect(result.content[0]).toHaveProperty('text');
      const text = (result.content[0] as any).text;
      expect(text.toLowerCase()).toContain('error');
    }, 30000);
  });

  describe('Edge Cases and Boundary Conditions', () => {
    test('should handle empty scheme name', async () => {
      const result = await client.request({
      method: 'tools/call',
      params: {
        name: 'build_project',
        arguments: {
          projectPath: path.join(process.cwd(), 'test_artifacts', 'TestProjectXCTest', 'TestProjectXCTest.xcodeproj'),
          scheme: ''
        }
        }
      }, CallToolResultSchema);

      expect(result.content[0]).toHaveProperty('text');
      const text = (result.content[0] as any).text;
      expect(text.toLowerCase()).toContain('error');
    });

    test('should handle special characters in paths', async () => {
      const specialPaths = [
        '/path/with spaces/project.xcodeproj',
        '/path/with(parens)/project.xcodeproj',
        '/path/with[brackets]/project.xcodeproj',
        '/path/with{braces}/project.xcodeproj'
      ];

      for (const path of specialPaths) {
        const result = await client.request({
      method: 'tools/call',
      params: {
          name: 'build_project',
          arguments: {
            projectPath: path
          }
          }
        }, CallToolResultSchema);

        expect(result.content[0]).toHaveProperty('text');
        const text = (result.content[0] as any).text;
        expect(text.toLowerCase()).toContain('error');
      }
    });

    test('should handle Unicode in project names', async () => {
      const unicodeDir = path.join(testDir, '项目_プロジェクト_🚀');
      await fs.mkdir(unicodeDir, { recursive: true });
      createdDirs.push(testDir);

      const result = await client.request({
      method: 'tools/call',
      params: {
        name: 'build_project',
        arguments: {
          projectPath: path.join(unicodeDir, 'Test.xcodeproj')
        }
        }
      }, CallToolResultSchema);

      expect(result.content[0]).toHaveProperty('text');
      const text = (result.content[0] as any).text;
      expect(text.toLowerCase()).toContain('error');
    });
  });
});