import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { InstallAppController } from '../../controllers/InstallAppController.js';
import { InstallAppUseCase } from '../../use-cases/InstallAppUseCase.js';
import { InstallRequest } from '../../domain/InstallRequest.js';
import { InstallResult } from '../../domain/InstallResult.js';
import { AppPath } from '../../../../shared/domain/AppPath.js';
import { DeviceId } from '../../../../shared/domain/DeviceId.js';

describe('InstallAppController', () => {
  function createSUT() {
    const mockExecute = jest.fn<(request: InstallRequest) => Promise<InstallResult>>();
    const mockUseCase: Partial<InstallAppUseCase> = {
      execute: mockExecute
    };
    const sut = new InstallAppController(mockUseCase as InstallAppUseCase);
    return { sut, mockExecute };
  }

  describe('MCP tool interface', () => {
    it('should define correct tool metadata', () => {
      const { sut } = createSUT();
      
      const definition = sut.getToolDefinition();
      
      expect(definition.name).toBe('install_app');
      expect(definition.description).toBe('Install an app on the simulator');
      expect(definition.inputSchema).toBeDefined();
    });

    it('should define correct input schema', () => {
      const { sut } = createSUT();
      
      const schema = sut.inputSchema;
      
      expect(schema.type).toBe('object');
      expect(schema.properties.appPath).toBeDefined();
      expect(schema.properties.simulatorId).toBeDefined();
      expect(schema.required).toEqual(['appPath']);
    });
  });

  describe('execute', () => {
    it('should install app on specified simulator', async () => {
      // Arrange
      const { sut, mockExecute } = createSUT();
      const mockResult = InstallResult.succeeded(
        'com.example.app',
        DeviceId.create('iPhone-15-Simulator'),
        'iPhone 15',
        AppPath.create('/path/to/app.app')
      );
      mockExecute.mockResolvedValue(mockResult);
      
      // Act
      const result = await sut.execute({
        appPath: '/path/to/app.app',
        simulatorId: 'iPhone-15-Simulator'
      });
      
      // Assert
      expect(mockExecute).toHaveBeenCalledWith(
        expect.any(InstallRequest)
      );
      expect(result.content[0].text).toBe('✅ Successfully installed com.example.app on iPhone 15 (iPhone-15-Simulator)');
    });

    it('should install app on booted simulator when no ID specified', async () => {
      // Arrange
      const { sut, mockExecute } = createSUT();
      const mockResult = InstallResult.succeeded(
        'com.example.app',
        DeviceId.create('Booted-iPhone-15'),
        'iPhone 15',
        AppPath.create('/path/to/app.app')
      );
      mockExecute.mockResolvedValue(mockResult);
      
      // Act
      const result = await sut.execute({
        appPath: '/path/to/app.app'
      });
      
      // Assert
      expect(mockExecute).toHaveBeenCalledWith(
        expect.any(InstallRequest)
      );
      expect(result.content[0].text).toBe('✅ Successfully installed com.example.app on iPhone 15 (Booted-iPhone-15)');
    });

    it('should handle validation errors', async () => {
      // Arrange
      const { sut } = createSUT();
      
      // Act
      const result = await sut.execute({
        // Missing required appPath
        simulatorId: 'test-sim'
      });
      
      // Assert
      expect(result.content[0].text).toBe('❌ App path is required');
    });

    it('should handle use case errors', async () => {
      // Arrange
      const { sut, mockExecute } = createSUT();
      mockExecute.mockRejectedValue(new Error('Simulator not found'));
      
      // Act
      const result = await sut.execute({
        appPath: '/path/to/app.app',
        simulatorId: 'non-existent'
      });
      
      // Assert
      expect(result.content[0].text).toBe('❌ Simulator not found');
    });

    it('should validate app path format', async () => {
      // Arrange
      const { sut } = createSUT();

      // Act
      const result = await sut.execute({
        appPath: '../../../etc/passwd' // Path traversal attempt
      });

      // Assert
      expect(result.content[0].text).toBe('❌ App path cannot contain directory traversal');
    });

    it('should handle app not found errors', async () => {
      // Arrange
      const { sut, mockExecute } = createSUT();
      mockExecute.mockRejectedValue(new Error('App bundle not found at path'));
      
      // Act
      const result = await sut.execute({
        appPath: '/non/existent/app.app'
      });
      
      // Assert
      expect(result.content[0].text).toBe('❌ App bundle not found at path');
    });
  });

});