import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { ProjectPath } from '../../../../domain/value-objects/ProjectPath.js';
import { existsSync } from 'fs';

// Mock fs module
jest.mock('fs', () => ({
  existsSync: jest.fn<(path: string) => boolean>()
}));
const mockExistsSync = existsSync as jest.MockedFunction<typeof existsSync>;

describe('ProjectPath', () => {
  // Reset mocks between tests for isolation
  beforeEach(() => {
    jest.clearAllMocks();
  });
  
  afterEach(() => {
    jest.restoreAllMocks();
  });
  
  describe('when creating a project path', () => {
    it('should accept valid .xcodeproj path that exists', () => {
      // Setup - all visible in test
      const projectPath = '/Users/dev/MyApp.xcodeproj';
      mockExistsSync.mockReturnValue(true);
      
      // Act
      const result = ProjectPath.create(projectPath);
      
      // Assert
      expect(result.toString()).toBe(projectPath);
      expect(mockExistsSync).toHaveBeenCalledWith(projectPath);
    });
    
    it('should accept valid .xcworkspace path that exists', () => {
      const workspacePath = '/Users/dev/MyApp.xcworkspace';
      mockExistsSync.mockReturnValue(true);
      
      const result = ProjectPath.create(workspacePath);
      
      expect(result.toString()).toBe(workspacePath);
      expect(mockExistsSync).toHaveBeenCalledWith(workspacePath);
    });
    
    it('should accept paths with spaces', () => {
      const pathWithSpaces = '/Users/dev/My Cool App.xcodeproj';
      mockExistsSync.mockReturnValue(true);
      
      const result = ProjectPath.create(pathWithSpaces);
      
      expect(result.toString()).toBe(pathWithSpaces);
    });
    
    it('should accept paths with special characters', () => {
      const specialPath = '/Users/dev/App-2024_v1.0.xcworkspace';
      mockExistsSync.mockReturnValue(true);
      
      const result = ProjectPath.create(specialPath);
      
      expect(result.toString()).toBe(specialPath);
    });
  });
  
  describe('when validating input', () => {
    it('should reject empty path', () => {
      expect(() => ProjectPath.create('')).toThrow('Project path cannot be empty');
      expect(mockExistsSync).not.toHaveBeenCalled();
    });
    
    it('should reject null path', () => {
      expect(() => ProjectPath.create(null as any))
        .toThrow('Project path cannot be empty');
      expect(mockExistsSync).not.toHaveBeenCalled();
    });
    
    it('should reject undefined path', () => {
      expect(() => ProjectPath.create(undefined as any))
        .toThrow('Project path cannot be empty');
      expect(mockExistsSync).not.toHaveBeenCalled();
    });
    
    it('should reject non-existent path', () => {
      const nonExistentPath = '/Users/dev/DoesNotExist.xcodeproj';
      mockExistsSync.mockReturnValue(false);
      
      expect(() => ProjectPath.create(nonExistentPath))
        .toThrow(`Project path does not exist: ${nonExistentPath}`);
      expect(mockExistsSync).toHaveBeenCalledWith(nonExistentPath);
    });
    
    it('should reject non-Xcode project files', () => {
      mockExistsSync.mockReturnValue(true);
      
      const invalidFiles = [
        '/Users/dev/MyApp.swift',
        '/Users/dev/MyApp.txt',
        '/Users/dev/MyApp.app',
        '/Users/dev/MyApp.framework',
        '/Users/dev/MyApp',  // No extension
        '/Users/dev/MyApp.xcode',  // Wrong extension
      ];
      
      invalidFiles.forEach(file => {
        expect(() => ProjectPath.create(file))
          .toThrow('Path must be an .xcodeproj or .xcworkspace file');
      });
    });
    
    it('should reject directories without proper extension', () => {
      const directory = '/Users/dev/MyProject';
      mockExistsSync.mockReturnValue(true);
      
      expect(() => ProjectPath.create(directory))
        .toThrow('Path must be an .xcodeproj or .xcworkspace file');
    });
  });
  
  describe('when getting project name', () => {
    it('should extract name from .xcodeproj path', () => {
      const projectPath = '/Users/dev/MyAwesomeApp.xcodeproj';
      mockExistsSync.mockReturnValue(true);
      
      const result = ProjectPath.create(projectPath);
      
      expect(result.name).toBe('MyAwesomeApp');
    });
    
    it('should extract name from .xcworkspace path', () => {
      const workspacePath = '/Users/dev/CoolWorkspace.xcworkspace';
      mockExistsSync.mockReturnValue(true);
      
      const result = ProjectPath.create(workspacePath);
      
      expect(result.name).toBe('CoolWorkspace');
    });
    
    it('should handle names with dots', () => {
      const pathWithDots = '/Users/dev/App.v2.0.xcodeproj';
      mockExistsSync.mockReturnValue(true);
      
      const result = ProjectPath.create(pathWithDots);
      
      expect(result.name).toBe('App.v2.0');
    });
    
    it('should handle names with spaces', () => {
      const pathWithSpaces = '/Users/dev/My Cool App.xcworkspace';
      mockExistsSync.mockReturnValue(true);
      
      const result = ProjectPath.create(pathWithSpaces);
      
      expect(result.name).toBe('My Cool App');
    });
  });
  
  describe('when checking project type', () => {
    it('should identify workspace files', () => {
      const workspacePath = '/Users/dev/MyApp.xcworkspace';
      mockExistsSync.mockReturnValue(true);
      
      const result = ProjectPath.create(workspacePath);
      
      expect(result.isWorkspace).toBe(true);
    });
    
    it('should identify non-workspace files as projects', () => {
      const projectPath = '/Users/dev/MyApp.xcodeproj';
      mockExistsSync.mockReturnValue(true);
      
      const result = ProjectPath.create(projectPath);
      
      expect(result.isWorkspace).toBe(false);
    });
  });
  
  describe('when converting to string', () => {
    it('should return the original path', () => {
      const originalPath = '/Users/dev/path/to/MyApp.xcodeproj';
      mockExistsSync.mockReturnValue(true);
      
      const result = ProjectPath.create(originalPath);
      
      expect(result.toString()).toBe(originalPath);
      expect(`${result}`).toBe(originalPath); // Implicit string conversion
    });
  });
  
  describe('when path validation is called multiple times', () => {
    it('should check existence only once during creation', () => {
      const projectPath = '/Users/dev/MyApp.xcodeproj';
      mockExistsSync.mockReturnValue(true);
      
      const result = ProjectPath.create(projectPath);
      
      // Access properties multiple times
      result.name;
      result.isWorkspace;
      result.toString();
      
      // Should only check existence once during creation
      expect(mockExistsSync).toHaveBeenCalledTimes(1);
    });
  });
});