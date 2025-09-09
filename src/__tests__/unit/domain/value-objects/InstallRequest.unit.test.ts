import { describe, it, expect } from '@jest/globals';
import { InstallRequest } from '../../../../domain/value-objects/InstallRequest.js';

describe('InstallRequest', () => {
  describe('create', () => {
    it('should create valid install request with simulator ID', () => {
      // Arrange & Act
      const request = InstallRequest.create(
        '/path/to/app.app',
        'iPhone-15-Simulator'
      );
      
      // Assert
      expect(request.appPath).toBe('/path/to/app.app');
      expect(request.simulatorId).toBe('iPhone-15-Simulator');
    });

    it('should create valid install request without simulator ID', () => {
      // Arrange & Act
      const request = InstallRequest.create(
        '/path/to/app.app'
      );
      
      // Assert
      expect(request.appPath).toBe('/path/to/app.app');
      expect(request.simulatorId).toBeUndefined();
    });

    it('should reject empty app path', () => {
      // Arrange & Act & Assert
      expect(() => InstallRequest.create('', 'test-sim'))
        .toThrow('App path cannot be empty');
    });

    it('should reject whitespace-only app path', () => {
      // Arrange & Act & Assert
      expect(() => InstallRequest.create('   ', 'test-sim'))
        .toThrow('App path cannot be empty');
    });

    it('should reject invalid app extension', () => {
      // Arrange & Act & Assert
      expect(() => InstallRequest.create('/path/to/file.txt', 'test-sim'))
        .toThrow('App path must end with .app');
    });

    it('should accept .app bundle path', () => {
      // Arrange & Act
      const request = InstallRequest.create(
        '/path/to/MyApp.app',
        'test-sim'
      );
      
      // Assert
      expect(request.appPath).toBe('/path/to/MyApp.app');
    });

    it('should trim whitespace from simulator ID', () => {
      // Arrange & Act
      const request = InstallRequest.create(
        '/path/to/app.app',
        '  test-sim  '
      );
      
      // Assert
      expect(request.simulatorId).toBe('test-sim');
    });
  });

  describe('validation', () => {
    it('should reject path traversal attempts', () => {
      // Arrange & Act & Assert
      expect(() => InstallRequest.create('../../../etc/passwd.app'))
        .toThrow();
    });

    it('should accept absolute paths', () => {
      // Arrange & Act
      const request = InstallRequest.create(
        '/Users/developer/MyApp.app'
      );
      
      // Assert
      expect(request.appPath).toBe('/Users/developer/MyApp.app');
    });

    it('should accept relative paths within project', () => {
      // Arrange & Act
      const request = InstallRequest.create(
        './build/Debug/MyApp.app'
      );
      
      // Assert
      expect(request.appPath).toBe('./build/Debug/MyApp.app');
    });
  });
});