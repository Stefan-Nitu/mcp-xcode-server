import { describe, it, expect } from '@jest/globals';
import { 
  InstallResult,
  InstallOutcome,
  InstallCommandFailedError,
  SimulatorNotFoundError
} from '../../../../domain/entities/InstallResult.js';

describe('InstallResult', () => {
  describe('succeeded', () => {
    it('should create successful install result', () => {
      // Arrange & Act
      const result = InstallResult.succeeded(
        'com.example.app',
        'iPhone-15-Simulator',
        'iPhone 15',
        '/path/to/app.app'
      );
      
      // Assert
      expect(result.outcome).toBe(InstallOutcome.Succeeded);
      expect(result.diagnostics.bundleId).toBe('com.example.app');
      expect(result.diagnostics.simulatorId).toBe('iPhone-15-Simulator');
      expect(result.diagnostics.simulatorName).toBe('iPhone 15');
      expect(result.diagnostics.appPath).toBe('/path/to/app.app');
      expect(result.diagnostics.error).toBeUndefined();
    });

    it('should include install timestamp', () => {
      // Arrange & Act
      const before = Date.now();
      const result = InstallResult.succeeded(
        'com.example.app',
        'test-sim',
        'Test Simulator',
        '/path/to/app.app'
      );
      const after = Date.now();
      
      // Assert
      expect(result.diagnostics.installedAt.getTime()).toBeGreaterThanOrEqual(before);
      expect(result.diagnostics.installedAt.getTime()).toBeLessThanOrEqual(after);
    });
  });

  describe('failed', () => {
    it('should create failed install result with SimulatorNotFoundError', () => {
      // Arrange
      const error = new SimulatorNotFoundError('non-existent-sim');
      
      // Act
      const result = InstallResult.failed(
        error,
        '/path/to/app.app',
        'non-existent-sim',
        'Unknown Simulator'
      );
      
      // Assert
      expect(result.outcome).toBe(InstallOutcome.Failed);
      expect(result.diagnostics.error).toBe(error);
      expect(result.diagnostics.appPath).toBe('/path/to/app.app');
      expect(result.diagnostics.simulatorId).toBe('non-existent-sim');
      expect(result.diagnostics.bundleId).toBeUndefined();
    });

    it('should handle failure without simulator ID', () => {
      // Arrange
      const error = new SimulatorNotFoundError('booted');
      
      // Act
      const result = InstallResult.failed(
        error,
        '/path/to/app.app'
      );
      
      // Assert
      expect(result.outcome).toBe(InstallOutcome.Failed);
      expect(result.diagnostics.error).toBe(error);
      expect(result.diagnostics.appPath).toBe('/path/to/app.app');
      expect(result.diagnostics.simulatorId).toBeUndefined();
    });

    it('should create failed install result with InstallCommandFailedError', () => {
      // Arrange
      const error = new InstallCommandFailedError('App bundle not found');
      
      // Act
      const result = InstallResult.failed(
        error,
        '/path/to/app.app',
        'test-sim',
        'Test Simulator'
      );
      
      // Assert
      expect(result.outcome).toBe(InstallOutcome.Failed);
      expect(result.diagnostics.error).toBe(error);
      expect((result.diagnostics.error as InstallCommandFailedError).stderr).toBe('App bundle not found');
    });
  });

  describe('outcome checking', () => {
    it('should identify successful installation', () => {
      // Arrange & Act
      const result = InstallResult.succeeded(
        'com.example.app',
        'sim-id',
        'Simulator',
        '/app.app'
      );
      
      // Assert
      expect(result.outcome).toBe(InstallOutcome.Succeeded);
    });

    it('should identify failed installation', () => {
      // Arrange
      const error = new InstallCommandFailedError('Installation failed');
      
      // Act
      const result = InstallResult.failed(
        error,
        '/app.app'
      );
      
      // Assert
      expect(result.outcome).toBe(InstallOutcome.Failed);
    });
  });
});