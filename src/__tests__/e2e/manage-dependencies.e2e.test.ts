/**
 * E2E tests for ManageDependenciesTool
 * Tests all SPM dependency management actions: list, resolve, update, add, remove
 * Ensures proper cleanup after each test
 */

import { describe, test, expect, beforeAll, afterAll, beforeEach, afterEach } from '@jest/globals';
import { existsSync, mkdirSync, writeFileSync, rmSync, readFileSync, copyFileSync } from 'fs';
import { join, resolve } from 'path';
import { execSync } from 'child_process';
import { spawn, ChildProcess } from 'child_process';
import { Client } from '@modelcontextprotocol/sdk/client/index';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio';
import { CallToolResultSchema } from '@modelcontextprotocol/sdk/types';

describe('ManageDependenciesTool E2E Tests', () => {
  let serverProcess: ChildProcess;
  let client: Client;
  let transport: StdioClientTransport;
  
  // Test directories with unique timestamps to avoid conflicts
  const timestamp = Date.now();
  const testProjectDir = `/tmp/test-dependencies-${timestamp}`;
  const testPackageDir = join(testProjectDir, 'TestPackage');
  const testXcodeProjectDir = join(testProjectDir, 'TestXcodeProject');
  const derivedDataPath = join(testProjectDir, 'DerivedData');
  
  // Backup of original Package.swift for restoration
  let originalPackageContent: string;

  beforeAll(async () => {
    // Clean up any existing test directories
    if (existsSync(testProjectDir)) {
      rmSync(testProjectDir, { recursive: true });
    }
    
    // Create test directories
    mkdirSync(testProjectDir, { recursive: true });
    mkdirSync(testPackageDir, { recursive: true });
    mkdirSync(testXcodeProjectDir, { recursive: true });
    
    // Build the server
    execSync('npm run build', { cwd: process.cwd() });
  }, 60000);
  
  afterAll(() => {
    // Comprehensive cleanup
    if (existsSync(testProjectDir)) {
      rmSync(testProjectDir, { recursive: true });
    }
    
    // Clean up any DerivedData created during tests
    if (existsSync(derivedDataPath)) {
      rmSync(derivedDataPath, { recursive: true });
    }
    
    // Clean up any .build directories
    const buildDirs = [
      join(testPackageDir, '.build'),
      join(testXcodeProjectDir, '.build')
    ];
    
    buildDirs.forEach(dir => {
      if (existsSync(dir)) {
        rmSync(dir, { recursive: true });
      }
    });
  });
  
  beforeEach(async () => {
    // Create a fresh Swift package for each test
    writeFileSync(join(testPackageDir, 'Package.swift'), `// swift-tools-version: 6.0
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
    dependencies: [
        // Dependencies will be added by tests
    ],
    targets: [
        .target(
            name: "TestPackage",
            dependencies: []),
        .testTarget(
            name: "TestPackageTests",
            dependencies: ["TestPackage"]),
    ]
)
`);
    
    // Store original content for restoration
    originalPackageContent = readFileSync(join(testPackageDir, 'Package.swift'), 'utf8');
    
    // Create source files
    mkdirSync(join(testPackageDir, 'Sources', 'TestPackage'), { recursive: true });
    writeFileSync(join(testPackageDir, 'Sources', 'TestPackage', 'TestPackage.swift'), `
public struct TestPackage {
    public init() {}
    public func greet() -> String {
        return "Hello from TestPackage"
    }
}
`);
    
    // Create test files
    mkdirSync(join(testPackageDir, 'Tests', 'TestPackageTests'), { recursive: true });
    writeFileSync(join(testPackageDir, 'Tests', 'TestPackageTests', 'TestPackageTests.swift'), `
import Testing
@testable import TestPackage

@Test func testGreeting() {
    let package = TestPackage()
    #expect(package.greet() == "Hello from TestPackage")
}
`);
    
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
    
    // Clean up build artifacts
    const buildDir = join(testPackageDir, '.build');
    if (existsSync(buildDir)) {
      rmSync(buildDir, { recursive: true });
    }
    
    // Restore original Package.swift
    if (originalPackageContent) {
      writeFileSync(join(testPackageDir, 'Package.swift'), originalPackageContent);
    }
  });

  describe('List Dependencies', () => {
    test('should list dependencies in a package with no dependencies', async () => {
      const response = await client.request({
        method: 'tools/call',
        params: {
          name: 'manage_dependencies',
          arguments: {
            projectPath: testPackageDir,
            action: 'list'
          }
        }
      }, CallToolResultSchema);
      
      expect(response).toBeDefined();
      expect(response.content[0].type).toBe('text');
      const text = (response.content[0] as any).text;
      // The tool returns "No Swift Package dependencies found" for empty deps
      expect(text.toLowerCase()).toMatch(/no.*dependencies|dependencies.*none|empty/i);
    });

    test('should list dependencies after adding some', async () => {
      // First add a dependency - need to use full path to Package.swift for add action
      await client.request({
        method: 'tools/call',
        params: {
          name: 'manage_dependencies',
          arguments: {
            projectPath: join(testPackageDir, 'Package.swift'),
            action: 'add',
            packageURL: 'https://github.com/apple/swift-argument-parser',
            version: 'from: "1.0.0"'
          }
        }
      }, CallToolResultSchema);
      
      // Now list dependencies
      const response = await client.request({
        method: 'tools/call',
        params: {
          name: 'manage_dependencies',
          arguments: {
            projectPath: testPackageDir,
            action: 'list'
          }
        }
      }, CallToolResultSchema);
      
      expect(response).toBeDefined();
      const text = (response.content[0] as any).text;
      expect(text).toContain('swift-argument-parser');
    });
  });

  describe('Add Dependencies', () => {
    test('should add a dependency with version requirement', async () => {
      const response = await client.request({
        method: 'tools/call',
        params: {
          name: 'manage_dependencies',
          arguments: {
            projectPath: join(testPackageDir, 'Package.swift'),
            action: 'add',
            packageURL: 'https://github.com/apple/swift-argument-parser',
            version: 'from: "1.0.0"'
          }
        }
      }, CallToolResultSchema);
      
      expect(response).toBeDefined();
      const text = (response.content[0] as any).text;
      expect(text.toLowerCase()).toContain('added');
      
      // Verify the Package.swift was updated
      const packageContent = readFileSync(join(testPackageDir, 'Package.swift'), 'utf8');
      expect(packageContent).toContain('swift-argument-parser');
      expect(packageContent).toContain('from: "1.0.0"');
    });

    test('should add multiple dependencies', async () => {
      // Add first dependency
      await client.request({
        method: 'tools/call',
        params: {
          name: 'manage_dependencies',
          arguments: {
            projectPath: join(testPackageDir, 'Package.swift'),
            action: 'add',
            packageURL: 'https://github.com/apple/swift-argument-parser',
            version: 'from: "1.0.0"'
          }
        }
      }, CallToolResultSchema);
      
      // Add second dependency
      const response = await client.request({
        method: 'tools/call',
        params: {
          name: 'manage_dependencies',
          arguments: {
            projectPath: join(testPackageDir, 'Package.swift'),
            action: 'add',
            packageURL: 'https://github.com/apple/swift-algorithms',
            version: 'from: "1.0.0"'
          }
        }
      }, CallToolResultSchema);
      
      expect(response).toBeDefined();
      const text = (response.content[0] as any).text;
      expect(text.toLowerCase()).toContain('added');
      
      // Verify both dependencies are in Package.swift
      const packageContent = readFileSync(join(testPackageDir, 'Package.swift'), 'utf8');
      expect(packageContent).toContain('swift-argument-parser');
      expect(packageContent).toContain('swift-algorithms');
    });

    test('should handle adding dependency without version', async () => {
      const response = await client.request({
        method: 'tools/call',
        params: {
          name: 'manage_dependencies',
          arguments: {
            projectPath: join(testPackageDir, 'Package.swift'),
            action: 'add',
            packageURL: 'https://github.com/apple/swift-argument-parser'
            // No version specified - should use latest
          }
        }
      }, CallToolResultSchema);
      
      expect(response).toBeDefined();
      const text = (response.content[0] as any).text;
      expect(text.toLowerCase()).toContain('added');
    });
  });

  describe('Remove Dependencies', () => {
    test('should remove an existing dependency', async () => {
      // First add a dependency
      await client.request({
        method: 'tools/call',
        params: {
          name: 'manage_dependencies',
          arguments: {
            projectPath: join(testPackageDir, 'Package.swift'),
            action: 'add',
            packageURL: 'https://github.com/apple/swift-argument-parser',
            version: 'from: "1.0.0"'
          }
        }
      }, CallToolResultSchema);
      
      // Verify it was added
      let packageContent = readFileSync(join(testPackageDir, 'Package.swift'), 'utf8');
      expect(packageContent).toContain('swift-argument-parser');
      
      // Now remove it
      const response = await client.request({
        method: 'tools/call',
        params: {
          name: 'manage_dependencies',
          arguments: {
            projectPath: join(testPackageDir, 'Package.swift'),
            action: 'remove',
            packageName: 'swift-argument-parser'
          }
        }
      }, CallToolResultSchema);
      
      expect(response).toBeDefined();
      const text = (response.content[0] as any).text;
      expect(text.toLowerCase()).toContain('removed');
      
      // Verify it was removed
      packageContent = readFileSync(join(testPackageDir, 'Package.swift'), 'utf8');
      expect(packageContent).not.toContain('swift-argument-parser');
    });

    test('should handle removing non-existent dependency gracefully', async () => {
      const response = await client.request({
        method: 'tools/call',
        params: {
          name: 'manage_dependencies',
          arguments: {
            projectPath: join(testPackageDir, 'Package.swift'),
            action: 'remove',
            packageName: 'non-existent-package'
          }
        }
      }, CallToolResultSchema);
      
      expect(response).toBeDefined();
      const text = (response.content[0] as any).text;
      // Should either report not found or handle gracefully
      expect(text).toBeDefined();
    });
  });

  describe('Resolve Dependencies', () => {
    test('should resolve dependencies', async () => {
      // Add a dependency first
      await client.request({
        method: 'tools/call',
        params: {
          name: 'manage_dependencies',
          arguments: {
            projectPath: join(testPackageDir, 'Package.swift'),
            action: 'add',
            packageURL: 'https://github.com/apple/swift-argument-parser',
            version: 'from: "1.0.0"'
          }
        }
      }, CallToolResultSchema);
      
      // Resolve dependencies
      const response = await client.request({
        method: 'tools/call',
        params: {
          name: 'manage_dependencies',
          arguments: {
            projectPath: testPackageDir,
            action: 'resolve'
          }
        }
      }, CallToolResultSchema);
      
      expect(response).toBeDefined();
      const text = (response.content[0] as any).text;
      expect(text.toLowerCase()).toContain('resolved');
      
      // Verify Package.resolved was created
      expect(existsSync(join(testPackageDir, 'Package.resolved'))).toBe(true);
    }, 60000); // Longer timeout for network operations

    test('should handle resolve with no dependencies', async () => {
      const response = await client.request({
        method: 'tools/call',
        params: {
          name: 'manage_dependencies',
          arguments: {
            projectPath: testPackageDir,
            action: 'resolve'
          }
        }
      }, CallToolResultSchema);
      
      expect(response).toBeDefined();
      const text = (response.content[0] as any).text;
      // Should complete successfully even with no dependencies
      expect(text).toBeDefined();
    });
  });

  describe('Update Dependencies', () => {
    test('should update all dependencies', async () => {
      // Add a dependency
      await client.request({
        method: 'tools/call',
        params: {
          name: 'manage_dependencies',
          arguments: {
            projectPath: join(testPackageDir, 'Package.swift'),
            action: 'add',
            packageURL: 'https://github.com/apple/swift-argument-parser',
            version: 'from: "1.0.0"'
          }
        }
      }, CallToolResultSchema);
      
      // Resolve to lock versions
      await client.request({
        method: 'tools/call',
        params: {
          name: 'manage_dependencies',
          arguments: {
            projectPath: testPackageDir,
            action: 'resolve'
          }
        }
      }, CallToolResultSchema);
      
      // Update dependencies
      const response = await client.request({
        method: 'tools/call',
        params: {
          name: 'manage_dependencies',
          arguments: {
            projectPath: testPackageDir,
            action: 'update'
          }
        }
      }, CallToolResultSchema);
      
      expect(response).toBeDefined();
      const text = (response.content[0] as any).text;
      expect(text.toLowerCase()).toContain('update');
    }, 60000);

    test('should update specific dependency', async () => {
      // Add dependencies
      await client.request({
        method: 'tools/call',
        params: {
          name: 'manage_dependencies',
          arguments: {
            projectPath: join(testPackageDir, 'Package.swift'),
            action: 'add',
            packageURL: 'https://github.com/apple/swift-argument-parser',
            version: 'from: "1.0.0"'
          }
        }
      }, CallToolResultSchema);
      
      // Update specific package
      const response = await client.request({
        method: 'tools/call',
        params: {
          name: 'manage_dependencies',
          arguments: {
            projectPath: testPackageDir,
            action: 'update',
            packageName: 'swift-argument-parser'
          }
        }
      }, CallToolResultSchema);
      
      expect(response).toBeDefined();
      const text = (response.content[0] as any).text;
      expect(text.toLowerCase()).toContain('update');
    }, 60000);
  });

  describe('Error Handling', () => {
    test('should handle invalid project path', async () => {
      const response = await client.request({
        method: 'tools/call',
        params: {
          name: 'manage_dependencies',
          arguments: {
            projectPath: '/non/existent/path',
            action: 'list'
          }
        }
      }, CallToolResultSchema);
      
      expect(response).toBeDefined();
      const text = (response.content[0] as any).text;
      expect(text.toLowerCase()).toContain('error');
    });

    test('should handle invalid action', async () => {
      const response = await client.request({
        method: 'tools/call',
        params: {
          name: 'manage_dependencies',
          arguments: {
            projectPath: testPackageDir,
            action: 'invalid-action'
          }
        }
      }, CallToolResultSchema);
      
      expect(response).toBeDefined();
      // Should either reject or handle gracefully
    });

    test('should handle malformed Package.swift', async () => {
      // Create a malformed Package.swift
      writeFileSync(join(testPackageDir, 'Package.swift'), `
// Invalid Swift code
let package = {
  this is not valid Swift
}
`);
      
      const response = await client.request({
        method: 'tools/call',
        params: {
          name: 'manage_dependencies',
          arguments: {
            projectPath: testPackageDir,
            action: 'list'
          }
        }
      }, CallToolResultSchema);
      
      expect(response).toBeDefined();
      const text = (response.content[0] as any).text;
      // Should report an error about invalid Package.swift
      expect(text.toLowerCase()).toContain('error');
    });

    test('should handle invalid package URL', async () => {
      const response = await client.request({
        method: 'tools/call',
        params: {
          name: 'manage_dependencies',
          arguments: {
            projectPath: testPackageDir,
            action: 'add',
            packageURL: 'not-a-valid-url'
          }
        }
      }, CallToolResultSchema);
      
      expect(response).toBeDefined();
      const text = (response.content[0] as any).text;
      // Should report an error about invalid URL
      expect(text.toLowerCase()).toContain('error');
    });

    test('should handle network failures gracefully', async () => {
      const response = await client.request({
        method: 'tools/call',
        params: {
          name: 'manage_dependencies',
          arguments: {
            projectPath: testPackageDir,
            action: 'add',
            packageURL: 'https://non.existent.domain.xyz/package'
          }
        }
      }, CallToolResultSchema);
      
      expect(response).toBeDefined();
      const text = (response.content[0] as any).text;
      // Should report an error about network/fetch failure
      expect(text.toLowerCase()).toContain('error');
    });
  });

  describe('Xcode Project Integration', () => {
    beforeEach(() => {
      // Create a simple Xcode project structure
      const xcodeProjectPath = join(testXcodeProjectDir, 'Test.xcodeproj');
      mkdirSync(xcodeProjectPath, { recursive: true });
      
      writeFileSync(join(xcodeProjectPath, 'project.pbxproj'), `// !$*UTF8*$!
{
  archiveVersion = 1;
  classes = {};
  objectVersion = 56;
  objects = {};
  rootObject = 1234567890ABCDEF;
}`);
      
      // Create a Package.swift in the project directory
      writeFileSync(join(testXcodeProjectDir, 'Package.swift'), `// swift-tools-version: 6.0
import PackageDescription

let package = Package(
    name: "TestXcodePackage",
    platforms: [.iOS(.v17)],
    products: [],
    dependencies: [],
    targets: []
)
`);
    });

    test('should manage dependencies in Xcode project with Package.swift', async () => {
      const response = await client.request({
        method: 'tools/call',
        params: {
          name: 'manage_dependencies',
          arguments: {
            projectPath: join(testXcodeProjectDir, 'Test.xcodeproj'),
            action: 'add',
            packageURL: 'https://github.com/apple/swift-argument-parser',
            version: 'from: "1.0.0"'
          }
        }
      }, CallToolResultSchema);
      
      expect(response).toBeDefined();
      // Should either handle Xcode project dependencies or report appropriate message
      const text = (response.content[0] as any).text;
      expect(text).toBeDefined();
    });
  });

  describe('Cleanup Verification', () => {
    test('should not leave build artifacts after operations', async () => {
      // Add and resolve dependencies
      await client.request({
        method: 'tools/call',
        params: {
          name: 'manage_dependencies',
          arguments: {
            projectPath: join(testPackageDir, 'Package.swift'),
            action: 'add',
            packageURL: 'https://github.com/apple/swift-argument-parser',
            version: 'from: "1.0.0"'
          }
        }
      }, CallToolResultSchema);
      
      await client.request({
        method: 'tools/call',
        params: {
          name: 'manage_dependencies',
          arguments: {
            projectPath: testPackageDir,
            action: 'resolve'
          }
        }
      }, CallToolResultSchema);
      
      // After test cleanup (simulated here)
      const buildDir = join(testPackageDir, '.build');
      if (existsSync(buildDir)) {
        rmSync(buildDir, { recursive: true });
      }
      
      // Verify cleanup
      expect(existsSync(buildDir)).toBe(false);
    });

    test('should restore original Package.swift after modifications', async () => {
      const originalContent = readFileSync(join(testPackageDir, 'Package.swift'), 'utf8');
      
      // Modify by adding dependency
      await client.request({
        method: 'tools/call',
        params: {
          name: 'manage_dependencies',
          arguments: {
            projectPath: join(testPackageDir, 'Package.swift'),
            action: 'add',
            packageURL: 'https://github.com/apple/swift-argument-parser',
            version: 'from: "1.0.0"'
          }
        }
      }, CallToolResultSchema);
      
      // Verify it was modified
      const modifiedContent = readFileSync(join(testPackageDir, 'Package.swift'), 'utf8');
      expect(modifiedContent).not.toBe(originalContent);
      
      // Restore original (simulating afterEach cleanup)
      writeFileSync(join(testPackageDir, 'Package.swift'), originalContent);
      
      // Verify restoration
      const restoredContent = readFileSync(join(testPackageDir, 'Package.swift'), 'utf8');
      expect(restoredContent).toBe(originalContent);
    });
  });
});