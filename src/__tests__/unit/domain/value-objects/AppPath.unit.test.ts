import { describe, it, expect } from '@jest/globals';
import { AppPath } from '../../../../domain/value-objects/AppPath.js';

describe('AppPath', () => {
  describe('create', () => {
    it('should create valid AppPath with .app extension', () => {
      // Arrange & Act
      const appPath = AppPath.create('/path/to/MyApp.app');
      
      // Assert
      expect(appPath.toString()).toBe('/path/to/MyApp.app');
      expect(appPath.name).toBe('MyApp.app');
    });

    it('should accept paths with spaces', () => {
      // Arrange & Act
      const appPath = AppPath.create('/path/to/My Cool App.app');
      
      // Assert
      expect(appPath.toString()).toBe('/path/to/My Cool App.app');
      expect(appPath.name).toBe('My Cool App.app');
    });

    it('should accept relative paths', () => {
      // Arrange & Act
      const appPath = AppPath.create('./build/Debug/TestApp.app');
      
      // Assert
      expect(appPath.toString()).toBe('./build/Debug/TestApp.app');
      expect(appPath.name).toBe('TestApp.app');
    });

    it('should throw error for empty path', () => {
      // Arrange, Act & Assert
      expect(() => AppPath.create('')).toThrow('App path cannot be empty');
    });

    it('should throw error for path without .app extension', () => {
      // Arrange, Act & Assert
      expect(() => AppPath.create('/path/to/MyApp')).toThrow('App path must end with .app');
      expect(() => AppPath.create('/path/to/MyApp.ipa')).toThrow('App path must end with .app');
      expect(() => AppPath.create('/path/to/binary')).toThrow('App path must end with .app');
    });

    it('should throw error for path with directory traversal', () => {
      // Arrange, Act & Assert
      expect(() => AppPath.create('../../../etc/passwd.app')).toThrow('App path cannot contain directory traversal');
      expect(() => AppPath.create('/path/../../../etc/evil.app')).toThrow('App path cannot contain directory traversal');
      expect(() => AppPath.create('/valid/path/../../sneaky.app')).toThrow('App path cannot contain directory traversal');
    });

    it('should throw error for path with null characters', () => {
      // Arrange, Act & Assert
      expect(() => AppPath.create('/path/to/MyApp.app\0')).toThrow('App path cannot contain null characters');
      expect(() => AppPath.create('/path\0/to/MyApp.app')).toThrow('App path cannot contain null characters');
    });

    it('should handle paths ending with slash after .app', () => {
      // Arrange & Act
      const appPath = AppPath.create('/path/to/MyApp.app/');
      
      // Assert
      expect(appPath.toString()).toBe('/path/to/MyApp.app/');
      expect(appPath.name).toBe('MyApp.app');
    });
  });

  describe('name property', () => {
    it('should extract app name from simple path', () => {
      // Arrange & Act
      const appPath = AppPath.create('/Users/dev/MyApp.app');
      
      // Assert
      expect(appPath.name).toBe('MyApp.app');
    });

    it('should extract app name from Windows-style path', () => {
      // Arrange & Act  
      const appPath = AppPath.create('C:\\Users\\dev\\MyApp.app');
      
      // Assert
      expect(appPath.name).toBe('MyApp.app');
    });

    it('should handle app name with special characters', () => {
      // Arrange & Act
      const appPath = AppPath.create('/path/to/My-App_v1.2.3.app');
      
      // Assert
      expect(appPath.name).toBe('My-App_v1.2.3.app');
    });

    it('should handle just the app name without path', () => {
      // Arrange & Act
      const appPath = AppPath.create('MyApp.app');
      
      // Assert
      expect(appPath.name).toBe('MyApp.app');
    });
  });

  describe('toString', () => {
    it('should return the original path', () => {
      // Arrange
      const originalPath = '/path/to/MyApp.app';
      
      // Act
      const appPath = AppPath.create(originalPath);
      
      // Assert
      expect(appPath.toString()).toBe(originalPath);
    });
  });
});