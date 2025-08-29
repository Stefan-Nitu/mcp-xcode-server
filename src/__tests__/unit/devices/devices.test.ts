import { Devices } from '../../../utils/devices/Devices';
import { SimulatorDevice } from '../../../utils/devices/SimulatorDevice';
import { execAsync } from '../../../utils';
import { Platform } from '../../../types';

jest.mock('../../../utils', () => ({
  execAsync: jest.fn()
}));

describe('Devices', () => {
  let devices: Devices;
  const mockExecAsync = execAsync as jest.MockedFunction<typeof execAsync>;

  beforeEach(() => {
    devices = new Devices();
    jest.clearAllMocks();
  });

  describe('find()', () => {
    const mockDeviceData = {
      devices: {
        'com.apple.CoreSimulator.SimRuntime.iOS-17-0': [
          {
            udid: 'AAAA-1111',
            name: 'iPhone 15',
            state: 'Shutdown',
            isAvailable: true
          },
          {
            udid: 'AAAA-2222',
            name: 'iPhone 15',
            state: 'Booted',
            isAvailable: true
          }
        ],
        'com.apple.CoreSimulator.SimRuntime.iOS-16-0': [
          {
            udid: 'AAAA-3333',
            name: 'iPhone 15',
            state: 'Shutdown',
            isAvailable: false,
            availabilityError: 'runtime profile not found'
          }
        ]
      }
    };

    it('should find device by UDID', async () => {
      mockExecAsync.mockResolvedValue({
        stdout: JSON.stringify(mockDeviceData),
        stderr: ''
      });

      const device = await devices.find('AAAA-1111');
      
      expect(device).not.toBeNull();
      expect(device?.id).toBe('AAAA-1111');
      expect(device?.name).toBe('iPhone 15');
    });

    it('should find device by name and prefer available ones', async () => {
      mockExecAsync.mockResolvedValue({
        stdout: JSON.stringify(mockDeviceData),
        stderr: ''
      });

      const device = await devices.find('iPhone 15');
      
      expect(device).not.toBeNull();
      // Should prefer the booted and available device
      expect(device?.id).toBe('AAAA-2222');
    });

    it('should return null if device not found', async () => {
      mockExecAsync.mockResolvedValue({
        stdout: JSON.stringify(mockDeviceData),
        stderr: ''
      });

      const device = await devices.find('iPhone 99');
      
      expect(device).toBeNull();
    });

    it('should warn when selecting unavailable device', async () => {
      const onlyUnavailable = {
        devices: {
          'com.apple.CoreSimulator.SimRuntime.iOS-16-0': [
            {
              udid: 'BBBB-1111',
              name: 'iPhone 14',
              state: 'Shutdown',
              isAvailable: false
            }
          ]
        }
      };

      mockExecAsync.mockResolvedValue({
        stdout: JSON.stringify(onlyUnavailable),
        stderr: ''
      });

      const device = await devices.find('iPhone 14');
      
      expect(device).not.toBeNull();
    });
  });

  describe('findForPlatform()', () => {
    const mockPlatformData = {
      devices: {
        'com.apple.CoreSimulator.SimRuntime.iOS-17-0': [
          {
            udid: 'iOS-1',
            name: 'iPhone 15',
            state: 'Shutdown',
            isAvailable: true
          },
          {
            udid: 'iOS-2',
            name: 'iPhone 15 Pro',
            state: 'Booted',
            isAvailable: true
          }
        ],
        'com.apple.CoreSimulator.SimRuntime.tvOS-17-0': [
          {
            udid: 'tvOS-1',
            name: 'Apple TV',
            state: 'Shutdown',
            isAvailable: true
          }
        ]
      }
    };

    it('should find device for iOS platform', async () => {
      mockExecAsync.mockResolvedValue({
        stdout: JSON.stringify(mockPlatformData),
        stderr: ''
      });

      const device = await devices.findForPlatform(Platform.iOS);
      
      expect(device).not.toBeNull();
      // Should prefer the booted device
      expect(device?.id).toBe('iOS-2');
    });

    it('should find device for tvOS platform', async () => {
      mockExecAsync.mockResolvedValue({
        stdout: JSON.stringify(mockPlatformData),
        stderr: ''
      });

      const device = await devices.findForPlatform(Platform.tvOS);
      
      expect(device).not.toBeNull();
      expect(device?.id).toBe('tvOS-1');
      expect(device?.platform).toBe('tvOS');
    });

    it('should return null if no devices for platform', async () => {
      mockExecAsync.mockResolvedValue({
        stdout: JSON.stringify(mockPlatformData),
        stderr: ''
      });

      const device = await devices.findForPlatform(Platform.watchOS);
      
      expect(device).toBeNull();
    });

    it('should handle visionOS/xrOS naming', async () => {
      const visionData = {
        devices: {
          'com.apple.CoreSimulator.SimRuntime.xrOS-1-0': [
            {
              udid: 'xrOS-1',
              name: 'Apple Vision Pro',
              state: 'Shutdown',
              isAvailable: true
            }
          ]
        }
      };

      mockExecAsync.mockResolvedValue({
        stdout: JSON.stringify(visionData),
        stderr: ''
      });

      const device = await devices.findForPlatform(Platform.visionOS);
      
      expect(device).not.toBeNull();
      expect(device?.id).toBe('xrOS-1');
    });
  });

  describe('listSimulators()', () => {
    it('should list all simulators', async () => {
      const mockData = {
        devices: {
          'com.apple.CoreSimulator.SimRuntime.iOS-17-0': [
            {
              udid: 'iOS-1',
              name: 'iPhone 15',
              state: 'Shutdown',
              isAvailable: true
            }
          ],
          'com.apple.CoreSimulator.SimRuntime.tvOS-17-0': [
            {
              udid: 'tvOS-1',
              name: 'Apple TV',
              state: 'Shutdown',
              isAvailable: true
            }
          ]
        }
      };

      mockExecAsync.mockResolvedValue({
        stdout: JSON.stringify(mockData),
        stderr: ''
      });

      const simulators = await devices.listSimulators();
      
      expect(simulators).toHaveLength(2);
      expect(simulators.map(s => s.id)).toContain('iOS-1');
      expect(simulators.map(s => s.id)).toContain('tvOS-1');
    });

    it('should filter by platform', async () => {
      const mockData = {
        devices: {
          'com.apple.CoreSimulator.SimRuntime.iOS-17-0': [
            {
              udid: 'iOS-1',
              name: 'iPhone 15',
              state: 'Shutdown',
              isAvailable: true
            }
          ],
          'com.apple.CoreSimulator.SimRuntime.tvOS-17-0': [
            {
              udid: 'tvOS-1',
              name: 'Apple TV',
              state: 'Shutdown',
              isAvailable: true
            }
          ]
        }
      };

      mockExecAsync.mockResolvedValue({
        stdout: JSON.stringify(mockData),
        stderr: ''
      });

      const simulators = await devices.listSimulators(Platform.iOS);
      
      expect(simulators).toHaveLength(1);
      expect(simulators[0].id).toBe('iOS-1');
      expect(simulators[0].platform).toBe('iOS');
    });
  });

  describe('getBooted()', () => {
    it('should return booted device', async () => {
      const mockData = {
        devices: {
          'com.apple.CoreSimulator.SimRuntime.iOS-17-0': [
            {
              udid: 'iOS-1',
              name: 'iPhone 15',
              state: 'Shutdown',
              isAvailable: true
            },
            {
              udid: 'iOS-2',
              name: 'iPhone 15 Pro',
              state: 'Booted',
              isAvailable: true
            }
          ]
        }
      };

      mockExecAsync.mockResolvedValue({
        stdout: JSON.stringify(mockData),
        stderr: ''
      });

      const device = await devices.getBooted();
      
      expect(device).not.toBeNull();
      expect(device?.id).toBe('iOS-2');
    });

    it('should return null if no booted device', async () => {
      const mockData = {
        devices: {
          'com.apple.CoreSimulator.SimRuntime.iOS-17-0': [
            {
              udid: 'iOS-1',
              name: 'iPhone 15',
              state: 'Shutdown',
              isAvailable: true
            }
          ]
        }
      };

      mockExecAsync.mockResolvedValue({
        stdout: JSON.stringify(mockData),
        stderr: ''
      });

      const device = await devices.getBooted();
      
      expect(device).toBeNull();
    });
  });
});