import { describe, it, expect, jest } from '@jest/globals';
import { ListSimulatorsController } from '../../controllers/ListSimulatorsController.js';
import { ListSimulatorsUseCase } from '../../use-cases/ListSimulatorsUseCase.js';
import { ListSimulatorsRequest } from '../../domain/ListSimulatorsRequest.js';
import { ListSimulatorsResult, SimulatorInfo } from '../../domain/ListSimulatorsResult.js';
import { SimulatorState } from '../../domain/SimulatorState.js';

describe('ListSimulatorsController', () => {
  function createSUT() {
    const mockExecute = jest.fn<(request: ListSimulatorsRequest) => Promise<ListSimulatorsResult>>();
    const mockUseCase: Partial<ListSimulatorsUseCase> = {
      execute: mockExecute
    };
    const sut = new ListSimulatorsController(mockUseCase as ListSimulatorsUseCase);
    return { sut, mockExecute };
  }

  describe('MCP tool interface', () => {
    it('should define correct tool metadata', () => {
      // Arrange
      const { sut } = createSUT();

      // Act
      const definition = sut.getToolDefinition();

      // Assert
      expect(definition.name).toBe('list_simulators');
      expect(definition.description).toBe('List available iOS simulators');
      expect(definition.inputSchema).toBeDefined();
    });

    it('should define correct input schema with optional filters', () => {
      // Arrange
      const { sut } = createSUT();

      // Act
      const schema = sut.inputSchema;

      // Assert
      expect(schema.type).toBe('object');
      expect(schema.properties.platform).toBeDefined();
      expect(schema.properties.platform.type).toBe('string');
      expect(schema.properties.platform.enum).toEqual(['iOS', 'tvOS', 'watchOS', 'visionOS']);
      expect(schema.properties.state).toBeDefined();
      expect(schema.properties.state.type).toBe('string');
      expect(schema.properties.state.enum).toEqual(['Booted', 'Shutdown']);
      expect(schema.required).toEqual([]);
    });
  });

  describe('execute', () => {
    it('should list all simulators without filters', async () => {
      // Arrange
      const { sut, mockExecute } = createSUT();
      const simulators: SimulatorInfo[] = [
        {
          udid: 'ABC123',
          name: 'iPhone 15',
          state: SimulatorState.Booted,
          platform: 'iOS',
          runtime: 'iOS 17.0'
        },
        {
          udid: 'DEF456',
          name: 'iPad Pro',
          state: SimulatorState.Shutdown,
          platform: 'iOS',
          runtime: 'iOS 17.0'
        }
      ];
      const mockResult = ListSimulatorsResult.success(simulators);
      mockExecute.mockResolvedValue(mockResult);

      // Act
      const result = await sut.execute({});

      // Assert
      expect(mockExecute).toHaveBeenCalledWith(
        expect.any(ListSimulatorsRequest)
      );
      expect(result.content[0].text).toContain('Found 2 simulators');
      expect(result.content[0].text).toContain('iPhone 15 (ABC123) - Booted');
      expect(result.content[0].text).toContain('iPad Pro (DEF456) - Shutdown');
    });

    it('should filter by platform', async () => {
      // Arrange
      const { sut, mockExecute } = createSUT();
      const simulators: SimulatorInfo[] = [
        {
          udid: 'ABC123',
          name: 'iPhone 15',
          state: SimulatorState.Booted,
          platform: 'iOS',
          runtime: 'iOS 17.0'
        }
      ];
      const mockResult = ListSimulatorsResult.success(simulators);
      mockExecute.mockResolvedValue(mockResult);

      // Act
      const result = await sut.execute({ platform: 'iOS' });

      // Assert
      expect(mockExecute).toHaveBeenCalledWith(
        expect.objectContaining({
          platform: 'iOS'
        })
      );
      expect(result.content[0].text).toContain('Found 1 simulator');
    });

    it('should filter by state', async () => {
      // Arrange
      const { sut, mockExecute } = createSUT();
      const simulators: SimulatorInfo[] = [
        {
          udid: 'ABC123',
          name: 'iPhone 15',
          state: SimulatorState.Booted,
          platform: 'iOS',
          runtime: 'iOS 17.0'
        }
      ];
      const mockResult = ListSimulatorsResult.success(simulators);
      mockExecute.mockResolvedValue(mockResult);

      // Act
      const result = await sut.execute({ state: 'Booted' });

      // Assert
      expect(mockExecute).toHaveBeenCalledWith(
        expect.objectContaining({
          state: 'Booted'
        })
      );
      expect(result.content[0].text).toContain('✅');
    });

    it('should handle no simulators found', async () => {
      // Arrange
      const { sut, mockExecute } = createSUT();
      const mockResult = ListSimulatorsResult.success([]);
      mockExecute.mockResolvedValue(mockResult);

      // Act
      const result = await sut.execute({});

      // Assert
      expect(result.content[0].text).toBe('⚠️ No simulators found');
    });

    it('should handle errors gracefully', async () => {
      // Arrange
      const { sut, mockExecute } = createSUT();
      const mockResult = ListSimulatorsResult.failed(new Error('Failed to list devices'));
      mockExecute.mockResolvedValue(mockResult);

      // Act
      const result = await sut.execute({});

      // Assert
      expect(result.content[0].text).toContain('❌');
      expect(result.content[0].text).toContain('Failed to list devices');
    });

    it('should format simulators with runtime info', async () => {
      // Arrange
      const { sut, mockExecute } = createSUT();
      const simulators: SimulatorInfo[] = [
        {
          udid: 'ABC123',
          name: 'iPhone 15 Pro Max',
          state: SimulatorState.Booted,
          platform: 'iOS',
          runtime: 'iOS 17.2'
        }
      ];
      const mockResult = ListSimulatorsResult.success(simulators);
      mockExecute.mockResolvedValue(mockResult);

      // Act
      const result = await sut.execute({});

      // Assert
      expect(result.content[0].text).toContain('iOS 17.2');
    });

    it('should return validation error for invalid input', async () => {
      // Arrange
      const { sut } = createSUT();

      // Act
      const result = await sut.execute({
        platform: 'invalid'
      });

      // Assert
      expect(result.content[0].text).toBe('❌ Invalid platform: invalid. Valid values are: iOS, macOS, tvOS, watchOS, visionOS');
    });
  });
});