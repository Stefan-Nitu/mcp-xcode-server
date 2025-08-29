/**
 * Unit tests for ListSchemesTool
 * Tests behavior with mocked dependencies
 */

import { describe, test, expect, beforeEach, jest } from '@jest/globals';

// Create mock exec function that accepts options
const mockExecAsync = jest.fn<(cmd: string, options?: any) => Promise<{ stdout: string; stderr: string }>>();

// Mock the modules before importing the tool
jest.mock('../../logger.js', () => ({
  createModuleLogger: jest.fn(() => ({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
  }))
}));

jest.mock('util', () => ({
  promisify: jest.fn(() => mockExecAsync)
}));

// Import after mocking
import { ListSchemesTool } from '../../tools/ListSchemesTool.js';

describe('ListSchemesTool Unit Tests', () => {
  let tool: ListSchemesTool;
  
  beforeEach(() => {
    jest.clearAllMocks();
    tool = new ListSchemesTool();
  });

  describe('getToolDefinition', () => {
    test('should return correct tool definition', () => {
      const definition = tool.getToolDefinition();
      
      expect(definition.name).toBe('list_schemes');
      expect(definition.description).toContain('List all available schemes');
      expect(definition.inputSchema.required).toContain('projectPath');
    });
  });

  describe('execute - validation behavior', () => {
    test('should reject missing projectPath', async () => {
      await expect(tool.execute({}))
        .rejects
        .toThrow('Required');
    });

    test('should reject path traversal attempts', async () => {
      await expect(tool.execute({ projectPath: '../../../etc/passwd' }))
        .rejects
        .toThrow('Path traversal patterns are not allowed');
    });

    test('should reject null injection attempts', async () => {
      // Null bytes will cause execAsync to reject when actually executed
      mockExecAsync.mockRejectedValue(new Error('Path contains null bytes'));
      
      const result = await tool.execute({ projectPath: '/path/to/project\0.xcodeproj' });
      expect(result.content[0].text).toContain('Error: Failed to list schemes');
      expect(result.content[0].text).toContain('null');
    });

    test('should reject command injection attempts', async () => {
      await expect(tool.execute({ projectPath: '/path/to/project$(rm -rf /).xcodeproj' }))
        .rejects
        .toThrow('Command injection patterns are not allowed');
    });

    test('should reject paths with semicolons', async () => {
      await expect(tool.execute({ projectPath: '/path/to/project;ls.xcodeproj' }))
        .rejects
        .toThrow('Command injection patterns are not allowed');
    });
  });

  describe('execute - xcodebuild behavior', () => {
    test('should handle workspace projects correctly', async () => {
      const mockOutput = `Information about workspace "TestWorkspace":
    Schemes:
        WorkspaceScheme1
        WorkspaceScheme2`;
      
      mockExecAsync.mockResolvedValue({ stdout: mockOutput, stderr: '' });

      const result = await tool.execute({ 
        projectPath: '/path/to/project.xcworkspace' 
      });

      // Verify correct command was used
      expect(mockExecAsync).toHaveBeenCalledWith(
        expect.stringContaining('-workspace "/path/to/project.xcworkspace"'),
        { maxBuffer: 1024 * 1024 }
      );

      // Verify schemes were parsed correctly
      const schemes = JSON.parse(result.content[0].text);
      expect(schemes).toEqual(['WorkspaceScheme1', 'WorkspaceScheme2']);
    });

    test('should handle regular projects correctly', async () => {
      const mockOutput = `Information about project "TestProject":
    Targets:
        TestTarget
    Schemes:
        TestScheme1
        TestScheme2
        TestScheme3`;
      
      mockExecAsync.mockResolvedValue({ stdout: mockOutput, stderr: '' });

      const result = await tool.execute({ 
        projectPath: '/path/to/project.xcodeproj' 
      });

      // Verify correct command was used
      expect(mockExecAsync).toHaveBeenCalledWith(
        expect.stringContaining('-project "/path/to/project.xcodeproj"'),
        { maxBuffer: 1024 * 1024 }
      );

      // Verify schemes were parsed correctly
      const schemes = JSON.parse(result.content[0].text);
      expect(schemes).toEqual(['TestScheme1', 'TestScheme2', 'TestScheme3']);
    });

    test('should handle projects with no schemes', async () => {
      const mockOutput = `Information about project "TestProject":
    Targets:
        TestTarget
    Build Configurations:
        Debug
        Release`;
      
      mockExecAsync.mockResolvedValue({ stdout: mockOutput, stderr: '' });

      const result = await tool.execute({ 
        projectPath: '/path/to/project.xcodeproj' 
      });

      const schemes = JSON.parse(result.content[0].text);
      expect(schemes).toEqual([]);
    });

    test('should handle projects with single scheme', async () => {
      const mockOutput = `Information about project "TestProject":
    Schemes:
        SingleScheme`;
      
      mockExecAsync.mockResolvedValue({ stdout: mockOutput, stderr: '' });

      const result = await tool.execute({ 
        projectPath: '/path/to/project.xcodeproj' 
      });

      const schemes = JSON.parse(result.content[0].text);
      expect(schemes).toEqual(['SingleScheme']);
    });

    test('should handle schemes with special characters', async () => {
      const mockOutput = `Information about project "TestProject":
    Schemes:
        My App (Dev)
        My-App-Staging
        My.App.Production`;
      
      mockExecAsync.mockResolvedValue({ stdout: mockOutput, stderr: '' });

      const result = await tool.execute({ 
        projectPath: '/path/to/project.xcodeproj' 
      });

      const schemes = JSON.parse(result.content[0].text);
      expect(schemes).toEqual([
        'My App (Dev)',
        'My-App-Staging', 
        'My.App.Production'
      ]);
    });
  });

  describe('execute - error handling behavior', () => {
    test('should handle non-existent project error', async () => {
      const error = new Error('The project file at \'/non/existent/project.xcodeproj\' does not exist.');
      mockExecAsync.mockRejectedValue(error);

      const result = await tool.execute({ 
        projectPath: '/non/existent/project.xcodeproj' 
      });

      expect(result.content[0].text).toContain('Error: Failed to list schemes');
      expect(result.content[0].text).toContain('does not exist');
    });

    test('should handle invalid project format error', async () => {
      const error = new Error('The file at \'/path/to/file.txt\' does not exist.');
      mockExecAsync.mockRejectedValue(error);

      const result = await tool.execute({ 
        projectPath: '/path/to/file.txt' 
      });

      expect(result.content[0].text).toContain('Error: Failed to list schemes');
      expect(result.content[0].text).toContain('does not exist');
    });

    test('should handle Package.swift error gracefully', async () => {
      const error = new Error('Could not open file at /path/to/Package.swift');
      mockExecAsync.mockRejectedValue(error);

      const result = await tool.execute({ 
        projectPath: '/path/to/Package.swift' 
      });

      expect(result.content[0].text).toContain('Error: Failed to list schemes');
      expect(result.content[0].text).toContain('Package.swift');
    });

    test('should handle xcodebuild not found error', async () => {
      const error = new Error('spawn xcodebuild ENOENT');
      (error as any).code = 'ENOENT';
      mockExecAsync.mockRejectedValue(error);

      const result = await tool.execute({ 
        projectPath: '/path/to/project.xcodeproj' 
      });

      expect(result.content[0].text).toContain('Error: Failed to list schemes');
      expect(result.content[0].text).toContain('ENOENT');
    });

    test('should handle permission denied error', async () => {
      const error = new Error('Permission denied');
      (error as any).code = 'EACCES';
      mockExecAsync.mockRejectedValue(error);

      const result = await tool.execute({ 
        projectPath: '/path/to/project.xcodeproj' 
      });

      expect(result.content[0].text).toContain('Error: Failed to list schemes');
      expect(result.content[0].text).toContain('Permission denied');
    });

    test('should handle generic xcodebuild error', async () => {
      const error = new Error('Unable to read project.');
      mockExecAsync.mockRejectedValue(error);

      const result = await tool.execute({ 
        projectPath: '/path/to/project.xcodeproj' 
      });

      expect(result.content[0].text).toContain('Error: Failed to list schemes');
      expect(result.content[0].text).toContain('Unable to read project');
    });
  });

  describe('execute - path handling behavior', () => {
    test('should handle paths with spaces correctly', async () => {
      const mockOutput = `Information about project "My Project":
    Schemes:
        MyScheme`;
      
      mockExecAsync.mockResolvedValue({ stdout: mockOutput, stderr: '' });

      const result = await tool.execute({ 
        projectPath: '/path with spaces/My Project.xcodeproj' 
      });

      // Verify path was properly quoted
      expect(mockExecAsync).toHaveBeenCalledWith(
        expect.stringContaining('"/path with spaces/My Project.xcodeproj"'),
        { maxBuffer: 1024 * 1024 }
      );

      const schemes = JSON.parse(result.content[0].text);
      expect(schemes).toEqual(['MyScheme']);
    });

    test('should handle paths with special characters in filenames', async () => {
      const mockOutput = `Information about project "My-Project_v2.0":
    Schemes:
        MyScheme`;
      
      mockExecAsync.mockResolvedValue({ stdout: mockOutput, stderr: '' });

      const result = await tool.execute({ 
        projectPath: '/path/to/My-Project_v2.0.xcodeproj' 
      });

      expect(mockExecAsync).toHaveBeenCalledWith(
        expect.stringContaining('"/path/to/My-Project_v2.0.xcodeproj"'),
        { maxBuffer: 1024 * 1024 }
      );

      const schemes = JSON.parse(result.content[0].text);
      expect(schemes).toEqual(['MyScheme']);
    });
  });
});