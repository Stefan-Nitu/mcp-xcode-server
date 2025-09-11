import { describe, it, expect } from '@jest/globals';
import { BootRequest } from '../../../../domain/value-objects/BootRequest.js';

describe('BootRequest', () => {
  describe('create', () => {
    it('should create a valid boot request with simulator UUID', () => {
      // Arrange
      const deviceId = 'ABC123-DEF456-789';

      // Act
      const request = BootRequest.create(deviceId);

      // Assert
      expect(request.deviceId).toBe(deviceId);
    });

    it('should create a valid boot request with simulator name', () => {
      // Arrange
      const deviceName = 'iPhone 15 Pro';

      // Act
      const request = BootRequest.create(deviceName);

      // Assert
      expect(request.deviceId).toBe(deviceName);
    });

    it('should throw error for empty device ID', () => {
      // Arrange
      const emptyId = '';

      // Act & Assert
      expect(() => BootRequest.create(emptyId)).toThrow('Device ID cannot be empty');
    });

    it('should throw error for whitespace-only device ID', () => {
      // Arrange
      const whitespaceId = '   ';

      // Act & Assert
      expect(() => BootRequest.create(whitespaceId)).toThrow('Device ID cannot be empty');
    });

    it('should be immutable', () => {
      // Arrange
      const request = BootRequest.create('ABC123');

      // Act & Assert
      expect(() => {
        (request as any).deviceId = 'changed';
      }).toThrow();
    });

    it('should trim whitespace from device ID', () => {
      // Arrange
      const idWithSpaces = '  iPhone 15  ';

      // Act
      const request = BootRequest.create(idWithSpaces);

      // Assert
      expect(request.deviceId).toBe('iPhone 15');
    });
  });
});