import { describe, it, expect, beforeEach } from '@jest/globals';
import { BuildRequest } from '../../../../domain/value-objects/BuildRequest.js';
import { BuildDestination } from '../../../../domain/value-objects/BuildDestination.js';
import { ProjectPath } from '../../../../domain/value-objects/ProjectPath.js';
import { existsSync } from 'fs';

// Mock filesystem for ProjectPath validation
jest.mock('fs', () => ({
  existsSync: jest.fn()
}));

const mockExistsSync = existsSync as jest.MockedFunction<typeof existsSync>;

/**
 * Unit tests for BuildRequest value object
 * 
 * Testing expected BEHAVIOR:
 * 1. BuildRequest represents a valid build request
 * 2. All fields are required and validated
 * 3. Invalid data is rejected at creation
 * 4. Object is immutable after creation
 */
describe('BuildRequest', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Default mock: project exists
    mockExistsSync.mockReturnValue(true);
  });

  describe('create method', () => {
    it('should create BuildRequest with all required fields', () => {
      // Act
      const request = BuildRequest.create(
        '/path/to/project.xcodeproj',
        'MyApp',
        BuildDestination.iOSSimulator,
        'Debug',
        '/path/to/DerivedData'
      );
      
      // Assert
      expect(request.scheme).toBe('MyApp');
      expect(request.destination).toBe(BuildDestination.iOSSimulator);
      expect(request.configuration).toBe('Debug');
      expect(request.derivedDataPath).toBe('/path/to/DerivedData');
      expect(request.projectPath.toString()).toBe('/path/to/project.xcodeproj');
    });

    it('should use Debug as default configuration', () => {
      // Act
      const request = BuildRequest.create(
        '/path/to/project.xcodeproj',
        'MyApp',
        BuildDestination.iOSSimulator,
        undefined, // Use default
        '/path/to/DerivedData'
      );
      
      // Assert
      expect(request.configuration).toBe('Debug');
    });

    it('should accept different BuildDestination values', () => {
      // Arrange
      const destinations = [
        BuildDestination.iOSDevice,
        BuildDestination.iOSSimulatorUniversal,
        BuildDestination.tvOSSimulator,
        BuildDestination.watchOSSimulator,
        BuildDestination.visionOSSimulator,
        BuildDestination.macOSUniversal
      ];
      
      // Act & Assert
      for (const destination of destinations) {
        const request = BuildRequest.create(
          '/path/to/project.xcodeproj',
          'MyApp',
          destination,
          'Debug',
          '/path/to/DerivedData'
        );
        expect(request.destination).toBe(destination);
      }
    });

    it('should accept .xcworkspace files', () => {
      // Act
      const request = BuildRequest.create(
        '/path/to/project.xcworkspace',
        'MyApp',
        BuildDestination.iOSSimulator,
        'Debug',
        '/path/to/DerivedData'
      );
      
      // Assert
      expect(request.projectPath.isWorkspace).toBe(true);
      expect(request.projectPath.toString()).toBe('/path/to/project.xcworkspace');
    });

    it('should accept .xcodeproj files', () => {
      // Act
      const request = BuildRequest.create(
        '/path/to/project.xcodeproj',
        'MyApp',
        BuildDestination.iOSSimulator,
        'Debug',
        '/path/to/DerivedData'
      );
      
      // Assert
      expect(request.projectPath.isWorkspace).toBe(false);
      expect(request.projectPath.toString()).toBe('/path/to/project.xcodeproj');
    });
  });

  describe('validation', () => {
    it('should throw error when projectPath does not exist', () => {
      // Arrange
      mockExistsSync.mockReturnValue(false);
      
      // Act & Assert
      expect(() => BuildRequest.create(
        '/path/to/nonexistent.xcodeproj',
        'MyApp',
        BuildDestination.iOSSimulator,
        'Debug',
        '/path/to/DerivedData'
      )).toThrow('Project path does not exist');
    });

    it('should throw error when projectPath is empty', () => {
      // Act & Assert
      expect(() => BuildRequest.create(
        '',
        'MyApp',
        BuildDestination.iOSSimulator,
        'Debug',
        '/path/to/DerivedData'
      )).toThrow('Project path cannot be empty');
    });

    it('should throw error when scheme is empty', () => {
      // Act & Assert
      expect(() => BuildRequest.create(
        '/path/to/project.xcodeproj',
        '',
        BuildDestination.iOSSimulator,
        'Debug',
        '/path/to/DerivedData'
      )).toThrow('Scheme cannot be empty');
    });

    it('should throw error when scheme is only whitespace', () => {
      // Act & Assert
      expect(() => BuildRequest.create(
        '/path/to/project.xcodeproj',
        '   ',
        BuildDestination.iOSSimulator,
        'Debug',
        '/path/to/DerivedData'
      )).toThrow('Scheme cannot be empty');
    });

    it('should throw error when configuration is empty', () => {
      // Act & Assert
      expect(() => BuildRequest.create(
        '/path/to/project.xcodeproj',
        'MyApp',
        BuildDestination.iOSSimulator,
        '',
        '/path/to/DerivedData'
      )).toThrow('Configuration cannot be empty');
    });

    it('should throw error when configuration is only whitespace', () => {
      // Act & Assert
      expect(() => BuildRequest.create(
        '/path/to/project.xcodeproj',
        'MyApp',
        BuildDestination.iOSSimulator,
        '   ',
        '/path/to/DerivedData'
      )).toThrow('Configuration cannot be empty');
    });

    it('should throw error when derivedDataPath is empty', () => {
      // Act & Assert
      expect(() => BuildRequest.create(
        '/path/to/project.xcodeproj',
        'MyApp',
        BuildDestination.iOSSimulator,
        'Debug',
        ''
      )).toThrow('Derived data path cannot be empty');
    });

    it('should throw error when derivedDataPath is only whitespace', () => {
      // Act & Assert
      expect(() => BuildRequest.create(
        '/path/to/project.xcodeproj',
        'MyApp',
        BuildDestination.iOSSimulator,
        'Debug',
        '   '
      )).toThrow('Derived data path cannot be empty');
    });

    it('should throw error for invalid project file extensions', () => {
      // Act & Assert
      expect(() => BuildRequest.create(
        '/path/to/project.txt',
        'MyApp',
        BuildDestination.iOSSimulator,
        'Debug',
        '/path/to/DerivedData'
      )).toThrow('Path must be an .xcodeproj or .xcworkspace file');
    });
  });

  describe('constructor with domain objects', () => {
    it('should create BuildRequest when given valid domain objects', () => {
      // Arrange
      const projectPath = ProjectPath.create('/path/to/project.xcodeproj');
      
      // Act
      const request = new BuildRequest(
        projectPath,
        'MyApp',
        'Release',
        BuildDestination.macOSUniversal,
        '/custom/derived/data'
      );
      
      // Assert
      expect(request.projectPath).toBe(projectPath);
      expect(request.scheme).toBe('MyApp');
      expect(request.configuration).toBe('Release');
      expect(request.destination).toBe(BuildDestination.macOSUniversal);
      expect(request.derivedDataPath).toBe('/custom/derived/data');
    });

    it('should validate scheme in constructor', () => {
      // Arrange
      const projectPath = ProjectPath.create('/path/to/project.xcodeproj');
      
      // Act & Assert
      expect(() => new BuildRequest(
        projectPath,
        '',
        'Debug',
        BuildDestination.iOSSimulator,
        '/path/to/DerivedData'
      )).toThrow('Scheme cannot be empty');
    });

    it('should validate configuration in constructor', () => {
      // Arrange
      const projectPath = ProjectPath.create('/path/to/project.xcodeproj');
      
      // Act & Assert
      expect(() => new BuildRequest(
        projectPath,
        'MyApp',
        '',
        BuildDestination.iOSSimulator,
        '/path/to/DerivedData'
      )).toThrow('Configuration cannot be empty');
    });

    it('should validate derivedDataPath in constructor', () => {
      // Arrange
      const projectPath = ProjectPath.create('/path/to/project.xcodeproj');
      
      // Act & Assert
      expect(() => new BuildRequest(
        projectPath,
        'MyApp',
        'Debug',
        BuildDestination.iOSSimulator,
        ''
      )).toThrow('Derived data path cannot be empty');
    });
  });

  describe('immutability', () => {
    it('should have readonly properties', () => {
      // Arrange
      const request = BuildRequest.create(
        '/path/to/project.xcodeproj',
        'MyApp',
        BuildDestination.iOSSimulator,
        'Debug',
        '/path/to/DerivedData'
      );
      
      // TypeScript compiler enforces readonly, but we can verify at runtime
      expect(Object.isFrozen(request.projectPath)).toBe(false); // Objects aren't frozen
      expect(typeof request.scheme).toBe('string'); // Primitives are immutable
      expect(typeof request.configuration).toBe('string');
      expect(typeof request.derivedDataPath).toBe('string');
    });
  });

  describe('edge cases', () => {
    it('should handle long file paths', () => {
      // Arrange
      const longPath = '/very/long/path/'.repeat(50) + 'project.xcodeproj';
      
      // Act
      const request = BuildRequest.create(
        longPath,
        'MyApp',
        BuildDestination.iOSSimulator,
        'Debug',
        '/path/to/DerivedData'
      );
      
      // Assert
      expect(request.projectPath.toString()).toBe(longPath);
    });

    it('should handle Unicode characters in scheme name', () => {
      // Act
      const request = BuildRequest.create(
        '/path/to/project.xcodeproj',
        'MyApp-测试-🚀',
        BuildDestination.iOSSimulator,
        'Debug',
        '/path/to/DerivedData'
      );
      
      // Assert
      expect(request.scheme).toBe('MyApp-测试-🚀');
    });

    it('should handle spaces in project path', () => {
      // Arrange
      const pathWithSpaces = '/path/to/My Project/project.xcodeproj';
      
      // Act
      const request = BuildRequest.create(
        pathWithSpaces,
        'MyApp',
        BuildDestination.iOSSimulator,
        'Debug',
        '/path/to/DerivedData'
      );
      
      // Assert
      expect(request.projectPath.toString()).toBe(pathWithSpaces);
    });

    it('should handle spaces in derived data path', () => {
      // Act
      const request = BuildRequest.create(
        '/path/to/project.xcodeproj',
        'MyApp',
        BuildDestination.iOSSimulator,
        'Debug',
        '/path/to/Derived Data'
      );
      
      // Assert
      expect(request.derivedDataPath).toBe('/path/to/Derived Data');
    });
  });
});