import { SimulatorDevice } from '../../../utils/devices/SimulatorDevice';
import { SimulatorBoot } from '../../../utils/devices/SimulatorBoot';
import { SimulatorInfo } from '../../../utils/devices/SimulatorInfo';

jest.mock('../../../utils/devices/SimulatorBoot');
jest.mock('../../../utils/devices/SimulatorInfo');

describe('SimulatorDevice', () => {
  let mockBoot: jest.Mocked<SimulatorBoot>;
  let mockInfo: jest.Mocked<SimulatorInfo>;
  
  beforeEach(() => {
    jest.clearAllMocks();
    mockBoot = new SimulatorBoot() as jest.Mocked<SimulatorBoot>;
    mockInfo = new SimulatorInfo() as jest.Mocked<SimulatorInfo>;
  });

  describe('constructor and properties', () => {
    it('should create device with all properties', () => {
      const device = new SimulatorDevice(
        'test-id',
        'iPhone 15',
        'iOS',
        'com.apple.CoreSimulator.SimRuntime.iOS-17-0'
      );

      expect(device.id).toBe('test-id');
      expect(device.name).toBe('iPhone 15');
      expect(device.platform).toBe('iOS');
      expect(device.runtime).toBe('com.apple.CoreSimulator.SimRuntime.iOS-17-0');
    });
  });

  describe('isBooted()', () => {
    it('should return true when actual state is Booted', async () => {
      const device = new SimulatorDevice(
        'test-id',
        'iPhone 15',
        'iOS',
        'runtime',
        { info: mockInfo }
      );

      mockInfo.getDeviceState.mockResolvedValue('Booted');

      expect(await device.isBooted()).toBe(true);
      expect(mockInfo.getDeviceState).toHaveBeenCalledWith('test-id');
    });

    it('should return false when actual state is not Booted', async () => {
      const device = new SimulatorDevice(
        'test-id',
        'iPhone 15',
        'iOS',
        'runtime',
        { info: mockInfo }
      );

      mockInfo.getDeviceState.mockResolvedValue('Shutdown');

      expect(await device.isBooted()).toBe(false);
      expect(mockInfo.getDeviceState).toHaveBeenCalledWith('test-id');
    });
  });

  describe('ensureBooted()', () => {
    it('should not boot if already booted', async () => {
      const device = new SimulatorDevice(
        'test-id',
        'iPhone 15',
        'iOS',
        'runtime',
        { boot: mockBoot, info: mockInfo }
      );

      mockInfo.getDeviceState.mockResolvedValue('Booted');
      mockInfo.isAvailable.mockResolvedValue(true);

      await device.ensureBooted();

      expect(mockInfo.getDeviceState).toHaveBeenCalledWith('test-id');
      expect(mockBoot.boot).not.toHaveBeenCalled();
    });

    it('should boot if not booted and available', async () => {
      const device = new SimulatorDevice(
        'test-id',
        'iPhone 15',
        'iOS',
        'runtime',
        { boot: mockBoot, info: mockInfo }
      );

      mockInfo.getDeviceState.mockResolvedValue('Shutdown');
      mockInfo.isAvailable.mockResolvedValue(true);
      mockBoot.boot.mockResolvedValue(undefined);

      await device.ensureBooted();

      expect(mockInfo.getDeviceState).toHaveBeenCalledWith('test-id');
      expect(mockBoot.boot).toHaveBeenCalledWith('test-id');
    });

    it('should throw error if device is not available', async () => {
      const device = new SimulatorDevice(
        'test-id',
        'iPhone 15',
        'iOS',
        'com.apple.CoreSimulator.SimRuntime.iOS-16-0',
        { boot: mockBoot, info: mockInfo }
      );

      mockInfo.isAvailable.mockResolvedValue(false);

      await expect(device.ensureBooted()).rejects.toThrow(
        'Device "iPhone 15" (test-id) is not available'
      );
      
      expect(mockBoot.boot).not.toHaveBeenCalled();
    });

    it('should provide helpful error message for unavailable device', async () => {
      const device = new SimulatorDevice(
        'test-id',
        'iPhone 15',
        'iOS',
        'com.apple.CoreSimulator.SimRuntime.iOS-16-0',
        { boot: mockBoot, info: mockInfo }
      );

      mockInfo.isAvailable.mockResolvedValue(false);

      await expect(device.ensureBooted()).rejects.toThrow(
        /runtime.*may be missing or corrupted/
      );
    });
  });

  describe('bootDevice()', () => {
    it('should call boot with device id', async () => {
      const device = new SimulatorDevice(
        'test-id',
        'iPhone 15',
        'iOS',
        'runtime',
        { boot: mockBoot }
      );

      mockBoot.boot.mockResolvedValue(undefined);

      await device.bootDevice();

      expect(mockBoot.boot).toHaveBeenCalledWith('test-id');
    });
  });

  describe('shutdown()', () => {
    it('should call shutdown with device id', async () => {
      const device = new SimulatorDevice(
        'test-id',
        'iPhone 15',
        'iOS',
        'runtime',
        { boot: mockBoot }
      );

      mockBoot.shutdown.mockResolvedValue(undefined);

      await device.shutdown();

      expect(mockBoot.shutdown).toHaveBeenCalledWith('test-id');
    });
  });
});