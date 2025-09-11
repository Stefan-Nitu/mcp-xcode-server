import { InstallResult, InstallOutcome, InstallCommandFailedError, SimulatorNotFoundError } from '../../../../domain/entities/InstallResult.js';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { InstallAppUseCase } from '../../../../application/use-cases/InstallAppUseCase.js';
import { InstallRequest } from '../../../../domain/value-objects/InstallRequest.js';
import { SimulatorState } from '../../../../domain/value-objects/SimulatorState.js';
import { 
  ISimulatorLocator,
  ISimulatorControl,
  IAppInstaller, 
  SimulatorInfo 
} from '../../../../application/ports/SimulatorPorts.js';
import { ILogManager } from '../../../../application/ports/LoggingPorts.js';

describe('InstallAppUseCase', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  function createSUT() {
    const mockFindSimulator = jest.fn<ISimulatorLocator['findSimulator']>();
    const mockFindBootedSimulator = jest.fn<ISimulatorLocator['findBootedSimulator']>();
    const mockSimulatorLocator: ISimulatorLocator = {
      findSimulator: mockFindSimulator,
      findBootedSimulator: mockFindBootedSimulator
    };

    const mockBoot = jest.fn<ISimulatorControl['boot']>();
    const mockShutdown = jest.fn<ISimulatorControl['shutdown']>();
    const mockSimulatorControl: ISimulatorControl = {
      boot: mockBoot,
      shutdown: mockShutdown
    };

    const mockInstallApp = jest.fn<IAppInstaller['installApp']>();
    const mockAppInstaller: IAppInstaller = {
      installApp: mockInstallApp
    };

    const mockSaveDebugData = jest.fn<ILogManager['saveDebugData']>();
    const mockSaveLog = jest.fn<ILogManager['saveLog']>();
    const mockLogManager: ILogManager = {
      saveDebugData: mockSaveDebugData,
      saveLog: mockSaveLog
    };

    const sut = new InstallAppUseCase(
      mockSimulatorLocator,
      mockSimulatorControl,
      mockAppInstaller,
      mockLogManager
    );

    return {
      sut,
      mockFindSimulator,
      mockFindBootedSimulator,
      mockBoot,
      mockInstallApp,
      mockSaveDebugData,
      mockSaveLog
    };
  }

  function createTestSimulator(state: SimulatorState = SimulatorState.Booted): SimulatorInfo {
    return {
      id: 'test-simulator-id',
      name: 'iPhone 15',
      state,
      platform: 'iOS',
      runtime: 'iOS 17.0'
    };
  }

  describe('when installing with specific simulator ID', () => {
    it('should install app on already booted simulator', async () => {
      // Arrange
      const { sut, mockFindSimulator, mockInstallApp } = createSUT();
      const request = InstallRequest.create('/path/to/MyApp.app', 'test-simulator-id');
      const simulator = createTestSimulator(SimulatorState.Booted);
      
      mockFindSimulator.mockResolvedValue(simulator);
      mockInstallApp.mockResolvedValue(undefined);

      // Act
      const result = await sut.execute(request);

      // Assert
      expect(result.outcome).toBe(InstallOutcome.Succeeded);
      expect(result.diagnostics.bundleId).toBe('MyApp.app');
      expect(result.diagnostics.simulatorId).toBe('test-simulator-id');
      expect(mockInstallApp).toHaveBeenCalledWith('/path/to/MyApp.app', 'test-simulator-id');
    });

    it('should auto-boot shutdown simulator before installing', async () => {
      // Arrange
      const { sut, mockFindSimulator, mockBoot, mockInstallApp } = createSUT();
      const request = InstallRequest.create('/path/to/MyApp.app', 'test-simulator-id');
      const simulator = createTestSimulator(SimulatorState.Shutdown);
      
      mockFindSimulator.mockResolvedValue(simulator);
      mockBoot.mockResolvedValue(undefined);
      mockInstallApp.mockResolvedValue(undefined);

      // Act
      const result = await sut.execute(request);

      // Assert
      expect(mockBoot).toHaveBeenCalledWith('test-simulator-id');
      expect(mockInstallApp).toHaveBeenCalledWith('/path/to/MyApp.app', 'test-simulator-id');
      expect(result.outcome).toBe(InstallOutcome.Succeeded);
    });

    it('should return failure when simulator not found', async () => {
      // Arrange
      const { sut, mockFindSimulator, mockSaveDebugData } = createSUT();
      const request = InstallRequest.create('/path/to/MyApp.app', 'non-existent-id');
      
      mockFindSimulator.mockResolvedValue(null);

      // Act
      const result = await sut.execute(request);

      // Assert
      expect(result.outcome).toBe(InstallOutcome.Failed);
      expect(result.diagnostics.error).toBeInstanceOf(SimulatorNotFoundError);
      expect((result.diagnostics.error as SimulatorNotFoundError).simulatorId).toBe('non-existent-id');
      expect(mockSaveDebugData).toHaveBeenCalledWith(
        'install-app-failed',
        expect.objectContaining({ reason: 'simulator_not_found' }),
        'MyApp.app'
      );
    });

    it('should return failure when boot fails', async () => {
      // Arrange  
      const { sut, mockFindSimulator, mockBoot, mockSaveDebugData } = createSUT();
      const request = InstallRequest.create('/path/to/MyApp.app', 'test-simulator-id');
      const simulator = createTestSimulator(SimulatorState.Shutdown);
      
      mockFindSimulator.mockResolvedValue(simulator);
      mockBoot.mockRejectedValue(new Error('Boot failed'));

      // Act
      const result = await sut.execute(request);

      // Assert
      expect(result.outcome).toBe(InstallOutcome.Failed);
      expect(result.diagnostics.error).toBeInstanceOf(InstallCommandFailedError);
      expect((result.diagnostics.error as InstallCommandFailedError).stderr).toBe('Boot failed');
      expect(mockSaveDebugData).toHaveBeenCalledWith(
        'simulator-boot-failed',
        expect.objectContaining({ error: 'Boot failed' }),
        'MyApp.app'
      );
    });
  });

  describe('when installing without simulator ID', () => {
    it('should use booted simulator', async () => {
      // Arrange
      const { sut, mockFindBootedSimulator, mockInstallApp } = createSUT();
      const request = InstallRequest.create('/path/to/MyApp.app');
      const simulator = createTestSimulator(SimulatorState.Booted);
      
      mockFindBootedSimulator.mockResolvedValue(simulator);
      mockInstallApp.mockResolvedValue(undefined);

      // Act
      const result = await sut.execute(request);

      // Assert
      expect(result.outcome).toBe(InstallOutcome.Succeeded);
      expect(result.diagnostics.simulatorId).toBe('test-simulator-id');
      expect(mockFindBootedSimulator).toHaveBeenCalled();
      expect(mockInstallApp).toHaveBeenCalledWith('/path/to/MyApp.app', 'test-simulator-id');
    });

    it('should return failure when no booted simulator found', async () => {
      // Arrange
      const { sut, mockFindBootedSimulator, mockSaveDebugData } = createSUT();
      const request = InstallRequest.create('/path/to/MyApp.app');
      
      mockFindBootedSimulator.mockResolvedValue(null);

      // Act
      const result = await sut.execute(request);

      // Assert
      expect(result.outcome).toBe(InstallOutcome.Failed);
      expect(result.diagnostics.error).toBeInstanceOf(SimulatorNotFoundError);
      expect((result.diagnostics.error as SimulatorNotFoundError).simulatorId).toBe('booted');
      expect(mockSaveDebugData).toHaveBeenCalledWith(
        'install-app-failed',
        expect.objectContaining({ reason: 'simulator_not_found' }),
        'MyApp.app'
      );
    });
  });

  describe('when installation fails', () => {
    it('should return failure with error message', async () => {
      // Arrange
      const { sut, mockFindSimulator, mockInstallApp, mockSaveDebugData } = createSUT();
      const request = InstallRequest.create('/path/to/MyApp.app', 'test-simulator-id');
      const simulator = createTestSimulator(SimulatorState.Booted);
      
      mockFindSimulator.mockResolvedValue(simulator);
      mockInstallApp.mockRejectedValue(new Error('Code signing error'));

      // Act
      const result = await sut.execute(request);

      // Assert
      expect(result.outcome).toBe(InstallOutcome.Failed);
      expect(result.diagnostics.error).toBeInstanceOf(InstallCommandFailedError);
      expect((result.diagnostics.error as InstallCommandFailedError).stderr).toBe('Code signing error');
      expect(mockSaveDebugData).toHaveBeenCalledWith(
        'install-app-error',
        expect.objectContaining({ error: 'Code signing error' }),
        'MyApp.app'
      );
    });

    it('should handle generic error', async () => {
      // Arrange
      const { sut, mockFindSimulator, mockInstallApp } = createSUT();
      const request = InstallRequest.create('/path/to/MyApp.app', 'test-simulator-id');
      const simulator = createTestSimulator(SimulatorState.Booted);
      
      mockFindSimulator.mockResolvedValue(simulator);
      mockInstallApp.mockRejectedValue('String error');

      // Act
      const result = await sut.execute(request);

      // Assert
      expect(result.outcome).toBe(InstallOutcome.Failed);
      expect(result.diagnostics.error).toBeInstanceOf(InstallCommandFailedError);
      expect((result.diagnostics.error as InstallCommandFailedError).stderr).toBe('String error');
    });
  });

  describe('debug data logging', () => {
    it('should log success with app name and simulator info', async () => {
      // Arrange
      const { sut, mockFindSimulator, mockInstallApp, mockSaveDebugData } = createSUT();
      const request = InstallRequest.create('/path/to/MyApp.app', 'test-simulator-id');
      const simulator = createTestSimulator(SimulatorState.Booted);
      
      mockFindSimulator.mockResolvedValue(simulator);
      mockInstallApp.mockResolvedValue(undefined);

      // Act
      await sut.execute(request);

      // Assert
      expect(mockSaveDebugData).toHaveBeenCalledWith(
        'install-app-success',
        expect.objectContaining({
          simulator: 'iPhone 15',
          simulatorId: 'test-simulator-id',
          app: 'MyApp.app'
        }),
        'MyApp.app'
      );
    });

    it('should log auto-boot event', async () => {
      // Arrange
      const { sut, mockFindSimulator, mockBoot, mockInstallApp, mockSaveDebugData } = createSUT();
      const request = InstallRequest.create('/path/to/MyApp.app', 'test-simulator-id');
      const simulator = createTestSimulator(SimulatorState.Shutdown);
      
      mockFindSimulator.mockResolvedValue(simulator);
      mockBoot.mockResolvedValue(undefined);
      mockInstallApp.mockResolvedValue(undefined);

      // Act
      await sut.execute(request);

      // Assert
      expect(mockSaveDebugData).toHaveBeenCalledWith(
        'simulator-auto-booted',
        expect.objectContaining({
          simulatorId: 'test-simulator-id',
          simulatorName: 'iPhone 15'
        }),
        'MyApp.app'
      );
    });
  });
});