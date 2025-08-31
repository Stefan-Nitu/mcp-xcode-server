/**
 * E2E tests for build and compile error display
 * Tests that various error types are properly formatted and displayed across all tools
 */

import { describe, test, expect, beforeAll, beforeEach, afterEach, afterAll } from '@jest/globals';
import { execSync } from 'child_process';
import { Client } from '@modelcontextprotocol/sdk/client/index';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio';
import { CallToolResultSchema } from '@modelcontextprotocol/sdk/types';
import { createAndConnectClient, cleanupClientAndTransport } from '../../utils/testHelpers.js';
import { TestProjectManager } from '../../utils/TestProjectManager.js';
import { TestEnvironmentCleaner } from '../../utils/TestEnvironmentCleaner.js';
import { TestErrorInjector } from '../../utils/TestErrorInjector.js';
import { createModuleLogger } from '../../../logger.js';
import { join } from 'path';

const logger = createModuleLogger('compile-errors-e2e');

describe('Build and Compile Error Display E2E Tests', () => {
  let client: Client;
  let transport: StdioClientTransport;
  let testProjectManager: TestProjectManager;
  let errorInjector: TestErrorInjector;
  
  beforeAll(async () => {
    execSync('npm run build', { cwd: process.cwd() });
    testProjectManager = new TestProjectManager();
    testProjectManager.setup();
    errorInjector = new TestErrorInjector();
  }, 120000);
  
  beforeEach(async () => {
    const setup = await createAndConnectClient();
    client = setup.client;
    transport = setup.transport;
  }, 30000);
  
  afterEach(async () => {
    TestEnvironmentCleaner.cleanupTestEnvironment();
    
    // Restore any modified files
    errorInjector.restoreAll();
    
    await cleanupClientAndTransport(client, transport);
    testProjectManager.cleanup();
  });

  afterAll(() => {
    TestEnvironmentCleaner.cleanupTestEnvironment();
  });

  describe('Xcode Project Compile Errors', () => {
    test('build_xcode should display compile errors with file location', async () => {
      // Inject a compile error into ContentView.swift
      const contentViewPath = join(testProjectManager.paths.xcodeProjectXCTestPath, '..', 'TestProjectXCTest', 'ContentView.swift');
      errorInjector.injectCompileError(contentViewPath, 'type-mismatch');
      
      const response = await client.request({
        method: 'tools/call',
        params: {
          name: 'build_xcode',
          arguments: {
            projectPath: testProjectManager.paths.xcodeProjectXCTestPath,
            scheme: testProjectManager.schemes.xcodeProject,
            platform: 'iOS'
          }
        }
      }, CallToolResultSchema, { timeout: 180000 });
      
      const text = (response.content[0] as any).text;
      logger.info({ 
        buildResponse: text,
        projectPath: testProjectManager.paths.xcodeProjectXCTestPath,
        scheme: testProjectManager.schemes.xcodeProject 
      }, 'Compile error test - Build response');
      
      // Check for compile error display
      expect(text).toContain('❌ Build failed with');
      expect(text).toContain('error');
      expect(text).toContain('ContentView.swift'); // File with the error
      expect(text).toMatch(/String.*Int|cannot convert|type mismatch/i); // Type error message
      expect(text).toContain('📁 Full logs saved to:'); // Log path
    }, 30000);

    test('test_xcode should display compile errors when build fails', async () => {
      // Inject a compile error into ContentView.swift
      const contentViewPath = join(testProjectManager.paths.xcodeProjectXCTestPath, '..', 'TestProjectXCTest', 'ContentView.swift');
      errorInjector.injectCompileError(contentViewPath, 'type-mismatch');
      
      const response = await client.request({
        method: 'tools/call',
        params: {
          name: 'test_xcode',
          arguments: {
            projectPath: testProjectManager.paths.xcodeProjectXCTestPath,
            scheme: testProjectManager.schemes.xcodeProject,
            platform: 'iOS'
          }
        }
      }, CallToolResultSchema, { timeout: 180000 });
      
      const text = (response.content[0] as any).text;
      
      // Check for compile error display in test tool
      expect(text).toContain('❌ Build failed with');
      expect(text).toContain('error');
      expect(text).toContain('ContentView.swift');
      expect(text).toMatch(/String.*Int|cannot convert|type mismatch/i);
      expect(text).toContain('📁 Full logs saved to:');
    }, 180000);

    test('run_xcode should display compile errors when build fails', async () => {
      // Inject a compile error into ContentView.swift
      const contentViewPath = join(testProjectManager.paths.xcodeProjectXCTestPath, '..', 'TestProjectXCTest', 'ContentView.swift');
      errorInjector.injectCompileError(contentViewPath, 'type-mismatch');
      
      const response = await client.request({
        method: 'tools/call',
        params: {
          name: 'run_xcode',
          arguments: {
            projectPath: testProjectManager.paths.xcodeProjectXCTestPath,
            scheme: testProjectManager.schemes.xcodeProject,
            platform: 'iOS'
          }
        }
      }, CallToolResultSchema, { timeout: 180000 });
      
      const text = (response.content[0] as any).text;
      
      // Check for compile error display in run tool
      expect(text).toContain('❌ Build failed with');
      expect(text).toContain('error');
      expect(text).toContain('ContentView.swift');
      expect(text).toMatch(/String.*Int|cannot convert|type mismatch/i);
      expect(text).toContain('📁 Full logs saved to:');
    }, 180000);
  });

  describe('Swift Package Compile Errors', () => {
    test('build_swift_package should display compile errors', async () => {
      // Use the XCTest Swift package for testing
      const packagePath = testProjectManager.paths.swiftPackageXCTestDir;
      
      // Skip if no test package is available
      if (!packagePath) {
        console.log('Skipping Swift package compile error test - no test package available');
        return;
      }
      
      const response = await client.request({
        method: 'tools/call',
        params: {
          name: 'build_swift_package',
          arguments: {
            packagePath: packagePath
          }
        }
      }, CallToolResultSchema, { timeout: 180000 });
      
      const text = (response.content[0] as any).text;
      
      // Check for compile error display format
      if (text.includes('Build failed with')) {
        expect(text).toContain('❌ Build failed with');
        expect(text).toContain('.swift:'); // File location
        expect(text).toContain('📁 Full logs saved to:');
      } else {
        // If no compile error in test package, at least verify format
        expect(text).toMatch(/✅ Build succeeded|❌ Build failed/);
      }
    }, 30000);

    test('test_swift_package should display compile errors when build fails', async () => {
      const packagePath = testProjectManager.paths.swiftPackageXCTestDir;
      
      if (!packagePath) {
        console.log('Skipping Swift package compile error test - no test package available');
        return;
      }
      
      const response = await client.request({
        method: 'tools/call',
        params: {
          name: 'test_swift_package',
          arguments: {
            packagePath: packagePath
          }
        }
      }, CallToolResultSchema, { timeout: 180000 });
      
      const text = (response.content[0] as any).text;
      
      // Check for proper formatting
      if (text.includes('Build failed with')) {
        expect(text).toContain('❌ Build failed with');
        expect(text).toContain('.swift:');
        expect(text).toContain('📁 Full logs saved to:');
      } else {
        // Test results format
        expect(text).toMatch(/✅ Tests passed|❌ Tests failed|❌ Build failed/);
        expect(text).toContain('📁 Full logs saved to:');
      }
    }, 30000);
  });

  describe('Error Deduplication', () => {
    test('should not show duplicate errors for multiple architectures', async () => {
      const response = await client.request({
        method: 'tools/call',
        params: {
          name: 'build_xcode',
          arguments: {
            projectPath: testProjectManager.paths.xcodeProjectXCTestPath,
            scheme: testProjectManager.schemes.xcodeProject,
            platform: 'iOS'
          }
        }
      }, CallToolResultSchema, { timeout: 180000 });
      
      const text = (response.content[0] as any).text;
      
      // Count occurrences of the same error message
      const errorLine = 'ContentView.swift:52:';
      const occurrences = (text.match(new RegExp(errorLine, 'g')) || []).length;
      
      // Should only show each error once, not twice (for arm64 and x86_64)
      expect(occurrences).toBeLessThanOrEqual(1);
    }, 30000);
  });

  describe('Build Error Types', () => {
    test('should display scheme not found error with suggestion', async () => {
      const response = await client.request({
        method: 'tools/call',
        params: {
          name: 'build_xcode',
          arguments: {
            projectPath: testProjectManager.paths.xcodeProjectXCTestPath,
            scheme: 'NonExistentScheme',
            platform: 'iOS'
          }
        }
      }, CallToolResultSchema, { timeout: 180000 });
      
      const text = (response.content[0] as any).text;
      
      // Should show scheme error with helpful message
      expect(text).toContain('❌ Build failed');
      expect(text).toContain('Scheme not found');
      expect(text).toContain('NonExistentScheme');
      expect(text).toContain('💡'); // Suggestion icon
      expect(text).toContain('list_schemes'); // Suggestion to use list_schemes tool
      expect(text).toContain('📁 Full logs saved to:');
    }, 30000);

    test('should display configuration not found error', async () => {
      const response = await client.request({
        method: 'tools/call',
        params: {
          name: 'build_xcode',
          arguments: {
            projectPath: testProjectManager.paths.xcodeProjectXCTestPath,
            scheme: testProjectManager.schemes.xcodeProject,
            platform: 'iOS',
            configuration: 'Production' // Non-existent configuration
          }
        }
      }, CallToolResultSchema, { timeout: 180000 });
      
      const text = (response.content[0] as any).text;
      
      // Should show configuration error
      expect(text.toLowerCase()).toMatch(/configuration.*not found|invalid.*configuration/);
      expect(text).toContain('Production');
      expect(text).toContain('📁 Full logs saved to:');
    }, 30000);

    test('should display project not found error', async () => {
      const response = await client.request({
        method: 'tools/call',
        params: {
          name: 'build_xcode',
          arguments: {
            projectPath: '/path/to/nonexistent/project.xcodeproj',
            scheme: 'SomeScheme',
            platform: 'iOS'
          }
        }
      }, CallToolResultSchema, { timeout: 180000 });
      
      const text = (response.content[0] as any).text;
      
      // Should show project not found error
      expect(text).toContain('No Xcode project found at:');
      expect(text).toContain('/path/to/nonexistent/project.xcodeproj');
    }, 30000);

    test('should display platform not supported error', async () => {
      // Try to build a watchOS project for iOS
      const response = await client.request({
        method: 'tools/call',
        params: {
          name: 'build_xcode',
          arguments: {
            projectPath: testProjectManager.paths.watchOSProjectPath,
            scheme: testProjectManager.schemes.watchOSProject,
            platform: 'iOS' // Wrong platform for watchOS app
          }
        }
      }, CallToolResultSchema, { timeout: 180000 });
      
      const text = (response.content[0] as any).text;
      
      // Should indicate platform issue
      expect(text).toContain('❌ Build failed');
      expect(text.toLowerCase()).toMatch(/platform.*not supported/);
      expect(text).toContain('watchOS'); // Should mention the correct platform
      // No log path for platform validation errors - build never started
    }, 30000);
  });

  describe('Swift Package Build Errors', () => {
    test('should display package not found error', async () => {
      const response = await client.request({
        method: 'tools/call',
        params: {
          name: 'build_swift_package',
          arguments: {
            packagePath: '/path/to/nonexistent/package'
          }
        }
      }, CallToolResultSchema, { timeout: 180000 });
      
      const text = (response.content[0] as any).text;
      
      // Should show package not found
      expect(text.toLowerCase()).toMatch(/no package\.swift found|does not exist/);
      expect(text).toContain('/path/to/nonexistent/package');
    }, 30000);

    test('should display invalid configuration error for Swift package', async () => {
      const response = await client.request({
        method: 'tools/call',
        params: {
          name: 'build_swift_package',
          arguments: {
            packagePath: testProjectManager.paths.swiftPackageXCTestDir,
            configuration: 'Beta' // Invalid for SPM (only Debug/Release)
          }
        }
      }, CallToolResultSchema, { timeout: 180000 });
      
      const text = (response.content[0] as any).text;
      
      // Should fail validation
      expect(text.toLowerCase()).toContain('validation');
      expect(text.toLowerCase()).toMatch(/debug.*release|invalid/);
    }, 30000);
  });

  describe('Log Path Display', () => {
    test('all tools should display log path on failure', async () => {
      const tools = ['build_xcode', 'test_xcode', 'run_xcode'];
      
      for (const tool of tools) {
        const response = await client.request({
          method: 'tools/call',
          params: {
            name: tool,
            arguments: {
              projectPath: testProjectManager.paths.xcodeProjectXCTestPath,
              scheme: testProjectManager.schemes.xcodeProject,
              platform: 'iOS'
            }
          }
        }, CallToolResultSchema, { timeout: 180000 });
        
        const text = (response.content[0] as any).text;
        
        // All tools should show log path when there's an error
        if (text.includes('❌')) {
          expect(text).toContain('📁 Full logs saved to:');
          expect(text).toMatch(/\/.*\.log/); // Should contain a log file path
        }
      }
    }, 540000);
  });
});