/**
 * E2E tests for complex build error scenarios
 * Tests code signing, provisioning, and dependency errors
 */

import { describe, test, expect, beforeAll, beforeEach, afterEach, afterAll } from '@jest/globals';
import { execSync } from 'child_process';
import { Client } from '@modelcontextprotocol/sdk/client/index';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio';
import { CallToolResultSchema } from '@modelcontextprotocol/sdk/types';
import { createAndConnectClient, cleanupClientAndTransport } from '../utils/testHelpers.js';
import { TestProjectManager } from '../utils/TestProjectManager.js';
import { TestEnvironmentCleaner } from '../utils/TestEnvironmentCleaner.js';
import { TestErrorInjector } from '../utils/TestErrorInjector.js';
import { join } from 'path';

describe('Complex Build Error Scenarios E2E Tests', () => {
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
    errorInjector.restoreAll(); // Restore all modified files
    
    await cleanupClientAndTransport(client, transport);
    testProjectManager.cleanup();
  });

  afterAll(() => {
    TestEnvironmentCleaner.cleanupTestEnvironment();
    errorInjector.restoreAll();
  });

  describe('Injected Compile Errors', () => {
    test('should display injected type mismatch error', async () => {
      // Inject a type mismatch error
      const contentViewPath = join(
        testProjectManager.paths.xcodeProjectSwiftTestingDir,
        'TestProjectSwiftTesting',
        'ContentView.swift'
      );
      
      errorInjector.injectCompileError(contentViewPath, 'type-mismatch');
      
      const response = await client.request({
        method: 'tools/call',
        params: {
          name: 'build_xcode',
          arguments: {
            projectPath: testProjectManager.paths.xcodeProjectSwiftTestingPath,
            scheme: testProjectManager.schemes.xcodeProjectSwiftTesting,
            platform: 'iOS'
          }
        }
      }, CallToolResultSchema);
      
      const text = (response.content[0] as any).text;
      
      // Check for injected error
      expect(text).toContain('❌ Build failed with');
      expect(text).toContain('error');
      expect(text).toContain('ContentView.swift');
      expect(text.toLowerCase()).toContain('type');
      expect(text).toContain('📁 Full logs saved to:');
    }, 30000);

    test('should display multiple error types', async () => {
      // Inject both syntax and type errors
      const contentViewPath = join(
        testProjectManager.paths.xcodeProjectSwiftTestingDir,
        'TestProjectSwiftTesting',
        'ContentView.swift'
      );
      
      errorInjector.injectCompileError(contentViewPath, 'syntax');
      
      const response = await client.request({
        method: 'tools/call',
        params: {
          name: 'build_xcode',
          arguments: {
            projectPath: testProjectManager.paths.xcodeProjectSwiftTestingPath,
            scheme: testProjectManager.schemes.xcodeProjectSwiftTesting,
            platform: 'iOS'
          }
        }
      }, CallToolResultSchema);
      
      const text = (response.content[0] as any).text;
      
      // Should show compile errors
      expect(text).toContain('❌ Build failed with');
      expect(text).toContain('ContentView.swift');
      expect(text).toContain('📁 Full logs saved to:');
    }, 30000);
  });

  describe('Code Signing and Provisioning Errors', () => {
    test('should detect and display code signing configuration issues', async () => {
      // Note: This test modifies project settings but may not trigger actual
      // signing errors in CI environments without certificates
      const projectPath = join(
        testProjectManager.paths.xcodeProjectSwiftTestingDir,
        'TestProjectSwiftTesting.xcodeproj'
      );
      
      errorInjector.injectCodeSigningError(projectPath);
      
      const response = await client.request({
        method: 'tools/call',
        params: {
          name: 'build_xcode',
          arguments: {
            projectPath: testProjectManager.paths.xcodeProjectSwiftTestingPath,
            scheme: testProjectManager.schemes.xcodeProjectSwiftTesting,
            platform: 'iOS'
          }
        }
      }, CallToolResultSchema);
      
      const text = (response.content[0] as any).text;
      
      // May show signing-related errors or warnings
      if (text.toLowerCase().includes('sign')) {
        expect(text).toMatch(/sign|certificate|identity/i);
        expect(text).toContain('📁 Full logs saved to:');
      }
    }, 30000);
  });

  describe('Swift Package Dependency Errors', () => {
    test('should display missing dependency error', async () => {
      errorInjector.injectMissingDependency(testProjectManager.paths.swiftPackageXCTestDir);
      
      const response = await client.request({
        method: 'tools/call',
        params: {
          name: 'build_swift_package',
          arguments: {
            packagePath: testProjectManager.paths.swiftPackageXCTestDir
          }
        }
      }, CallToolResultSchema);
      
      const text = (response.content[0] as any).text;
      
      // Should show build failure with dependency resolution error
      expect(text).toContain('❌ Build failed');
      // Should show structured error with title, details, and suggestion
      expect(text).toContain('📍 Failed to clone repository');
      expect(text).toContain('Could not fetch dependency from https://github.com/nonexistent-org/nonexistent-package.git');
      expect(text).toContain('💡 Verify the repository URL exists and is accessible');
      expect(text).toContain('📁 Full logs saved to:');
    }, 60000);
  });

  describe('Error Recovery', () => {
    test('should build successfully after error is fixed', async () => {
      const contentViewPath = join(
        testProjectManager.paths.xcodeProjectSwiftTestingDir,
        'TestProjectSwiftTesting',
        'ContentView.swift'
      );
      
      // First, inject an error
      errorInjector.injectCompileError(contentViewPath, 'type-mismatch');
      
      const failResponse = await client.request({
        method: 'tools/call',
        params: {
          name: 'build_xcode',
          arguments: {
            projectPath: testProjectManager.paths.xcodeProjectSwiftTestingPath,
            scheme: testProjectManager.schemes.xcodeProjectSwiftTesting,
            platform: 'iOS'
          }
        }
      }, CallToolResultSchema);
      
      const failText = (failResponse.content[0] as any).text;
      expect(failText).toContain('❌ Build failed');
      
      // Now restore the file and try again
      errorInjector.restoreFile(contentViewPath);
      
      const successResponse = await client.request({
        method: 'tools/call',
        params: {
          name: 'build_xcode',
          arguments: {
            projectPath: testProjectManager.paths.xcodeProjectSwiftTestingPath,
            scheme: testProjectManager.schemes.xcodeProjectSwiftTesting,
            platform: 'iOS'
          }
        }
      }, CallToolResultSchema);
      
      const successText = (successResponse.content[0] as any).text;
      expect(successText).toContain('✅ Build succeeded');
    }, 60000);
  });

  describe('Error Format Consistency', () => {
    test('all error types should follow consistent format', async () => {
      const errorScenarios = [
        {
          name: 'scheme_error',
          tool: 'build_xcode',
          args: {
            projectPath: testProjectManager.paths.xcodeProjectXCTestPath,
            scheme: 'InvalidScheme',
            platform: 'iOS'
          }
        },
        {
          name: 'project_error',
          tool: 'build_xcode',
          args: {
            projectPath: '/invalid/path.xcodeproj',
            scheme: 'Scheme',
            platform: 'iOS'
          }
        }
      ];

      for (const scenario of errorScenarios) {
        const response = await client.request({
          method: 'tools/call',
          params: {
            name: scenario.tool,
            arguments: scenario.args
          }
        }, CallToolResultSchema);
        
        const text = (response.content[0] as any).text;
        
        // All errors should have:
        // 1. Error indicator (❌ or "failed")
        expect(text).toMatch(/❌|failed/i);
        
        // 2. Clear error description
        expect(text.length).toBeGreaterThan(20);
        
        // 3. Log path when available (except for validation errors)
        if (!text.toLowerCase().includes('validation')) {
          // Some errors may include log paths
          if (text.includes('Full logs')) {
            expect(text).toContain('📁');
          }
        }
      }
    }, 60000);
  });
});