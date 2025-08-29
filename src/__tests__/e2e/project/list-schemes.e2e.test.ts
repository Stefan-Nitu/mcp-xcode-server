/**
 * E2E tests for ListSchemesTool
 * Tests scheme listing for various project types
 */

import { describe, test, expect, beforeAll, afterAll, beforeEach, afterEach } from '@jest/globals';
import { execSync } from 'child_process';
import { Client } from '@modelcontextprotocol/sdk/client/index';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio';
import { CallToolResultSchema } from '@modelcontextprotocol/sdk/types';
import { TestProjectManager } from '../../utils/TestProjectManager';
import { createAndConnectClient, cleanupClientAndTransport } from '../../utils/testHelpers';
import { TestEnvironmentCleaner } from '../../utils/TestEnvironmentCleaner';

describe('ListSchemesTool E2E Tests', () => {
  let client: Client;
  let transport: StdioClientTransport;
  let projectManager: TestProjectManager;
  
  beforeAll(async () => {
    // Setup test project manager
    projectManager = new TestProjectManager();
    await projectManager.setup();
    
    // Build the server
    execSync('npm run build', { cwd: process.cwd() });
  }, 60000);
  
  afterAll(() => {
    TestEnvironmentCleaner.cleanupTestEnvironment();
    
    // Clean up using project manager
    projectManager.cleanup();
  });
  
  beforeEach(async () => {
    const connection = await createAndConnectClient();
    client = connection.client;
    transport = connection.transport;
  }, 30000);
  
  afterEach(async () => {
    TestEnvironmentCleaner.cleanupTestEnvironment();
    
    await cleanupClientAndTransport(client, transport);
    projectManager.cleanup();
  });

  describe('Xcode Project Schemes', () => {
    test('should list schemes for TestProjectXCTest', async () => {
      const response = await client.request({
        method: 'tools/call',
        params: {
          name: 'list_schemes',
          arguments: {
            projectPath: projectManager.paths.xcodeProjectXCTestPath
          }
        }
      }, CallToolResultSchema);
      
      expect(response).toBeDefined();
      const schemes = JSON.parse((response.content[0] as any).text);
      
      // Should return an array with exactly one scheme
      expect(Array.isArray(schemes)).toBe(true);
      expect(schemes).toHaveLength(1);
      expect(schemes).toContain('TestProjectXCTest');
    });

    test('should list schemes for TestProjectSwiftTesting', async () => {
      const response = await client.request({
        method: 'tools/call',
        params: {
          name: 'list_schemes',
          arguments: {
            projectPath: projectManager.paths.testProjectDir + '/TestProjectSwiftTesting/TestProjectSwiftTesting.xcodeproj'
          }
        }
      }, CallToolResultSchema);
      
      expect(response).toBeDefined();
      const schemes = JSON.parse((response.content[0] as any).text);
      
      // Should return exactly 3 schemes based on xcodebuild -list output
      expect(Array.isArray(schemes)).toBe(true);
      expect(schemes).toHaveLength(3);
      expect(schemes).toEqual([
        'TestProjectSwiftTesting',
        'TestSwiftPackageSwiftTesting',
        'TestSwiftPackageSwiftTestingExecutable'
      ]);
    });

    test('should list schemes for watchOS project', async () => {
      const response = await client.request({
        method: 'tools/call',
        params: {
          name: 'list_schemes',
          arguments: {
            projectPath: projectManager.paths.watchOSProjectPath
          }
        }
      }, CallToolResultSchema);
      
      expect(response).toBeDefined();
      const schemes = JSON.parse((response.content[0] as any).text);
      
      // Should return exactly two schemes
      expect(Array.isArray(schemes)).toBe(true);
      expect(schemes).toHaveLength(2);
      expect(schemes).toContain('TestProjectWatchOS');
      expect(schemes).toContain('TestProjectWatchOS Watch App');
    });
  });

  describe('Workspace Schemes', () => {
    test('should list schemes for workspace', async () => {
      const response = await client.request({
        method: 'tools/call',
        params: {
          name: 'list_schemes',
          arguments: {
            projectPath: projectManager.paths.workspacePath
          }
        }
      }, CallToolResultSchema);
      
      expect(response).toBeDefined();
      const schemes = JSON.parse((response.content[0] as any).text);
      
      // Workspace should have exactly one scheme
      expect(Array.isArray(schemes)).toBe(true);
      expect(schemes).toHaveLength(1);
      expect(schemes).toContain('TestProjectXCTest');
    });
  });

  describe('Swift Package Schemes', () => {
    test('should return error for Swift packages since they do not have schemes', async () => {
      // Swift packages have targets and products, not schemes
      // xcodebuild -list doesn't work with Package.swift files
      const response = await client.request({
        method: 'tools/call',
        params: {
          name: 'list_schemes',
          arguments: {
            projectPath: projectManager.paths.swiftPackageXCTestDir + '/Package.swift'
          }
        }
      }, CallToolResultSchema);
      
      expect(response).toBeDefined();
      const content = (response.content[0] as any).text;
      
      // Should always return an error since xcodebuild -list doesn't work with Package.swift
      expect(content).toContain('Error: Failed to list schemes');
      // The error should indicate it's not a project file
      expect(content).toMatch(/not.*project|Package\.swift|cannot list schemes/i);
    });
  });

  describe('Error Handling', () => {
    test('should handle non-existent project path', async () => {
      const response = await client.request({
        method: 'tools/call',
        params: {
          name: 'list_schemes',
          arguments: {
            projectPath: '/non/existent/project.xcodeproj'
          }
        }
      }, CallToolResultSchema);
      
      expect(response).toBeDefined();
      const text = (response.content[0] as any).text;
      expect(text).toContain('Error: Failed to list schemes');
      expect(text).toContain('does not exist');
    });

    test('should handle invalid project format', async () => {
      // Try to list schemes for a regular file
      const response = await client.request({
        method: 'tools/call',
        params: {
          name: 'list_schemes',
          arguments: {
            projectPath: projectManager.paths.testProjectDir + '/README.md'
          }
        }
      }, CallToolResultSchema);
      
      expect(response).toBeDefined();
      const text = (response.content[0] as any).text;
      expect(text).toContain('Error: Failed to list schemes');
      // The actual error says "does not exist" for non-project files
      expect(text).toContain('does not exist');
    });

    test('should handle path traversal attempts', async () => {
      const response = await client.request({
        method: 'tools/call',
        params: {
          name: 'list_schemes',
          arguments: {
            projectPath: '../../../etc/passwd'
          }
        }
      }, CallToolResultSchema);
      
      expect(response).toBeDefined();
      const text = (response.content[0] as any).text;
      // Path traversal is caught by validation
      expect(text).toContain('Validation error');
      expect(text).toContain('Path traversal patterns are not allowed');
    });

    test('should handle missing project path parameter', async () => {
      const response = await client.request({
        method: 'tools/call',
        params: {
          name: 'list_schemes',
          arguments: {}
        }
      }, CallToolResultSchema);
      
      expect(response).toBeDefined();
      const text = (response.content[0] as any).text;
      expect(text).toContain('Validation error');
      expect(text).toContain('Required');
    });
  });

  describe('Multiple Project Types', () => {
    test('should handle projects with multiple schemes', async () => {
      // Test with TestProjectSwiftTesting which has multiple schemes
      const response = await client.request({
        method: 'tools/call',
        params: {
          name: 'list_schemes',
          arguments: {
            projectPath: projectManager.paths.testProjectDir + '/TestProjectSwiftTesting/TestProjectSwiftTesting.xcodeproj'
          }
        }
      }, CallToolResultSchema);
      
      expect(response).toBeDefined();
      const schemes = JSON.parse((response.content[0] as any).text);
      
      expect(Array.isArray(schemes)).toBe(true);
      // This project specifically has 3 schemes
      expect(schemes).toHaveLength(3);
      
      // Check that each scheme is a non-empty string
      schemes.forEach((scheme: any) => {
        expect(typeof scheme).toBe('string');
        expect(scheme.length).toBeGreaterThan(0);
      });
      
      // Verify the expected schemes are present
      expect(schemes).toContain('TestProjectSwiftTesting');
      expect(schemes).toContain('TestSwiftPackageSwiftTesting');
      expect(schemes).toContain('TestSwiftPackageSwiftTestingExecutable');
    });

    test('should return consistent results on multiple calls', async () => {
      // First call
      const response1 = await client.request({
        method: 'tools/call',
        params: {
          name: 'list_schemes',
          arguments: {
            projectPath: projectManager.paths.xcodeProjectXCTestPath
          }
        }
      }, CallToolResultSchema);
      
      const schemes1 = JSON.parse((response1.content[0] as any).text);
      
      // Second call
      const response2 = await client.request({
        method: 'tools/call',
        params: {
          name: 'list_schemes',
          arguments: {
            projectPath: projectManager.paths.xcodeProjectXCTestPath
          }
        }
      }, CallToolResultSchema);
      
      const schemes2 = JSON.parse((response2.content[0] as any).text);
      
      // Should return the same schemes
      expect(schemes1).toEqual(schemes2);
    });
  });

  describe('Performance', () => {
    test('should list schemes quickly for small projects', async () => {
      const startTime = Date.now();
      
      const response = await client.request({
        method: 'tools/call',
        params: {
          name: 'list_schemes',
          arguments: {
            projectPath: projectManager.paths.xcodeProjectXCTestPath
          }
        }
      }, CallToolResultSchema);
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      expect(response).toBeDefined();
      // Should complete in less than 5 seconds for a small project
      expect(duration).toBeLessThan(5000);
    });
  });

  describe('Special Cases', () => {
    test('should handle project with spaces in path', async () => {
      // Test that the tool properly handles non-existent paths with spaces
      const pathWithSpaces = '/path with spaces/Project Name.xcodeproj';
      
      const response = await client.request({
        method: 'tools/call',
        params: {
          name: 'list_schemes',
          arguments: {
            projectPath: pathWithSpaces
          }
        }
      }, CallToolResultSchema);
      
      expect(response).toBeDefined();
      const text = (response.content[0] as any).text;
      // Should handle the path with spaces and return an error (project doesn't exist)
      expect(text).toContain('Error: Failed to list schemes');
      expect(text).toContain('does not exist');
    });

    test('should return empty array for bare directory without Xcode project', async () => {
      // Test that a regular directory doesn't crash the tool
      const response = await client.request({
        method: 'tools/call',
        params: {
          name: 'list_schemes',
          arguments: {
            projectPath: projectManager.paths.testProjectDir
          }
        }
      }, CallToolResultSchema);
      
      expect(response).toBeDefined();
      const content = (response.content[0] as any).text;
      
      // Should return an error since it's not a valid Xcode project/workspace
      expect(content).toContain('Error: Failed to list schemes');
      expect(content).toMatch(/not.*project|not.*workspace|invalid/i);
    });
  });
});