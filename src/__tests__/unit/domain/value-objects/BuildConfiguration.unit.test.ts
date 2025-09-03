import { describe, it, expect } from '@jest/globals';
import { BuildConfiguration } from '../../../../domain/value-objects/BuildConfiguration.js';
import { Platform } from '../../../../domain/value-objects/Platform.js';

describe('BuildConfiguration', () => {
  // Test data setup - DAMP approach, visible in each test
  const derivedDataPath = '/path/to/DerivedData';
  
  describe('when creating a configuration', () => {
    it('should store all build settings', () => {
      // All setup visible in the test
      const config = new BuildConfiguration(
        'MyScheme',
        'Release',
        Platform.iOS,
        'device-123',
        derivedDataPath
      );
      
      expect(config.scheme).toBe('MyScheme');
      expect(config.configuration).toBe('Release');
      expect(config.platform).toBe(Platform.iOS);
      expect(config.deviceId).toBe('device-123');
      expect(config.derivedDataPath).toBe(derivedDataPath);
    });
    
    it('should allow undefined scheme', () => {
      const config = new BuildConfiguration(
        undefined,
        'Debug',
        Platform.macOS,
        undefined,
        derivedDataPath
      );
      
      expect(config.scheme).toBeUndefined();
      expect(config.configuration).toBe('Debug');
    });
    
    it('should allow undefined deviceId', () => {
      const config = new BuildConfiguration(
        'MyScheme',
        'Debug',
        Platform.iOS,
        undefined,
        derivedDataPath
      );
      
      expect(config.deviceId).toBeUndefined();
    });
  });
  
  describe('when validating input', () => {
    it('should reject empty configuration', () => {
      expect(() => new BuildConfiguration(
        'MyScheme',
        '',
        Platform.iOS,
        undefined,
        derivedDataPath
      )).toThrow('Configuration cannot be empty');
    });
    
    it('should reject null configuration', () => {
      expect(() => new BuildConfiguration(
        'MyScheme',
        null as any,
        Platform.iOS,
        undefined,
        derivedDataPath
      )).toThrow('Configuration cannot be empty');
    });
    
    it('should reject undefined configuration', () => {
      expect(() => new BuildConfiguration(
        'MyScheme',
        undefined as any,
        Platform.iOS,
        undefined,
        derivedDataPath
      )).toThrow('Configuration cannot be empty');
    });
  });
  
  describe('when using default configuration', () => {
    it('should create Debug iOS configuration', () => {
      const config = BuildConfiguration.default(derivedDataPath);
      
      expect(config.scheme).toBeUndefined();
      expect(config.configuration).toBe('Debug');
      expect(config.platform).toBe(Platform.iOS);
      expect(config.deviceId).toBeUndefined();
      expect(config.derivedDataPath).toBe(derivedDataPath);
    });
  });
  
  describe('when modifying configuration (immutability)', () => {
    it('should create new instance when changing scheme', () => {
      const original = BuildConfiguration.default(derivedDataPath);
      const modified = original.withScheme('NewScheme');
      
      // New instance created
      expect(modified).not.toBe(original);
      
      // Original unchanged
      expect(original.scheme).toBeUndefined();
      
      // Modified has new value
      expect(modified.scheme).toBe('NewScheme');
      
      // Other values preserved
      expect(modified.configuration).toBe(original.configuration);
      expect(modified.platform).toBe(original.platform);
      expect(modified.deviceId).toBe(original.deviceId);
      expect(modified.derivedDataPath).toBe(original.derivedDataPath);
    });
    
    it('should create new instance when changing platform', () => {
      const original = new BuildConfiguration(
        'MyScheme',
        'Debug',
        Platform.iOS,
        'device-123',
        derivedDataPath
      );
      const modified = original.withPlatform(Platform.macOS);
      
      // New instance created
      expect(modified).not.toBe(original);
      
      // Original unchanged
      expect(original.platform).toBe(Platform.iOS);
      
      // Modified has new value
      expect(modified.platform).toBe(Platform.macOS);
      
      // Other values preserved
      expect(modified.scheme).toBe(original.scheme);
      expect(modified.configuration).toBe(original.configuration);
      expect(modified.deviceId).toBe(original.deviceId);
      expect(modified.derivedDataPath).toBe(original.derivedDataPath);
    });
    
    it('should support fluent chaining', () => {
      const config = BuildConfiguration.default(derivedDataPath)
        .withScheme('MyScheme')
        .withPlatform(Platform.tvOS);
      
      expect(config.scheme).toBe('MyScheme');
      expect(config.platform).toBe(Platform.tvOS);
      expect(config.configuration).toBe('Debug');
    });
  });
  
});