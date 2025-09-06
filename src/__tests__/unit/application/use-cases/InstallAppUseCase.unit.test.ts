import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { InstallAppUseCase } from '../../../../application/use-cases/InstallAppUseCase.js';
import { AppPath } from '../../../../domain/value-objects/AppPath.js';
import { SimulatorState } from '../../../../domain/value-objects/SimulatorState.js';
import { 
  ISimulatorLocator, 
  ISimulatorStateQuery,
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

    const mockGetState = jest.fn<ISimulatorStateQuery['getState']>();
    const mockStateQuery: ISimulatorStateQuery = {
      getState: mockGetState
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
      mockStateQuery,
      mockSimulatorControl,
      mockAppInstaller,
      mockLogManager
    );

    return {
      sut,
      mockFindSimulator,
      mockFindBootedSimulator,
      mockGetState,
      mockBoot,
      mockInstallApp,
      mockSaveDebugData
    };
  }

  function createTestSimulator(): SimulatorInfo {
    return {
      id: 'test-simulator-id',
      name: 'iPhone 15',
      platform: 'iOS',
      runtime: 'iOS 17.0'
    };
  }

  describe('when installing with specific simulator ID', () => {
    it('should install app on already booted simulator', async () => {
      // Arrange
      const { sut, mockFindSimulator, mockGetState, mockInstallApp } = createSUT();
      const appPath = AppPath.create('/path/to/MyApp.app');
      const simulator = createTestSimulator();
      
      mockFindSimulator.mockResolvedValue(simulator);
      mockGetState.mockResolvedValue(SimulatorState.Booted);
      mockInstallApp.mockResolvedValue(undefined);

      // Act
      const result = await sut.execute({
        appPath,
        simulatorId: 'test-simulator-id'
      });

      // Assert
      expect(result).toEqual({
        success: true,
        message: 'Successfully installed MyApp.app on iPhone 15',
        simulatorName: 'iPhone 15',
        appName: 'MyApp.app'
      });
      expect(mockInstallApp).toHaveBeenCalledWith('/path/to/MyApp.app', 'test-simulator-id');
    });

    it('should auto-boot shutdown simulator before installing', async () => {
      // Arrange
      const { sut, mockFindSimulator, mockGetState, mockBoot, mockInstallApp } = createSUT();
      const appPath = AppPath.create('/path/to/MyApp.app');
      const simulator = createTestSimulator();
      
      mockFindSimulator.mockResolvedValue(simulator);
      mockGetState.mockResolvedValue(SimulatorState.Shutdown);
      mockBoot.mockResolvedValue(undefined);
      mockInstallApp.mockResolvedValue(undefined);

      // Act
      const result = await sut.execute({
        appPath,
        simulatorId: 'test-simulator-id'
      });

      // Assert
      expect(mockBoot).toHaveBeenCalledWith('test-simulator-id');
      expect(mockInstallApp).toHaveBeenCalledWith('/path/to/MyApp.app', 'test-simulator-id');
      expect(result.success).toBe(true);
    });

    it('should throw error when simulator not found', async () => {
      // Arrange
      const { sut, mockFindSimulator } = createSUT();
      const appPath = AppPath.create('/path/to/MyApp.app');
      
      mockFindSimulator.mockResolvedValue(null);

      // Act & Assert
      await expect(sut.execute({
        appPath,
        simulatorId: 'non-existent'
      })).rejects.toThrow('Simulator not found: non-existent');
    });
  });

  describe('when installing without simulator ID', () => {
    it('should use the single booted simulator', async () => {
      // Arrange
      const { sut, mockFindBootedSimulator, mockInstallApp } = createSUT();
      const appPath = AppPath.create('/path/to/TestApp.app');
      const simulator = createTestSimulator();
      
      mockFindBootedSimulator.mockResolvedValue(simulator);
      mockInstallApp.mockResolvedValue(undefined);

      // Act
      const result = await sut.execute({ appPath });

      // Assert
      expect(result).toEqual({
        success: true,
        message: 'Successfully installed TestApp.app on iPhone 15',
        simulatorName: 'iPhone 15',
        appName: 'TestApp.app'
      });
      expect(mockInstallApp).toHaveBeenCalledWith('/path/to/TestApp.app', 'test-simulator-id');
    });

    it('should throw clear error when no booted simulator found', async () => {
      // Arrange
      const { sut, mockFindBootedSimulator } = createSUT();
      const appPath = AppPath.create('/path/to/MyApp.app');
      
      mockFindBootedSimulator.mockResolvedValue(null);

      // Act & Assert
      await expect(sut.execute({ appPath }))
        .rejects.toThrow('No booted simulator found. Please boot a simulator first or specify a simulator ID.');
    });
  });

  describe('error handling', () => {
    it('should throw error with details when installation fails', async () => {
      // Arrange
      const { sut, mockFindSimulator, mockGetState, mockInstallApp } = createSUT();
      const appPath = AppPath.create('/path/to/MyApp.app');
      const simulator = createTestSimulator();
      
      mockFindSimulator.mockResolvedValue(simulator);
      mockGetState.mockResolvedValue(SimulatorState.Booted);
      mockInstallApp.mockRejectedValue(new Error('Invalid app bundle'));

      // Act & Assert
      await expect(sut.execute({
        appPath,
        simulatorId: 'test-simulator-id'
      })).rejects.toThrow('Failed to install app: Invalid app bundle');
    });

    it('should throw error when booting simulator fails', async () => {
      // Arrange
      const { sut, mockFindSimulator, mockGetState, mockBoot } = createSUT();
      const appPath = AppPath.create('/path/to/MyApp.app');
      const simulator = createTestSimulator();
      
      mockFindSimulator.mockResolvedValue(simulator);
      mockGetState.mockResolvedValue(SimulatorState.Shutdown);
      mockBoot.mockRejectedValue(new Error('Unable to boot simulator'));

      // Act & Assert
      await expect(sut.execute({
        appPath,
        simulatorId: 'test-simulator-id'
      })).rejects.toThrow('Failed to boot simulator: Unable to boot simulator');
    });
  });

  describe('logging', () => {
    it('should log success with simulator details', async () => {
      // Arrange
      const { sut, mockFindSimulator, mockGetState, mockInstallApp, mockSaveDebugData } = createSUT();
      const appPath = AppPath.create('/path/to/MyApp.app');
      const simulator = createTestSimulator();
      
      mockFindSimulator.mockResolvedValue(simulator);
      mockGetState.mockResolvedValue(SimulatorState.Booted);
      mockInstallApp.mockResolvedValue(undefined);

      // Act
      await sut.execute({
        appPath,
        simulatorId: 'test-simulator-id'
      });

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

    it('should log error details on failure', async () => {
      // Arrange
      const { sut, mockFindSimulator, mockGetState, mockInstallApp, mockSaveDebugData } = createSUT();
      const appPath = AppPath.create('/path/to/MyApp.app');
      const simulator = createTestSimulator();
      
      mockFindSimulator.mockResolvedValue(simulator);
      mockGetState.mockResolvedValue(SimulatorState.Booted);
      mockInstallApp.mockRejectedValue(new Error('Invalid bundle'));

      // Act & Assert
      await expect(sut.execute({
        appPath,
        simulatorId: 'test-simulator-id'
      })).rejects.toThrow();

      expect(mockSaveDebugData).toHaveBeenCalledWith(
        'install-app-error',
        expect.objectContaining({
          error: 'Invalid bundle'
        }),
        'MyApp.app'
      );
    });
  });
});