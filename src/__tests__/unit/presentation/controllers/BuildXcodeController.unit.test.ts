import { describe, it, expect } from '@jest/globals';
import { BuildXcodeController } from '../../../../presentation/controllers/BuildXcodeController.js';
import { BuildProjectUseCase } from '../../../../application/use-cases/BuildProjectUseCase.js';
import { BuildXcodePresenter } from '../../../../presentation/presenters/BuildXcodePresenter.js';
import { ConfigProviderAdapter } from '../../../../infrastructure/adapters/ConfigProviderAdapter.js';

/**
 * Unit tests for BuildXcodeController
 * 
 * Following testing philosophy from TESTING-PHILOSOPHY.md:
 * - Controllers are pure orchestrators - no logic to unit test
 * - Unit tests here ONLY verify the MCP tool contract
 * - All behavior testing belongs in integration tests
 */
describe('BuildXcodeController', () => {
  function createSUT() {
    // Create minimal mocks just to instantiate the controller
    const mockBuildUseCase = {} as BuildProjectUseCase;
    const mockPresenter = {} as BuildXcodePresenter;
    const mockConfigProvider = {} as ConfigProviderAdapter;
    
    return new BuildXcodeController(
      mockBuildUseCase,
      mockPresenter,
      mockConfigProvider
    );
  }
  
  describe('MCP tool contract', () => {
    it('should define correct tool name', () => {
      // Arrange
      const sut = createSUT();
      
      // Assert
      expect(sut.name).toBe('build_xcode');
    });
    
    it('should define correct tool description', () => {
      // Arrange
      const sut = createSUT();
      
      // Assert
      expect(sut.description).toBe('Build an Xcode project or workspace');
    });
    
    it('should define input schema with required fields', () => {
      // Arrange
      const sut = createSUT();
      
      // Assert
      expect(sut.inputSchema).toMatchObject({
        type: 'object',
        properties: {
          projectPath: expect.any(Object),
          scheme: expect.any(Object),
          destination: expect.any(Object),
          configuration: expect.any(Object),
          derivedDataPath: expect.any(Object)
        },
        required: ['projectPath', 'scheme', 'destination']
      });
    });
    
    it('should return complete tool definition', () => {
      // Arrange
      const sut = createSUT();
      
      // Act
      const definition = sut.getToolDefinition();
      
      // Assert
      expect(definition).toEqual({
        name: 'build_xcode',
        description: 'Build an Xcode project or workspace',
        inputSchema: sut.inputSchema
      });
    });
  });
});