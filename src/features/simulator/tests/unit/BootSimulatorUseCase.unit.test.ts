import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { BootSimulatorUseCase } from '../../use-cases/BootSimulatorUseCase.js';
import { BootRequest } from '../../domain/BootRequest.js';
import { DeviceId } from '../../../../shared/domain/DeviceId.js';
import { BootResult, BootOutcome, SimulatorNotFoundError, BootCommandFailedError, SimulatorBusyError } from '../../domain/BootResult.js';
import { SimulatorState } from '../../domain/SimulatorState.js';
import { ISimulatorLocator, ISimulatorControl, SimulatorInfo } from '../../../../application/ports/SimulatorPorts.js';

describe('BootSimulatorUseCase', () => {
  let useCase: BootSimulatorUseCase;
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
    
    useCase = new BootSimulatorUseCase(mockLocator, mockControl);
  });

  describe('execute', () => {
    it('should boot a shutdown simulator', async () => {
      // Arrange
      const request = BootRequest.create(DeviceId.create('iPhone-15'));
      const simulatorInfo: SimulatorInfo = {
        id: 'ABC123',
        name: 'iPhone 15',
        state: SimulatorState.Shutdown,
        platform: 'iOS',
        runtime: 'iOS-17.0'
      };
      
      mockLocator.findSimulator.mockResolvedValue(simulatorInfo);
      mockControl.boot.mockResolvedValue(undefined);

      // Act
      const result = await useCase.execute(request);

      // Assert
      expect(mockLocator.findSimulator).toHaveBeenCalledWith('iPhone-15');
      expect(mockControl.boot).toHaveBeenCalledWith('ABC123');
      expect(result.outcome).toBe(BootOutcome.Booted);
      expect(result.diagnostics.simulatorId).toBe('ABC123');
      expect(result.diagnostics.simulatorName).toBe('iPhone 15');
      expect(result.diagnostics.platform).toBe('iOS');
      expect(result.diagnostics.runtime).toBe('iOS-17.0');
    });

    it('should handle already booted simulator', async () => {
      // Arrange
      const request = BootRequest.create(DeviceId.create('iPhone-15'));
      const simulatorInfo: SimulatorInfo = {
        id: 'ABC123',
        name: 'iPhone 15',
        state: SimulatorState.Booted,
        platform: 'iOS',
        runtime: 'iOS-17.0'
      };
      
      mockLocator.findSimulator.mockResolvedValue(simulatorInfo);

      // Act
      const result = await useCase.execute(request);

      // Assert
      expect(mockControl.boot).not.toHaveBeenCalled();
      expect(result.outcome).toBe(BootOutcome.AlreadyBooted);
      expect(result.diagnostics.simulatorId).toBe('ABC123');
    });

    it('should return failure when simulator not found', async () => {
      // Arrange
      const request = BootRequest.create(DeviceId.create('non-existent'));
      mockLocator.findSimulator.mockResolvedValue(null);

      // Act
      const result = await useCase.execute(request);
      
      // Assert - Test behavior: simulator not found error
      expect(mockControl.boot).not.toHaveBeenCalled();
      expect(result.outcome).toBe(BootOutcome.Failed);
      expect(result.diagnostics.error).toBeInstanceOf(SimulatorNotFoundError);
      expect((result.diagnostics.error as SimulatorNotFoundError).deviceId).toBe('non-existent');
    });

    it('should return failure on boot error', async () => {
      // Arrange
      const request = BootRequest.create(DeviceId.create('iPhone-15'));
      const simulatorInfo: SimulatorInfo = {
        id: 'ABC123',
        name: 'iPhone 15',
        state: SimulatorState.Shutdown,
        platform: 'iOS',
        runtime: 'iOS-17.0'
      };
      
      mockLocator.findSimulator.mockResolvedValue(simulatorInfo);
      mockControl.boot.mockRejectedValue(new Error('Boot failed'));

      // Act
      const result = await useCase.execute(request);

      // Assert - Test behavior: boot command failed error
      expect(result.outcome).toBe(BootOutcome.Failed);
      expect(result.diagnostics.error).toBeInstanceOf(BootCommandFailedError);
      expect((result.diagnostics.error as BootCommandFailedError).stderr).toBe('Boot failed');
    });

    it('should boot simulator found by UUID', async () => {
      // Arrange
      const uuid = '838C707D-5703-4AEE-AF43-4798E0BA1B05';
      const request = BootRequest.create(DeviceId.create(uuid));
      const simulatorInfo: SimulatorInfo = {
        id: uuid,
        name: 'iPhone 15',
        state: SimulatorState.Shutdown,
        platform: 'iOS',
        runtime: 'iOS-17.0'
      };
      
      mockLocator.findSimulator.mockResolvedValue(simulatorInfo);
      mockControl.boot.mockResolvedValue(undefined);

      // Act
      const result = await useCase.execute(request);

      // Assert
      expect(mockLocator.findSimulator).toHaveBeenCalledWith(uuid);
      expect(mockControl.boot).toHaveBeenCalledWith(uuid);
      expect(result.outcome).toBe(BootOutcome.Booted);
      expect(result.diagnostics.simulatorId).toBe(uuid);
    });

    it('should handle simulator in Booting state as already booted', async () => {
      // Arrange
      const request = BootRequest.create(DeviceId.create('iPhone-15'));
      const simulatorInfo: SimulatorInfo = {
        id: 'ABC123',
        name: 'iPhone 15',
        state: SimulatorState.Booting,
        platform: 'iOS',
        runtime: 'iOS-17.0'
      };
      
      mockLocator.findSimulator.mockResolvedValue(simulatorInfo);

      // Act
      const result = await useCase.execute(request);

      // Assert
      expect(mockControl.boot).not.toHaveBeenCalled();
      expect(result.outcome).toBe(BootOutcome.AlreadyBooted);
      expect(result.diagnostics.simulatorId).toBe('ABC123');
      expect(result.diagnostics.simulatorName).toBe('iPhone 15');
    });

    it('should return failure when simulator is ShuttingDown', async () => {
      // Arrange
      const request = BootRequest.create(DeviceId.create('iPhone-15'));
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
      expect(mockControl.boot).not.toHaveBeenCalled();
      expect(result.outcome).toBe(BootOutcome.Failed);
      expect(result.diagnostics.error).toBeInstanceOf(SimulatorBusyError);
      expect((result.diagnostics.error as SimulatorBusyError).currentState).toBe(SimulatorState.ShuttingDown);
      expect(result.diagnostics.simulatorId).toBe('ABC123');
      expect(result.diagnostics.simulatorName).toBe('iPhone 15');
    });

  });
});