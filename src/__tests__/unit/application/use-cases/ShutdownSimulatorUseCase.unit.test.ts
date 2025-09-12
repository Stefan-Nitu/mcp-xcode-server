import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { ShutdownSimulatorUseCase } from '../../../../application/use-cases/ShutdownSimulatorUseCase.js';
import { ShutdownRequest } from '../../../../domain/value-objects/ShutdownRequest.js';
import { ShutdownResult, ShutdownOutcome, SimulatorNotFoundError, ShutdownCommandFailedError } from '../../../../domain/entities/ShutdownResult.js';
import { SimulatorState } from '../../../../domain/value-objects/SimulatorState.js';
import { ISimulatorLocator, ISimulatorControl, SimulatorInfo } from '../../../../application/ports/SimulatorPorts.js';

describe('ShutdownSimulatorUseCase', () => {
  let useCase: ShutdownSimulatorUseCase;
  let mockLocator: jest.Mocked<ISimulatorLocator>;
  let mockControl: jest.Mocked<ISimulatorControl>;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockLocator = {
      findSimulator: jest.fn<ISimulatorLocator['findSimulator']>(),
      findBootedSimulator: jest.fn<ISimulatorLocator['findBootedSimulator']>()
    };
    
    mockControl = {
      boot: jest.fn<ISimulatorControl['boot']>(),
      shutdown: jest.fn<ISimulatorControl['shutdown']>()
    };
    
    useCase = new ShutdownSimulatorUseCase(mockLocator, mockControl);
  });

  describe('execute', () => {
    it('should shutdown a booted simulator', async () => {
      // Arrange
      const request = ShutdownRequest.create('iPhone-15');
      const simulatorInfo: SimulatorInfo = {
        id: 'ABC123',
        name: 'iPhone 15',
        state: SimulatorState.Booted,
        platform: 'iOS',
        runtime: 'iOS-17.0'
      };
      
      mockLocator.findSimulator.mockResolvedValue(simulatorInfo);
      mockControl.shutdown.mockResolvedValue(undefined);

      // Act
      const result = await useCase.execute(request);

      // Assert
      expect(mockLocator.findSimulator).toHaveBeenCalledWith('iPhone-15');
      expect(mockControl.shutdown).toHaveBeenCalledWith('ABC123');
      expect(result.outcome).toBe(ShutdownOutcome.Shutdown);
      expect(result.diagnostics.simulatorId).toBe('ABC123');
      expect(result.diagnostics.simulatorName).toBe('iPhone 15');
    });

    it('should handle already shutdown simulator', async () => {
      // Arrange
      const request = ShutdownRequest.create('iPhone-15');
      const simulatorInfo: SimulatorInfo = {
        id: 'ABC123',
        name: 'iPhone 15',
        state: SimulatorState.Shutdown,
        platform: 'iOS',
        runtime: 'iOS-17.0'
      };
      
      mockLocator.findSimulator.mockResolvedValue(simulatorInfo);

      // Act
      const result = await useCase.execute(request);

      // Assert
      expect(mockControl.shutdown).not.toHaveBeenCalled();
      expect(result.outcome).toBe(ShutdownOutcome.AlreadyShutdown);
      expect(result.diagnostics.simulatorId).toBe('ABC123');
      expect(result.diagnostics.simulatorName).toBe('iPhone 15');
    });

    it('should shutdown a simulator in Booting state', async () => {
      // Arrange
      const request = ShutdownRequest.create('iPhone-15');
      const simulatorInfo: SimulatorInfo = {
        id: 'ABC123',
        name: 'iPhone 15',
        state: SimulatorState.Booting,
        platform: 'iOS',
        runtime: 'iOS-17.0'
      };
      
      mockLocator.findSimulator.mockResolvedValue(simulatorInfo);
      mockControl.shutdown.mockResolvedValue(undefined);

      // Act
      const result = await useCase.execute(request);

      // Assert
      expect(mockControl.shutdown).toHaveBeenCalledWith('ABC123');
      expect(result.outcome).toBe(ShutdownOutcome.Shutdown);
    });

    it('should handle simulator in ShuttingDown state as already shutdown', async () => {
      // Arrange
      const request = ShutdownRequest.create('iPhone-15');
      const simulatorInfo: SimulatorInfo = {
        id: 'ABC123',
        name: 'iPhone 15',
        state: SimulatorState.ShuttingDown,
        platform: 'iOS',
        runtime: 'iOS-17.0'
      };
      
      mockLocator.findSimulator.mockResolvedValue(simulatorInfo);

      // Act
      const result = await useCase.execute(request);

      // Assert
      expect(mockControl.shutdown).not.toHaveBeenCalled();
      expect(result.outcome).toBe(ShutdownOutcome.AlreadyShutdown);
      expect(result.diagnostics.simulatorId).toBe('ABC123');
      expect(result.diagnostics.simulatorName).toBe('iPhone 15');
    });

    it('should return failure when simulator not found', async () => {
      // Arrange
      const request = ShutdownRequest.create('non-existent');
      mockLocator.findSimulator.mockResolvedValue(null);

      // Act
      const result = await useCase.execute(request);
      
      // Assert - Test behavior: simulator not found error
      expect(mockControl.shutdown).not.toHaveBeenCalled();
      expect(result.outcome).toBe(ShutdownOutcome.Failed);
      expect(result.diagnostics.error).toBeInstanceOf(SimulatorNotFoundError);
      expect((result.diagnostics.error as SimulatorNotFoundError).deviceId).toBe('non-existent');
    });

    it('should return failure on shutdown error', async () => {
      // Arrange
      const request = ShutdownRequest.create('iPhone-15');
      const simulatorInfo: SimulatorInfo = {
        id: 'ABC123',
        name: 'iPhone 15',
        state: SimulatorState.Booted,
        platform: 'iOS',
        runtime: 'iOS-17.0'
      };
      
      const shutdownError = new Error('Device is busy');
      (shutdownError as any).stderr = 'Device is busy';
      
      mockLocator.findSimulator.mockResolvedValue(simulatorInfo);
      mockControl.shutdown.mockRejectedValue(shutdownError);

      // Act
      const result = await useCase.execute(request);

      // Assert
      expect(result.outcome).toBe(ShutdownOutcome.Failed);
      expect(result.diagnostics.error).toBeInstanceOf(ShutdownCommandFailedError);
      expect((result.diagnostics.error as ShutdownCommandFailedError).stderr).toBe('Device is busy');
      expect(result.diagnostics.simulatorId).toBe('ABC123');
      expect(result.diagnostics.simulatorName).toBe('iPhone 15');
    });

    it('should handle shutdown error without stderr', async () => {
      // Arrange
      const request = ShutdownRequest.create('iPhone-15');
      const simulatorInfo: SimulatorInfo = {
        id: 'ABC123',
        name: 'iPhone 15',
        state: SimulatorState.Booted,
        platform: 'iOS',
        runtime: 'iOS-17.0'
      };
      
      const shutdownError = new Error('Unknown error');
      
      mockLocator.findSimulator.mockResolvedValue(simulatorInfo);
      mockControl.shutdown.mockRejectedValue(shutdownError);

      // Act
      const result = await useCase.execute(request);

      // Assert
      expect(result.outcome).toBe(ShutdownOutcome.Failed);
      expect(result.diagnostics.error).toBeInstanceOf(ShutdownCommandFailedError);
      expect((result.diagnostics.error as ShutdownCommandFailedError).stderr).toBe('Unknown error');
    });

    it('should handle shutdown error with empty message', async () => {
      // Arrange
      const request = ShutdownRequest.create('iPhone-15');
      const simulatorInfo: SimulatorInfo = {
        id: 'ABC123',
        name: 'iPhone 15',
        state: SimulatorState.Booted,
        platform: 'iOS',
        runtime: 'iOS-17.0'
      };
      
      const shutdownError = {};
      
      mockLocator.findSimulator.mockResolvedValue(simulatorInfo);
      mockControl.shutdown.mockRejectedValue(shutdownError);

      // Act
      const result = await useCase.execute(request);

      // Assert
      expect(result.outcome).toBe(ShutdownOutcome.Failed);
      expect(result.diagnostics.error).toBeInstanceOf(ShutdownCommandFailedError);
      expect((result.diagnostics.error as ShutdownCommandFailedError).stderr).toBe('');
    });

    it('should shutdown simulator by UUID', async () => {
      // Arrange
      const uuid = '550e8400-e29b-41d4-a716-446655440000';
      const request = ShutdownRequest.create(uuid);
      const simulatorInfo: SimulatorInfo = {
        id: uuid,
        name: 'iPhone 15 Pro',
        state: SimulatorState.Booted,
        platform: 'iOS',
        runtime: 'iOS-17.0'
      };
      
      mockLocator.findSimulator.mockResolvedValue(simulatorInfo);
      mockControl.shutdown.mockResolvedValue(undefined);

      // Act
      const result = await useCase.execute(request);

      // Assert
      expect(mockLocator.findSimulator).toHaveBeenCalledWith(uuid);
      expect(mockControl.shutdown).toHaveBeenCalledWith(uuid);
      expect(result.outcome).toBe(ShutdownOutcome.Shutdown);
      expect(result.diagnostics.simulatorId).toBe(uuid);
    });
  });
});