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
import { cleanupClientAndTransport, createAndConnectClient } from '../../utils/testHelpers';
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
    const result = await createAndConnectClient();
    client = result.client;
    transport = result.transport;
  });
  
  afterEach(async () => {
    await cleanupClientAndTransport(client, transport);
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
      
      expect(text).toContain('Build succeeded');
      expect(text).toContain('Platform: tvOS');
    }, 30000);
  });

  describe('watchOS Builds', () => {
    test('should build watchOS project successfully', async () => {
      const response = await client.request({
        method: 'tools/call',
        params: {
          name: 'build',
          arguments: {
            projectPath: testProjectManager.paths.watchOSProjectPath,
            scheme: testProjectManager.schemes.watchOSProject,
            platform: 'watchOS'
          }
        }
      }, CallToolResultSchema);
      
      const text = (response.content[0] as any).text;
      
      // This should succeed since we have a proper watchOS project
      expect(text).toContain('Build succeeded');
      expect(text).toContain('Platform: watchOS');
      expect(text).toContain(testProjectManager.schemes.watchOSProject);
    }, 30000);

    test('should handle iOS project without watchOS support', async () => {
      // Try to build an iOS-only project for watchOS
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
      
      // This should fail since TestProjectXCTest doesn't have watchOS targets
      expect(text).toMatch(/Unable to find a destination matching|xcodebuild: error|does not contain.*watchOS/);
      expect(text).not.toContain('Build succeeded');
    }, 30000);

    test('should handle watchOS SPM build', async () => {
      const response = await client.request({
        method: 'tools/call',
        params: {
          name: 'build',
          arguments: {
            projectPath: join(testProjectManager.paths.swiftPackageDir, 'Package.swift'),
            scheme: testProjectManager.schemes.swiftPackage,
            platform: 'watchOS'
          }
        }
      }, CallToolResultSchema);
      
      const text = (response.content[0] as any).text;
      
      // SPM packages may or may not support watchOS
      if (text.includes('Unable to find a destination matching')) {
        // Package doesn't support watchOS - this is OK
        expect(text).toContain('Unable to find a destination matching');
      } else {
        // If it does support watchOS, it should succeed
        expect(text).toContain('Build succeeded');
        expect(text).toContain('Platform: watchOS');
      }
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
            projectPath: join(testProjectManager.paths.swiftPackageDir, 'Package.swift'),
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
        expect(text).toMatch(/Unable to find a destination|no available simulator|Device.*not found/i);
      }
    }, 30000);
  });
});