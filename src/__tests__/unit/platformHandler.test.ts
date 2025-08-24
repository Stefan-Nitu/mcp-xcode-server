/**
 * Unit tests for PlatformHandler
 */

import { describe, test, expect } from '@jest/globals';
import { PlatformHandler } from '../../platformHandler';
import { Platform } from '../../types';

describe('PlatformHandler', () => {
  describe('getConfig', () => {
    test('should return config for iOS', () => {
      const config = PlatformHandler.getConfig(Platform.iOS);
      expect(config.platform).toBe(Platform.iOS);
      expect(config.needsSimulator).toBe(true);
      expect(config.defaultDevice).toBe('iPhone 16 Pro');
    });
    
    test('should return config for macOS', () => {
      const config = PlatformHandler.getConfig(Platform.macOS);
      expect(config.platform).toBe(Platform.macOS);
      expect(config.needsSimulator).toBe(false);
      expect(config.defaultDevice).toBeUndefined();
    });
    
    test('should return config for tvOS', () => {
      const config = PlatformHandler.getConfig(Platform.tvOS);
      expect(config.platform).toBe(Platform.tvOS);
      expect(config.needsSimulator).toBe(true);
      expect(config.defaultDevice).toBe('Apple TV');
    });
    
    test('should return config for watchOS', () => {
      const config = PlatformHandler.getConfig(Platform.watchOS);
      expect(config.platform).toBe(Platform.watchOS);
      expect(config.needsSimulator).toBe(true);
      expect(config.defaultDevice).toBe('Apple Watch Series 10 (46mm)');
    });
    
    test('should return config for visionOS', () => {
      const config = PlatformHandler.getConfig(Platform.visionOS);
      expect(config.platform).toBe(Platform.visionOS);
      expect(config.needsSimulator).toBe(true);
      expect(config.defaultDevice).toBe('Apple Vision Pro');
    });
  });
  
  describe('needsSimulator', () => {
    test('iOS should need simulator', () => {
      expect(PlatformHandler.needsSimulator(Platform.iOS)).toBe(true);
    });
    
    test('macOS should not need simulator', () => {
      expect(PlatformHandler.needsSimulator(Platform.macOS)).toBe(false);
    });
    
    test('tvOS should need simulator', () => {
      expect(PlatformHandler.needsSimulator(Platform.tvOS)).toBe(true);
    });
    
    test('watchOS should need simulator', () => {
      expect(PlatformHandler.needsSimulator(Platform.watchOS)).toBe(true);
    });
    
    test('visionOS should need simulator', () => {
      expect(PlatformHandler.needsSimulator(Platform.visionOS)).toBe(true);
    });
  });
  
  describe('getDestination', () => {
    test('should return iOS destination with default device', () => {
      const destination = PlatformHandler.getDestination(Platform.iOS);
      expect(destination).toBe('platform=iOS Simulator,name=iPhone 16 Pro');
    });
    
    test('should return iOS destination with custom device', () => {
      const destination = PlatformHandler.getDestination(Platform.iOS, 'iPhone 15');
      expect(destination).toBe('platform=iOS Simulator,name=iPhone 15');
    });
    
    test('should return macOS destination', () => {
      const destination = PlatformHandler.getDestination(Platform.macOS);
      expect(destination).toBe('platform=macOS');
    });
    
    test('should return macOS destination ignoring device name', () => {
      const destination = PlatformHandler.getDestination(Platform.macOS, 'Some Device');
      expect(destination).toBe('platform=macOS');
    });
    
    test('should return tvOS destination with default device', () => {
      const destination = PlatformHandler.getDestination(Platform.tvOS);
      expect(destination).toBe('platform=tvOS Simulator,name=Apple TV');
    });
    
    test('should return watchOS destination with default device', () => {
      const destination = PlatformHandler.getDestination(Platform.watchOS);
      expect(destination).toBe('platform=watchOS Simulator,name=Apple Watch Series 10 (46mm)');
    });
    
    test('should return visionOS destination with default device', () => {
      const destination = PlatformHandler.getDestination(Platform.visionOS);
      expect(destination).toBe('platform=xrOS Simulator,name=Apple Vision Pro');
    });
  });
  
  describe('getDefaultDevice', () => {
    test('should return default device for iOS', () => {
      expect(PlatformHandler.getDefaultDevice(Platform.iOS)).toBe('iPhone 16 Pro');
    });
    
    test('should return undefined for macOS', () => {
      expect(PlatformHandler.getDefaultDevice(Platform.macOS)).toBeUndefined();
    });
    
    test('should return default device for tvOS', () => {
      expect(PlatformHandler.getDefaultDevice(Platform.tvOS)).toBe('Apple TV');
    });
    
    test('should return default device for watchOS', () => {
      expect(PlatformHandler.getDefaultDevice(Platform.watchOS)).toBe('Apple Watch Series 9 (45mm)');
    });
    
    test('should return default device for visionOS', () => {
      expect(PlatformHandler.getDefaultDevice(Platform.visionOS)).toBe('Apple Vision Pro');
    });
  });
  
  describe('parsePlatformFromString', () => {
    test('should parse iOS variations', () => {
      expect(PlatformHandler.parsePlatformFromString('ios')).toBe(Platform.iOS);
      expect(PlatformHandler.parsePlatformFromString('iOS')).toBe(Platform.iOS);
      expect(PlatformHandler.parsePlatformFromString('iphonesimulator')).toBe(Platform.iOS);
      expect(PlatformHandler.parsePlatformFromString('iphoneos')).toBe(Platform.iOS);
    });
    
    test('should parse macOS variations', () => {
      expect(PlatformHandler.parsePlatformFromString('macos')).toBe(Platform.macOS);
      expect(PlatformHandler.parsePlatformFromString('macOS')).toBe(Platform.macOS);
      expect(PlatformHandler.parsePlatformFromString('mac')).toBe(Platform.macOS);
      expect(PlatformHandler.parsePlatformFromString('osx')).toBe(Platform.macOS);
    });
    
    test('should parse tvOS variations', () => {
      expect(PlatformHandler.parsePlatformFromString('tvos')).toBe(Platform.tvOS);
      expect(PlatformHandler.parsePlatformFromString('tvOS')).toBe(Platform.tvOS);
      expect(PlatformHandler.parsePlatformFromString('appletv')).toBe(Platform.tvOS);
    });
    
    test('should parse watchOS variations', () => {
      expect(PlatformHandler.parsePlatformFromString('watchos')).toBe(Platform.watchOS);
      expect(PlatformHandler.parsePlatformFromString('watchOS')).toBe(Platform.watchOS);
      expect(PlatformHandler.parsePlatformFromString('watch')).toBe(Platform.watchOS);
    });
    
    test('should parse visionOS variations', () => {
      expect(PlatformHandler.parsePlatformFromString('visionos')).toBe(Platform.visionOS);
      expect(PlatformHandler.parsePlatformFromString('visionOS')).toBe(Platform.visionOS);
      expect(PlatformHandler.parsePlatformFromString('vision')).toBe(Platform.visionOS);
      expect(PlatformHandler.parsePlatformFromString('xros')).toBe(Platform.visionOS);
    });
    
    test('should throw error for unknown platform', () => {
      expect(() => PlatformHandler.parsePlatformFromString('android')).toThrow('Unknown platform: android');
      expect(() => PlatformHandler.parsePlatformFromString('windows')).toThrow('Unknown platform: windows');
      expect(() => PlatformHandler.parsePlatformFromString('linux')).toThrow('Unknown platform: linux');
    });
  });
});