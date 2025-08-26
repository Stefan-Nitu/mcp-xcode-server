/**
 * E2E tests for CleanBuildTool
 * Tests cleaning actual build artifacts, DerivedData, and test results
 */

import { describe, test, expect, beforeAll, afterAll, beforeEach, afterEach } from '@jest/globals';
import { existsSync, rmSync } from 'fs';
import { join } from 'path';
import { execSync } from 'child_process';
import { Client } from '@modelcontextprotocol/sdk/client/index';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio';
import { CallToolResultSchema } from '@modelcontextprotocol/sdk/types';
import { TestProjectManager } from '../utils/TestProjectManager';
import { cleanupClientAndTransport, createAndConnectClient } from '../utils/testHelpers';
import { TestEnvironmentCleaner } from '../utils/TestEnvironmentCleaner';
import { config } from '../../config';

describe('CleanBuildTool E2E Tests', () => {
  let client: Client;
  let transport: StdioClientTransport;
  let testProjectManager: TestProjectManager;
  
  let derivedDataPath: string;
  
  beforeAll(async () => {
    testProjectManager = new TestProjectManager();
    await testProjectManager.setup();
    execSync('npm run build', { cwd: process.cwd() });
  }, 120000);

  beforeEach(async () => {
    const result = await createAndConnectClient();
    client = result.client;
    transport = result.transport;
    
    // Set the correct DerivedData path based on the project being tested
    derivedDataPath = config.getDerivedDataPath(testProjectManager.paths.xcodeProjectXCTestPath);
  });

  afterEach(async () => {
    TestEnvironmentCleaner.cleanupTestEnvironment();
    
    await cleanupClientAndTransport(client, transport);
    testProjectManager.cleanup();
    
    // Ensure DerivedData is cleaned up after each test
    if (existsSync(derivedDataPath)) {
      rmSync(derivedDataPath, { recursive: true, force: true });
    }
  });

  afterAll(() => {
    TestEnvironmentCleaner.cleanupTestEnvironment();
    
    // Final cleanup
    if (existsSync(derivedDataPath)) {
      rmSync(derivedDataPath, { recursive: true, force: true });
    }
  });

  describe('Clean Build Target', () => {
    test('should clean build folder after actual build', async () => {
      // First, build the project to create real build artifacts
      const buildResponse = await client.request({
        method: 'tools/call',
        params: {
          name: 'build_xcode',
          arguments: {
            projectPath: testProjectManager.paths.xcodeProjectXCTestPath,
            scheme: testProjectManager.schemes.xcodeProject,
            platform: 'iOS',
            configuration: 'Debug'
          }
        }
      }, CallToolResultSchema, { timeout: 180000 });
      
      const buildText = (buildResponse.content[0] as any).text;
      expect(buildText).toContain('Build succeeded');
      
      // Verify DerivedData was created
      expect(existsSync(derivedDataPath)).toBe(true);
      
      // Now clean the build folder
      const cleanResponse = await client.request({
        method: 'tools/call',
        params: {
          name: 'clean_build',
          arguments: {
            projectPath: testProjectManager.paths.xcodeProjectXCTestPath,
            scheme: testProjectManager.schemes.xcodeProject,
            platform: 'iOS',
            configuration: 'Debug',
            cleanTarget: 'build'
          }
        }
      }, CallToolResultSchema);
      
      const cleanResult = JSON.parse((cleanResponse.content[0] as any).text);
      expect(cleanResult.success).toBe(true);
      expect(cleanResult.message).toContain('Cleaned build folder');
      
      // DerivedData should still exist (only build was cleaned)
      expect(existsSync(derivedDataPath)).toBe(true);
    }, 60000);

    test('should clean workspace build', async () => {
      const response = await client.request({
        method: 'tools/call',
        params: {
          name: 'clean_build',
          arguments: {
            projectPath: testProjectManager.paths.workspacePath,
            scheme: testProjectManager.schemes.workspace,
            cleanTarget: 'build'
          }
        }
      }, CallToolResultSchema);
      
      const result = JSON.parse((response.content[0] as any).text);
      expect(result.success).toBe(true);
      // Should either clean or handle gracefully if no build exists
      expect(result.message).toBeDefined();
    });

    test('should fail when project path not provided for build clean', async () => {
      const response = await client.request({
        method: 'tools/call',
        params: {
          name: 'clean_build',
          arguments: {
            cleanTarget: 'build'
            // No projectPath
          }
        }
      }, CallToolResultSchema);
      
      const result = JSON.parse((response.content[0] as any).text);
      expect(result.success).toBe(false);
      expect(result.message).toContain('Project path required');
    });
  });

  describe('Clean DerivedData', () => {
    test('should remove DerivedData after actual build', async () => {
      // Build first to create DerivedData
      const buildResponse = await client.request({
        method: 'tools/call',
        params: {
          name: 'build_xcode',
          arguments: {
            projectPath: testProjectManager.paths.xcodeProjectXCTestPath,
            scheme: testProjectManager.schemes.xcodeProject,
            platform: 'iOS'
          }
        }
      }, CallToolResultSchema, { timeout: 180000 });
      
      const buildText = (buildResponse.content[0] as any).text;
      expect(buildText).toContain('Build succeeded');
      expect(existsSync(derivedDataPath)).toBe(true);
      
      // Clean DerivedData
      const cleanResponse = await client.request({
        method: 'tools/call',
        params: {
          name: 'clean_build',
          arguments: {
            cleanTarget: 'derivedData',
            derivedDataPath: derivedDataPath
          }
        }
      }, CallToolResultSchema);
      
      const result = JSON.parse((cleanResponse.content[0] as any).text);
      expect(result.success).toBe(true);
      expect(result.message).toContain('Removed DerivedData');
      
      // DerivedData should be gone
      expect(existsSync(derivedDataPath)).toBe(false);
    }, 60000);

    test('should handle non-existent DerivedData gracefully', async () => {
      // Ensure DerivedData doesn't exist
      if (existsSync(derivedDataPath)) {
        rmSync(derivedDataPath, { recursive: true });
      }
      
      const response = await client.request({
        method: 'tools/call',
        params: {
          name: 'clean_build',
          arguments: {
            cleanTarget: 'derivedData',
            derivedDataPath: derivedDataPath
          }
        }
      }, CallToolResultSchema);
      
      const result = JSON.parse((response.content[0] as any).text);
      expect(result.success).toBe(true);
      expect(result.message).toContain('No DerivedData found');
    });
  });

  describe('Clean Test Results', () => {
    test('should clean only test results after running tests', async () => {
      // Run tests first to create test results
      const testResponse = await client.request({
        method: 'tools/call',
        params: {
          name: 'test_xcode',
          arguments: {
            projectPath: testProjectManager.paths.xcodeProjectXCTestPath,
            scheme: testProjectManager.schemes.xcodeProject,
            platform: 'iOS'
          }
        }
      }, CallToolResultSchema, { timeout: 180000 });
      
      // Test might succeed or fail, but should create some results
      expect(testResponse).toBeDefined();
      
      // Check if DerivedData exists
      if (!existsSync(derivedDataPath)) {
        // No DerivedData means no test results to clean
        const cleanResponse = await client.request({
          method: 'tools/call',
          params: {
            name: 'clean_build',
            arguments: {
              cleanTarget: 'testResults',
              derivedDataPath: derivedDataPath
            }
          }
        }, CallToolResultSchema);
        
        const result = JSON.parse((cleanResponse.content[0] as any).text);
        expect(result.success).toBe(true);
        expect(result.message).toMatch(/No DerivedData found|No test results/);
        return;
      }
      
      // Check if test results exist
      const testPath = join(derivedDataPath, 'Logs', 'Test');
      const hadTestResults = existsSync(testPath);
      
      // Clean test results only
      const cleanResponse = await client.request({
        method: 'tools/call',
        params: {
          name: 'clean_build',
          arguments: {
            cleanTarget: 'testResults',
            derivedDataPath: derivedDataPath
          }
        }
      }, CallToolResultSchema);
      
      const result = JSON.parse((cleanResponse.content[0] as any).text);
      expect(result.success).toBe(true);
      
      if (hadTestResults) {
        expect(result.message).toContain('Cleared test results');
        // Test results should be gone
        expect(existsSync(testPath)).toBe(false);
        // But DerivedData should still exist
        expect(existsSync(derivedDataPath)).toBe(true);
      } else {
        expect(result.message).toContain('No test results to clear');
      }
    }, 120000);
  });

  describe('Clean All', () => {
    test('should clean everything after build', async () => {
      // Build first
      const buildResponse = await client.request({
        method: 'tools/call',
        params: {
          name: 'build_xcode',
          arguments: {
            projectPath: testProjectManager.paths.xcodeProjectXCTestPath,
            scheme: testProjectManager.schemes.xcodeProject,
            platform: 'iOS'
          }
        }
      }, CallToolResultSchema, { timeout: 180000 });
      
      const buildText = (buildResponse.content[0] as any).text;
      expect(buildText).toContain('Build succeeded');
      expect(existsSync(derivedDataPath)).toBe(true);
      
      // Clean everything
      const cleanResponse = await client.request({
        method: 'tools/call',
        params: {
          name: 'clean_build',
          arguments: {
            projectPath: testProjectManager.paths.xcodeProjectXCTestPath,
            scheme: testProjectManager.schemes.xcodeProject,
            cleanTarget: 'all',
            derivedDataPath: derivedDataPath
          }
        }
      }, CallToolResultSchema);
      
      const result = JSON.parse((cleanResponse.content[0] as any).text);
      expect(result.success).toBe(true);
      expect(result.message).toContain('Cleaned build folder');
      expect(result.message).toContain('Removed DerivedData');
      
      // Everything should be cleaned
      expect(existsSync(derivedDataPath)).toBe(false);
    }, 60000);

    test('should clean DerivedData even if xcodebuild clean fails', async () => {
      // Build first to create DerivedData
      await client.request({
        method: 'tools/call',
        params: {
          name: 'build_xcode',
          arguments: {
            projectPath: testProjectManager.paths.xcodeProjectXCTestPath,
            scheme: testProjectManager.schemes.xcodeProject,
            platform: 'iOS'
          }
        }
      }, CallToolResultSchema);
      
      expect(existsSync(derivedDataPath)).toBe(true);
      
      // Use invalid scheme to make xcodebuild fail, but still clean DerivedData
      const cleanResponse = await client.request({
        method: 'tools/call',
        params: {
          name: 'clean_build',
          arguments: {
            projectPath: testProjectManager.paths.xcodeProjectXCTestPath,
            scheme: 'NonExistentScheme',
            cleanTarget: 'all',
            derivedDataPath: derivedDataPath
          }
        }
      }, CallToolResultSchema);
      
      const result = JSON.parse((cleanResponse.content[0] as any).text);
      expect(result.success).toBe(true);
      
      // Should mention warning about build clean but still clean DerivedData
      expect(result.message).toMatch(/Warning.*Could not clean build folder|Removed DerivedData/);
      expect(existsSync(derivedDataPath)).toBe(false);
    }, 60000);
  });

  describe('Swift Package Cleaning', () => {
    test('should clean Swift package .build directory', async () => {
      // First build the Swift package
      const buildResponse = await client.request({
        method: 'tools/call',
        params: {
          name: 'build_swift_package',
          arguments: {
            packagePath: join(testProjectManager.paths.swiftPackageXCTestDir, 'Package.swift')
          }
        }
      }, CallToolResultSchema);
      
      const buildText = (buildResponse.content[0] as any).text;
      expect(buildText).toContain('Build succeeded');
      
      // SPM with swift build creates .build directory
      const buildDir = join(testProjectManager.paths.swiftPackageXCTestDir, '.build');
      expect(existsSync(buildDir)).toBe(true);
      
      // Clean the .build directory using the clean-build tool
      const cleanResponse = await client.request({
        method: 'tools/call',
        params: {
          name: 'clean_build',
          arguments: {
            projectPath: join(testProjectManager.paths.swiftPackageXCTestDir, 'Package.swift'),
            cleanTarget: 'build'
          }
        }
      }, CallToolResultSchema);
      
      const result = JSON.parse((cleanResponse.content[0] as any).text);
      expect(result.success).toBe(true);
      expect(result.message).toContain('Removed .build directory');
      
      // Verify .build directory is gone
      expect(existsSync(buildDir)).toBe(false);
    }, 60000);
  });

  describe('Platform and Configuration Specific Cleaning', () => {
    test('should clean specific configuration', async () => {
      // Build with Release configuration
      await client.request({
        method: 'tools/call',
        params: {
          name: 'build_xcode',
          arguments: {
            projectPath: testProjectManager.paths.xcodeProjectXCTestPath,
            scheme: testProjectManager.schemes.xcodeProject,
            platform: 'iOS',
            configuration: 'Release'
          }
        }
      }, CallToolResultSchema, { timeout: 180000 });
      
      // Clean Release configuration
      const cleanResponse = await client.request({
        method: 'tools/call',
        params: {
          name: 'clean_build',
          arguments: {
            projectPath: testProjectManager.paths.xcodeProjectXCTestPath,
            scheme: testProjectManager.schemes.xcodeProject,
            platform: 'iOS',
            configuration: 'Release',
            cleanTarget: 'build'
          }
        }
      }, CallToolResultSchema);
      
      const result = JSON.parse((cleanResponse.content[0] as any).text);
      expect(result.success).toBe(true);
      expect(result.message).toContain('Cleaned build folder');
    }, 60000);
  });
});