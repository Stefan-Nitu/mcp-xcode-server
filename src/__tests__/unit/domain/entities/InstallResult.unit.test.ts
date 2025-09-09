import { describe, it, expect } from '@jest/globals';
import { InstallResult } from '../../../../domain/entities/InstallResult.js';

describe('InstallResult', () => {
  describe('success', () => {
    it('should create successful install result', () => {
      // Arrange & Act
      const result = InstallResult.success(
        'com.example.app',
        'iPhone-15-Simulator',
        'iPhone 15',
        '/path/to/app.app'
      );
      
      // Assert
      expect(result.isSuccess).toBe(true);
      expect(result.bundleId).toBe('com.example.app');
      expect(result.simulatorId).toBe('iPhone-15-Simulator');
      expect(result.simulatorName).toBe('iPhone 15');
      expect(result.appPath).toBe('/path/to/app.app');
      expect(result.error).toBeUndefined();
    });

    it('should include install timestamp', () => {
      // Arrange & Act
      const before = Date.now();
      const result = InstallResult.success(
        'com.example.app',
        'test-sim',
        'Test Simulator',
        '/path/to/app.app'
      );
      const after = Date.now();
      
      // Assert
      expect(result.installedAt.getTime()).toBeGreaterThanOrEqual(before);
      expect(result.installedAt.getTime()).toBeLessThanOrEqual(after);
    });
  });

  describe('failure', () => {
    it('should create failed install result', () => {
      // Arrange & Act
      const result = InstallResult.failure(
        'Simulator not found',
        '/path/to/app.app',
        'non-existent-sim',
        'Unknown Simulator'
      );
      
      // Assert
      expect(result.isSuccess).toBe(false);
      expect(result.error).toBe('Simulator not found');
      expect(result.appPath).toBe('/path/to/app.app');
      expect(result.simulatorId).toBe('non-existent-sim');
      expect(result.bundleId).toBeUndefined();
    });

    it('should handle failure without simulator ID', () => {
      // Arrange & Act
      const result = InstallResult.failure(
        'No booted simulator found',
        '/path/to/app.app'
      );
      
      // Assert
      expect(result.isSuccess).toBe(false);
      expect(result.error).toBe('No booted simulator found');
      expect(result.appPath).toBe('/path/to/app.app');
      expect(result.simulatorId).toBeUndefined();
    });
  });

  describe('toString', () => {
    it('should format successful result with name and ID', () => {
      // Arrange
      const result = InstallResult.success(
        'com.example.app',
        'iPhone-15-UUID',
        'iPhone 15',
        '/path/to/app.app'
      );
      
      // Act
      const str = result.toString();
      
      // Assert
      expect(str).toBe('Successfully installed com.example.app on iPhone 15 (iPhone-15-UUID)');
    });

    it('should format failed result', () => {
      // Arrange
      const result = InstallResult.failure(
        'App bundle not found',
        '/path/to/app.app',
        'test-sim',
        'Test Simulator'
      );
      
      // Act
      const str = result.toString();
      
      // Assert
      expect(str).toContain('Failed to install');
      expect(str).toContain('App bundle not found');
      expect(str).toContain('/path/to/app.app');
    });
  });
});