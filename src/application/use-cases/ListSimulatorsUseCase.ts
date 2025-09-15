import { ListSimulatorsRequest } from '../../domain/value-objects/ListSimulatorsRequest.js';
import { ListSimulatorsResult, SimulatorInfo } from '../../domain/entities/ListSimulatorsResult.js';
import { DeviceRepository } from '../../infrastructure/repositories/DeviceRepository.js';
import { Platform } from '../../domain/value-objects/Platform.js';
import { SimulatorState } from '../../domain/value-objects/SimulatorState.js';

/**
 * Use case for listing available simulators
 */
export class ListSimulatorsUseCase {
  constructor(
    private readonly deviceRepository: DeviceRepository
  ) {}

  async execute(request: ListSimulatorsRequest): Promise<ListSimulatorsResult> {
    try {
      const allDevices = await this.deviceRepository.getAllDevices();

      const simulatorInfos: SimulatorInfo[] = [];

      for (const [runtime, devices] of Object.entries(allDevices)) {
        const platform = this.extractPlatformFromRuntime(runtime);
        const runtimeVersion = this.extractVersionFromRuntime(runtime);

        for (const device of devices) {
          if (!device.isAvailable) continue;

          const simulatorInfo: SimulatorInfo = {
            udid: device.udid,
            name: device.name,
            state: SimulatorState.parse(device.state),
            platform: platform,
            runtime: `${platform} ${runtimeVersion}`
          };

          if (this.matchesFilter(simulatorInfo, request)) {
            simulatorInfos.push(simulatorInfo);
          }
        }
      }

      return ListSimulatorsResult.success(simulatorInfos);
    } catch (error) {
      return ListSimulatorsResult.failed(
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  private matchesFilter(simulator: SimulatorInfo, request: ListSimulatorsRequest): boolean {
    if (request.platform) {
      const platformString = Platform[request.platform];
      if (simulator.platform !== platformString) {
        return false;
      }
    }

    if (request.state && simulator.state !== request.state) {
      return false;
    }

    return true;
  }

  private extractPlatformFromRuntime(runtime: string): string {
    if (runtime.includes('iOS')) return 'iOS';
    if (runtime.includes('tvOS')) return 'tvOS';
    if (runtime.includes('watchOS')) return 'watchOS';
    if (runtime.includes('xrOS') || runtime.includes('visionOS')) return 'visionOS';
    if (runtime.includes('macOS')) return 'macOS';
    return 'Unknown';
  }

  private extractVersionFromRuntime(runtime: string): string {
    const match = runtime.match(/(\d+[-.]?\d*(?:[-.]?\d+)?)/);
    return match ? match[1].replace(/-/g, '.') : 'Unknown';
  }

}