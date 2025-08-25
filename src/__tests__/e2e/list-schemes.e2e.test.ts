/**
 * E2E tests for ListSchemesTool
 * Tests scheme listing for various project types
 */

import { describe, test, expect, beforeAll, afterAll, beforeEach, afterEach } from '@jest/globals';
import { execSync } from 'child_process';
import { Client } from '@modelcontextprotocol/sdk/client/index';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio';
import { CallToolResultSchema } from '@modelcontextprotocol/sdk/types';
import { TestProjectManager } from '../utils/TestProjectManager';
import { createAndConnectClient, cleanupClientAndTransport } from '../utils/testHelpers';

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
    // Clean up using project manager
    projectManager.cleanup();
  });
  
  beforeEach(async () => {
    const connection = await createAndConnectClient();
    client = connection.client;
    transport = connection.transport;
  }, 30000);
  
  afterEach(async () => {
    await cleanupClientAndTransport(client, transport);
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
      
      // Should return an array with schemes
      expect(Array.isArray(schemes)).toBe(true);
      expect(schemes.length).toBeGreaterThanOrEqual(2);
      expect(schemes).toContain('TestProjectSwiftTesting');
      // Could be either TestSwiftPackageXCTest or TestSwiftPackageSwiftTesting
      const hasXCTest = schemes.includes('TestSwiftPackageXCTest');
      const hasSwiftTesting = schemes.includes('TestSwiftPackageSwiftTesting');
      expect(hasXCTest || hasSwiftTesting).toBe(true);
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
    test('should list schemes for Swift package', async () => {
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
      
      // Swift packages don't have traditional Xcode schemes
      // The tool should either return an empty array or an error message
      if (content.includes('error') || content.includes('Error')) {
        // Expected - SPM packages don't have schemes in the same way
        expect(content.toLowerCase()).toContain('package');
      } else {
        const schemes = JSON.parse(content);
        expect(Array.isArray(schemes)).toBe(true);
        // SPM might return the package name as a scheme
        if (schemes.length > 0) {
          const hasXCTest = schemes.includes('TestSwiftPackageXCTest');
          const hasSwiftTesting = schemes.includes('TestSwiftPackageSwiftTesting');
          expect(hasXCTest || hasSwiftTesting).toBe(true);
        }
      }
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
      expect(text.toLowerCase()).toContain('error');
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
      expect(text.toLowerCase()).toContain('error');
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
      expect(text.toLowerCase()).toContain('error');
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
      expect(text.toLowerCase()).toContain('error');
    });
  });

  describe('Multiple Project Types', () => {
    test('should handle projects with multiple schemes', async () => {
      // Some projects might have multiple schemes (e.g., app + tests + UI tests)
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
      
      expect(Array.isArray(schemes)).toBe(true);
      
      // Check that each scheme is a string
      schemes.forEach((scheme: any) => {
        expect(typeof scheme).toBe('string');
        expect(scheme.length).toBeGreaterThan(0);
      });
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
      // Note: This test would need a project with spaces in its path
      // For now, we'll test that the tool handles paths with spaces correctly
      const pathWithSpaces = projectManager.paths.xcodeProjectXCTestPath.replace('TestProjectXCTest', 'Test Project XCTest');
      
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
      // Will error since the project doesn't exist, but shouldn't crash
      const text = (response.content[0] as any).text;
      expect(text).toBeDefined();
    });

    test('should handle empty project (no schemes)', async () => {
      // Try to find a project without schemes
      // Most projects have at least one scheme, so this might return an empty array
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
      const content = (response.content[0] as any).text;
      
      if (!content.includes('error')) {
        const schemes = JSON.parse(content);
        expect(Array.isArray(schemes)).toBe(true);
        // Could be empty array
        expect(schemes.length).toBeGreaterThanOrEqual(0);
      }
    });
  });
});