/**
 * E2E tests for RunSwiftPackageTool
 * Tests running Swift Package executables
 */

import { describe, test, expect, beforeAll, beforeEach, afterEach, afterAll } from '@jest/globals';
import { execSync } from 'child_process';
import { join } from 'path';
import { Client } from '@modelcontextprotocol/sdk/client/index';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio';
import { CallToolResultSchema } from '@modelcontextprotocol/sdk/types';
import { createAndConnectClient, cleanupClientAndTransport } from '../../utils/testHelpers.js';
import { TestProjectManager } from '../../utils/TestProjectManager.js';
import { TestEnvironmentCleaner } from '../../utils/TestEnvironmentCleaner.js';

describe('RunSwiftPackageTool E2E Tests', () => {
  let client: Client;
  let transport: StdioClientTransport;
  let testProjectManager: TestProjectManager;
  
  beforeAll(async () => {
    // Build the server
    execSync('npm run build', { cwd: process.cwd() });
    testProjectManager = new TestProjectManager();
    testProjectManager.setup();
  }, 180000);
  
  beforeEach(async () => {
    const setup = await createAndConnectClient();
    client = setup.client;
    transport = setup.transport;
  }, 180000);
  
  afterEach(async () => {
    TestEnvironmentCleaner.cleanupTestEnvironment();
    
    await cleanupClientAndTransport(client, transport);
    testProjectManager.cleanup();
  });

  afterAll(() => {
    TestEnvironmentCleaner.cleanupTestEnvironment();
    TestEnvironmentCleaner.killMacOSApp('TestSwiftPackageXCTest');
  });

  describe('Basic Execution', () => {
    test('should run SPM executable with default configuration', async () => {
      const response = await client.request({
        method: 'tools/call',
        params: {
          name: 'run_swift_package',
          arguments: {
            packagePath: testProjectManager.paths.swiftPackageXCTestDir,
            executable: 'TestSwiftPackageXCTestExecutable'
          }
        }
      }, CallToolResultSchema, { timeout: 180000 });
      
      const text = (response.content[0] as any).text;
      expect(text).toContain('Execution completed: TestSwiftPackageXCTestExecutable');
      expect(text).toContain('Configuration: Debug');
      expect(text).toContain('TestSwiftPackageXCTestExecutable Executable Running');
      expect(text).toContain('Execution completed successfully');
    }, 180000);

    test('should run with Release configuration', async () => {
      const response = await client.request({
        method: 'tools/call',
        params: {
          name: 'run_swift_package',
          arguments: {
            packagePath: testProjectManager.paths.swiftPackageXCTestDir,
            executable: 'TestSwiftPackageXCTestExecutable',
            configuration: 'Release'
          }
        }
      }, CallToolResultSchema, { timeout: 180000 });
      
      const text = (response.content[0] as any).text;
      expect(text).toContain('Configuration: Release');
      expect(text).toContain('TestSwiftPackageXCTestExecutable Executable Running');
    }, 180000);

    test('should run from Package.swift path', async () => {
      const response = await client.request({
        method: 'tools/call',
        params: {
          name: 'run_swift_package',
          arguments: {
            packagePath: join(testProjectManager.paths.swiftPackageXCTestDir, 'Package.swift'),
            executable: 'TestSwiftPackageXCTestExecutable'
          }
        }
      }, CallToolResultSchema, { timeout: 180000 });
      
      const text = (response.content[0] as any).text;
      expect(text).toContain('TestSwiftPackageXCTestExecutable Executable Running');
    }, 180000);
  });

  describe('Argument Handling', () => {
    test('should pass single argument to executable', async () => {
      const response = await client.request({
        method: 'tools/call',
        params: {
          name: 'run_swift_package',
          arguments: {
            packagePath: testProjectManager.paths.swiftPackageXCTestDir,
            executable: 'TestSwiftPackageXCTestExecutable',
            arguments: ['test-arg']
          }
        }
      }, CallToolResultSchema, { timeout: 180000 });
      
      const text = (response.content[0] as any).text;
      expect(text).toContain('Received 1 arguments');
      expect(text).toContain('Arg 1: test-arg');
    }, 180000);

    test('should pass multiple arguments to executable', async () => {
      const response = await client.request({
        method: 'tools/call',
        params: {
          name: 'run_swift_package',
          arguments: {
            packagePath: testProjectManager.paths.swiftPackageXCTestDir,
            executable: 'TestSwiftPackageXCTestExecutable',
            arguments: ['arg1', 'arg2', 'arg3']
          }
        }
      }, CallToolResultSchema, { timeout: 180000 });
      
      const text = (response.content[0] as any).text;
      expect(text).toContain('Received 3 arguments');
      expect(text).toContain('Arg 1: arg1');
      expect(text).toContain('Arg 2: arg2');
      expect(text).toContain('Arg 3: arg3');
    }, 180000);
  });

  describe('Error Handling', () => {
    test('should handle non-existent package', async () => {
      const response = await client.request({
        method: 'tools/call',
        params: {
          name: 'run_swift_package',
          arguments: {
            packagePath: '/non/existent/package'
          }
        }
      }, CallToolResultSchema, { timeout: 180000 });
      
      const text = (response.content[0] as any).text;
      expect(text).toContain('❌ No Package.swift found at:');
      expect(text).toContain('/non/existent/package');
    });

    test('should handle non-existent executable', async () => {
      const response = await client.request({
        method: 'tools/call',
        params: {
          name: 'run_swift_package',
          arguments: {
            packagePath: testProjectManager.paths.swiftPackageXCTestDir,
            executable: 'NonExistentExecutable'
          }
        }
      }, CallToolResultSchema, { timeout: 180000 });
      
      const text = (response.content[0] as any).text;
      expect(text).toContain('❌ Build failed');
      expect(text).toContain('Executable not found: NonExistentExecutable');
      expect(text).toContain("No executable product named 'NonExistentExecutable'");
      expect(text).toContain('Full logs saved to');
    });

    test('should handle executable failure with exit code', async () => {
      const response = await client.request({
        method: 'tools/call',
        params: {
          name: 'run_swift_package',
          arguments: {
            packagePath: testProjectManager.paths.swiftPackageXCTestDir,
            executable: 'TestSwiftPackageXCTestExecutable',
            arguments: ['--fail']
          }
        }
      }, CallToolResultSchema, { timeout: 180000 });
      
      const text = (response.content[0] as any).text;
      expect(text).toContain('❌ Build failed');
      expect(text).toContain('Executable failed with exit code 1:');
      expect(text).toContain('TestSwiftPackageXCTestExecutable Executable Running');
      expect(text).toContain('Error: Requested failure via --fail flag');
      expect(text).toContain('Full logs saved to');
      // The actual error output is in the logs, not in the response
    }, 180000);

    test('should handle broken Package.swift', async () => {
      // Create a broken package temporarily
      const brokenPackagePath = '/tmp/broken-run-spm-test';
      execSync(`mkdir -p ${brokenPackagePath}`, { stdio: 'pipe' });
      execSync(`echo 'invalid swift code' > ${brokenPackagePath}/Package.swift`, { stdio: 'pipe' });
      
      const response = await client.request({
        method: 'tools/call',
        params: {
          name: 'run_swift_package',
          arguments: {
            packagePath: brokenPackagePath
          }
        }
      }, CallToolResultSchema, { timeout: 180000 });
      
      const text = (response.content[0] as any).text;
      expect(text).toContain('❌ Build failed');
      expect(text).toContain('Outdated Swift tools version');
      expect(text).toContain('Package.swift is using Swift tools version');
      expect(text).toContain('which is no longer supported');
      expect(text).toContain("Add '// swift-tools-version:");
      expect(text).toContain('at the top of your Package.swift file');
      expect(text).toContain('Full logs saved to');
      
      // Clean up
      execSync(`rm -rf ${brokenPackagePath}`, { stdio: 'pipe' });
    }, 180000);
  });

  describe('Default Executable', () => {
    test('should run without specifying executable name', async () => {
      const response = await client.request({
        method: 'tools/call',
        params: {
          name: 'run_swift_package',
          arguments: {
            packagePath: testProjectManager.paths.swiftPackageXCTestDir
          }
        }
      }, CallToolResultSchema, { timeout: 180000 });
      
      const text = (response.content[0] as any).text;
      // Should run the default executable (first one found)
      expect(text).toContain('Execution completed: default executable');
      expect(text).toContain('TestSwiftPackageXCTestExecutable Executable Running');
    }, 180000);
  });
});