import { describe, it, expect } from '@jest/globals';
import { BootRequest } from '../../../../domain/value-objects/BootRequest.js';
import { DeviceId } from '../../../../domain/value-objects/DeviceId.js';

describe('BootRequest', () => {
  describe('create', () => {
    it('should create a valid boot request with simulator UUID', () => {
      // Arrange
      const deviceIdString = 'ABC123-DEF456-789';
      const deviceId = DeviceId.create(deviceIdString);

      // Act
      const request = BootRequest.create(deviceId);

      // Assert
      expect(request.deviceId).toBe(deviceIdString);
    });

    it('should create a valid boot request with simulator name', () => {
      // Arrange
      const deviceName = 'iPhone 15 Pro';
      const deviceId = DeviceId.create(deviceName);

      // Act
      const request = BootRequest.create(deviceId);

      // Assert
      expect(request.deviceId).toBe(deviceName);
    });

    it('should throw error for empty device ID', () => {
      // Arrange
      const emptyId = '';

      // Act & Assert
      expect(() => DeviceId.create(emptyId)).toThrow('Device ID cannot be empty');
    });

    it('should throw error for whitespace-only device ID', () => {
      // Arrange
      const whitespaceId = '   ';

      // Act & Assert
      expect(() => DeviceId.create(whitespaceId)).toThrow('Device ID cannot be whitespace only');
    });

    it('should be immutable', () => {
      // Arrange
      const deviceId = DeviceId.create('ABC123');
      const request = BootRequest.create(deviceId);

      // Act & Assert
      expect(() => {
        (request as any).deviceId = 'changed';
      }).toThrow();
    });

    it('should trim whitespace from device ID', () => {
      // Arrange
      const idWithSpaces = '  iPhone 15  ';
      const deviceId = DeviceId.create(idWithSpaces);

      // Act
      const request = BootRequest.create(deviceId);

      // Assert
      expect(request.deviceId).toBe('iPhone 15');
    });
  });
});