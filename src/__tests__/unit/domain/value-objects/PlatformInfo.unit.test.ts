import { describe, it, expect } from '@jest/globals';
import { PlatformInfo } from '../../../../domain/value-objects/PlatformInfo.js';
import { Platform } from '../../../../domain/value-objects/Platform.js';

describe('PlatformInfo', () => {
  // Test data factory - DAMP approach for clarity
  function createTestUUID(): string {
    return '550E8400-E29B-41D4-A716-446655440000';
  }
  
  describe('when parsing platform strings', () => {
    it('should recognize standard platform names', () => {
      // Each platform visible in test
      expect(PlatformInfo.parse('iOS')).toBe(PlatformInfo.iOS);
      expect(PlatformInfo.parse('macOS')).toBe(PlatformInfo.macOS);
      expect(PlatformInfo.parse('tvOS')).toBe(PlatformInfo.tvOS);
      expect(PlatformInfo.parse('watchOS')).toBe(PlatformInfo.watchOS);
      expect(PlatformInfo.parse('visionOS')).toBe(PlatformInfo.visionOS);
    });
    
    it('should recognize lowercase aliases', () => {
      expect(PlatformInfo.parse('ios')).toBe(PlatformInfo.iOS);
      expect(PlatformInfo.parse('mac')).toBe(PlatformInfo.macOS);
      expect(PlatformInfo.parse('watch')).toBe(PlatformInfo.watchOS);
      expect(PlatformInfo.parse('vision')).toBe(PlatformInfo.visionOS);
    });
    
    it('should recognize Xcode internal names', () => {
      expect(PlatformInfo.parse('iphonesimulator')).toBe(PlatformInfo.iOS);
      expect(PlatformInfo.parse('iphoneos')).toBe(PlatformInfo.iOS);
      expect(PlatformInfo.parse('xros')).toBe(PlatformInfo.visionOS);
    });
    
    it('should throw for unknown platforms', () => {
      expect(() => PlatformInfo.parse('android')).toThrow('Unknown platform: android');
      expect(() => PlatformInfo.parse('windows')).toThrow('Unknown platform: windows');
      expect(() => PlatformInfo.parse('linux')).toThrow('Unknown platform: linux');
    });
    
    it('should return same instance for same platform (singleton)', () => {
      const ios1 = PlatformInfo.parse('iOS');
      const ios2 = PlatformInfo.parse('iphonesimulator');
      const ios3 = PlatformInfo.fromPlatform(Platform.iOS);
      
      // All should be the exact same instance
      expect(ios1).toBe(ios2);
      expect(ios2).toBe(ios3);
    });
  });
  
  describe('when checking platform characteristics', () => {
    it('should identify simulator platforms', () => {
      expect(PlatformInfo.iOS.requiresSimulator()).toBe(true);
      expect(PlatformInfo.tvOS.requiresSimulator()).toBe(true);
      expect(PlatformInfo.watchOS.requiresSimulator()).toBe(true);
      expect(PlatformInfo.visionOS.requiresSimulator()).toBe(true);
    });
    
    it('should identify native Mac platform', () => {
      expect(PlatformInfo.macOS.requiresSimulator()).toBe(false);
      expect(PlatformInfo.macOS.isNativeMac()).toBe(true);
    });
    
    it('should know simulator platforms are not native Mac', () => {
      expect(PlatformInfo.iOS.isNativeMac()).toBe(false);
      expect(PlatformInfo.tvOS.isNativeMac()).toBe(false);
      expect(PlatformInfo.watchOS.isNativeMac()).toBe(false);
      expect(PlatformInfo.visionOS.isNativeMac()).toBe(false);
    });
    
    it('should provide xcodebuild internal names', () => {
      expect(PlatformInfo.iOS.getInternalName()).toBe('iOS');
      expect(PlatformInfo.macOS.getInternalName()).toBe('macOS');
      expect(PlatformInfo.tvOS.getInternalName()).toBe('tvOS');
      expect(PlatformInfo.watchOS.getInternalName()).toBe('watchOS');
      expect(PlatformInfo.visionOS.getInternalName()).toBe('xrOS'); // Special case!
    });
  });
  
  describe('when generating build destinations', () => {
    describe('for simulator platforms', () => {
      it('should generate generic destination when no device specified', () => {
        const destination = PlatformInfo.iOS.generateDestination();
        
        expect(destination).toBe('generic/platform=iOS Simulator');
      });
      
      it('should generate named destination for device names', () => {
        const destination = PlatformInfo.iOS.generateDestination('iPhone 15 Pro');
        
        expect(destination).toBe('platform=iOS Simulator,name=iPhone 15 Pro');
      });
      
      it('should generate ID destination for UUIDs', () => {
        const uuid = createTestUUID();
        const destination = PlatformInfo.iOS.generateDestination(uuid);
        
        expect(destination).toBe(`platform=iOS Simulator,id=${uuid}`);
      });
      
      it('should handle case-insensitive UUID detection', () => {
        const upperUUID = 'AAAA8400-E29B-41D4-A716-446655440000';
        const lowerUUID = 'aaaa8400-e29b-41d4-a716-446655440000';
        
        const dest1 = PlatformInfo.iOS.generateDestination(upperUUID);
        const dest2 = PlatformInfo.iOS.generateDestination(lowerUUID);
        
        expect(dest1).toContain('id=');
        expect(dest2).toContain('id=');
      });
      
      it('should use xrOS internally for visionOS', () => {
        const destination = PlatformInfo.visionOS.generateDestination('Vision Pro');
        
        expect(destination).toBe('platform=xrOS Simulator,name=Vision Pro');
      });
    });
    
    describe('for native Mac platform', () => {
      it('should ignore device parameter for macOS', () => {
        const withoutDevice = PlatformInfo.macOS.generateDestination();
        const withDevice = PlatformInfo.macOS.generateDestination('Mac Studio');
        const withUUID = PlatformInfo.macOS.generateDestination(createTestUUID());
        
        // All should produce the same result
        expect(withoutDevice).toBe('platform=macOS');
        expect(withDevice).toBe('platform=macOS');
        expect(withUUID).toBe('platform=macOS');
      });
    });
    
    describe('generic destination generation', () => {
      it('should generate generic for simulators', () => {
        expect(PlatformInfo.iOS.generateGenericDestination())
          .toBe('generic/platform=iOS Simulator');
        expect(PlatformInfo.tvOS.generateGenericDestination())
          .toBe('generic/platform=tvOS Simulator');
        expect(PlatformInfo.watchOS.generateGenericDestination())
          .toBe('generic/platform=watchOS Simulator');
        expect(PlatformInfo.visionOS.generateGenericDestination())
          .toBe('generic/platform=xrOS Simulator');
      });
      
      it('should generate simple platform for macOS', () => {
        expect(PlatformInfo.macOS.generateGenericDestination())
          .toBe('platform=macOS');
      });
    });
  });
  
  describe('when validating device identifiers', () => {
    it('should accept undefined for generic builds', () => {
      const result = PlatformInfo.iOS.generateDestination(undefined);
      expect(result).toBe('generic/platform=iOS Simulator');
    });
    
    it('should accept valid device names', () => {
      const deviceName = 'iPhone 15 Pro Max';
      const result = PlatformInfo.iOS.generateDestination(deviceName);
      expect(result).toContain(`name=${deviceName}`);
    });
    
    it('should reject empty strings', () => {
      expect(() => PlatformInfo.iOS.generateDestination(''))
        .toThrow('Device identifier cannot be empty');
      expect(() => PlatformInfo.iOS.generateDestination('   '))
        .toThrow('Device identifier cannot be empty');
    });
    
    it('should reject non-string values', () => {
      expect(() => PlatformInfo.iOS.generateDestination(123 as any))
        .toThrow('Device identifier must be a string or undefined');
      expect(() => PlatformInfo.iOS.generateDestination({} as any))
        .toThrow('Device identifier must be a string or undefined');
      expect(() => PlatformInfo.iOS.generateDestination([] as any))
        .toThrow('Device identifier must be a string or undefined');
    });
    
    it('should handle device names with special characters', () => {
      const specialNames = [
        'iPhone (2024)',
        "Developer's iPad",
        'iPhone & iPad',
        'Test Device #1'
      ];
      
      specialNames.forEach(name => {
        const result = PlatformInfo.iOS.generateDestination(name);
        expect(result).toContain(`name=${name}`);
      });
    });
  });
  
  describe('when detecting UUIDs', () => {
    it('should recognize valid UUID format', () => {
      const validUUIDs = [
        '550E8400-E29B-41D4-A716-446655440000',
        '00000000-0000-0000-0000-000000000000',
        'FFFFFFFF-FFFF-FFFF-FFFF-FFFFFFFFFFFF',
        'abcdef12-3456-7890-abcd-ef1234567890'
      ];
      
      validUUIDs.forEach(uuid => {
        const destination = PlatformInfo.iOS.generateDestination(uuid);
        expect(destination).toContain(`id=${uuid}`);
      });
    });
    
    it('should treat malformed UUIDs as device names', () => {
      const notUUIDs = [
        '550E8400-E29B-41D4-A716-44665544000',   // Too short
        '550E8400-E29B-41D4-A716-4466554400000', // Too long  
        '550E8400E29B41D4A716446655440000',      // Missing dashes
        '550E8400-E29B-41D4-A716-44665544ZZZZ',  // Invalid hex
        'iPhone-15-Pro-Max'                       // Dash-separated but not UUID
      ];
      
      notUUIDs.forEach(notUuid => {
        const destination = PlatformInfo.iOS.generateDestination(notUuid);
        expect(destination).toContain(`name=${notUuid}`);
      });
    });
  });
  
  describe('when converting between representations', () => {
    it('should convert from Platform enum to PlatformInfo', () => {
      expect(PlatformInfo.fromPlatform(Platform.iOS)).toBe(PlatformInfo.iOS);
      expect(PlatformInfo.fromPlatform(Platform.macOS)).toBe(PlatformInfo.macOS);
      expect(PlatformInfo.fromPlatform(Platform.tvOS)).toBe(PlatformInfo.tvOS);
      expect(PlatformInfo.fromPlatform(Platform.watchOS)).toBe(PlatformInfo.watchOS);
      expect(PlatformInfo.fromPlatform(Platform.visionOS)).toBe(PlatformInfo.visionOS);
    });
    
    it('should provide access to Platform enum value', () => {
      expect(PlatformInfo.iOS.getValue()).toBe(Platform.iOS);
      expect(PlatformInfo.macOS.getValue()).toBe(Platform.macOS);
      expect(PlatformInfo.tvOS.getValue()).toBe(Platform.tvOS);
      expect(PlatformInfo.watchOS.getValue()).toBe(Platform.watchOS);
      expect(PlatformInfo.visionOS.getValue()).toBe(Platform.visionOS);
    });
    
    it('should convert to string using Platform enum value', () => {
      expect(PlatformInfo.iOS.toString()).toBe(Platform.iOS);
      expect(PlatformInfo.macOS.toString()).toBe(Platform.macOS);
    });
  });
});