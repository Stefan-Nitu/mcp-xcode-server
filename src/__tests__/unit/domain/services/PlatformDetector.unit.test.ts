import { describe, it, expect } from '@jest/globals';
import { PlatformDetector } from '../../../../domain/services/PlatformDetector.js';
import { BuildDestination } from '../../../../domain/value-objects/BuildDestination.js';
import { Platform } from '../../../../domain/value-objects/Platform.js';

/**
 * Unit tests for PlatformDetector domain service
 * 
 * Testing pure domain logic for platform detection from build destinations
 */
describe('PlatformDetector', () => {
  describe('fromDestination', () => {
    it('should detect iOS platform from iOS destinations', () => {
      // Arrange & Act & Assert
      expect(PlatformDetector.fromDestination(BuildDestination.iOSSimulator)).toBe(Platform.iOS);
      expect(PlatformDetector.fromDestination(BuildDestination.iOSDevice)).toBe(Platform.iOS);
      expect(PlatformDetector.fromDestination(BuildDestination.iOSSimulatorUniversal)).toBe(Platform.iOS);
    });

    it('should detect macOS platform from macOS destinations', () => {
      // Arrange & Act & Assert
      expect(PlatformDetector.fromDestination(BuildDestination.macOS)).toBe(Platform.macOS);
      expect(PlatformDetector.fromDestination(BuildDestination.macOSUniversal)).toBe(Platform.macOS);
    });

    it('should detect tvOS platform from tvOS destinations', () => {
      // Arrange & Act & Assert
      expect(PlatformDetector.fromDestination(BuildDestination.tvOSSimulator)).toBe(Platform.tvOS);
      expect(PlatformDetector.fromDestination(BuildDestination.tvOSDevice)).toBe(Platform.tvOS);
      expect(PlatformDetector.fromDestination(BuildDestination.tvOSSimulatorUniversal)).toBe(Platform.tvOS);
    });

    it('should detect watchOS platform from watchOS destinations', () => {
      // Arrange & Act & Assert
      expect(PlatformDetector.fromDestination(BuildDestination.watchOSSimulator)).toBe(Platform.watchOS);
      expect(PlatformDetector.fromDestination(BuildDestination.watchOSDevice)).toBe(Platform.watchOS);
      expect(PlatformDetector.fromDestination(BuildDestination.watchOSSimulatorUniversal)).toBe(Platform.watchOS);
    });

    it('should detect visionOS platform from visionOS destinations', () => {
      // Arrange & Act & Assert
      expect(PlatformDetector.fromDestination(BuildDestination.visionOSSimulator)).toBe(Platform.visionOS);
      expect(PlatformDetector.fromDestination(BuildDestination.visionOSDevice)).toBe(Platform.visionOS);
      expect(PlatformDetector.fromDestination(BuildDestination.visionOSSimulatorUniversal)).toBe(Platform.visionOS);
    });

    it('should default to iOS for unknown destination patterns', () => {
      // Arrange
      const unknownDestination = 'unknownPlatform' as BuildDestination;
      
      // Act
      const result = PlatformDetector.fromDestination(unknownDestination);
      
      // Assert
      expect(result).toBe(Platform.iOS);
    });
  });
});