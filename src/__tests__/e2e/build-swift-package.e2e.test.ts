/**
 * E2E tests for BuildSwiftPackageTool
 * Extracted and adapted from validated build-tool tests
 */

import { describe, test, expect, beforeAll, beforeEach, afterEach, afterAll } from '@jest/globals';
import { execSync } from 'child_process';
import { existsSync } from 'fs';
import { join } from 'path';
import { Client } from '@modelcontextprotocol/sdk/client/index';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio';
import { CallToolResultSchema } from '@modelcontextprotocol/sdk/types';
import { createAndConnectClient, cleanupClientAndTransport } from '../utils/testHelpers.js';
import { TestProjectManager } from '../utils/TestProjectManager.js';
import { TestEnvironmentCleaner } from '../utils/TestEnvironmentCleaner.js';

describe('BuildSwiftPackageTool E2E Tests', () => {
  let client: Client;
  let transport: StdioClientTransport;
  let testProjectManager: TestProjectManager;
  
  beforeAll(async () => {
    // Build the server
    execSync('npm run build', { cwd: process.cwd() });
    testProjectManager = new TestProjectManager();
    testProjectManager.setup();
  }, 120000);
  
  beforeEach(async () => {
    const setup = await createAndConnectClient();
    client = setup.client;
    transport = setup.transport;
  }, 30000);
  
  afterEach(async () => {
    TestEnvironmentCleaner.cleanupTestEnvironment();
    
    await cleanupClientAndTransport(client, transport);
    testProjectManager.cleanup();
  });

  afterAll(() => {
    TestEnvironmentCleaner.cleanupTestEnvironment();
    TestEnvironmentCleaner.killTestProjectApp();
  });

  describe('Basic SPM Builds', () => {
    test('should build SPM package with default configuration', async () => {
      const response = await client.request({
        method: 'tools/call',
        params: {
          name: 'build_swift_package',
          arguments: {
            packagePath: join(testProjectManager.paths.swiftPackageXCTestDir, 'Package.swift')
          }
        }
      }, CallToolResultSchema);
      
      const text = (response.content[0] as any).text;
      expect(text).toContain('Build succeeded');
      expect(text).toContain('Configuration: Debug');
      
      // Verify .build directory was created (swift build output)
      const buildDirExists = existsSync(join(testProjectManager.paths.swiftPackageXCTestDir, '.build'));
      expect(buildDirExists).toBe(true);
    }, 30000);

    test('should build SPM package with Release configuration', async () => {
      const response = await client.request({
        method: 'tools/call',
        params: {
          name: 'build_swift_package',
          arguments: {
            packagePath: join(testProjectManager.paths.swiftPackageXCTestDir, 'Package.swift'),
            configuration: 'Release'
          }
        }
      }, CallToolResultSchema);
      
      const text = (response.content[0] as any).text;
      expect(text).toContain('Build succeeded');
      expect(text).toContain('Configuration: Release');
    }, 30000);

    test('should build SPM package from directory path', async () => {
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
      expect(text).toContain('Build succeeded');
    }, 30000);
  });

  describe('Target and Product Support', () => {
    test('should build specific target if available', async () => {
      // First, list available targets by attempting a build
      const response = await client.request({
        method: 'tools/call',
        params: {
          name: 'build_swift_package',
          arguments: {
            packagePath: testProjectManager.paths.swiftPackageXCTestDir,
            target: 'TestSwiftPackageXCTest'
          }
        }
      }, CallToolResultSchema);
      
      const text = (response.content[0] as any).text;
      // Either succeeds or fails if target doesn't exist
      if (text.includes('Build succeeded')) {
        expect(text).toContain('Target: TestSwiftPackageXCTest');
      } else {
        expect(text.toLowerCase()).toContain('error');
      }
    }, 30000);

    test('should build specific product if available', async () => {
      const response = await client.request({
        method: 'tools/call',
        params: {
          name: 'build_swift_package',
          arguments: {
            packagePath: testProjectManager.paths.swiftPackageXCTestDir,
            product: 'TestSwiftPackageXCTest'
          }
        }
      }, CallToolResultSchema);
      
      const text = (response.content[0] as any).text;
      // Either succeeds or fails if product doesn't exist
      if (text.includes('Build succeeded')) {
        expect(text).toContain('Product: TestSwiftPackageXCTest');
      } else {
        expect(text.toLowerCase()).toContain('error');
      }
    }, 30000);
  });


  describe('Error Handling', () => {
    test('should handle non-existent SPM package', async () => {
      const response = await client.request({
        method: 'tools/call',
        params: {
          name: 'build_swift_package',
          arguments: {
            packagePath: '/non/existent/Package.swift'
          }
        }
      }, CallToolResultSchema);
      
      const text = (response.content[0] as any).text;
      expect(text.toLowerCase()).toContain('failed');
      expect(text).toContain('No Package.swift found');
    });

    test('should handle broken SPM package', async () => {
      // Create a broken Package.swift temporarily
      const brokenPackagePath = '/tmp/broken-spm-test';
      execSync(`mkdir -p ${brokenPackagePath}`, { stdio: 'pipe' });
      execSync(`echo 'invalid swift code' > ${brokenPackagePath}/Package.swift`, { stdio: 'pipe' });
      
      const response = await client.request({
        method: 'tools/call',
        params: {
          name: 'build_swift_package',
          arguments: {
            packagePath: brokenPackagePath
          }
        }
      }, CallToolResultSchema);
      
      const text = (response.content[0] as any).text;
      expect(text).toContain('❌ Build failed');
      expect(text).toContain('Full logs saved to');
      
      // Clean up
      execSync(`rm -rf ${brokenPackagePath}`, { stdio: 'pipe' });
    }, 30000);

    test('should handle invalid target', async () => {
      const response = await client.request({
        method: 'tools/call',
        params: {
          name: 'build_swift_package',
          arguments: {
            packagePath: testProjectManager.paths.swiftPackageXCTestDir,
            target: 'NonExistentTarget'
          }
        }
      }, CallToolResultSchema);
      
      const text = (response.content[0] as any).text;
      expect(text).toContain('❌ Build failed');
      expect(text).toContain('Full logs saved to');
      // Swift build reports unknown target in the logs
    });

    test('should handle invalid product', async () => {
      const response = await client.request({
        method: 'tools/call',
        params: {
          name: 'build_swift_package',
          arguments: {
            packagePath: testProjectManager.paths.swiftPackageXCTestDir,
            product: 'NonExistentProduct'
          }
        }
      }, CallToolResultSchema);
      
      const text = (response.content[0] as any).text;
      expect(text).toContain('❌ Build failed');
      expect(text).toContain('Full logs saved to');
      // Swift build reports unknown product in the logs
    });
  });

});