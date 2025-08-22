/**
 * E2E tests for macOS platform builds
 * Tests Xcode projects, workspaces, and Swift packages
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

const logger = createModuleLogger('macOS-Build-E2E');

describe('macOS Build Tests', () => {
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

  describe('Swift Package Builds (macOS)', () => {
    test('should build SPM package with swift build', async () => {
      const response = await client.request({
        method: 'tools/call',
        params: {
          name: 'build',
          arguments: {
            projectPath: join(testProjectManager.paths.swiftPackageDir, 'Package.swift'),
            platform: 'macOS'
          }
        }
      }, CallToolResultSchema);
      
      const text = (response.content[0] as any).text;
      expect(text).toContain('Build succeeded');
      expect(text).toContain('Platform: macOS');
      
      // Verify .build directory was created (swift build output)
      const buildDirExists = existsSync(join(testProjectManager.paths.swiftPackageDir, '.build'));
      expect(buildDirExists).toBe(true);
    }, 30000);

    test('should build SPM with Release configuration', async () => {
      const response = await client.request({
        method: 'tools/call',
        params: {
          name: 'build',
          arguments: {
            projectPath: join(testProjectManager.paths.swiftPackageDir, 'Package.swift'),
            platform: 'macOS',
            configuration: 'Release'
          }
        }
      }, CallToolResultSchema);
      
      const text = (response.content[0] as any).text;
      expect(text).toContain('Build succeeded');
      expect(text).toContain('Configuration: Release');
    }, 30000);

    test('should handle scheme parameter for SPM', async () => {
      // When scheme is provided for SPM on macOS, it should be ignored (swift build doesn't use schemes)
      const response = await client.request({
        method: 'tools/call',
        params: {
          name: 'build',
          arguments: {
            projectPath: join(testProjectManager.paths.swiftPackageDir, 'Package.swift'),
            scheme: 'TestSPM',
            platform: 'macOS'
          }
        }
      }, CallToolResultSchema);
      
      const text = (response.content[0] as any).text;
      expect(text).toContain('Build succeeded');
    }, 30000);
  });

  describe('Xcode Project Builds (macOS)', () => {
    test('should build macOS project if available', async () => {
      // This might fail if the test project doesn't have macOS support
      const response = await client.request({
        method: 'tools/call',
        params: {
          name: 'build',
          arguments: {
            projectPath: testProjectManager.paths.xcodeProjectPath,
            scheme: testProjectManager.schemes.xcodeProject,
            platform: 'macOS'
          }
        }
      }, CallToolResultSchema);
      
      const text = (response.content[0] as any).text;
      
      // Either succeeds or reports platform not supported
      if (text.includes('Build succeeded')) {
        expect(text).toContain('Platform: macOS');
      } else {
        expect(text).toMatch(/Unable to find a destination|Platform.*not supported|error/i);
      }
    }, 30000);
  });

  describe('Workspace Builds (macOS)', () => {
    test('should build workspace for macOS if supported', async () => {
      const response = await client.request({
        method: 'tools/call',
        params: {
          name: 'build',
          arguments: {
            projectPath: testProjectManager.paths.workspacePath,
            scheme: testProjectManager.schemes.xcodeProject,
            platform: 'macOS'
          }
        }
      }, CallToolResultSchema);
      
      const text = (response.content[0] as any).text;
      
      // Either succeeds or reports platform not supported
      if (text.includes('Build succeeded')) {
        expect(text).toContain('Platform: macOS');
      } else {
        expect(text).toMatch(/Unable to find a destination|Platform.*not supported|error/i);
      }
    }, 30000);
  });

  describe('Error Handling', () => {
    test('should handle non-existent SPM package', async () => {
      const response = await client.request({
        method: 'tools/call',
        params: {
          name: 'build',
          arguments: {
            projectPath: '/non/existent/Package.swift',
            platform: 'macOS'
          }
        }
      }, CallToolResultSchema);
      
      const text = (response.content[0] as any).text;
      expect(text.toLowerCase()).toContain('no package.swift found');
    });

    test('should handle build failures with proper output', async () => {
      // Create a package with syntax errors
      const brokenPackagePath = join(testProjectManager.paths.testProjectDir, 'BrokenPackage');
      execSync(`mkdir -p ${brokenPackagePath}/Sources/BrokenPackage`, { stdio: 'pipe' });
      
      const packageSwift = `// swift-tools-version: 6.0
import PackageDescription

let package = Package(
    name: "BrokenPackage",
    targets: [
        .target(name: "BrokenPackage"),
    ]
)`;
      
      const brokenCode = `
// Intentional syntax error
func broken() {
    this is not valid Swift code
}`;
      
      require('fs').writeFileSync(join(brokenPackagePath, 'Package.swift'), packageSwift);
      require('fs').writeFileSync(join(brokenPackagePath, 'Sources/BrokenPackage/Broken.swift'), brokenCode);
      
      const response = await client.request({
        method: 'tools/call',
        params: {
          name: 'build',
          arguments: {
            projectPath: join(brokenPackagePath, 'Package.swift'),
            platform: 'macOS'
          }
        }
      }, CallToolResultSchema);
      
      const text = (response.content[0] as any).text;
      expect(text.toLowerCase()).toContain('error');
      
      // Clean up
      execSync(`rm -rf ${brokenPackagePath}`, { stdio: 'pipe' });
    }, 30000);
  });
});