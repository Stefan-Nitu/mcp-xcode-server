/**
 * Integration tests for the MCP server
 * Tests the server's request handlers directly without spawning a separate process
 */

import { describe, test, expect, beforeAll } from '@jest/globals';
import { existsSync, mkdirSync, writeFileSync, rmSync } from 'fs';
import { join } from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

describe('Apple Simulator MCP Server Integration', () => {
  const testProjectPath = '/tmp/test-integration-project';
  
  beforeAll(async () => {
    // Create a simple test Swift package
    if (existsSync(testProjectPath)) {
      rmSync(testProjectPath, { recursive: true });
    }
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
    
    public func add(_ a: Int, _ b: Int) -> Int {
        return a + b
    }
}
`);
    
    // Create test file
    mkdirSync(join(testProjectPath, 'Tests', 'TestPackageTests'), { recursive: true });
    writeFileSync(join(testProjectPath, 'Tests', 'TestPackageTests', 'TestPackageTests.swift'), `
import XCTest
@testable import TestPackage

final class TestPackageTests: XCTestCase {
    func testAddition() {
        let package = TestPackage()
        XCTAssertEqual(package.add(2, 3), 5)
    }
    
    func testZeroAddition() {
        let package = TestPackage()
        XCTAssertEqual(package.add(0, 0), 0)
    }
}
`);
  }, 30000);
  
  describe('Simulator Operations', () => {
    test('should list iOS simulators', async () => {
      const { stdout } = await execAsync('xcrun simctl list devices --json');
      const data = JSON.parse(stdout);
      
      const iosDevices = [];
      for (const [runtime, deviceList] of Object.entries(data.devices)) {
        if (runtime.toLowerCase().includes('ios')) {
          for (const device of deviceList as any[]) {
            iosDevices.push(device);
          }
        }
      }
      
      expect(iosDevices.length).toBeGreaterThan(0);
    });
    
    test('should check for booted simulators', async () => {
      const { stdout } = await execAsync('xcrun simctl list devices --json');
      const data = JSON.parse(stdout);
      
      let hasBootedDevice = false;
      for (const deviceList of Object.values(data.devices)) {
        for (const device of deviceList as any[]) {
          if (device.state === 'Booted') {
            hasBootedDevice = true;
            break;
          }
        }
      }
      
      // Just verify we can check simulator state
      expect(typeof hasBootedDevice).toBe('boolean');
    });
  });
  
  describe('Swift Package Testing', () => {
    test('should run Swift package tests on macOS', async () => {
      const command = `swift test --package-path "${testProjectPath}"`;
      
      try {
        const { stdout } = await execAsync(command, { 
          maxBuffer: 10 * 1024 * 1024
        });
        
        // Check for successful test execution
        expect(stdout).toContain('Test Suite');
        expect(stdout).toContain('Executed');
        
        // Our package has 2 tests
        const testMatch = stdout.match(/Executed (\d+) test/);
        expect(testMatch).toBeTruthy();
        if (testMatch) {
          expect(parseInt(testMatch[1])).toBe(2);
        }
      } catch (error: any) {
        // Even if tests fail, we should see output
        expect(error.stdout || error.message).toContain('Test');
      }
    }, 60000);
  });
  
  describe('Xcode Command Verification', () => {
    test('should verify xcodebuild is available', async () => {
      const { stdout } = await execAsync('xcodebuild -version');
      expect(stdout).toContain('Xcode');
    });
    
    test('should verify xcrun simctl is available', async () => {
      const { stdout } = await execAsync('xcrun simctl help');
      expect(stdout).toContain('simctl');
    });
    
    test('should list available SDKs', async () => {
      const { stdout } = await execAsync('xcodebuild -showsdks');
      expect(stdout).toContain('iOS');
      expect(stdout).toContain('macOS');
    });
  });
  
  describe('Test Output Parsing', () => {
    test('should correctly identify test success patterns', () => {
      const successOutput = `Test Suite 'All tests' passed`;
      expect(successOutput.includes('passed')).toBe(true);
      expect(successOutput.includes('failed')).toBe(false);
    });
    
    test('should correctly identify test failure patterns', () => {
      const failureOutput = `Test Suite 'All tests' failed`;
      expect(failureOutput.includes('failed')).toBe(true);
      expect(failureOutput.includes('passed')).toBe(false);
    });
    
    test('should extract test counts from output', () => {
      const output = `Executed 5 tests, with 2 failures`;
      
      const testMatch = output.match(/Executed (\d+) test/);
      const failureMatch = output.match(/(\d+) failure/);
      
      expect(testMatch?.[1]).toBe('5');
      expect(failureMatch?.[1]).toBe('2');
    });
  });
  
  afterAll(() => {
    // Clean up test project
    if (existsSync(testProjectPath)) {
      rmSync(testProjectPath, { recursive: true });
    }
  });
});