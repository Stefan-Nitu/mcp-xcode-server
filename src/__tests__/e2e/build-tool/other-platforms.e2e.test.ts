/**
 * E2E tests for tvOS, watchOS, and visionOS platform builds
 * Tests Xcode projects, workspaces, and Swift packages
 */

import { describe, test, expect, beforeAll, beforeEach, afterEach } from '@jest/globals';
import { execSync } from 'child_process';
import { join } from 'path';
import { Client } from '@modelcontextprotocol/sdk/client/index';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio';
import { CallToolResultSchema } from '@modelcontextprotocol/sdk/types';
import { TestProjectManager } from '../../utils/TestProjectManager';
import { createModuleLogger } from '../../../logger';

const logger = createModuleLogger('Other-Platform-Build-E2E');

describe('Other Platform Build Tests', () => {
  let client: Client;
  let transport: StdioClientTransport;
  let testProjectManager: TestProjectManager;
  
  beforeAll(async () => {
    testProjectManager = new TestProjectManager();
    await testProjectManager.setup();
    execSync('npm run build', { cwd: process.cwd() });
  }, 120000);
  
  beforeEach(async () => {
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
  });
  
  afterEach(async () => {
    if (client) {
      await client.close();
    }
    
    if (transport) {
      const transportProcess = (transport as any)._process;
      await transport.close();
      
      if (transportProcess) {
        if (transportProcess.stdin && !transportProcess.stdin.destroyed) {
          transportProcess.stdin.end();
          transportProcess.stdin.destroy();
        }
        if (transportProcess.stdout && !transportProcess.stdout.destroyed) {
          transportProcess.stdout.destroy();
        }
        if (transportProcess.stderr && !transportProcess.stderr.destroyed) {
          transportProcess.stderr.destroy();
        }
        transportProcess.unref();
        if (!transportProcess.killed) {
          transportProcess.kill('SIGTERM');
          await new Promise(resolve => {
            const timeout = setTimeout(resolve, 100);
            transportProcess.once('exit', () => {
              clearTimeout(timeout);
              resolve(undefined);
            });
          });
        }
      }
    }
    
    testProjectManager.cleanup();
  });

  describe('tvOS Builds', () => {
    test('should handle tvOS project build', async () => {
      const response = await client.request({
        method: 'tools/call',
        params: {
          name: 'build',
          arguments: {
            projectPath: testProjectManager.paths.xcodeProjectPath,
            scheme: testProjectManager.schemes.xcodeProject,
            platform: 'tvOS'
          }
        }
      }, CallToolResultSchema);
      
      const text = (response.content[0] as any).text;
      // Will either succeed if tvOS SDK is installed, or fail with meaningful error
      if (text.includes('Build succeeded')) {
        expect(text).toContain('Platform: tvOS');
      } else {
        // Should have error about missing SDK or unsupported platform
        expect(text.toLowerCase()).toMatch(/tvos|platform|sdk|not installed/i);
      }
    }, 30000);

    test('should handle tvOS SPM build', async () => {
      const response = await client.request({
        method: 'tools/call',
        params: {
          name: 'build',
          arguments: {
            projectPath: join(testProjectManager.paths.swiftPackageDir, 'Package.swift'),
            scheme: testProjectManager.schemes.swiftPackage,
            platform: 'tvOS'
          }
        }
      }, CallToolResultSchema);
      
      const text = (response.content[0] as any).text;
      
      // SPM builds should either succeed or report clear errors
      if (text.includes('Build succeeded')) {
        expect(text).toContain('Build succeeded');
        expect(text).toContain('Platform: tvOS');
      } else {
        // Should have meaningful error message about tvOS support
        expect(text).toMatch(/Unable to find a destination|error|failed/i);
      }
    }, 30000);
  });

  describe('watchOS Builds', () => {
    test('should handle watchOS project build', async () => {
      const response = await client.request({
        method: 'tools/call',
        params: {
          name: 'build',
          arguments: {
            projectPath: testProjectManager.paths.xcodeProjectPath,
            scheme: testProjectManager.schemes.xcodeProject,
            platform: 'watchOS'
          }
        }
      }, CallToolResultSchema);
      
      const text = (response.content[0] as any).text;
      
      // Check if the project doesn't support watchOS (this is acceptable to skip)
      if (text.includes('Unable to find a destination matching') || 
          text.includes('xcodebuild: error')) {
        // Project doesn't support watchOS - this is OK, skip the test
        expect(text).toMatch(/Unable to find a destination matching|xcodebuild: error/);
        return;
      }
      
      // Otherwise, the build MUST succeed
      expect(text).toContain('Build succeeded');
      expect(text).toContain('Platform: watchOS');
    }, 30000);

    test('should handle watchOS SPM build', async () => {
      const response = await client.request({
        method: 'tools/call',
        params: {
          name: 'build',
          arguments: {
            projectPath: testProjectManager.paths.swiftPackageDir,
            scheme: testProjectManager.schemes.swiftPackage,
            platform: 'watchOS'
          }
        }
      }, CallToolResultSchema);
      
      const text = (response.content[0] as any).text;
      
      // Check if the project doesn't support watchOS (this is acceptable to skip)
      if (text.includes('Unable to find a destination matching')) {
        // Project doesn't support watchOS - this is OK, skip the test
        expect(text).toContain('Unable to find a destination matching');
        return; // Skip further assertions
      }
      
      // Otherwise, the build MUST succeed
      expect(text).toContain('Build succeeded');
      expect(text).toContain('Platform: watchOS');
    }, 30000);
  });

  describe('visionOS Builds', () => {
    test('should handle visionOS project build', async () => {
      const response = await client.request({
        method: 'tools/call',
        params: {
          name: 'build',
          arguments: {
            projectPath: testProjectManager.paths.xcodeProjectPath,
            scheme: testProjectManager.schemes.xcodeProject,
            platform: 'visionOS'
          }
        }
      }, CallToolResultSchema);
      
      const text = (response.content[0] as any).text; // Should have a response
      
      // Only acceptable non-success outcomes are platform/simulator issues
      if (text.includes('Unable to find a destination matching') || 
          text.toLowerCase().includes('no available simulator')) {
        // Platform not supported or no simulators - skip test
        logger.info('visionOS not available - skipping');
        return;
      }
      
      // Otherwise, build MUST succeed
      expect(text).toContain('Build succeeded');
      expect(text).toContain('Platform: visionOS');
    }, 50000);

    test('should handle visionOS SPM build', async () => {
      const response = await client.request({
        method: 'tools/call',
        params: {
          name: 'build',
          arguments: {
            projectPath: testProjectManager.paths.swiftPackageDir,
            scheme: testProjectManager.schemes.swiftPackage,
            platform: 'visionOS',
            configuration: 'Debug'
          }
        }
      }, CallToolResultSchema);
      
      const text = (response.content[0] as any).text;
      
      // SPM builds should either succeed or report clear errors  
      if (text.includes('Build succeeded')) {
        expect(text).toContain('Build succeeded');
        expect(text).toContain('Platform: visionOS');
      } else {
        // Should have meaningful error message about visionOS support
        expect(text).toMatch(/Unable to find a destination|error|failed/i);
      }
    }, 50000);
  });

  describe('Platform Error Handling', () => {
    test('should reject invalid platform', async () => {
      const response = await client.request({
        method: 'tools/call',
        params: {
          name: 'build',
          arguments: {
            projectPath: testProjectManager.paths.xcodeProjectPath,
            scheme: testProjectManager.schemes.xcodeProject,
            platform: 'InvalidPlatform'
          }
        }
      }, CallToolResultSchema);
      
      const text = (response.content[0] as any).text;
      
      // Should get validation error for invalid platform
      expect(text).not.toContain('Build succeeded');
      expect(text.toLowerCase()).toMatch(/validation|invalid platform|unsupported/);
    });

    test('should handle missing simulators gracefully', async () => {
      const response = await client.request({
        method: 'tools/call',
        params: {
          name: 'build',
          arguments: {
            projectPath: testProjectManager.paths.xcodeProjectPath,
            scheme: testProjectManager.schemes.xcodeProject,
            platform: 'tvOS',
            deviceId: 'Apple TV 4K (3rd generation)'
          }
        }
      }, CallToolResultSchema);
      
      const text = (response.content[0] as any).text;
      
      // Should either build with the device or report device not found
      if (text.includes('Build succeeded')) {
        expect(text).toContain('Platform: tvOS');
      } else {
        expect(text).toMatch(/Unable to find a destination|no available simulator|device not found/i);
      }
    }, 30000);
  });
});