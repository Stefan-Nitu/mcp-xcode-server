import { ConfigProviderAdapter } from '../../infrastructure/ConfigProviderAdapter.js';
import { IConfigProvider } from '../../../application/ports/ConfigPorts.js';
import { homedir } from 'os';
import path from 'path';

describe('ConfigProvider', () => {
  // Save original env
  const originalEnv = process.env;
  
  beforeEach(() => {
    // Reset env before each test
    process.env = { ...originalEnv };
  });
  
  afterAll(() => {
    // Restore original env
    process.env = originalEnv;
  });
  
  // Factory method for creating the SUT
  function createSUT(): IConfigProvider {
    return new ConfigProviderAdapter();
  }
  
  describe('getDerivedDataPath', () => {
    it('should use default path when no env var is set', () => {
      // Arrange
      delete process.env.MCP_XCODE_DERIVED_DATA_PATH;
      const sut = createSUT();
      const expectedPath = path.join(homedir(), 'Library', 'Developer', 'Xcode', 'DerivedData', 'MCP-Xcode');
      
      // Act
      const result = sut.getDerivedDataPath();
      
      // Assert
      expect(result).toBe(expectedPath);
    });
    
    it('should use env var when set', () => {
      // Arrange
      process.env.MCP_XCODE_DERIVED_DATA_PATH = '/custom/path';
      const sut = createSUT();
      
      // Act
      const result = sut.getDerivedDataPath();
      
      // Assert
      expect(result).toBe('/custom/path');
    });
    
    it('should return project-specific path when project path is provided', () => {
      // Arrange
      process.env.MCP_XCODE_DERIVED_DATA_PATH = '/base/path';
      const sut = createSUT();
      
      // Act
      const result = sut.getDerivedDataPath('/Users/dev/MyApp.xcodeproj');
      
      // Assert
      expect(result).toBe('/base/path/MyApp');
    });
    
    it('should handle workspace paths correctly', () => {
      // Arrange
      process.env.MCP_XCODE_DERIVED_DATA_PATH = '/base/path';
      const sut = createSUT();
      
      // Act
      const result = sut.getDerivedDataPath('/Users/dev/MyWorkspace.xcworkspace');
      
      // Assert
      expect(result).toBe('/base/path/MyWorkspace');
    });
    
    it('should handle paths with spaces', () => {
      // Arrange
      process.env.MCP_XCODE_DERIVED_DATA_PATH = '/base/path';
      const sut = createSUT();
      
      // Act
      const result = sut.getDerivedDataPath('/Users/dev/My App.xcodeproj');
      
      // Assert
      expect(result).toBe('/base/path/My App');
    });
  });
  
  describe('getBuildTimeout', () => {
    it('should return default timeout when no env var is set', () => {
      // Arrange
      delete process.env.MCP_XCODE_BUILD_TIMEOUT;
      const sut = createSUT();
      
      // Act
      const result = sut.getBuildTimeout();
      
      // Assert
      expect(result).toBe(600000); // 10 minutes
    });
    
    it('should use env var when set', () => {
      // Arrange
      process.env.MCP_XCODE_BUILD_TIMEOUT = '300000';
      const sut = createSUT();
      
      // Act
      const result = sut.getBuildTimeout();
      
      // Assert
      expect(result).toBe(300000);
    });
    
    it('should handle invalid timeout value', () => {
      // Arrange
      process.env.MCP_XCODE_BUILD_TIMEOUT = 'invalid';
      const sut = createSUT();
      
      // Act
      const result = sut.getBuildTimeout();
      
      // Assert
      expect(result).toBeNaN(); // parseInt returns NaN for invalid strings
    });
  });
  
  describe('isXcbeautifyEnabled', () => {
    it('should return true by default', () => {
      // Arrange
      delete process.env.MCP_XCODE_XCBEAUTIFY_ENABLED;
      const sut = createSUT();
      
      // Act
      const result = sut.isXcbeautifyEnabled();
      
      // Assert
      expect(result).toBe(true);
    });
    
    it('should return true when env var is "true"', () => {
      // Arrange
      process.env.MCP_XCODE_XCBEAUTIFY_ENABLED = 'true';
      const sut = createSUT();
      
      // Act
      const result = sut.isXcbeautifyEnabled();
      
      // Assert
      expect(result).toBe(true);
    });
    
    it('should return false when env var is "false"', () => {
      // Arrange
      process.env.MCP_XCODE_XCBEAUTIFY_ENABLED = 'false';
      const sut = createSUT();
      
      // Act
      const result = sut.isXcbeautifyEnabled();
      
      // Assert
      expect(result).toBe(false);
    });
    
    it('should handle case insensitive true value', () => {
      // Arrange
      process.env.MCP_XCODE_XCBEAUTIFY_ENABLED = 'TRUE';
      const sut = createSUT();
      
      // Act
      const result = sut.isXcbeautifyEnabled();
      
      // Assert
      expect(result).toBe(true);
    });
    
    it('should return false for any non-true value', () => {
      // Arrange
      process.env.MCP_XCODE_XCBEAUTIFY_ENABLED = 'yes';
      const sut = createSUT();
      
      // Act
      const result = sut.isXcbeautifyEnabled();
      
      // Assert
      expect(result).toBe(false);
    });
  });
  
  describe('getCustomBuildSettings', () => {
    it('should return empty object by default', () => {
      // Arrange
      delete process.env.MCP_XCODE_CUSTOM_BUILD_SETTINGS;
      const sut = createSUT();
      
      // Act
      const result = sut.getCustomBuildSettings();
      
      // Assert
      expect(result).toEqual({});
    });
    
    it('should parse valid JSON from env var', () => {
      // Arrange
      const settings = { 'SWIFT_VERSION': '5.9', 'DEBUG': 'true' };
      process.env.MCP_XCODE_CUSTOM_BUILD_SETTINGS = JSON.stringify(settings);
      const sut = createSUT();
      
      // Act
      const result = sut.getCustomBuildSettings();
      
      // Assert
      expect(result).toEqual(settings);
    });
    
    it('should return empty object for invalid JSON', () => {
      // Arrange
      process.env.MCP_XCODE_CUSTOM_BUILD_SETTINGS = 'not valid json';
      const sut = createSUT();
      
      // Act
      const result = sut.getCustomBuildSettings();
      
      // Assert
      expect(result).toEqual({});
    });
    
    it('should handle empty JSON object', () => {
      // Arrange
      process.env.MCP_XCODE_CUSTOM_BUILD_SETTINGS = '{}';
      const sut = createSUT();
      
      // Act
      const result = sut.getCustomBuildSettings();
      
      // Assert
      expect(result).toEqual({});
    });
  });
});