/**
 * E2E tests for CleanBuildTool
 * Tests cleaning build artifacts, DerivedData, and test results with verification
 */

import { describe, test, expect, beforeAll, afterAll, beforeEach, afterEach } from '@jest/globals';
import { existsSync, mkdirSync, writeFileSync, rmSync, readdirSync } from 'fs';
import { join, resolve } from 'path';
import { execSync } from 'child_process';
import { spawn, ChildProcess } from 'child_process';
import { Client } from '@modelcontextprotocol/sdk/client/index';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio';
import { CallToolResultSchema } from '@modelcontextprotocol/sdk/types';

describe('CleanBuildTool E2E Tests', () => {
  let serverProcess: ChildProcess;
  let client: Client;
  let transport: StdioClientTransport;
  
  // Test directories with unique timestamps
  const timestamp = Date.now();
  const testProjectDir = `/tmp/test-clean-build-${timestamp}`;
  const xcodeProjectDir = join(testProjectDir, 'XcodeProject');
  const swiftPackageDir = join(testProjectDir, 'SwiftPackage');
  const workspaceDir = join(testProjectDir, 'Workspace');
  
  // Various paths to test cleaning
  const derivedDataPaths = {
    default: join(testProjectDir, 'DerivedData'),
    custom: join(testProjectDir, 'CustomDerivedData'),
    project: join(xcodeProjectDir, 'DerivedData'),
    global: join(process.cwd(), 'DerivedData')
  };
  
  beforeAll(async () => {
    // Clean up any existing test directories
    if (existsSync(testProjectDir)) {
      rmSync(testProjectDir, { recursive: true });
    }
    
    // Create test directories
    mkdirSync(testProjectDir, { recursive: true });
    mkdirSync(xcodeProjectDir, { recursive: true });
    mkdirSync(swiftPackageDir, { recursive: true });
    mkdirSync(workspaceDir, { recursive: true });
    
    // Build the server
    execSync('npm run build', { cwd: process.cwd() });
    
    // Create test projects
    await createTestProjects();
  }, 120000);
  
  afterAll(() => {
    // Final comprehensive cleanup
    cleanupAll();
  });
  
  beforeEach(async () => {
    // Start MCP server
    serverProcess = spawn('node', ['dist/index.js'], {
      cwd: process.cwd(),
      env: { ...process.env },
    });
    
    // Create MCP client
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
  }, 30000);
  
  afterEach(async () => {
    // Disconnect client
    if (client) {
      await client.close();
    }
    
    // Kill server process
    if (serverProcess) {
      serverProcess.kill();
      await new Promise(resolve => {
        serverProcess.once('exit', resolve);
      });
    }
    
    // Clean all artifacts after each test
    cleanAllArtifacts();
  });

  function createBuildArtifacts() {
    // Create various build artifacts to test cleaning
    
    // DerivedData with build products
    const buildDir = join(derivedDataPaths.default, 'Build', 'Products', 'Debug');
    mkdirSync(buildDir, { recursive: true });
    writeFileSync(join(buildDir, 'MyApp.app'), 'mock app bundle');
    
    // Test results
    const testResultsDir = join(derivedDataPaths.default, 'Logs', 'Test');
    mkdirSync(testResultsDir, { recursive: true });
    writeFileSync(join(testResultsDir, 'TestSummaries.plist'), '<plist>test results</plist>');
    writeFileSync(join(testResultsDir, 'TestLog.xcresult'), 'test log data');
    
    // Index files
    const indexDir = join(derivedDataPaths.default, 'Index', 'DataStore');
    mkdirSync(indexDir, { recursive: true });
    writeFileSync(join(indexDir, 'index.db'), 'index data');
    
    // Module cache
    const moduleCacheDir = join(derivedDataPaths.default, 'ModuleCache.noindex');
    mkdirSync(moduleCacheDir, { recursive: true });
    writeFileSync(join(moduleCacheDir, 'module.cache'), 'cache data');
    
    // Swift Package .build directory
    const swiftBuildDir = join(swiftPackageDir, '.build');
    mkdirSync(join(swiftBuildDir, 'debug'), { recursive: true });
    writeFileSync(join(swiftBuildDir, 'debug', 'Package.build'), 'build artifacts');
    
    // Custom DerivedData
    mkdirSync(join(derivedDataPaths.custom, 'Build'), { recursive: true });
    writeFileSync(join(derivedDataPaths.custom, 'Build', 'artifact'), 'custom artifact');
  }

  function verifyArtifactsExist() {
    // Verify build artifacts were created
    return existsSync(derivedDataPaths.default) || 
           existsSync(join(swiftPackageDir, '.build')) ||
           existsSync(derivedDataPaths.custom);
  }

  function verifyArtifactsRemoved(paths: string[]) {
    // Verify specified paths were removed
    return paths.every(path => !existsSync(path));
  }

  function cleanAllArtifacts() {
    // Clean all possible artifact locations
    Object.values(derivedDataPaths).forEach(path => {
      if (existsSync(path)) {
        rmSync(path, { recursive: true });
      }
    });
    
    // Clean .build directories
    [swiftPackageDir, xcodeProjectDir, workspaceDir].forEach(dir => {
      const buildPath = join(dir, '.build');
      if (existsSync(buildPath)) {
        rmSync(buildPath, { recursive: true });
      }
    });
  }

  function cleanupAll() {
    if (existsSync(testProjectDir)) {
      rmSync(testProjectDir, { recursive: true });
    }
    
    // Clean any global DerivedData that might have been created
    if (existsSync(derivedDataPaths.global)) {
      rmSync(derivedDataPaths.global, { recursive: true });
    }
  }

  async function createTestProjects() {
    // Create Xcode project
    const xcodeProj = join(xcodeProjectDir, 'TestApp.xcodeproj');
    mkdirSync(xcodeProj, { recursive: true });
    
    writeFileSync(join(xcodeProj, 'project.pbxproj'), `// !$*UTF8*$!
{
  archiveVersion = 1;
  classes = {};
  objectVersion = 56;
  objects = {};
  rootObject = 1234567890ABCDEF;
}`);
    
    // Create Swift package
    writeFileSync(join(swiftPackageDir, 'Package.swift'), `// swift-tools-version: 6.0
import PackageDescription

let package = Package(
    name: "TestPackage",
    platforms: [.macOS(.v14)],
    products: [
        .library(name: "TestPackage", targets: ["TestPackage"])
    ],
    targets: [
        .target(name: "TestPackage", path: "Sources")
    ]
)
`);
    
    mkdirSync(join(swiftPackageDir, 'Sources'), { recursive: true });
    writeFileSync(join(swiftPackageDir, 'Sources', 'Test.swift'), `
public struct Test {
    public init() {}
}
`);
    
    // Create workspace
    const xcworkspace = join(workspaceDir, 'Test.xcworkspace');
    mkdirSync(xcworkspace, { recursive: true });
    
    writeFileSync(join(xcworkspace, 'contents.xcworkspacedata'), `<?xml version="1.0" encoding="UTF-8"?>
<Workspace version = "1.0">
</Workspace>
`);
  }

  describe('Clean Build Target', () => {
    test('should clean build folder with xcodebuild clean', async () => {
      createBuildArtifacts();
      expect(verifyArtifactsExist()).toBe(true);
      
      const response = await client.request({
        method: 'tools/call',
        params: {
          name: 'clean_build',
          arguments: {
            projectPath: join(xcodeProjectDir, 'TestApp.xcodeproj'),
            scheme: 'TestApp',
            platform: 'iOS',
            configuration: 'Debug',
            cleanTarget: 'build'
          }
        }
      }, CallToolResultSchema);
      
      expect(response).toBeDefined();
      const result = JSON.parse((response.content[0] as any).text);
      expect(result.success).toBe(true);
      expect(result.message).toContain('Cleaned build folder');
    });

    test('should clean workspace build', async () => {
      const response = await client.request({
        method: 'tools/call',
        params: {
          name: 'clean_build',
          arguments: {
            projectPath: join(workspaceDir, 'Test.xcworkspace'),
            scheme: 'Test',
            cleanTarget: 'build'
          }
        }
      }, CallToolResultSchema);
      
      expect(response).toBeDefined();
      const result = JSON.parse((response.content[0] as any).text);
      // Should attempt to clean or report error gracefully
      expect(result).toBeDefined();
    });
  });

  describe('Clean DerivedData', () => {
    test('should remove default DerivedData folder', async () => {
      createBuildArtifacts();
      expect(existsSync(derivedDataPaths.default)).toBe(true);
      
      const response = await client.request({
        method: 'tools/call',
        params: {
          name: 'clean_build',
          arguments: {
            cleanTarget: 'derivedData',
            derivedDataPath: derivedDataPaths.default
          }
        }
      }, CallToolResultSchema);
      
      expect(response).toBeDefined();
      const result = JSON.parse((response.content[0] as any).text);
      expect(result.success).toBe(true);
      expect(result.message).toContain('Removed DerivedData');
      expect(existsSync(derivedDataPaths.default)).toBe(false);
    });

    test('should handle custom DerivedData path', async () => {
      mkdirSync(derivedDataPaths.custom, { recursive: true });
      writeFileSync(join(derivedDataPaths.custom, 'artifact'), 'test');
      
      const response = await client.request({
        method: 'tools/call',
        params: {
          name: 'clean_build',
          arguments: {
            cleanTarget: 'derivedData',
            derivedDataPath: derivedDataPaths.custom
          }
        }
      }, CallToolResultSchema);
      
      expect(response).toBeDefined();
      const result = JSON.parse((response.content[0] as any).text);
      expect(result.success).toBe(true);
      expect(existsSync(derivedDataPaths.custom)).toBe(false);
    });

    test('should handle non-existent DerivedData gracefully', async () => {
      const nonExistentPath = join(testProjectDir, 'NonExistentDerivedData');
      
      const response = await client.request({
        method: 'tools/call',
        params: {
          name: 'clean_build',
          arguments: {
            cleanTarget: 'derivedData',
            derivedDataPath: nonExistentPath
          }
        }
      }, CallToolResultSchema);
      
      expect(response).toBeDefined();
      const result = JSON.parse((response.content[0] as any).text);
      expect(result.success).toBe(true);
      expect(result.message).toContain('No DerivedData found');
    });
  });

  describe('Clean Test Results', () => {
    test('should clean only test results', async () => {
      createBuildArtifacts();
      const testResultsPath = join(derivedDataPaths.default, 'Logs', 'Test');
      const buildPath = join(derivedDataPaths.default, 'Build');
      
      expect(existsSync(testResultsPath)).toBe(true);
      expect(existsSync(buildPath)).toBe(true);
      
      const response = await client.request({
        method: 'tools/call',
        params: {
          name: 'clean_build',
          arguments: {
            cleanTarget: 'testResults',
            derivedDataPath: derivedDataPaths.default
          }
        }
      }, CallToolResultSchema);
      
      expect(response).toBeDefined();
      const result = JSON.parse((response.content[0] as any).text);
      expect(result.success).toBe(true);
      expect(result.message).toContain('Cleared test results');
      
      // Test results should be removed
      expect(existsSync(testResultsPath)).toBe(false);
      // Build artifacts should remain
      expect(existsSync(buildPath)).toBe(true);
    });

    test('should handle missing test results directory', async () => {
      // Create DerivedData without test results
      mkdirSync(join(derivedDataPaths.default, 'Build'), { recursive: true });
      
      const response = await client.request({
        method: 'tools/call',
        params: {
          name: 'clean_build',
          arguments: {
            cleanTarget: 'testResults',
            derivedDataPath: derivedDataPaths.default
          }
        }
      }, CallToolResultSchema);
      
      expect(response).toBeDefined();
      const result = JSON.parse((response.content[0] as any).text);
      expect(result.success).toBe(true);
      // Should handle gracefully
    });
  });

  describe('Clean All', () => {
    test('should clean everything with all target', async () => {
      createBuildArtifacts();
      
      const response = await client.request({
        method: 'tools/call',
        params: {
          name: 'clean_build',
          arguments: {
            projectPath: join(xcodeProjectDir, 'TestApp.xcodeproj'),
            scheme: 'TestApp',
            cleanTarget: 'all',
            derivedDataPath: derivedDataPaths.default
          }
        }
      }, CallToolResultSchema);
      
      expect(response).toBeDefined();
      const result = JSON.parse((response.content[0] as any).text);
      expect(result.success).toBe(true);
      
      // Everything should be cleaned
      expect(existsSync(derivedDataPaths.default)).toBe(false);
    });

    test('should clean all without project path', async () => {
      createBuildArtifacts();
      
      const response = await client.request({
        method: 'tools/call',
        params: {
          name: 'clean_build',
          arguments: {
            cleanTarget: 'all',
            derivedDataPath: derivedDataPaths.default
          }
        }
      }, CallToolResultSchema);
      
      expect(response).toBeDefined();
      const result = JSON.parse((response.content[0] as any).text);
      // Should clean DerivedData at least
      expect(result.success).toBe(true);
      expect(existsSync(derivedDataPaths.default)).toBe(false);
    });
  });

  describe('Swift Package Cleaning', () => {
    test('should clean Swift package .build directory', async () => {
      const buildDir = join(swiftPackageDir, '.build');
      mkdirSync(join(buildDir, 'debug'), { recursive: true });
      writeFileSync(join(buildDir, 'debug', 'module.swiftmodule'), 'module');
      
      const response = await client.request({
        method: 'tools/call',
        params: {
          name: 'clean_build',
          arguments: {
            projectPath: join(swiftPackageDir, 'Package.swift'),
            scheme: 'TestPackage',
            cleanTarget: 'build'
          }
        }
      }, CallToolResultSchema);
      
      expect(response).toBeDefined();
      const result = JSON.parse((response.content[0] as any).text);
      // Should clean or report status
      expect(result).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    test('should require project path for build clean', async () => {
      const response = await client.request({
        method: 'tools/call',
        params: {
          name: 'clean_build',
          arguments: {
            cleanTarget: 'build'
            // No projectPath provided
          }
        }
      }, CallToolResultSchema);
      
      expect(response).toBeDefined();
      const result = JSON.parse((response.content[0] as any).text);
      expect(result.success).toBe(false);
      expect(result.message).toContain('Project path required');
    });

    test('should handle invalid project path', async () => {
      const response = await client.request({
        method: 'tools/call',
        params: {
          name: 'clean_build',
          arguments: {
            projectPath: '/non/existent/project.xcodeproj',
            scheme: 'NonExistent',
            cleanTarget: 'build'
          }
        }
      }, CallToolResultSchema);
      
      expect(response).toBeDefined();
      const result = JSON.parse((response.content[0] as any).text);
      // Should handle gracefully
      expect(result).toBeDefined();
    });

    test('should handle permission errors gracefully', async () => {
      // Create a directory with restricted permissions
      const restrictedDir = join(testProjectDir, 'RestrictedDerivedData');
      mkdirSync(restrictedDir, { recursive: true });
      writeFileSync(join(restrictedDir, 'file'), 'data');
      
      // Make it read-only
      try {
        execSync(`chmod 444 "${restrictedDir}/file"`, { stdio: 'ignore' });
        execSync(`chmod 555 "${restrictedDir}"`, { stdio: 'ignore' });
      } catch {
        // Skip on systems where chmod doesn't work as expected
      }
      
      const response = await client.request({
        method: 'tools/call',
        params: {
          name: 'clean_build',
          arguments: {
            cleanTarget: 'derivedData',
            derivedDataPath: restrictedDir
          }
        }
      }, CallToolResultSchema);
      
      expect(response).toBeDefined();
      const result = JSON.parse((response.content[0] as any).text);
      // Should handle permission error gracefully
      expect(result).toBeDefined();
      
      // Clean up with force
      try {
        execSync(`chmod -R 755 "${restrictedDir}"`, { stdio: 'ignore' });
        rmSync(restrictedDir, { recursive: true, force: true });
      } catch {
        // Ignore cleanup errors
      }
    });

    test('should continue cleaning even if xcodebuild clean fails', async () => {
      createBuildArtifacts();
      
      // Use invalid scheme to make xcodebuild fail
      const response = await client.request({
        method: 'tools/call',
        params: {
          name: 'clean_build',
          arguments: {
            projectPath: join(xcodeProjectDir, 'TestApp.xcodeproj'),
            scheme: 'NonExistentScheme',
            cleanTarget: 'all',
            derivedDataPath: derivedDataPaths.default
          }
        }
      }, CallToolResultSchema);
      
      expect(response).toBeDefined();
      const result = JSON.parse((response.content[0] as any).text);
      // Should still clean DerivedData even if xcodebuild fails
      expect(result.success).toBe(true);
      expect(existsSync(derivedDataPaths.default)).toBe(false);
    });
  });

  describe('Platform-specific Cleaning', () => {
    test('should clean iOS platform artifacts', async () => {
      const response = await client.request({
        method: 'tools/call',
        params: {
          name: 'clean_build',
          arguments: {
            projectPath: join(xcodeProjectDir, 'TestApp.xcodeproj'),
            scheme: 'TestApp',
            platform: 'iOS',
            cleanTarget: 'build'
          }
        }
      }, CallToolResultSchema);
      
      expect(response).toBeDefined();
      const result = JSON.parse((response.content[0] as any).text);
      expect(result).toBeDefined();
    });

    test('should clean macOS platform artifacts', async () => {
      const response = await client.request({
        method: 'tools/call',
        params: {
          name: 'clean_build',
          arguments: {
            projectPath: join(swiftPackageDir, 'Package.swift'),
            scheme: 'TestPackage',
            platform: 'macOS',
            cleanTarget: 'build'
          }
        }
      }, CallToolResultSchema);
      
      expect(response).toBeDefined();
      const result = JSON.parse((response.content[0] as any).text);
      expect(result).toBeDefined();
    });
  });

  describe('Configuration-specific Cleaning', () => {
    test('should clean Debug configuration', async () => {
      const response = await client.request({
        method: 'tools/call',
        params: {
          name: 'clean_build',
          arguments: {
            projectPath: join(xcodeProjectDir, 'TestApp.xcodeproj'),
            scheme: 'TestApp',
            configuration: 'Debug',
            cleanTarget: 'build'
          }
        }
      }, CallToolResultSchema);
      
      expect(response).toBeDefined();
      const result = JSON.parse((response.content[0] as any).text);
      expect(result).toBeDefined();
    });

    test('should clean Release configuration', async () => {
      const response = await client.request({
        method: 'tools/call',
        params: {
          name: 'clean_build',
          arguments: {
            projectPath: join(xcodeProjectDir, 'TestApp.xcodeproj'),
            scheme: 'TestApp',
            configuration: 'Release',
            cleanTarget: 'build'
          }
        }
      }, CallToolResultSchema);
      
      expect(response).toBeDefined();
      const result = JSON.parse((response.content[0] as any).text);
      expect(result).toBeDefined();
    });
  });

  describe('Concurrent Cleaning', () => {
    test('should handle concurrent clean requests', async () => {
      createBuildArtifacts();
      
      // Run multiple clean operations in parallel
      const cleanOps = Promise.all([
        client.request({
          method: 'tools/call',
          params: {
            name: 'clean_build',
            arguments: {
              cleanTarget: 'testResults',
              derivedDataPath: derivedDataPaths.default
            }
          }
        }, CallToolResultSchema),
        
        client.request({
          method: 'tools/call',
          params: {
            name: 'clean_build',
            arguments: {
              projectPath: join(swiftPackageDir, 'Package.swift'),
              scheme: 'TestPackage',
              cleanTarget: 'build'
            }
          }
        }, CallToolResultSchema)
      ]);
      
      const results = await cleanOps;
      
      expect(results).toHaveLength(2);
      results.forEach(response => {
        expect(response).toBeDefined();
        const result = JSON.parse((response.content[0] as any).text);
        expect(result.success).toBeDefined();
      });
    });
  });

  describe('Cleanup Verification', () => {
    test('should verify artifacts are removed', async () => {
      createBuildArtifacts();
      
      // Clean everything
      await client.request({
        method: 'tools/call',
        params: {
          name: 'clean_build',
          arguments: {
            cleanTarget: 'all',
            derivedDataPath: derivedDataPaths.default
          }
        }
      }, CallToolResultSchema);
      
      // Verify all artifacts are gone
      expect(existsSync(derivedDataPaths.default)).toBe(false);
      expect(existsSync(join(derivedDataPaths.default, 'Build'))).toBe(false);
      expect(existsSync(join(derivedDataPaths.default, 'Logs', 'Test'))).toBe(false);
    });

    test('should not affect unrelated directories', async () => {
      // Create an unrelated directory
      const unrelatedDir = join(testProjectDir, 'UnrelatedDir');
      mkdirSync(unrelatedDir, { recursive: true });
      writeFileSync(join(unrelatedDir, 'important.txt'), 'important data');
      
      // Clean DerivedData
      await client.request({
        method: 'tools/call',
        params: {
          name: 'clean_build',
          arguments: {
            cleanTarget: 'derivedData',
            derivedDataPath: derivedDataPaths.default
          }
        }
      }, CallToolResultSchema);
      
      // Unrelated directory should still exist
      expect(existsSync(unrelatedDir)).toBe(true);
      expect(existsSync(join(unrelatedDir, 'important.txt'))).toBe(true);
      
      // Clean up
      rmSync(unrelatedDir, { recursive: true });
    });

    test('should provide clear success/failure messages', async () => {
      createBuildArtifacts();
      
      const response = await client.request({
        method: 'tools/call',
        params: {
          name: 'clean_build',
          arguments: {
            cleanTarget: 'derivedData',
            derivedDataPath: derivedDataPaths.default
          }
        }
      }, CallToolResultSchema);
      
      expect(response).toBeDefined();
      const result = JSON.parse((response.content[0] as any).text);
      expect(result.success).toBe(true);
      expect(result.message).toBeDefined();
      expect(result.message.length).toBeGreaterThan(0);
    });
  });
});