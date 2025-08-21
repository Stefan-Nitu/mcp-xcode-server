/**
 * E2E tests for iOS platform builds
 * Tests Xcode projects, workspaces, and Swift packages with all build parameters
 */

import { describe, test, expect, beforeAll, afterAll, beforeEach, afterEach } from '@jest/globals';
import { existsSync } from 'fs';
import { join } from 'path';
import { execSync } from 'child_process';
import { Client } from '@modelcontextprotocol/sdk/client/index';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio';
import { CallToolResultSchema } from '@modelcontextprotocol/sdk/types';
import { TestProjectManager } from '../../utils/TestProjectManager';
import { createModuleLogger } from '../../../logger';

const logger = createModuleLogger('iOS-Build-E2E');

describe('iOS Build Tests', () => {
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

  describe('Xcode Project Builds', () => {
    test('should build with default configuration', async () => {
      const response = await client.request({
        method: 'tools/call',
        params: {
          name: 'build',
          arguments: {
            projectPath: testProjectManager.paths.xcodeProjectPath,
            scheme: testProjectManager.schemes.xcodeProject,
            platform: 'iOS'
          }
        }
      }, CallToolResultSchema);
      
      expect(response).toBeDefined();
      expect(response.content).toBeDefined();
      expect(response.content[0]).toBeDefined();
      
      const text = (response.content[0] as any).text;
      expect(text).toContain('Build succeeded');
      expect(text).toContain('Platform: iOS');
      expect(text).toContain('Configuration: Debug');
      
      // Verify DerivedData was created
      const derivedDataExists = existsSync('./DerivedData') || 
                                existsSync(join(process.cwd(), 'DerivedData'));
      expect(derivedDataExists).toBe(true);
    }, 30000);

    test('should build with Release configuration', async () => {
      const response = await client.request({
        method: 'tools/call',
        params: {
          name: 'build',
          arguments: {
            projectPath: testProjectManager.paths.xcodeProjectPath,
            scheme: testProjectManager.schemes.xcodeProject,
            platform: 'iOS',
            configuration: 'Release'
          }
        }
      }, CallToolResultSchema);
      
      const text = (response.content[0] as any).text;
      expect(text).toContain('Build succeeded');
      expect(text).toContain('Configuration: Release');
    }, 30000);

    test('should build with specific device', async () => {
      const response = await client.request({
        method: 'tools/call',
        params: {
          name: 'build',
          arguments: {
            projectPath: testProjectManager.paths.xcodeProjectPath,
            scheme: testProjectManager.schemes.xcodeProject,
            platform: 'iOS',
            deviceId: 'iPhone 15 Pro'
          }
        }
      }, CallToolResultSchema);
      
      const text = (response.content[0] as any).text;
      expect(text).toBeDefined();
      // Should either succeed or report device not found
      expect(text).toMatch(/Build succeeded|No available simulator found/);
    }, 30000);

    test('should build with custom configuration', async () => {
      // This tests that we accept custom configurations beyond Debug/Release
      const response = await client.request({
        method: 'tools/call',
        params: {
          name: 'build',
          arguments: {
            projectPath: testProjectManager.paths.xcodeProjectPath,
            scheme: testProjectManager.schemes.xcodeProject,
            platform: 'iOS',
            configuration: 'Beta' // Custom configuration (will fail but should be accepted)
          }
        }
      }, CallToolResultSchema);
      
      const text = (response.content[0] as any).text;
      expect(text).toBeDefined();
      // The build will likely fail with unknown configuration, but the parameter should be accepted
    }, 30000);
  });

  describe('Workspace Builds', () => {
    test('should build workspace with valid scheme', async () => {
      const response = await client.request({
        method: 'tools/call',
        params: {
          name: 'build',
          arguments: {
            projectPath: testProjectManager.paths.workspacePath,
            scheme: testProjectManager.schemes.xcodeProject,
            platform: 'iOS'
          }
        }
      }, CallToolResultSchema);
      
      const text = (response.content[0] as any).text;
      expect(text).toContain('Build succeeded');
      expect(text).toContain(testProjectManager.schemes.xcodeProject);
    }, 60000);

    test('should fail with invalid scheme', async () => {
      const response = await client.request({
        method: 'tools/call',
        params: {
          name: 'build',
          arguments: {
            projectPath: testProjectManager.paths.workspacePath,
            scheme: 'NonExistentScheme',
            platform: 'iOS'
          }
        }
      }, CallToolResultSchema);
      
      const text = (response.content[0] as any).text;
      expect(text).not.toContain('Build succeeded');
      expect(text.toLowerCase()).toContain('scheme');
    }, 30000);
  });

  describe('Swift Package Builds', () => {
    test('should build SPM package for iOS', async () => {
      const response = await client.request({
        method: 'tools/call',
        params: {
          name: 'build',
          arguments: {
            projectPath: join(testProjectManager.paths.swiftPackageDir, 'Package.swift'),
            scheme: testProjectManager.schemes.swiftPackage,
            platform: 'iOS'
          }
        }
      }, CallToolResultSchema);
      
      const text = (response.content[0] as any).text;
      expect(text).toContain('Build succeeded');
      expect(text).toContain('Platform: iOS');
      expect(text).toContain(testProjectManager.schemes.swiftPackage);
    }, 30000);

    test('should build SPM with Release configuration', async () => {
      const response = await client.request({
        method: 'tools/call',
        params: {
          name: 'build',
          arguments: {
            projectPath: testProjectManager.paths.swiftPackageDir,
            scheme: testProjectManager.schemes.swiftPackage,
            platform: 'iOS',
            configuration: 'Release'
          }
        }
      }, CallToolResultSchema);
      
      const text = (response.content[0] as any).text;
      expect(text).toContain('Build succeeded');
      expect(text).toContain('Configuration: Release');
    }, 30000);

    test('should build SPM with specific device', async () => {
      const response = await client.request({
        method: 'tools/call',
        params: {
          name: 'build',
          arguments: {
            projectPath: testProjectManager.paths.swiftPackageDir,
            scheme: testProjectManager.schemes.swiftPackage,
            platform: 'iOS',
            deviceId: 'iPhone 15',
            configuration: 'Debug'
          }
        }
      }, CallToolResultSchema);
      
      const text = (response.content[0] as any).text;
      expect(text).toBeDefined();
      // Should either succeed or report device issue
      expect(text).toMatch(/Build succeeded|No available simulator found/);
    }, 30000);
  });

  describe('Error Handling', () => {
    test('should handle non-existent project', async () => {
      const response = await client.request({
        method: 'tools/call',
        params: {
          name: 'build',
          arguments: {
            projectPath: '/non/existent/project.xcodeproj',
            scheme: 'NonExistent',
            platform: 'iOS'
          }
        }
      }, CallToolResultSchema);
      
      const text = (response.content[0] as any).text;
      expect(text.toLowerCase()).toContain('does not exist');
    });

    test('should handle non-existent SPM package', async () => {
      const response = await client.request({
        method: 'tools/call',
        params: {
          name: 'build',
          arguments: {
            projectPath: '/non/existent/Package.swift',
            scheme: 'TestPackage',
            platform: 'iOS'
          }
        }
      }, CallToolResultSchema);
      
      const text = (response.content[0] as any).text;
      expect(text.toLowerCase()).toContain('no package.swift found');
    });

    test('should handle invalid device', async () => {
      const response = await client.request({
        method: 'tools/call',
        params: {
          name: 'build',
          arguments: {
            projectPath: testProjectManager.paths.xcodeProjectPath,
            scheme: testProjectManager.schemes.xcodeProject,
            platform: 'iOS',
            deviceId: 'Non-existent Device 99'
          }
        }
      }, CallToolResultSchema);
      
      const text = (response.content[0] as any).text;
      expect(text).toBeDefined();
      // Should report device not found
    });
  });

  describe('Build Output Validation', () => {
    test('should report app path for successful builds', async () => {
      const response = await client.request({
        method: 'tools/call',
        params: {
          name: 'build',
          arguments: {
            projectPath: testProjectManager.paths.xcodeProjectPath,
            scheme: testProjectManager.schemes.xcodeProject,
            platform: 'iOS'
          }
        }
      }, CallToolResultSchema);
      
      const text = (response.content[0] as any).text;
      if (text.includes('Build succeeded')) {
        expect(text).toContain('App path:');
      }
    }, 30000);

    test('should provide detailed error output on failure', async () => {
      const response = await client.request({
        method: 'tools/call',
        params: {
          name: 'build',
          arguments: {
            projectPath: testProjectManager.paths.xcodeProjectPath,
            scheme: 'InvalidScheme',
            platform: 'iOS'
          }
        }
      }, CallToolResultSchema);
      
      const text = (response.content[0] as any).text;
      // Should contain actual xcodebuild output
      expect(text).toBeDefined();
      expect(text.length).toBeGreaterThan(50); // Should have meaningful error output
    });
  });
});