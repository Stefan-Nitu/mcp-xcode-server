import { describe, it, expect } from '@jest/globals';
import {
  InstallResult,
  InstallOutcome,
  InstallCommandFailedError,
  SimulatorNotFoundError
} from '../../../../domain/entities/InstallResult.js';
import { DeviceId } from '../../../../domain/value-objects/DeviceId.js';
import { AppPath } from '../../../../domain/value-objects/AppPath.js';

describe('InstallResult', () => {
  describe('succeeded', () => {
    it('should create successful install result', () => {
      // Arrange & Act
      const simulatorId = DeviceId.create('iPhone-15-Simulator');
      const appPath = AppPath.create('/path/to/app.app');
      const result = InstallResult.succeeded(
        'com.example.app',
        simulatorId,
        'iPhone 15',
        appPath
      );
      
      // Assert
      expect(result.outcome).toBe(InstallOutcome.Succeeded);
      expect(result.diagnostics.bundleId).toBe('com.example.app');
      expect(result.diagnostics.simulatorId?.toString()).toBe('iPhone-15-Simulator');
      expect(result.diagnostics.simulatorName).toBe('iPhone 15');
      expect(result.diagnostics.appPath.toString()).toBe('/path/to/app.app');
      expect(result.diagnostics.error).toBeUndefined();
    });

    it('should include install timestamp', () => {
      // Arrange & Act
      const before = Date.now();
      const simulatorId = DeviceId.create('test-sim');
      const appPath = AppPath.create('/path/to/app.app');
      const result = InstallResult.succeeded(
        'com.example.app',
        simulatorId,
        'Test Simulator',
        appPath
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
      const simulatorId = DeviceId.create('non-existent-sim');
      const error = new SimulatorNotFoundError(simulatorId);
      
      // Act
      const appPath = AppPath.create('/path/to/app.app');
      const result = InstallResult.failed(
        error,
        appPath,
        simulatorId,
        'Unknown Simulator'
      );
      
      // Assert
      expect(result.outcome).toBe(InstallOutcome.Failed);
      expect(result.diagnostics.error).toBe(error);
      expect(result.diagnostics.appPath.toString()).toBe('/path/to/app.app');
      expect(result.diagnostics.simulatorId?.toString()).toBe('non-existent-sim');
      expect(result.diagnostics.bundleId).toBeUndefined();
    });

    it('should handle failure without simulator ID', () => {
      // Arrange
      const simulatorId = DeviceId.create('booted');
      const error = new SimulatorNotFoundError(simulatorId);
      
      // Act
      const appPath = AppPath.create('/path/to/app.app');
      const result = InstallResult.failed(
        error,
        appPath
      );
      
      // Assert
      expect(result.outcome).toBe(InstallOutcome.Failed);
      expect(result.diagnostics.error).toBe(error);
      expect(result.diagnostics.appPath.toString()).toBe('/path/to/app.app');
      expect(result.diagnostics.simulatorId).toBeUndefined();
    });

    it('should create failed install result with InstallCommandFailedError', () => {
      // Arrange
      const error = new InstallCommandFailedError('App bundle not found');
      
      // Act
      const appPath = AppPath.create('/path/to/app.app');
      const simulatorId = DeviceId.create('test-sim');
      const result = InstallResult.failed(
        error,
        appPath,
        simulatorId,
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
      const simulatorId = DeviceId.create('sim-id');
      const appPath = AppPath.create('/app.app');
      const result = InstallResult.succeeded(
        'com.example.app',
        simulatorId,
        'Simulator',
        appPath
      );
      
      // Assert
      expect(result.outcome).toBe(InstallOutcome.Succeeded);
    });

    it('should identify failed installation', () => {
      // Arrange
      const error = new InstallCommandFailedError('Installation failed');
      
      // Act
      const appPath = AppPath.create('/app.app');
      const result = InstallResult.failed(
        error,
        appPath
      );
      
      // Assert
      expect(result.outcome).toBe(InstallOutcome.Failed);
    });
  });
});