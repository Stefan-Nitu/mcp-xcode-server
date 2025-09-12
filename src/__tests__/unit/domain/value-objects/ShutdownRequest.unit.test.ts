import { describe, it, expect } from '@jest/globals';
import { ShutdownRequest } from '../../../../domain/value-objects/ShutdownRequest.js';

describe('ShutdownRequest', () => {
  describe('create', () => {
    it('should create a valid shutdown request with device ID', () => {
      // Arrange
      const deviceId = 'iPhone-15';
      
      // Act
      const request = ShutdownRequest.create(deviceId);
      
      // Assert
      expect(request.deviceId).toBe('iPhone-15');
    });

    it('should trim whitespace from device ID', () => {
      // Arrange
      const deviceId = '  iPhone-15  ';
      
      // Act
      const request = ShutdownRequest.create(deviceId);
      
      // Assert
      expect(request.deviceId).toBe('iPhone-15');
    });

    it('should accept UUID format device ID', () => {
      // Arrange
      const uuid = '550e8400-e29b-41d4-a716-446655440000';
      
      // Act
      const request = ShutdownRequest.create(uuid);
      
      // Assert
      expect(request.deviceId).toBe(uuid);
    });

    it('should throw error for empty device ID', () => {
      // Arrange & Act & Assert
      expect(() => ShutdownRequest.create('')).toThrow('Device ID cannot be empty');
    });

    it('should throw error for null device ID', () => {
      // Arrange & Act & Assert
      expect(() => ShutdownRequest.create(null as any)).toThrow('Device ID cannot be empty');
    });

    it('should throw error for undefined device ID', () => {
      // Arrange & Act & Assert
      expect(() => ShutdownRequest.create(undefined as any)).toThrow('Device ID cannot be empty');
    });

    it('should throw error for whitespace-only device ID', () => {
      // Arrange & Act & Assert
      expect(() => ShutdownRequest.create('   ')).toThrow('Device ID cannot be empty');
    });

    it('should be immutable', () => {
      // Arrange
      const request = ShutdownRequest.create('iPhone-15');
      
      // Act & Assert
      expect(() => {
        (request as any).deviceId = 'Changed';
      }).toThrow();
    });

    it('should handle device names with spaces', () => {
      // Arrange
      const deviceName = 'iPhone 15 Pro Max';
      
      // Act
      const request = ShutdownRequest.create(deviceName);
      
      // Assert
      expect(request.deviceId).toBe('iPhone 15 Pro Max');
    });

    it('should handle device names with special characters', () => {
      // Arrange
      const deviceName = "John's iPhone (Work)";
      
      // Act
      const request = ShutdownRequest.create(deviceName);
      
      // Assert
      expect(request.deviceId).toBe("John's iPhone (Work)");
    });
  });
});