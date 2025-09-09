import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { BuildXcodeController } from '../../../../presentation/controllers/BuildXcodeController.js';
import { BuildProjectUseCase } from '../../../../application/use-cases/BuildProjectUseCase.js';
import { BuildXcodePresenter } from '../../../../presentation/presenters/BuildXcodePresenter.js';
import { ConfigProviderAdapter } from '../../../../infrastructure/adapters/ConfigProviderAdapter.js';
import { BuildRequest } from '../../../../domain/value-objects/BuildRequest.js';
import { BuildResult } from '../../../../domain/entities/BuildResult.js';
import { existsSync } from 'fs';

// Mock filesystem  
jest.mock('fs', () => ({
  existsSync: jest.fn<(path: string) => boolean>()
}));

const mockExistsSync = existsSync as jest.MockedFunction<typeof existsSync>;

/**
 * Unit tests for BuildXcodeController
 * 
 * Following testing philosophy from TESTING-PHILOSOPHY.md:
 * - Controllers are orchestrators - most behavior testing belongs in integration tests
 * - Unit tests here focus on:
 *   1. MCP tool contract (metadata, schema)
 *   2. Input validation rules
 * - Orchestration and data flow are tested in integration tests
 */

describe('BuildXcodeController', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Mock filesystem to return true for .xcodeproj and .xcworkspace files
    mockExistsSync.mockImplementation((path) => {
      const pathStr = String(path);
      return pathStr.endsWith('.xcodeproj') || pathStr.endsWith('.xcworkspace');
    });
  });

  // Factory method for creating SUT and mocks
  function createSUT() {
    // Create mocks that match the minimal interface needed
    const mockExecute = jest.fn<(request: BuildRequest) => Promise<BuildResult>>();
    const mockBuildUseCase: Pick<BuildProjectUseCase, 'execute'> = {
      execute: mockExecute
    };
    
    const mockPresent = jest.fn<BuildXcodePresenter['present']>();
    const mockPresentError = jest.fn<BuildXcodePresenter['presentError']>();
    const mockPresenter: Pick<BuildXcodePresenter, 'present' | 'presentError'> = {
      present: mockPresent,
      presentError: mockPresentError
    };
    
    const mockGetDerivedDataPath = jest.fn<(projectPath: string) => string>();
    const mockConfigProvider: Pick<ConfigProviderAdapter, 'getDerivedDataPath'> = {
      getDerivedDataPath: mockGetDerivedDataPath
    };
    
    const sut = new BuildXcodeController(
      mockBuildUseCase as BuildProjectUseCase,
      mockPresenter as BuildXcodePresenter,
      mockConfigProvider as ConfigProviderAdapter
    );
    
    return {
      sut,
      mockBuildUseCase: { execute: mockExecute },
      mockPresenter: { present: mockPresent, presentError: mockPresentError },
      mockConfigProvider: { getDerivedDataPath: mockGetDerivedDataPath }
    };
  }
  
  // Factory methods for test data
  function createValidInput(overrides = {}) {
    return {
      projectPath: '/path/to/project.xcodeproj',
      scheme: 'MyApp',
      destination: 'iOSSimulator',
      configuration: 'Debug',
      ...overrides
    };
  }
  
  function createSuccessfulBuildResult(): BuildResult {
    return BuildResult.success(
      'Build succeeded',
      '/path/to/app.app',
      '/path/to/logs/build.log'
    );
  }

  describe('MCP tool contract', () => {
    it('should expose correct tool name and description', () => {
      // Arrange
      const { sut } = createSUT();
      
      // Assert - verifies the MCP contract
      expect(sut.name).toBe('build_xcode');
      expect(sut.description).toBe('Build an Xcode project or workspace');
    });
    
    it('should define required MCP input schema', () => {
      // Arrange
      const { sut } = createSUT();
      
      // Act
      const schema = sut.inputSchema;
      
      // Assert - verifies schema contract for MCP
      expect(schema.type).toBe('object');
      expect(schema.properties).toHaveProperty('projectPath');
      expect(schema.properties).toHaveProperty('scheme');
      expect(schema.properties).toHaveProperty('destination');
      expect(schema.properties).toHaveProperty('configuration');
      expect(schema.properties).toHaveProperty('derivedDataPath');
      expect(schema.required).toEqual(['projectPath', 'scheme', 'destination']);
    });
    
    it('should provide complete tool definition for MCP registration', () => {
      // Arrange
      const { sut } = createSUT();
      
      // Act
      const definition = sut.getToolDefinition();
      
      // Assert - verifies the complete MCP tool interface
      expect(definition).toEqual({
        name: 'build_xcode',
        description: 'Build an Xcode project or workspace',
        inputSchema: sut.inputSchema
      });
    });
  });
  
  describe('input validation', () => {
    it('should accept valid input with all required fields', async () => {
      // Arrange
      const { sut, mockBuildUseCase, mockConfigProvider } = createSUT();
      const input = createValidInput();
      
      mockConfigProvider.getDerivedDataPath.mockReturnValue('/default/derived/data');
      mockBuildUseCase.execute.mockResolvedValue(createSuccessfulBuildResult());
      
      // Act & Assert - should not throw
      await expect(sut.handle(input)).resolves.toBeDefined();
    });
    
    it('should reject missing projectPath', async () => {
      // Arrange
      const { sut } = createSUT();
      const input = { 
        scheme: 'MyApp',
        destination: 'iOSSimulator'
      };
      
      // Act & Assert
      await expect(sut.handle(input)).rejects.toThrow();
    });
    
    it('should reject empty projectPath', async () => {
      // Arrange
      const { sut } = createSUT();
      const input = createValidInput({ projectPath: '' });
      
      // Act & Assert
      await expect(sut.handle(input)).rejects.toThrow();
    });
    
    it('should reject missing scheme', async () => {
      // Arrange
      const { sut } = createSUT();
      const input = { 
        projectPath: '/path/to/project.xcodeproj',
        destination: 'iOSSimulator'
      };
      
      // Act & Assert
      await expect(sut.handle(input)).rejects.toThrow();
    });
    
    it('should accept missing configuration (has default)', async () => {
      // Arrange
      const { sut, mockBuildUseCase, mockConfigProvider } = createSUT();
      const input = { 
        projectPath: '/path/to/project.xcodeproj',
        scheme: 'MyApp',
        destination: 'iOSSimulator'
        // configuration not provided - should use default
      };
      
      mockConfigProvider.getDerivedDataPath.mockReturnValue('/default/derived/data');
      mockBuildUseCase.execute.mockResolvedValue(createSuccessfulBuildResult());
      
      // Act & Assert - should not throw
      await expect(sut.handle(input)).resolves.toBeDefined();
    });
    
    it('should accept missing derivedDataPath (gets from config)', async () => {
      // Arrange
      const { sut, mockBuildUseCase, mockConfigProvider } = createSUT();
      const input = { 
        projectPath: '/path/to/project.xcodeproj',
        scheme: 'MyApp',
        destination: 'iOSSimulator',
        configuration: 'Debug'
        // derivedDataPath not provided - should get from config
      };
      
      mockConfigProvider.getDerivedDataPath.mockReturnValue('/default/derived/data');
      mockBuildUseCase.execute.mockResolvedValue(createSuccessfulBuildResult());
      
      // Act & Assert - should not throw
      await expect(sut.handle(input)).resolves.toBeDefined();
    });
    
    it('should reject invalid destination value', async () => {
      // Arrange
      const { sut } = createSUT();
      const input = createValidInput({ destination: 'AndroidEmulator' });
      
      // Act & Assert
      await expect(sut.handle(input)).rejects.toThrow();
    });
    
    it('should reject non-existent project file', async () => {
      // Arrange
      const { sut } = createSUT();
      const input = createValidInput({ projectPath: '/nonexistent/project.xcodeproj' });
      
      // Mock file doesn't exist
      mockExistsSync.mockReturnValue(false);
      
      // Act & Assert
      await expect(sut.handle(input)).rejects.toThrow();
    });
  });
});