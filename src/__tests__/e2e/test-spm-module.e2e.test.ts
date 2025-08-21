/**
 * E2E tests for TestSPMModule tool
 * Tests Swift Package Manager testing functionality with cleanup
 */

import { describe, test, expect, beforeAll, afterAll, afterEach } from '@jest/globals';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { CallToolResultSchema } from '@modelcontextprotocol/sdk/types';
import { ChildProcess, spawn } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';
import { execSync } from 'child_process';

describe('TestSPMModule Tool E2E', () => {
  let client: Client;
  let transport: StdioClientTransport;
  let serverProcess: ChildProcess;
  const timestamp = Date.now();
  const testPackageDir = path.join(process.cwd(), 'test_artifacts', `TestSPMPackage_${timestamp}`);
  const buildDirs: string[] = [];

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

    // Clean up build directories
    for (const dir of buildDirs) {
      try {
        await fs.rm(dir, { recursive: true, force: true });
      } catch (error) {
        // Directory might not exist
      }
    }
    buildDirs.length = 0;

    // Clean up test package directory
    try {
      await fs.rm(testPackageDir, { recursive: true, force: true });
    } catch (error) {
      // Directory might not exist
    }
  });

  afterAll(async () => {
    // Final cleanup
    try {
      await fs.rm(testPackageDir, { recursive: true, force: true });
    } catch (error) {
      // Directory might not exist
    }

    // Clean any remaining build directories
    for (const dir of buildDirs) {
      try {
        await fs.rm(dir, { recursive: true, force: true });
      } catch (error) {
        // Ignore errors
      }
    }

  });

  async function createTestPackage(withFailingTest: boolean = false): Promise<void> {
    // Create package directory
    await fs.mkdir(path.join(testPackageDir, 'Sources', 'TestPackage'), { recursive: true });
    await fs.mkdir(path.join(testPackageDir, 'Tests', 'TestPackageTests'), { recursive: true });
    
    // Create Package.swift
    const packageSwift = `// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "TestPackage",
    platforms: [
        .macOS(.v13),
        .iOS(.v16)
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
)`;
    await fs.writeFile(path.join(testPackageDir, 'Package.swift'), packageSwift);
    
    // Create source file
    const sourceFile = `public struct TestPackage {
    public let text = "Hello, World!"
    
    public init() {}
    
    public func greet(_ name: String) -> String {
        return "Hello, \\(name)!"
    }
    
    public func add(_ a: Int, _ b: Int) -> Int {
        return a + b
    }
}`;
    await fs.writeFile(
      path.join(testPackageDir, 'Sources', 'TestPackage', 'TestPackage.swift'),
      sourceFile
    );
    
    // Create test file
    const testFile = `import XCTest
@testable import TestPackage

final class TestPackageTests: XCTestCase {
    func testGreeting() throws {
        let package = TestPackage()
        XCTAssertEqual(package.text, "Hello, World!")
        XCTAssertEqual(package.greet("Swift"), "Hello, Swift!")
    }
    
    func testAddition() throws {
        let package = TestPackage()
        XCTAssertEqual(package.add(2, 3), 5)
        XCTAssertEqual(package.add(-1, 1), 0)
    }
    
    ${withFailingTest ? `
    func testFailure() throws {
        XCTFail("This test is designed to fail")
    }
    ` : ''}
}`;
    await fs.writeFile(
      path.join(testPackageDir, 'Tests', 'TestPackageTests', 'TestPackageTests.swift'),
      testFile
    );
    
    // Track build directory for cleanup
    buildDirs.push(path.join(testPackageDir, '.build'));
  }

  test('should test SPM package with all tests passing', async () => {
    await createTestPackage(false);
    
    const result = await client.request({
      method: 'tools/call',
      params: {
        name: 'test_spm_module',
        arguments: {
          packagePath: testPackageDir,
          platform: 'macOS'
        }
      }
    }, CallToolResultSchema);
    
    expect(result.content[0]).toHaveProperty('text');
    const text = (result.content[0] as any).text;
    expect(text).toContain('Test Suite');
    expect(text.toLowerCase()).toContain('passed');
    expect(text).toContain('TestPackageTests');
    
    // Verify .build directory was created
    const buildExists = await fs.access(path.join(testPackageDir, '.build'))
      .then(() => true)
      .catch(() => false);
    expect(buildExists).toBe(true);
  });

  test('should test with specific test filter', async () => {
    await createTestPackage(false);
    
    const result = await client.request({
      method: 'tools/call',
      params: {
        name: 'test_spm_module',
        arguments: {
          packagePath: testPackageDir,
          platform: 'macOS',
          testFilter: 'testGreeting'
        }
      }
    }, CallToolResultSchema);
    
    expect(result.content[0]).toHaveProperty('text');
    const text = (result.content[0] as any).text;
    expect(text).toContain('testGreeting');
    // Should not run other tests
    expect(text).not.toContain('testAddition');
  });

  test('should test on different platforms', async () => {
    await createTestPackage(false);
    
    const platforms = ['macOS', 'iOS'];
    
    for (const platform of platforms) {
      const result = await client.request({
        method: 'tools/call',
        params: {
          name: 'test_spm_module',
          arguments: {
            packagePath: testPackageDir,
            platform: platform
          }
        }
      }, CallToolResultSchema);
      
      expect(result.content[0]).toHaveProperty('text');
      const text = (result.content[0] as any).text;
      expect(text).toContain('Test Suite');
      
      // iOS tests run on simulator, macOS runs natively
      if (platform === 'iOS') {
        expect(text.toLowerCase()).toMatch(/simulator|ios/i);
      }
    }
  });

  test('should handle test failures', async () => {
    await createTestPackage(true);
    
    const result = await client.request({
      method: 'tools/call',
      params: {
        name: 'test_spm_module',
        arguments: {
          packagePath: testPackageDir,
          platform: 'macOS'
        }
      }
    }, CallToolResultSchema);
    
    expect(result.content[0]).toHaveProperty('text');
    const text = (result.content[0] as any).text;
    expect(text.toLowerCase()).toContain('fail');
    expect(text).toContain('testFailure');
  });

  test('should test with specific OS version', async () => {
    await createTestPackage(false);
    
    const result = await client.request({
      method: 'tools/call',
      params: {
        name: 'test_spm_module',
        arguments: {
          packagePath: testPackageDir,
          platform: 'iOS',
          osVersion: '17.0'
        }
      }
    }, CallToolResultSchema);
    
    expect(result.content[0]).toHaveProperty('text');
    const text = (result.content[0] as any).text;
    expect(text).toContain('17.0');
  });

  test('should validate OS version format', async () => {
    const invalidVersions = ['17', '17.0.1', 'seventeen', '17.x'];
    
    for (const version of invalidVersions) {
      try {
        await client.request({
          method: 'tools/call',
          params: {
            name: 'test_spm_module',
            arguments: {
              packagePath: testPackageDir,
              osVersion: version
            }
          }
        }, CallToolResultSchema);
        fail('Should have thrown validation error');
      } catch (error: any) {
        expect(error.message).toContain('OS version must be in format');
      }
    }
  });

  test('should handle missing Package.swift', async () => {
    const result = await client.request({
      method: 'tools/call',
      params: {
        name: 'test_spm_module',
        arguments: {
          packagePath: '/nonexistent/Package.swift'
        }
      }
    }, CallToolResultSchema);
    
    expect(result.content[0]).toHaveProperty('text');
    const text = (result.content[0] as any).text;
    expect(text.toLowerCase()).toContain('error');
  });

  test('should handle package with no tests', async () => {
    // Create package without tests
    await fs.mkdir(path.join(testPackageDir, 'Sources', 'NoTestPackage'), { recursive: true });
    
    const packageSwift = `// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "NoTestPackage",
    products: [
        .library(
            name: "NoTestPackage",
            targets: ["NoTestPackage"]),
    ],
    targets: [
        .target(name: "NoTestPackage")
    ]
)`;
    await fs.writeFile(path.join(testPackageDir, 'Package.swift'), packageSwift);
    
    const sourceFile = `public struct NoTestPackage {
    public init() {}
}`;
    await fs.writeFile(
      path.join(testPackageDir, 'Sources', 'NoTestPackage', 'NoTestPackage.swift'),
      sourceFile
    );
    
    const result = await client.request({
      method: 'tools/call',
      params: {
        name: 'test_spm_module',
        arguments: {
          packagePath: testPackageDir
        }
      }
    }, CallToolResultSchema);
    
    expect(result.content[0]).toHaveProperty('text');
    const text = (result.content[0] as any).text;
    // Should complete but indicate no tests
    expect(text).toBeDefined();
  });

  test('should handle compilation errors', async () => {
    // Create package with compilation error
    await fs.mkdir(path.join(testPackageDir, 'Sources', 'BrokenPackage'), { recursive: true });
    await fs.mkdir(path.join(testPackageDir, 'Tests', 'BrokenPackageTests'), { recursive: true });
    
    const packageSwift = `// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "BrokenPackage",
    targets: [
        .target(name: "BrokenPackage"),
        .testTarget(
            name: "BrokenPackageTests",
            dependencies: ["BrokenPackage"])
    ]
)`;
    await fs.writeFile(path.join(testPackageDir, 'Package.swift'), packageSwift);
    
    // Source with syntax error
    const brokenSource = `public struct BrokenPackage {
    public init() {
        // Missing closing brace
}`;
    await fs.writeFile(
      path.join(testPackageDir, 'Sources', 'BrokenPackage', 'BrokenPackage.swift'),
      brokenSource
    );
    
    const testFile = `import XCTest
@testable import BrokenPackage

final class BrokenPackageTests: XCTestCase {
    func testExample() {
        XCTAssertTrue(true)
    }
}`;
    await fs.writeFile(
      path.join(testPackageDir, 'Tests', 'BrokenPackageTests', 'BrokenPackageTests.swift'),
      testFile
    );
    
    const result = await client.request({
      method: 'tools/call',
      params: {
        name: 'test_spm_module',
        arguments: {
          packagePath: testPackageDir
        }
      }
    }, CallToolResultSchema);
    
    expect(result.content[0]).toHaveProperty('text');
    const text = (result.content[0] as any).text;
    expect(text.toLowerCase()).toContain('error');
  });

  test('should use existing TestSPM package', async () => {
    // Test with the existing TestSPM package
    const existingPackagePath = path.join(process.cwd(), 'test_artifacts', 'TestSPM');
    
    // Check if it exists
    const exists = await fs.access(path.join(existingPackagePath, 'Package.swift'))
      .then(() => true)
      .catch(() => false);
    
    if (exists) {
      const result = await client.request({
        method: 'tools/call',
        params: {
          name: 'test_spm_module',
          arguments: {
            packagePath: existingPackagePath,
            platform: 'macOS'
          }
        }
      }, CallToolResultSchema);
      
      expect(result.content[0]).toHaveProperty('text');
      const text = (result.content[0] as any).text;
      expect(text).toContain('TestSPM');
      expect(text.toLowerCase()).toContain('passed');
    }
  });

  test('should clean build artifacts after test', async () => {
    await createTestPackage(false);
    
    // Run test
    await client.request({
      method: 'tools/call',
      params: {
        name: 'test_spm_module',
        arguments: {
          packagePath: testPackageDir
        }
      }
    }, CallToolResultSchema);
    
    // Verify .build exists
    const buildPath = path.join(testPackageDir, '.build');
    const existsBefore = await fs.access(buildPath)
      .then(() => true)
      .catch(() => false);
    expect(existsBefore).toBe(true);
    
    // Clean up (simulating what afterEach does)
    await fs.rm(buildPath, { recursive: true, force: true });
    
    // Verify it's gone
    const existsAfter = await fs.access(buildPath)
      .then(() => true)
      .catch(() => false);
    expect(existsAfter).toBe(false);
  });

  test('should handle path traversal attempts', async () => {
    const maliciousPaths = [
      '../../../etc/passwd',
      '/path/with/../traversal',
      '~/home/Package.swift'
    ];
    
    for (const path of maliciousPaths) {
      try {
        await client.request({
          method: 'tools/call',
          params: {
            name: 'test_spm_module',
            arguments: {
              packagePath: path
            }
          }
        }, CallToolResultSchema);
        fail('Should have thrown validation error');
      } catch (error: any) {
        expect(error.message).toContain('Path traversal patterns are not allowed');
      }
    }
  });

  test('should handle concurrent test runs', async () => {
    // Create multiple packages
    const package1Dir = path.join(process.cwd(), 'test_artifacts', `Package1_${timestamp}`);
    const package2Dir = path.join(process.cwd(), 'test_artifacts', `Package2_${timestamp}`);
    
    // Helper to create a simple package
    const createSimplePackage = async (dir: string, name: string) => {
      await fs.mkdir(path.join(dir, 'Sources', name), { recursive: true });
      await fs.mkdir(path.join(dir, 'Tests', `${name}Tests`), { recursive: true });
      
      const packageSwift = `// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "${name}",
    targets: [
        .target(name: "${name}"),
        .testTarget(name: "${name}Tests", dependencies: ["${name}"])
    ]
)`;
      await fs.writeFile(path.join(dir, 'Package.swift'), packageSwift);
      
      const source = `public struct ${name} { public init() {} }`;
      await fs.writeFile(path.join(dir, 'Sources', name, `${name}.swift`), source);
      
      const test = `import XCTest
@testable import ${name}

final class ${name}Tests: XCTestCase {
    func testInit() { _ = ${name}() }
}`;
      await fs.writeFile(path.join(dir, 'Tests', `${name}Tests`, `${name}Tests.swift`), test);
      
      buildDirs.push(path.join(dir, '.build'));
    };
    
    await createSimplePackage(package1Dir, 'Package1');
    await createSimplePackage(package2Dir, 'Package2');
    
    // Run tests concurrently
    const [result1, result2] = await Promise.all([
      client.request({
        method: 'tools/call',
        params: {
          name: 'test_spm_module',
          arguments: {
            packagePath: package1Dir
          }
        }
      }, CallToolResultSchema),
      client.request({
        method: 'tools/call',
        params: {
          name: 'test_spm_module',
          arguments: {
            packagePath: package2Dir
          }
        }
      }, CallToolResultSchema)
    ]);
    
    // Both should succeed
    expect(result1.content[0]).toHaveProperty('text');
    expect(result2.content[0]).toHaveProperty('text');
    
    const text1 = (result1.content[0] as any).text;
    const text2 = (result2.content[0] as any).text;
    
    expect(text1).toContain('Package1');
    expect(text2).toContain('Package2');
    
    // Clean up
    await fs.rm(package1Dir, { recursive: true, force: true });
    await fs.rm(package2Dir, { recursive: true, force: true });
  });
});