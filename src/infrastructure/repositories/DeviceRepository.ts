import { ICommandExecutor } from '../../application/ports/CommandPorts.js';

export interface RawDevice {
  udid: string;
  name: string;
  state: string;
  isAvailable: boolean;
  deviceTypeIdentifier?: string;
  dataPath?: string;
  dataPathSize?: number;
  logPath?: string;
}

export interface DeviceList {
  [runtime: string]: RawDevice[];
}

/**
 * Repository for accessing simulator device information
 */
export class DeviceRepository {
  constructor(private executor: ICommandExecutor) {}

  async getAllDevices(): Promise<DeviceList> {
    const result = await this.executor.execute('xcrun simctl list devices --json');
    const data = JSON.parse(result.stdout);
    return data.devices as DeviceList;
  }
}