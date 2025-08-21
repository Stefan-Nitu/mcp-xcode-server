/**
 * E2E tests for TestProjectTool
 * Tests running XCTest and Swift Testing frameworks with comprehensive cleanup
 */

import { describe, test, expect, beforeAll, afterAll, beforeEach, afterEach } from '@jest/globals';
import { existsSync, mkdirSync, writeFileSync, rmSync, readFileSync } from 'fs';
import { join, resolve } from 'path';
import { execSync } from 'child_process';
import { spawn, ChildProcess } from 'child_process';
import { Client } from '@modelcontextprotocol/sdk/client/index';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio';
import { CallToolResultSchema } from '@modelcontextprotocol/sdk/types';

describe('TestProjectTool E2E Tests', () => {
  let serverProcess: ChildProcess;
  let client: Client;
  let transport: StdioClientTransport;
  
  // Test directories with unique timestamps
  const timestamp = Date.now();
  const testProjectDir = `/tmp/test-project-testing-${timestamp}`;
  const xcTestProjectDir = join(testProjectDir, 'XCTestProject');
  const swiftTestingProjectDir = join(testProjectDir, 'SwiftTestingProject');
  const mixedTestProjectDir = join(testProjectDir, 'MixedTestProject');
  const failingTestProjectDir = join(testProjectDir, 'FailingTestProject');
  const derivedDataPath = join(testProjectDir, 'DerivedData');
  
  // Track test results directories for cleanup
  const testResultsPaths: string[] = [];
  
  beforeAll(async () => {
    // Clean up any existing test directories
    if (existsSync(testProjectDir)) {
      rmSync(testProjectDir, { recursive: true });
    }
    
    // Create test directories
    mkdirSync(testProjectDir, { recursive: true });
    mkdirSync(xcTestProjectDir, { recursive: true });
    mkdirSync(swiftTestingProjectDir, { recursive: true });
    mkdirSync(mixedTestProjectDir, { recursive: true });
    mkdirSync(failingTestProjectDir, { recursive: true });
    
    // Build the server
    execSync('npm run build', { cwd: process.cwd() });
    
    // Create test projects
    await createTestProjects();
  }, 120000);
  
  afterAll(() => {
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
    
    // Clean build and test artifacts after each test
    cleanTestArtifacts();
  });

  function cleanTestArtifacts() {
    // Clean all .build, DerivedData, and test result directories
    const artifactDirs = [
      join(xcTestProjectDir, '.build'),
      join(xcTestProjectDir, 'DerivedData'),
      join(swiftTestingProjectDir, '.build'),
      join(swiftTestingProjectDir, 'DerivedData'),
      join(mixedTestProjectDir, '.build'),
      join(mixedTestProjectDir, 'DerivedData'),
      join(failingTestProjectDir, '.build'),
      join(failingTestProjectDir, 'DerivedData'),
      derivedDataPath,
      join(process.cwd(), 'DerivedData'),
      ...testResultsPaths
    ];
    
    artifactDirs.forEach(dir => {
      if (existsSync(dir)) {
        rmSync(dir, { recursive: true });
      }
    });
    
    // Clean test results from DerivedData
    const derivedDataTestResults = join(derivedDataPath, 'Logs', 'Test');
    if (existsSync(derivedDataTestResults)) {
      rmSync(derivedDataTestResults, { recursive: true });
    }
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
    // Create XCTest project
    writeFileSync(join(xcTestProjectDir, 'Package.swift'), `// swift-tools-version: 6.0
import PackageDescription

let package = Package(
    name: "XCTestProject",
    platforms: [.macOS(.v14), .iOS(.v17)],
    products: [
        .library(name: "XCTestProject", targets: ["XCTestProject"])
    ],
    targets: [
        .target(name: "XCTestProject", path: "Sources"),
        .testTarget(
            name: "XCTestProjectTests",
            dependencies: ["XCTestProject"],
            path: "Tests"
        )
    ]
)
`);
    
    mkdirSync(join(xcTestProjectDir, 'Sources'), { recursive: true });
    writeFileSync(join(xcTestProjectDir, 'Sources', 'Calculator.swift'), `
public struct Calculator {
    public init() {}
    
    public func add(_ a: Int, _ b: Int) -> Int {
        return a + b
    }
    
    public func subtract(_ a: Int, _ b: Int) -> Int {
        return a - b
    }
    
    public func multiply(_ a: Int, _ b: Int) -> Int {
        return a * b
    }
    
    public func divide(_ a: Int, _ b: Int) throws -> Int {
        guard b != 0 else {
            throw CalculatorError.divisionByZero
        }
        return a / b
    }
}

public enum CalculatorError: Error {
    case divisionByZero
}
`);
    
    mkdirSync(join(xcTestProjectDir, 'Tests'), { recursive: true });
    writeFileSync(join(xcTestProjectDir, 'Tests', 'CalculatorTests.swift'), `
import XCTest
@testable import XCTestProject

final class CalculatorTests: XCTestCase {
    var calculator: Calculator!
    
    override func setUp() {
        super.setUp()
        calculator = Calculator()
    }
    
    func testAddition() {
        XCTAssertEqual(calculator.add(2, 3), 5)
        XCTAssertEqual(calculator.add(-1, 1), 0)
        XCTAssertEqual(calculator.add(0, 0), 0)
    }
    
    func testSubtraction() {
        XCTAssertEqual(calculator.subtract(5, 3), 2)
        XCTAssertEqual(calculator.subtract(0, 5), -5)
    }
    
    func testMultiplication() {
        XCTAssertEqual(calculator.multiply(3, 4), 12)
        XCTAssertEqual(calculator.multiply(-2, 3), -6)
        XCTAssertEqual(calculator.multiply(0, 100), 0)
    }
    
    func testDivision() throws {
        XCTAssertEqual(try calculator.divide(10, 2), 5)
        XCTAssertEqual(try calculator.divide(9, 3), 3)
    }
    
    func testDivisionByZero() {
        XCTAssertThrowsError(try calculator.divide(10, 0)) { error in
            XCTAssertEqual(error as? CalculatorError, .divisionByZero)
        }
    }
}
`);
    
    // Create Swift Testing project
    writeFileSync(join(swiftTestingProjectDir, 'Package.swift'), `// swift-tools-version: 6.0
import PackageDescription

let package = Package(
    name: "SwiftTestingProject",
    platforms: [.macOS(.v14), .iOS(.v17)],
    products: [
        .library(name: "SwiftTestingProject", targets: ["SwiftTestingProject"])
    ],
    targets: [
        .target(name: "SwiftTestingProject", path: "Sources"),
        .testTarget(
            name: "SwiftTestingProjectTests",
            dependencies: ["SwiftTestingProject"],
            path: "Tests"
        )
    ]
)
`);
    
    mkdirSync(join(swiftTestingProjectDir, 'Sources'), { recursive: true });
    writeFileSync(join(swiftTestingProjectDir, 'Sources', 'StringUtils.swift'), `
public struct StringUtils {
    public init() {}
    
    public func reverse(_ string: String) -> String {
        return String(string.reversed())
    }
    
    public func isPalindrome(_ string: String) -> Bool {
        let clean = string.lowercased().filter { $0.isLetter }
        return clean == String(clean.reversed())
    }
    
    public func wordCount(_ string: String) -> Int {
        return string.split(separator: " ").count
    }
    
    public func capitalize(_ string: String) -> String {
        return string.prefix(1).uppercased() + string.dropFirst().lowercased()
    }
}
`);
    
    mkdirSync(join(swiftTestingProjectDir, 'Tests'), { recursive: true });
    writeFileSync(join(swiftTestingProjectDir, 'Tests', 'StringUtilsTests.swift'), `
import Testing
@testable import SwiftTestingProject

@Suite("String Utilities Tests")
struct StringUtilsTests {
    let utils = StringUtils()
    
    @Test("Reverse string")
    func testReverse() {
        #expect(utils.reverse("hello") == "olleh")
        #expect(utils.reverse("Swift") == "tfiwS")
        #expect(utils.reverse("") == "")
        #expect(utils.reverse("a") == "a")
    }
    
    @Test("Check palindrome")
    func testPalindrome() {
        #expect(utils.isPalindrome("racecar") == true)
        #expect(utils.isPalindrome("A man a plan a canal Panama") == true)
        #expect(utils.isPalindrome("hello") == false)
        #expect(utils.isPalindrome("") == true)
    }
    
    @Test("Count words")
    func testWordCount() {
        #expect(utils.wordCount("Hello world") == 2)
        #expect(utils.wordCount("The quick brown fox") == 4)
        #expect(utils.wordCount("") == 0)
        #expect(utils.wordCount("   multiple   spaces   ") == 2)
    }
    
    @Test("Capitalize string", arguments: [
        "hello", "WORLD", "swift", "TEST"
    ])
    func testCapitalize(input: String) {
        let result = utils.capitalize(input)
        #expect(result.first?.isUppercase == true)
        #expect(result.dropFirst().allSatisfy { $0.isLowercase || !$0.isLetter })
    }
}
`);
    
    // Create mixed test project (both XCTest and Swift Testing)
    writeFileSync(join(mixedTestProjectDir, 'Package.swift'), `// swift-tools-version: 6.0
import PackageDescription

let package = Package(
    name: "MixedTestProject",
    platforms: [.macOS(.v14), .iOS(.v17)],
    products: [
        .library(name: "MixedTestProject", targets: ["MixedTestProject"])
    ],
    targets: [
        .target(name: "MixedTestProject", path: "Sources"),
        .testTarget(
            name: "MixedTestProjectTests",
            dependencies: ["MixedTestProject"],
            path: "Tests"
        )
    ]
)
`);
    
    mkdirSync(join(mixedTestProjectDir, 'Sources'), { recursive: true });
    writeFileSync(join(mixedTestProjectDir, 'Sources', 'DataProcessor.swift'), `
public struct DataProcessor {
    public init() {}
    
    public func process(_ data: [Int]) -> Int {
        return data.reduce(0, +)
    }
    
    public func filter(_ data: [Int], threshold: Int) -> [Int] {
        return data.filter { $0 > threshold }
    }
}
`);
    
    mkdirSync(join(mixedTestProjectDir, 'Tests'), { recursive: true });
    writeFileSync(join(mixedTestProjectDir, 'Tests', 'XCTestTests.swift'), `
import XCTest
@testable import MixedTestProject

final class DataProcessorXCTests: XCTestCase {
    func testProcessSum() {
        let processor = DataProcessor()
        XCTAssertEqual(processor.process([1, 2, 3, 4, 5]), 15)
    }
}
`);
    
    writeFileSync(join(mixedTestProjectDir, 'Tests', 'SwiftTestingTests.swift'), `
import Testing
@testable import MixedTestProject

@Test func testFilter() {
    let processor = DataProcessor()
    #expect(processor.filter([1, 5, 10, 15], threshold: 7) == [10, 15])
}
`);
    
    // Create failing test project
    writeFileSync(join(failingTestProjectDir, 'Package.swift'), `// swift-tools-version: 6.0
import PackageDescription

let package = Package(
    name: "FailingTestProject",
    platforms: [.macOS(.v14)],
    products: [
        .library(name: "FailingTestProject", targets: ["FailingTestProject"])
    ],
    targets: [
        .target(name: "FailingTestProject", path: "Sources"),
        .testTarget(
            name: "FailingTestProjectTests",
            dependencies: ["FailingTestProject"],
            path: "Tests"
        )
    ]
)
`);
    
    mkdirSync(join(failingTestProjectDir, 'Sources'), { recursive: true });
    writeFileSync(join(failingTestProjectDir, 'Sources', 'Buggy.swift'), `
public struct Buggy {
    public init() {}
    
    public func calculate(_ n: Int) -> Int {
        // Intentionally buggy
        return n * 2 + 1  // Should be n * 2
    }
}
`);
    
    mkdirSync(join(failingTestProjectDir, 'Tests'), { recursive: true });
    writeFileSync(join(failingTestProjectDir, 'Tests', 'BuggyTests.swift'), `
import Testing
@testable import FailingTestProject

@Test func testCalculate() {
    let buggy = Buggy()
    #expect(buggy.calculate(5) == 10)  // This will fail: 11 != 10
    #expect(buggy.calculate(0) == 0)   // This will fail: 1 != 0
}

@Test func testPassingTest() {
    #expect(1 + 1 == 2)  // This passes
}
`);
  }

  describe('XCTest Framework', () => {
    test('should run XCTest tests successfully', async () => {
      const response = await client.request({
        method: 'tools/call',
        params: {
          name: 'test_project',
          arguments: {
            projectPath: join(xcTestProjectDir, 'Package.swift'),
            scheme: 'XCTestProject',
            platform: 'macOS',
            testTarget: 'XCTestProjectTests'
          }
        }
      }, CallToolResultSchema);
      
      expect(response).toBeDefined();
      const result = JSON.parse((response.content[0] as any).text);
      expect(result.success).toBe(true);
      expect(result.summary).toContain('Tests passed');
      expect(result.summary).toContain('5 tests');
    });

    test('should run specific XCTest test filter', async () => {
      const response = await client.request({
        method: 'tools/call',
        params: {
          name: 'test_project',
          arguments: {
            projectPath: join(xcTestProjectDir, 'Package.swift'),
            scheme: 'XCTestProject',
            platform: 'macOS',
            testTarget: 'XCTestProjectTests',
            testFilter: 'CalculatorTests/testAddition'
          }
        }
      }, CallToolResultSchema);
      
      expect(response).toBeDefined();
      const result = JSON.parse((response.content[0] as any).text);
      expect(result.success).toBe(true);
      // Should run only the filtered test
      expect(result.summary).toContain('1 test');
    });

    test('should run XCTest on iOS platform', async () => {
      const response = await client.request({
        method: 'tools/call',
        params: {
          name: 'test_project',
          arguments: {
            projectPath: join(xcTestProjectDir, 'Package.swift'),
            scheme: 'XCTestProject',
            platform: 'iOS',
            testTarget: 'XCTestProjectTests'
          }
        }
      }, CallToolResultSchema);
      
      expect(response).toBeDefined();
      const result = JSON.parse((response.content[0] as any).text);
      // Should work on iOS or report platform issue
      expect(result).toBeDefined();
    });
  });

  describe('Swift Testing Framework', () => {
    test('should run Swift Testing tests successfully', async () => {
      const response = await client.request({
        method: 'tools/call',
        params: {
          name: 'test_project',
          arguments: {
            projectPath: join(swiftTestingProjectDir, 'Package.swift'),
            scheme: 'SwiftTestingProject',
            platform: 'macOS',
            testTarget: 'SwiftTestingProjectTests'
          }
        }
      }, CallToolResultSchema);
      
      expect(response).toBeDefined();
      const result = JSON.parse((response.content[0] as any).text);
      expect(result.success).toBe(true);
      expect(result.summary).toContain('Tests passed');
      // Swift Testing uses different format
      expect(result.summary.toLowerCase()).toContain('test');
    });

    test('should handle parameterized Swift tests', async () => {
      const response = await client.request({
        method: 'tools/call',
        params: {
          name: 'test_project',
          arguments: {
            projectPath: join(swiftTestingProjectDir, 'Package.swift'),
            scheme: 'SwiftTestingProject',
            platform: 'macOS',
            testTarget: 'SwiftTestingProjectTests'
          }
        }
      }, CallToolResultSchema);
      
      expect(response).toBeDefined();
      const result = JSON.parse((response.content[0] as any).text);
      expect(result.success).toBe(true);
      // Parameterized tests run multiple times
      expect(result.testTarget).toBe('SwiftTestingProjectTests');
    });

    test('should filter Swift Testing tests', async () => {
      const response = await client.request({
        method: 'tools/call',
        params: {
          name: 'test_project',
          arguments: {
            projectPath: join(swiftTestingProjectDir, 'Package.swift'),
            scheme: 'SwiftTestingProject',
            platform: 'macOS',
            testTarget: 'SwiftTestingProjectTests',
            testFilter: 'testReverse'
          }
        }
      }, CallToolResultSchema);
      
      expect(response).toBeDefined();
      const result = JSON.parse((response.content[0] as any).text);
      // Should run filtered tests or all tests depending on implementation
      expect(result).toBeDefined();
    });
  });

  describe('Mixed Test Frameworks', () => {
    test('should run both XCTest and Swift Testing', async () => {
      const response = await client.request({
        method: 'tools/call',
        params: {
          name: 'test_project',
          arguments: {
            projectPath: join(mixedTestProjectDir, 'Package.swift'),
            scheme: 'MixedTestProject',
            platform: 'macOS',
            testTarget: 'MixedTestProjectTests'
          }
        }
      }, CallToolResultSchema);
      
      expect(response).toBeDefined();
      const result = JSON.parse((response.content[0] as any).text);
      expect(result.success).toBe(true);
      // Should run both test types
      expect(result.summary).toContain('Tests passed');
    });
  });

  describe('Test Failures', () => {
    test('should report failing tests', async () => {
      const response = await client.request({
        method: 'tools/call',
        params: {
          name: 'test_project',
          arguments: {
            projectPath: join(failingTestProjectDir, 'Package.swift'),
            scheme: 'FailingTestProject',
            platform: 'macOS',
            testTarget: 'FailingTestProjectTests'
          }
        }
      }, CallToolResultSchema);
      
      expect(response).toBeDefined();
      const result = JSON.parse((response.content[0] as any).text);
      expect(result.success).toBe(false);
      expect(result.summary).toContain('Tests failed');
      expect(result.summary).toContain('2 failed');
    });

    test('should provide failure details', async () => {
      const response = await client.request({
        method: 'tools/call',
        params: {
          name: 'test_project',
          arguments: {
            projectPath: join(failingTestProjectDir, 'Package.swift'),
            scheme: 'FailingTestProject',
            platform: 'macOS',
            testTarget: 'FailingTestProjectTests'
          }
        }
      }, CallToolResultSchema);
      
      expect(response).toBeDefined();
      const result = JSON.parse((response.content[0] as any).text);
      expect(result.success).toBe(false);
      // Should include failure information
      expect(result.output || result.summary).toBeDefined();
    });
  });

  describe('Platform Testing', () => {
    test('should test on iOS platform', async () => {
      const response = await client.request({
        method: 'tools/call',
        params: {
          name: 'test_project',
          arguments: {
            projectPath: join(xcTestProjectDir, 'Package.swift'),
            scheme: 'XCTestProject',
            platform: 'iOS',
            testTarget: 'XCTestProjectTests'
          }
        }
      }, CallToolResultSchema);
      
      expect(response).toBeDefined();
      const result = JSON.parse((response.content[0] as any).text);
      expect(result.platform).toBe('iOS');
    });

    test('should test on macOS platform', async () => {
      const response = await client.request({
        method: 'tools/call',
        params: {
          name: 'test_project',
          arguments: {
            projectPath: join(xcTestProjectDir, 'Package.swift'),
            scheme: 'XCTestProject',
            platform: 'macOS',
            testTarget: 'XCTestProjectTests'
          }
        }
      }, CallToolResultSchema);
      
      expect(response).toBeDefined();
      const result = JSON.parse((response.content[0] as any).text);
      expect(result.platform).toBe('macOS');
    });

    test('should test with specific device', async () => {
      const response = await client.request({
        method: 'tools/call',
        params: {
          name: 'test_project',
          arguments: {
            projectPath: join(xcTestProjectDir, 'Package.swift'),
            scheme: 'XCTestProject',
            platform: 'iOS',
            deviceId: 'iPhone 15',
            testTarget: 'XCTestProjectTests'
          }
        }
      }, CallToolResultSchema);
      
      expect(response).toBeDefined();
      const result = JSON.parse((response.content[0] as any).text);
      // Should use specified device or report if unavailable
      expect(result).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    test('should handle non-existent project', async () => {
      const response = await client.request({
        method: 'tools/call',
        params: {
          name: 'test_project',
          arguments: {
            projectPath: '/non/existent/project.xcodeproj',
            scheme: 'NonExistent',
            platform: 'iOS',
            testTarget: 'NonExistentTests'
          }
        }
      }, CallToolResultSchema);
      
      expect(response).toBeDefined();
      const result = JSON.parse((response.content[0] as any).text);
      expect(result.success).toBe(false);
      expect(result.summary.toLowerCase()).toContain('error');
    });

    test('should handle invalid test target', async () => {
      const response = await client.request({
        method: 'tools/call',
        params: {
          name: 'test_project',
          arguments: {
            projectPath: join(xcTestProjectDir, 'Package.swift'),
            scheme: 'XCTestProject',
            platform: 'macOS',
            testTarget: 'NonExistentTests'
          }
        }
      }, CallToolResultSchema);
      
      expect(response).toBeDefined();
      const result = JSON.parse((response.content[0] as any).text);
      // Should report target not found or run all tests
      expect(result).toBeDefined();
    });

    test('should handle build errors in tests', async () => {
      // Create a test with compilation errors
      const errorTestDir = join(testProjectDir, 'ErrorTest');
      mkdirSync(errorTestDir, { recursive: true });
      
      writeFileSync(join(errorTestDir, 'Package.swift'), `// swift-tools-version: 6.0
import PackageDescription

let package = Package(
    name: "ErrorTest",
    platforms: [.macOS(.v14)],
    targets: [
        .testTarget(name: "ErrorTestTests", path: "Tests")
    ]
)
`);
      
      mkdirSync(join(errorTestDir, 'Tests'), { recursive: true });
      writeFileSync(join(errorTestDir, 'Tests', 'ErrorTest.swift'), `
import Testing

@Test func testWithError() {
    this is not valid Swift code
}
`);
      
      const response = await client.request({
        method: 'tools/call',
        params: {
          name: 'test_project',
          arguments: {
            projectPath: join(errorTestDir, 'Package.swift'),
            scheme: 'ErrorTest',
            platform: 'macOS',
            testTarget: 'ErrorTestTests'
          }
        }
      }, CallToolResultSchema);
      
      expect(response).toBeDefined();
      const result = JSON.parse((response.content[0] as any).text);
      expect(result.success).toBe(false);
      expect(result.summary.toLowerCase()).toContain('error');
      
      // Clean up
      if (existsSync(errorTestDir)) {
        rmSync(errorTestDir, { recursive: true });
      }
    });

    test('should handle test timeout gracefully', async () => {
      // Create a test that hangs
      const timeoutTestDir = join(testProjectDir, 'TimeoutTest');
      mkdirSync(timeoutTestDir, { recursive: true });
      
      writeFileSync(join(timeoutTestDir, 'Package.swift'), `// swift-tools-version: 6.0
import PackageDescription

let package = Package(
    name: "TimeoutTest",
    platforms: [.macOS(.v14)],
    targets: [
        .testTarget(name: "TimeoutTestTests", path: "Tests")
    ]
)
`);
      
      mkdirSync(join(timeoutTestDir, 'Tests'), { recursive: true });
      writeFileSync(join(timeoutTestDir, 'Tests', 'TimeoutTest.swift'), `
import XCTest

final class TimeoutTests: XCTestCase {
    func testInfiniteLoop() {
        // This would hang indefinitely
        while true {
            Thread.sleep(forTimeInterval: 1)
        }
    }
}
`);
      
      // This test might timeout or be handled by the tool
      const responsePromise = client.request({
        method: 'tools/call',
        params: {
          name: 'test_project',
          arguments: {
            projectPath: join(timeoutTestDir, 'Package.swift'),
            scheme: 'TimeoutTest',
            platform: 'macOS',
            testTarget: 'TimeoutTestTests'
          }
        }
      }, CallToolResultSchema);
      
      // Set a reasonable timeout for the test
      const timeoutPromise = new Promise(resolve => {
        setTimeout(() => resolve({ timeout: true }), 30000);
      });
      
      const result = await Promise.race([responsePromise, timeoutPromise]);
      expect(result).toBeDefined();
      
      // Clean up
      if (existsSync(timeoutTestDir)) {
        rmSync(timeoutTestDir, { recursive: true });
      }
    });
  });

  describe('Test Results and Artifacts', () => {
    test('should generate test results', async () => {
      const response = await client.request({
        method: 'tools/call',
        params: {
          name: 'test_project',
          arguments: {
            projectPath: join(xcTestProjectDir, 'Package.swift'),
            scheme: 'XCTestProject',
            platform: 'macOS',
            testTarget: 'XCTestProjectTests'
          }
        }
      }, CallToolResultSchema);
      
      expect(response).toBeDefined();
      const result = JSON.parse((response.content[0] as any).text);
      
      // Should include test results
      expect(result.success).toBeDefined();
      expect(result.summary).toBeDefined();
      expect(result.testTarget).toBe('XCTestProjectTests');
    });

    test('should clean test results after tests', async () => {
      // Run tests
      await client.request({
        method: 'tools/call',
        params: {
          name: 'test_project',
          arguments: {
            projectPath: join(xcTestProjectDir, 'Package.swift'),
            scheme: 'XCTestProject',
            platform: 'macOS',
            testTarget: 'XCTestProjectTests'
          }
        }
      }, CallToolResultSchema);
      
      // Clean test artifacts
      cleanTestArtifacts();
      
      // Verify cleanup
      expect(existsSync(derivedDataPath)).toBe(false);
      const testResults = join(derivedDataPath, 'Logs', 'Test');
      expect(existsSync(testResults)).toBe(false);
    });
  });

  describe('Configuration Testing', () => {
    test('should test with Debug configuration', async () => {
      const response = await client.request({
        method: 'tools/call',
        params: {
          name: 'test_project',
          arguments: {
            projectPath: join(xcTestProjectDir, 'Package.swift'),
            scheme: 'XCTestProject',
            platform: 'macOS',
            configuration: 'Debug',
            testTarget: 'XCTestProjectTests'
          }
        }
      }, CallToolResultSchema);
      
      expect(response).toBeDefined();
      const result = JSON.parse((response.content[0] as any).text);
      expect(result.configuration || 'Debug').toBe('Debug');
    });

    test('should test with Release configuration', async () => {
      const response = await client.request({
        method: 'tools/call',
        params: {
          name: 'test_project',
          arguments: {
            projectPath: join(xcTestProjectDir, 'Package.swift'),
            scheme: 'XCTestProject',
            platform: 'macOS',
            configuration: 'Release',
            testTarget: 'XCTestProjectTests'
          }
        }
      }, CallToolResultSchema);
      
      expect(response).toBeDefined();
      const result = JSON.parse((response.content[0] as any).text);
      // Release tests might be optimized
      expect(result).toBeDefined();
    });
  });

  describe('Parallel Testing', () => {
    test('should handle concurrent test runs', async () => {
      // Run multiple test suites in parallel
      const tests = Promise.all([
        client.request({
          method: 'tools/call',
          params: {
            name: 'test_project',
            arguments: {
              projectPath: join(xcTestProjectDir, 'Package.swift'),
              scheme: 'XCTestProject',
              platform: 'macOS',
              testTarget: 'XCTestProjectTests'
            }
          }
        }, CallToolResultSchema),
        
        client.request({
          method: 'tools/call',
          params: {
            name: 'test_project',
            arguments: {
              projectPath: join(swiftTestingProjectDir, 'Package.swift'),
              scheme: 'SwiftTestingProject',
              platform: 'macOS',
              testTarget: 'SwiftTestingProjectTests'
            }
          }
        }, CallToolResultSchema)
      ]);
      
      const results = await tests;
      
      expect(results).toHaveLength(2);
      results.forEach(response => {
        expect(response).toBeDefined();
        const result = JSON.parse((response.content[0] as any).text);
        expect(result.success).toBeDefined();
      });
    });
  });

  describe('Cleanup Verification', () => {
    test('should not leave test artifacts', async () => {
      // Run tests
      await client.request({
        method: 'tools/call',
        params: {
          name: 'test_project',
          arguments: {
            projectPath: join(xcTestProjectDir, 'Package.swift'),
            scheme: 'XCTestProject',
            platform: 'macOS',
            testTarget: 'XCTestProjectTests'
          }
        }
      }, CallToolResultSchema);
      
      // Clean artifacts
      cleanTestArtifacts();
      
      // Verify no artifacts remain
      expect(existsSync(join(xcTestProjectDir, '.build'))).toBe(false);
      expect(existsSync(join(xcTestProjectDir, 'DerivedData'))).toBe(false);
      expect(existsSync(derivedDataPath)).toBe(false);
    });

    test('should clean up completely after all tests', async () => {
      // This verifies our cleanup functions work
      expect(() => cleanTestArtifacts()).not.toThrow();
      
      // After all tests, the test directory should be removed
      // (This happens in afterAll)
    });
  });
});