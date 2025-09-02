import { PlatformInfo } from '../../../domain/value-objects/PlatformInfo.js';
import { Platform } from '../../../domain/value-objects/Platform.js';

describe('PlatformInfo', () => {
  describe('Platform Recognition', () => {
    it('should recognize standard platform names', () => {
      expect(() => PlatformInfo.parse('iOS')).not.toThrow();
      expect(() => PlatformInfo.parse('macOS')).not.toThrow();
      expect(() => PlatformInfo.parse('tvOS')).not.toThrow();
      expect(() => PlatformInfo.parse('watchOS')).not.toThrow();
      expect(() => PlatformInfo.parse('visionOS')).not.toThrow();
    });

    it('should recognize common developer aliases', () => {
      // Developers often use these variations
      expect(() => PlatformInfo.parse('ios')).not.toThrow();
      expect(() => PlatformInfo.parse('mac')).not.toThrow();
      expect(() => PlatformInfo.parse('watch')).not.toThrow();
      expect(() => PlatformInfo.parse('vision')).not.toThrow();
    });

    it('should recognize Xcode-specific identifiers', () => {
      // These come from Xcode build settings
      expect(() => PlatformInfo.parse('iphonesimulator')).not.toThrow();
      expect(() => PlatformInfo.parse('iphoneos')).not.toThrow();
      expect(() => PlatformInfo.parse('xros')).not.toThrow(); // visionOS internal name
    });

    it('should reject unknown platforms', () => {
      expect(() => PlatformInfo.parse('android')).toThrow();
      expect(() => PlatformInfo.parse('windows')).toThrow();
      expect(() => PlatformInfo.parse('linux')).toThrow();
    });

    it('should provide consistent platform instances', () => {
      // Same platform should always return same instance (singleton pattern)
      const ios1 = PlatformInfo.parse('iOS');
      const ios2 = PlatformInfo.parse('iphonesimulator');
      expect(ios1).toBe(ios2);
    });
  });

  describe('Platform Characteristics', () => {
    it('should identify platforms that need simulators', () => {
      expect(PlatformInfo.iOS.requiresSimulator()).toBe(true);
      expect(PlatformInfo.tvOS.requiresSimulator()).toBe(true);
      expect(PlatformInfo.watchOS.requiresSimulator()).toBe(true);
      expect(PlatformInfo.visionOS.requiresSimulator()).toBe(true);
    });

    it('should identify platforms that run natively on Mac', () => {
      expect(PlatformInfo.macOS.requiresSimulator()).toBe(false);
      expect(PlatformInfo.macOS.isNativeMac()).toBe(true);
    });

    it('should know internal build tool names', () => {
      // visionOS is called xrOS internally by xcodebuild
      expect(PlatformInfo.visionOS.getInternalName()).toBe('xrOS');
      // Others use their standard names
      expect(PlatformInfo.iOS.getInternalName()).toBe('iOS');
    });
  });

  describe('Build Destination Generation', () => {
    describe('for simulator platforms', () => {
      it('should generate generic destinations for building without specific device', () => {
        // Generic builds don't require a booted simulator
        const destination = PlatformInfo.iOS.generateGenericDestination();
        expect(destination).toContain('generic');
        expect(destination).toContain('iOS');
        expect(destination).toContain('Simulator');
      });

      it('should generate device-specific destinations when device name provided', () => {
        const destination = PlatformInfo.iOS.generateDestination('iPhone 15');
        expect(destination).toContain('name=iPhone 15');
        expect(destination).not.toContain('generic');
      });

      it('should recognize and handle UUIDs differently from names', () => {
        const uuid = '550E8400-E29B-41D4-A716-446655440000';
        const destination = PlatformInfo.iOS.generateDestination(uuid);
        expect(destination).toContain('id=');
        expect(destination).not.toContain('name=');
      });

      it('should handle case-insensitive UUIDs', () => {
        const upperUUID = '550E8400-E29B-41D4-A716-446655440000';
        const lowerUUID = '550e8400-e29b-41d4-a716-446655440000';
        
        const dest1 = PlatformInfo.iOS.generateDestination(upperUUID);
        const dest2 = PlatformInfo.iOS.generateDestination(lowerUUID);
        
        expect(dest1).toContain('id=');
        expect(dest2).toContain('id=');
      });
    });

    describe('for native Mac platform', () => {
      it('should ignore device identifiers for macOS', () => {
        // macOS doesn't use device identifiers
        const dest1 = PlatformInfo.macOS.generateDestination();
        const dest2 = PlatformInfo.macOS.generateDestination('Mac Studio');
        const dest3 = PlatformInfo.macOS.generateDestination('any-device');
        
        expect(dest1).toBe(dest2);
        expect(dest2).toBe(dest3);
        expect(dest1).toBe('platform=macOS');
      });
    });

    describe('for visionOS', () => {
      it('should use xrOS as the internal platform name', () => {
        const destination = PlatformInfo.visionOS.generateDestination('Vision Pro');
        expect(destination).toContain('xrOS');
        expect(destination).not.toContain('visionOS');
      });
    });
  });

  describe('Input Validation', () => {
    it('should reject non-string device identifiers', () => {
      expect(() => PlatformInfo.iOS.generateDestination(123 as any)).toThrow();
      expect(() => PlatformInfo.iOS.generateDestination(true as any)).toThrow();
      expect(() => PlatformInfo.iOS.generateDestination({} as any)).toThrow();
      expect(() => PlatformInfo.iOS.generateDestination([] as any)).toThrow();
    });

    it('should reject empty device names', () => {
      expect(() => PlatformInfo.iOS.generateDestination('')).toThrow();
      expect(() => PlatformInfo.iOS.generateDestination('   ')).toThrow();
    });

    it('should accept undefined to mean "use generic"', () => {
      expect(() => PlatformInfo.iOS.generateDestination(undefined)).not.toThrow();
      expect(() => PlatformInfo.iOS.generateDestination()).not.toThrow();
    });

    it('should handle device names with special characters', () => {
      const specialNames = [
        'iPhone (2024)',
        "Developer's iPad",
        'iPhone & iPad',
        'Test Device #1'
      ];
      
      specialNames.forEach(name => {
        expect(() => PlatformInfo.iOS.generateDestination(name)).not.toThrow();
      });
    });
  });

  describe('UUID Detection', () => {
    it('should recognize valid UUID formats', () => {
      const validUUIDs = [
        '550E8400-E29B-41D4-A716-446655440000',
        '00000000-0000-0000-0000-000000000000',
        'FFFFFFFF-FFFF-FFFF-FFFF-FFFFFFFFFFFF'
      ];
      
      validUUIDs.forEach(uuid => {
        const dest = PlatformInfo.iOS.generateDestination(uuid);
        expect(dest).toContain('id=');
      });
    });

    it('should treat invalid UUID formats as device names', () => {
      const notUUIDs = [
        '550E8400-E29B-41D4-A716-44665544000',   // Too short
        '550E8400-E29B-41D4-A716-4466554400000', // Too long
        '550E8400E29B41D4A716446655440000',      // Missing dashes
        '550E8400-E29B-41D4-A716-44665544ZZZZ',  // Invalid hex
        'iPhone-15-Pro-Max'                       // Looks like UUID but isn't
      ];
      
      notUUIDs.forEach(notUuid => {
        const dest = PlatformInfo.iOS.generateDestination(notUuid);
        expect(dest).toContain('name=');
      });
    });
  });

  describe('Platform Conversion', () => {
    it('should convert from Platform enum to PlatformInfo', () => {
      expect(PlatformInfo.fromPlatform(Platform.iOS)).toBeDefined();
      expect(PlatformInfo.fromPlatform(Platform.macOS)).toBeDefined();
      expect(PlatformInfo.fromPlatform(Platform.tvOS)).toBeDefined();
      expect(PlatformInfo.fromPlatform(Platform.watchOS)).toBeDefined();
      expect(PlatformInfo.fromPlatform(Platform.visionOS)).toBeDefined();
    });

    it('should provide access to underlying Platform enum value', () => {
      expect(PlatformInfo.iOS.getValue()).toBe(Platform.iOS);
      expect(PlatformInfo.macOS.getValue()).toBe(Platform.macOS);
    });
  });
});