import { describe, it, expect } from '@jest/globals';
import { 
  BootResult, 
  BootOutcome, 
  SimulatorNotFoundError, 
  BootCommandFailedError 
} from '../../../../domain/entities/BootResult.js';

describe('BootResult', () => {
  describe('booted', () => {
    it('should create a result for newly booted simulator', () => {
      // Arrange
      const simulatorId = 'ABC123';
      const simulatorName = 'iPhone 15';
      
      // Act
      const result = BootResult.booted(simulatorId, simulatorName);
      
      // Assert - Test behavior: result indicates success
      expect(result.outcome).toBe(BootOutcome.Booted);
      expect(result.diagnostics.simulatorId).toBe(simulatorId);
      expect(result.diagnostics.simulatorName).toBe(simulatorName);
    });

    it('should include optional diagnostics', () => {
      // Arrange
      const diagnostics = { platform: 'iOS', runtime: 'iOS-17.0' };
      
      // Act
      const result = BootResult.booted('ABC123', 'iPhone 15', diagnostics);
      
      // Assert - Test behavior: diagnostics are preserved
      expect(result.diagnostics.platform).toBe('iOS');
      expect(result.diagnostics.runtime).toBe('iOS-17.0');
    });
  });

  describe('alreadyBooted', () => {
    it('should create a result for already running simulator', () => {
      // Arrange & Act
      const result = BootResult.alreadyBooted('ABC123', 'iPhone 15');
      
      // Assert - Test behavior: result indicates already running
      expect(result.outcome).toBe(BootOutcome.AlreadyBooted);
      expect(result.diagnostics.simulatorId).toBe('ABC123');
      expect(result.diagnostics.simulatorName).toBe('iPhone 15');
    });
  });

  describe('failed', () => {
    it('should create a failure result with error', () => {
      // Arrange
      const error = new BootCommandFailedError('Device is locked');
      
      // Act
      const result = BootResult.failed('ABC123', 'iPhone 15', error);
      
      // Assert - Test behavior: result indicates failure with error
      expect(result.outcome).toBe(BootOutcome.Failed);
      expect(result.diagnostics.simulatorId).toBe('ABC123');
      expect(result.diagnostics.simulatorName).toBe('iPhone 15');
      expect(result.diagnostics.error).toBe(error);
    });

    it('should handle simulator not found error', () => {
      // Arrange
      const error = new SimulatorNotFoundError('iPhone-16');
      
      // Act
      const result = BootResult.failed('iPhone-16', '', error);
      
      // Assert - Test behavior: error type is preserved
      expect(result.outcome).toBe(BootOutcome.Failed);
      expect(result.diagnostics.error).toBeInstanceOf(SimulatorNotFoundError);
      expect((result.diagnostics.error as SimulatorNotFoundError).deviceId).toBe('iPhone-16');
    });

    it('should include optional diagnostics on failure', () => {
      // Arrange
      const error = new BootCommandFailedError('Boot failed');
      const diagnostics = { runtime: 'iOS-17.0' };
      
      // Act
      const result = BootResult.failed('ABC123', 'iPhone 15', error, diagnostics);
      
      // Assert - Test behavior: diagnostics preserved even on failure
      expect(result.diagnostics.runtime).toBe('iOS-17.0');
      expect(result.diagnostics.error).toBe(error);
    });
  });

  describe('immutability', () => {
    it('should create immutable results', () => {
      // Arrange
      const result = BootResult.booted('ABC123', 'iPhone 15');
      
      // Act & Assert - Test behavior: results cannot be modified
      expect(() => {
        (result as any).outcome = BootOutcome.Failed;
      }).toThrow();
      
      expect(() => {
        (result.diagnostics as any).simulatorId = 'XYZ789';
      }).toThrow();
    });
  });
});