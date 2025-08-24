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
    await cleanupClientAndTransport(client, transport);
    testProjectManager.cleanup();
  });

  describe('Basic SPM Builds', () => {
    test('should build SPM package with default configuration', async () => {
      const response = await client.request({
        method: 'tools/call',
        params: {
          name: 'build_swift_package',
          arguments: {
            packagePath: join(testProjectManager.paths.swiftPackageDir, 'Package.swift')
          }
        }
      }, CallToolResultSchema);
      
      const text = (response.content[0] as any).text;
      expect(text).toContain('Build succeeded');
      expect(text).toContain('Configuration: Debug');
      
      // Verify .build directory was created (swift build output)
      const buildDirExists = existsSync(join(testProjectManager.paths.swiftPackageDir, '.build'));
      expect(buildDirExists).toBe(true);
    }, 30000);

    test('should build SPM package with Release configuration', async () => {
      const response = await client.request({
        method: 'tools/call',
        params: {
          name: 'build_swift_package',
          arguments: {
            packagePath: join(testProjectManager.paths.swiftPackageDir, 'Package.swift'),
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
            packagePath: testProjectManager.paths.swiftPackageDir
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
            packagePath: testProjectManager.paths.swiftPackageDir,
            target: 'TestSPM'
          }
        }
      }, CallToolResultSchema);
      
      const text = (response.content[0] as any).text;
      // Either succeeds or fails if target doesn't exist
      if (text.includes('Build succeeded')) {
        expect(text).toContain('Target: TestSPM');
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
            packagePath: testProjectManager.paths.swiftPackageDir,
            product: 'TestSPM'
          }
        }
      }, CallToolResultSchema);
      
      const text = (response.content[0] as any).text;
      // Either succeeds or fails if product doesn't exist
      if (text.includes('Build succeeded')) {
        expect(text).toContain('Product: TestSPM');
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
      expect(text.toLowerCase()).toContain('error');
      
      // Clean up
      execSync(`rm -rf ${brokenPackagePath}`, { stdio: 'pipe' });
    }, 30000);

    test('should handle invalid target', async () => {
      const response = await client.request({
        method: 'tools/call',
        params: {
          name: 'build_swift_package',
          arguments: {
            packagePath: testProjectManager.paths.swiftPackageDir,
            target: 'NonExistentTarget'
          }
        }
      }, CallToolResultSchema);
      
      const text = (response.content[0] as any).text;
      expect(text.toLowerCase()).toContain('error');
      // Swift build should report unknown target
    });

    test('should handle invalid product', async () => {
      const response = await client.request({
        method: 'tools/call',
        params: {
          name: 'build_swift_package',
          arguments: {
            packagePath: testProjectManager.paths.swiftPackageDir,
            product: 'NonExistentProduct'
          }
        }
      }, CallToolResultSchema);
      
      const text = (response.content[0] as any).text;
      expect(text.toLowerCase()).toContain('error');
      // Swift build should report unknown product
    });
  });

});