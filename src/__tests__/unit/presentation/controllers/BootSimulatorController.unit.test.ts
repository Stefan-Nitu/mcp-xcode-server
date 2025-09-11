import { describe, it, expect, jest } from '@jest/globals';
import { BootSimulatorController } from '../../../../presentation/controllers/BootSimulatorController.js';
import { BootSimulatorUseCase } from '../../../../application/use-cases/BootSimulatorUseCase.js';
import { BootRequest } from '../../../../domain/value-objects/BootRequest.js';
import { BootResult, BootOutcome, BootCommandFailedError } from '../../../../domain/entities/BootResult.js';

describe('BootSimulatorController', () => {
  function createSUT() {
    const mockExecute = jest.fn<(request: BootRequest) => Promise<BootResult>>();
    const mockUseCase: Partial<BootSimulatorUseCase> = {
      execute: mockExecute
    };
    const sut = new BootSimulatorController(mockUseCase as BootSimulatorUseCase);
    return { sut, mockExecute };
  }

  describe('MCP tool interface', () => {
    it('should define correct tool metadata', () => {
      // Arrange
      const { sut } = createSUT();
      
      // Act
      const definition = sut.getToolDefinition();
      
      // Assert
      expect(definition.name).toBe('boot_simulator');
      expect(definition.description).toBe('Boot a simulator');
      expect(definition.inputSchema).toBeDefined();
    });

    it('should define correct input schema', () => {
      // Arrange
      const { sut } = createSUT();
      
      // Act
      const schema = sut.inputSchema;
      
      // Assert
      expect(schema.type).toBe('object');
      expect(schema.properties.deviceId).toBeDefined();
      expect(schema.properties.deviceId.type).toBe('string');
      expect(schema.required).toEqual(['deviceId']);
    });
  });

  describe('execute', () => {
    it('should boot simulator successfully', async () => {
      // Arrange
      const { sut, mockExecute } = createSUT();
      const mockResult = BootResult.booted('ABC123', 'iPhone 15', {
        platform: 'iOS',
        runtime: 'iOS-17.0'
      });
      mockExecute.mockResolvedValue(mockResult);
      
      // Act
      const result = await sut.execute({
        deviceId: 'iPhone-15'
      });
      
      // Assert
      expect(mockExecute).toHaveBeenCalledWith(
        expect.any(BootRequest)
      );
      expect(result.content[0].text).toBe('✅ Successfully booted simulator: iPhone 15 (ABC123)');
    });

    it('should handle already booted simulator', async () => {
      // Arrange
      const { sut, mockExecute } = createSUT();
      const mockResult = BootResult.alreadyBooted('ABC123', 'iPhone 15');
      mockExecute.mockResolvedValue(mockResult);
      
      // Act
      const result = await sut.execute({
        deviceId: 'iPhone-15'
      });
      
      // Assert
      expect(result.content[0].text).toBe('✅ Simulator already booted: iPhone 15 (ABC123)');
    });

    it('should handle boot failure', async () => {
      // Arrange
      const { sut, mockExecute } = createSUT();
      const mockResult = BootResult.failed(
        'ABC123', 
        'iPhone 15', 
        new BootCommandFailedError('Device is locked')
      );
      mockExecute.mockResolvedValue(mockResult);
      
      // Act
      const result = await sut.execute({
        deviceId: 'iPhone-15'
      });
      
      // Assert - Error with ❌ emoji prefix and simulator context
      expect(result.content[0].text).toBe('❌ iPhone 15 (ABC123) - Device is locked');
    });

    it('should validate required deviceId', async () => {
      // Arrange
      const { sut } = createSUT();
      
      // Act
      const result = await sut.execute({} as any);
      
      // Assert
      expect(result.content[0].text).toBe('❌ Device ID is required');
    });

    it('should validate empty deviceId', async () => {
      // Arrange
      const { sut } = createSUT();
      
      // Act
      const result = await sut.execute({ deviceId: '' });
      
      // Assert
      expect(result.content[0].text).toBe('❌ Device ID cannot be empty');
    });

    it('should validate whitespace-only deviceId', async () => {
      // Arrange
      const { sut } = createSUT();
      
      // Act
      const result = await sut.execute({ deviceId: '   ' });
      
      // Assert
      expect(result.content[0].text).toBe('❌ Device ID cannot be whitespace only');
    });

    it('should pass UUID directly to use case', async () => {
      // Arrange
      const { sut, mockExecute } = createSUT();
      const uuid = '838C707D-5703-4AEE-AF43-4798E0BA1B05';
      const mockResult = BootResult.booted(uuid, 'iPhone 15');
      mockExecute.mockResolvedValue(mockResult);
      
      // Act
      await sut.execute({ deviceId: uuid });
      
      // Assert
      const calledWith = mockExecute.mock.calls[0][0];
      expect(calledWith.deviceId).toBe(uuid);
    });
  });
});