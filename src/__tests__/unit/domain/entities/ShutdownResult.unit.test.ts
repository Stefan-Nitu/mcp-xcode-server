import { describe, it, expect } from '@jest/globals';
import { 
  ShutdownResult, 
  ShutdownOutcome, 
  SimulatorNotFoundError, 
  ShutdownCommandFailedError 
} from '../../../../domain/entities/ShutdownResult.js';

describe('ShutdownResult', () => {
  describe('shutdown', () => {
    it('should create a successful shutdown result', () => {
      // Arrange
      const simulatorId = 'ABC123';
      const simulatorName = 'iPhone 15';
      
      // Act
      const result = ShutdownResult.shutdown(simulatorId, simulatorName);
      
      // Assert
      expect(result.outcome).toBe(ShutdownOutcome.Shutdown);
      expect(result.diagnostics.simulatorId).toBe('ABC123');
      expect(result.diagnostics.simulatorName).toBe('iPhone 15');
      expect(result.diagnostics.error).toBeUndefined();
    });
  });

  describe('alreadyShutdown', () => {
    it('should create an already shutdown result', () => {
      // Arrange
      const simulatorId = 'ABC123';
      const simulatorName = 'iPhone 15';
      
      // Act
      const result = ShutdownResult.alreadyShutdown(simulatorId, simulatorName);
      
      // Assert
      expect(result.outcome).toBe(ShutdownOutcome.AlreadyShutdown);
      expect(result.diagnostics.simulatorId).toBe('ABC123');
      expect(result.diagnostics.simulatorName).toBe('iPhone 15');
      expect(result.diagnostics.error).toBeUndefined();
    });
  });

  describe('failed', () => {
    it('should create a failed result with SimulatorNotFoundError', () => {
      // Arrange
      const error = new SimulatorNotFoundError('non-existent');
      
      // Act
      const result = ShutdownResult.failed(undefined, undefined, error);
      
      // Assert
      expect(result.outcome).toBe(ShutdownOutcome.Failed);
      expect(result.diagnostics.simulatorId).toBeUndefined();
      expect(result.diagnostics.simulatorName).toBeUndefined();
      expect(result.diagnostics.error).toBe(error);
      expect(result.diagnostics.error).toBeInstanceOf(SimulatorNotFoundError);
    });

    it('should create a failed result with ShutdownCommandFailedError', () => {
      // Arrange
      const error = new ShutdownCommandFailedError('Device is busy');
      const simulatorId = 'ABC123';
      const simulatorName = 'iPhone 15';
      
      // Act
      const result = ShutdownResult.failed(simulatorId, simulatorName, error);
      
      // Assert
      expect(result.outcome).toBe(ShutdownOutcome.Failed);
      expect(result.diagnostics.simulatorId).toBe('ABC123');
      expect(result.diagnostics.simulatorName).toBe('iPhone 15');
      expect(result.diagnostics.error).toBe(error);
      expect(result.diagnostics.error).toBeInstanceOf(ShutdownCommandFailedError);
    });

    it('should handle generic errors', () => {
      // Arrange
      const error = new Error('Unknown error');
      
      // Act
      const result = ShutdownResult.failed('123', 'Test Device', error);
      
      // Assert
      expect(result.outcome).toBe(ShutdownOutcome.Failed);
      expect(result.diagnostics.error).toBe(error);
    });
  });
});

describe('SimulatorNotFoundError', () => {
  it('should store device ID', () => {
    // Arrange & Act
    const error = new SimulatorNotFoundError('iPhone-16');
    
    // Assert
    expect(error.deviceId).toBe('iPhone-16');
    expect(error.name).toBe('SimulatorNotFoundError');
    expect(error.message).toBe('iPhone-16');
  });

  it('should be an instance of Error', () => {
    // Arrange & Act
    const error = new SimulatorNotFoundError('test');
    
    // Assert
    expect(error).toBeInstanceOf(Error);
  });
});

describe('ShutdownCommandFailedError', () => {
  it('should store stderr output', () => {
    // Arrange & Act
    const error = new ShutdownCommandFailedError('Device is locked');
    
    // Assert
    expect(error.stderr).toBe('Device is locked');
    expect(error.name).toBe('ShutdownCommandFailedError');
    expect(error.message).toBe('Device is locked');
  });

  it('should handle empty stderr', () => {
    // Arrange & Act
    const error = new ShutdownCommandFailedError('');
    
    // Assert
    expect(error.stderr).toBe('');
    expect(error.message).toBe('');
  });

  it('should be an instance of Error', () => {
    // Arrange & Act
    const error = new ShutdownCommandFailedError('test');
    
    // Assert
    expect(error).toBeInstanceOf(Error);
  });
});