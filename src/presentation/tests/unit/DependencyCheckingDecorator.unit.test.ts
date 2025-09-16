import { describe, it, expect, jest } from '@jest/globals';
import { DependencyCheckingDecorator } from '../../decorators/DependencyCheckingDecorator.js';
import { MCPController } from '../../interfaces/MCPController.js';
import { MCPResponse } from '../../interfaces/MCPResponse.js';
import { IDependencyChecker, MissingDependency } from '../../interfaces/IDependencyChecker.js';

describe('DependencyCheckingDecorator', () => {
  function createSUT(missingDeps: MissingDependency[] = []) {
    // Create mock controller
    const mockExecute = jest.fn<(args: unknown) => Promise<MCPResponse>>();
    const mockController: MCPController = {
      name: 'test_tool',
      description: 'Test tool',
      inputSchema: {},
      execute: mockExecute,
      getToolDefinition: () => ({
        name: 'test_tool',
        description: 'Test tool',
        inputSchema: {}
      })
    };

    // Create mock dependency checker
    const mockCheck = jest.fn<IDependencyChecker['check']>();
    mockCheck.mockResolvedValue(missingDeps);
    const mockChecker: IDependencyChecker = {
      check: mockCheck
    };

    // Create decorator
    const sut = new DependencyCheckingDecorator(
      mockController,
      ['xcodebuild', 'xcbeautify'],
      mockChecker
    );

    return { sut, mockExecute, mockCheck };
  }

  describe('execute', () => {
    it('should execute controller when all dependencies are available', async () => {
      // Arrange
      const { sut, mockExecute } = createSUT([]); // No missing dependencies
      const args = { someArg: 'value' };
      const expectedResponse = {
        content: [{ type: 'text', text: 'Success' }]
      };
      mockExecute.mockResolvedValue(expectedResponse);

      // Act
      const result = await sut.execute(args);

      // Assert - behavior: delegates to controller
      expect(result).toBe(expectedResponse);
      expect(mockExecute).toHaveBeenCalledWith(args);
    });

    it('should return error when dependencies are missing', async () => {
      // Arrange
      const missingDeps: MissingDependency[] = [
        { name: 'xcbeautify', installCommand: 'brew install xcbeautify' }
      ];
      const { sut, mockExecute } = createSUT(missingDeps);

      // Act
      const result = await sut.execute({});

      // Assert - behavior: returns error, doesn't execute controller
      expect(result.content[0].text).toContain('Missing required dependencies');
      expect(result.content[0].text).toContain('xcbeautify');
      expect(result.content[0].text).toContain('brew install xcbeautify');
      expect(mockExecute).not.toHaveBeenCalled();
    });

    it('should format multiple missing dependencies clearly', async () => {
      // Arrange
      const missingDeps: MissingDependency[] = [
        { name: 'xcodebuild', installCommand: 'Install Xcode from the App Store' },
        { name: 'xcbeautify', installCommand: 'brew install xcbeautify' }
      ];
      const { sut, mockExecute } = createSUT(missingDeps);

      // Act
      const result = await sut.execute({});

      // Assert - behavior: shows all missing dependencies
      expect(result.content[0].text).toContain('xcodebuild');
      expect(result.content[0].text).toContain('Install Xcode from the App Store');
      expect(result.content[0].text).toContain('xcbeautify');
      expect(result.content[0].text).toContain('brew install xcbeautify');
      expect(mockExecute).not.toHaveBeenCalled();
    });

    it('should handle dependencies without install commands', async () => {
      // Arrange
      const missingDeps: MissingDependency[] = [
        { name: 'customtool' } // No install command
      ];
      const { sut, mockExecute } = createSUT(missingDeps);

      // Act
      const result = await sut.execute({});

      // Assert - behavior: shows tool name without install command
      expect(result.content[0].text).toContain('customtool');
      expect(result.content[0].text).not.toContain('undefined');
      expect(mockExecute).not.toHaveBeenCalled();
    });
  });

  describe('getToolDefinition', () => {
    it('should delegate to decoratee', () => {
      // Arrange
      const { sut } = createSUT();

      // Act
      const definition = sut.getToolDefinition();

      // Assert - behavior: returns controller's definition
      expect(definition).toEqual({
        name: 'test_tool',
        description: 'Test tool',
        inputSchema: {}
      });
    });
  });

  describe('properties', () => {
    it('should delegate properties to decoratee', () => {
      // Arrange
      const { sut } = createSUT();

      // Act & Assert - behavior: properties match controller
      expect(sut.name).toBe('test_tool');
      expect(sut.description).toBe('Test tool');
      expect(sut.inputSchema).toEqual({});
    });
  });
});