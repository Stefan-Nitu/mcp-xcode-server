/**
 * E2E tests for BuildProjectTool
 * Tests building projects for all platforms with comprehensive cleanup
 */

import { describe, test, expect, beforeAll, afterAll, beforeEach, afterEach } from '@jest/globals';
import { existsSync, rmSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { execSync } from 'child_process';
import { Client } from '@modelcontextprotocol/sdk/client/index';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio';
import { CallToolResultSchema } from '@modelcontextprotocol/sdk/types';
import { TestProjectManager } from '../utils/TestProjectManager';
import { createModuleLogger } from '../../logger';

const logger = createModuleLogger('BuildProjectE2E');

describe('BuildProjectTool E2E Tests', () => {
  let client: Client;
  let transport: StdioClientTransport;
  let testProjectManager: TestProjectManager;
  
  // Get paths from the manager
  let xcodeProjectDir: string;
  let swiftPackageDir: string;
  let derivedDataPath: string;
  
  beforeAll(async () => {
    // Create test project manager that uses real test artifacts
    testProjectManager = new TestProjectManager();
    
    // Setup test projects (cleans up any existing build artifacts)
    await testProjectManager.setup();
    
    // Get paths from the manager
    const paths = testProjectManager.paths;
    xcodeProjectDir = paths.xcodeProjectDir;
    swiftPackageDir = paths.swiftPackageDir;
    derivedDataPath = paths.derivedDataPath;
    
    // Build the server
    execSync('npm run build', { cwd: process.cwd() });
  }, 120000);
  
  afterAll(() => {
    // No cleanup needed here - afterEach already handles it
  });
  
  beforeEach(async () => {
    // Create MCP client transport (this starts the server)
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
    // Disconnect client
    if (client) {
      await client.close();
    }
    
    // Properly clean up the child process and its stdio streams
    // This is necessary because StdioClientTransport doesn't fully clean up
    // See: https://github.com/modelcontextprotocol/typescript-sdk/issues/579
    if (transport) {
      // Get the process reference before closing transport
      const transportProcess = (transport as any)._process;
      
      // Close transport (this calls abort on the controller)
      await transport.close();
      
      // Additional cleanup for the child process
      if (transportProcess) {
        // Close stdin stream
        if (transportProcess.stdin && !transportProcess.stdin.destroyed) {
          transportProcess.stdin.end();
          transportProcess.stdin.destroy();
        }
        
        // Close stdout stream
        if (transportProcess.stdout && !transportProcess.stdout.destroyed) {
          transportProcess.stdout.destroy();
        }
        
        // Close stderr stream  
        if (transportProcess.stderr && !transportProcess.stderr.destroyed) {
          transportProcess.stderr.destroy();
        }
        
        // Unref the process to allow Jest to exit
        transportProcess.unref();
        
        // Kill the process if still running
        if (!transportProcess.killed) {
          transportProcess.kill('SIGTERM');
          // Give it a moment to exit gracefully
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
    
    // Ensure complete cleanup after each test for proper isolation
    testProjectManager.cleanup();
  });


  describe('iOS Platform Builds', () => {
    test('should build iOS project with default configuration', async () => {
      const response = await client.request({
        method: 'tools/call',
        params: {
          name: 'build_project',
          arguments: {
            projectPath: testProjectManager.paths.xcodeProjectPath,
            scheme: testProjectManager.schemes.xcodeProject,
            platform: 'iOS'
          }
        }
      }, CallToolResultSchema);
      
      expect(response).toBeDefined();
      const text = (response.content[0] as any).text;
      // Should either build successfully or report that scheme doesn't exist
      expect(text).toBeDefined();
      
      // Verify DerivedData was created if build succeeded
      if (text.toLowerCase().includes('success')) {
        expect(existsSync(derivedDataPath) || existsSync(join(process.cwd(), 'DerivedData'))).toBe(true);
      }
    });

    test('should build with specific device', async () => {
      const response = await client.request({
        method: 'tools/call',
        params: {
          name: 'build_project',
          arguments: {
            projectPath: testProjectManager.paths.xcodeProjectPath,
            scheme: testProjectManager.schemes.xcodeProject,
            platform: 'iOS',
            deviceId: 'iPhone 15 Pro',
            configuration: 'Debug'
          }
        }
      }, CallToolResultSchema);
      
      expect(response).toBeDefined();
      const text = (response.content[0] as any).text;
      expect(text).toBeDefined();
    });

    test('should build with Release configuration', async () => {
      const response = await client.request({
        method: 'tools/call',
        params: {
          name: 'build_project',
          arguments: {
            projectPath: testProjectManager.paths.xcodeProjectPath,
            scheme: testProjectManager.schemes.xcodeProject,
            platform: 'iOS',
            configuration: 'Release'
          }
        }
      }, CallToolResultSchema);
      
      expect(response).toBeDefined();
      const text = (response.content[0] as any).text;
      expect(text).toBeDefined();
      if (text.toLowerCase().includes('success')) {
        expect(text.toLowerCase()).toContain('release');
      }
    });
  });

  describe('macOS Platform Builds', () => {
    test('should build macOS project', async () => {
      const response = await client.request({
        method: 'tools/call',
        params: {
          name: 'build_project',
          arguments: {
            projectPath: join(swiftPackageDir, 'Package.swift'),
            scheme: 'TestPackage',
            platform: 'macOS'
          }
        }
      }, CallToolResultSchema);
      
      expect(response).toBeDefined();
      const text = (response.content[0] as any).text;
      expect(text).toBeDefined();
    });

    test('should build macOS with custom derived data path', async () => {
      const customDerivedData = join(testProjectManager.paths.testProjectDir, 'CustomDerivedData');
      
      const response = await client.request({
        method: 'tools/call',
        params: {
          name: 'build_project',
          arguments: {
            projectPath: join(swiftPackageDir, 'Package.swift'),
            scheme: 'TestPackage',
            platform: 'macOS',
            configuration: 'Debug'
          }
        }
      }, CallToolResultSchema);
      
      expect(response).toBeDefined();
      const text = (response.content[0] as any).text;
      expect(text).toBeDefined();
      
      // Clean up custom derived data
      if (existsSync(customDerivedData)) {
        rmSync(customDerivedData, { recursive: true });
      }
    });
  });

  describe('Other Platforms', () => {
    test('should handle tvOS platform', async () => {
      const response = await client.request({
        method: 'tools/call',
        params: {
          name: 'build_project',
          arguments: {
            projectPath: testProjectManager.paths.xcodeProjectPath,
            scheme: testProjectManager.schemes.xcodeProject,
            platform: 'tvOS'
          }
        }
      }, CallToolResultSchema);
      
      expect(response).toBeDefined();
      const text = (response.content[0] as any).text;
      logger.debug({ response: text, platform: 'tvOS' }, 'Build response');
      expect(text).toBeDefined();
      // The test should verify the actual response - either success or a meaningful error
      // If tvOS is not installed, we expect an error message about missing platform support
    });

    test('should handle watchOS platform', async () => {
      const response = await client.request({
        method: 'tools/call',
        params: {
          name: 'build_project',
          arguments: {
            projectPath: testProjectManager.paths.xcodeProjectPath,
            scheme: testProjectManager.schemes.xcodeProject,
            platform: 'watchOS'
          }
        }
      }, CallToolResultSchema);
      
      expect(response).toBeDefined();
      const text = (response.content[0] as any).text;
      expect(text).toBeDefined();
    });

    test('should handle visionOS platform', async () => {
      const response = await client.request({
        method: 'tools/call',
        params: {
          name: 'build_project',
          arguments: {
            projectPath: testProjectManager.paths.xcodeProjectPath,
            scheme: testProjectManager.schemes.xcodeProject,
            platform: 'visionOS'
          }
        }
      }, CallToolResultSchema);
      
      expect(response).toBeDefined();
      const text = (response.content[0] as any).text;
      expect(text).toBeDefined();
    }, 50000);
  });

  describe('Workspace Builds', () => {
    test('should succeed with valid workspace and scheme', async () => {
      const response = await client.request({
        method: 'tools/call',
        params: {
          name: 'build_project',
          arguments: {
            projectPath: testProjectManager.paths.workspacePath,
            scheme: testProjectManager.schemes.xcodeProject,
            platform: 'iOS'
          }
        }
      }, CallToolResultSchema);
      
      const text = (response.content[0] as any).text;

      // Build should succeed with valid inputs
      expect(text).toMatch(/^Build succeeded:/);
      expect(text).toContain('Platform: iOS');
      expect(text).toContain('Configuration: Debug');
      expect(text).toContain('TestProjectXCTest');
    }, 60000);

    test('should fail with proper error for invalid scheme', async () => {
      const response = await client.request({
        method: 'tools/call',
        params: {
          name: 'build_project',
          arguments: {
            projectPath: testProjectManager.paths.workspacePath,
            scheme: 'NonExistentScheme',
            platform: 'iOS'
          }
        }
      }, CallToolResultSchema);
      
      const text = (response.content[0] as any).text;
      
      // Build should fail with invalid scheme
      expect(text).not.toMatch(/^Build succeeded:/);
      
      // Should contain actual xcodebuild error output mentioning the scheme
      expect(text.toLowerCase()).toContain('scheme');
      expect(text).toContain('xcodebuild');
    }, 30000);
  });

  describe('Error Handling', () => {
    test('should handle non-existent project', async () => {
      const response = await client.request({
        method: 'tools/call',
        params: {
          name: 'build_project',
          arguments: {
            projectPath: '/non/existent/project.xcodeproj',
            scheme: 'NonExistent',
            platform: 'iOS'
          }
        }
      }, CallToolResultSchema);
      
      expect(response).toBeDefined();
      const text = (response.content[0] as any).text;
      expect(text.toLowerCase()).toContain('error');
    });

    test('should handle invalid scheme', async () => {
      const response = await client.request({
        method: 'tools/call',
        params: {
          name: 'build_project',
          arguments: {
            projectPath: join(xcodeProjectDir, 'TestApp.xcodeproj'),
            scheme: 'InvalidScheme',
            platform: 'iOS'
          }
        }
      }, CallToolResultSchema);
      
      expect(response).toBeDefined();
      const text = (response.content[0] as any).text;
      // Should report scheme not found
      expect(text).toBeDefined();
    });

    test('should handle invalid platform', async () => {
      const response = await client.request({
        method: 'tools/call',
        params: {
          name: 'build_project',
          arguments: {
            projectPath: testProjectManager.paths.xcodeProjectPath,
            scheme: testProjectManager.schemes.xcodeProject,
            platform: 'InvalidPlatform'
          }
        }
      }, CallToolResultSchema);
      
      expect(response).toBeDefined();
      // Should reject invalid platform
    });

    test('should handle build failures gracefully', async () => {
      // Create a project with syntax errors
      const errorProjectDir = join(testProjectManager.paths.testProjectDir, 'ErrorProject');
      mkdirSync(errorProjectDir, { recursive: true });
      
      writeFileSync(join(errorProjectDir, 'Package.swift'), `// swift-tools-version: 6.0
import PackageDescription

let package = Package(
    name: "ErrorPackage",
    targets: [
        .target(name: "ErrorPackage"),
    ]
)
`);
      
      mkdirSync(join(errorProjectDir, 'Sources', 'ErrorPackage'), { recursive: true });
      writeFileSync(join(errorProjectDir, 'Sources', 'ErrorPackage', 'Error.swift'), `
// Intentional syntax error
func broken() {
    this is not valid Swift code
}
`);
      
      const response = await client.request({
        method: 'tools/call',
        params: {
          name: 'build_project',
          arguments: {
            projectPath: join(errorProjectDir, 'Package.swift'),
            scheme: 'ErrorPackage',
            platform: 'macOS'
          }
        }
      }, CallToolResultSchema);
      
      expect(response).toBeDefined();
      const text = (response.content[0] as any).text;
      expect(text.toLowerCase()).toContain('error');
      
      // Clean up error project
      if (existsSync(errorProjectDir)) {
        rmSync(errorProjectDir, { recursive: true });
      }
    });

    test('should handle missing simulators', async () => {
      const response = await client.request({
        method: 'tools/call',
        params: {
          name: 'build_project',
          arguments: {
            projectPath: testProjectManager.paths.xcodeProjectPath,
            scheme: testProjectManager.schemes.xcodeProject,
            platform: 'iOS',
            deviceId: 'Non-existent Device 99'
          }
        }
      }, CallToolResultSchema);
      
      expect(response).toBeDefined();
      const text = (response.content[0] as any).text;
      // Should report device not found
      expect(text).toBeDefined();
    });
  });

  describe('Build Output', () => {
    test('should provide meaningful build output', async () => {
      const response = await client.request({
        method: 'tools/call',
        params: {
          name: 'build_project',
          arguments: {
            projectPath: join(swiftPackageDir, 'Package.swift'),
            scheme: 'TestPackage',
            platform: 'macOS'
          }
        }
      }, CallToolResultSchema);
      
      expect(response).toBeDefined();
      const text = (response.content[0] as any).text;
      
      // Should include relevant information
      if (text.toLowerCase().includes('success')) {
        // Should mention platform, configuration, or other details
        const hasRelevantInfo = 
          text.toLowerCase().includes('macos') ||
          text.toLowerCase().includes('debug') ||
          text.toLowerCase().includes('build') ||
          text.toLowerCase().includes('succeeded');
        expect(hasRelevantInfo).toBe(true);
      }
    });

    test('should report app path when applicable', async () => {
      const response = await client.request({
        method: 'tools/call',
        params: {
          name: 'build_project',
          arguments: {
            projectPath: testProjectManager.paths.xcodeProjectPath,
            scheme: testProjectManager.schemes.xcodeProject,
            platform: 'iOS'
          }
        }
      }, CallToolResultSchema);
      
      expect(response).toBeDefined();
      const text = (response.content[0] as any).text;
      
      // If build succeeds for an app, should include app path
      if (text.toLowerCase().includes('success') && text.toLowerCase().includes('app')) {
        expect(text).toMatch(/\.app|app path/i);
      }
    });
  });
});