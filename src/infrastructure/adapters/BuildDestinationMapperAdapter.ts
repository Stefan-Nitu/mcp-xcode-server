import { BuildDestination } from '../../domain/value-objects/BuildDestination.js';
import { IBuildDestinationMapper } from '../../application/ports/MappingPorts.js';
import { SystemArchitectureDetector } from '../services/SystemArchitectureDetector.js';

/**
 * Infrastructure adapter that maps domain BuildDestination values
 * to actual xcodebuild command destination strings and build settings.
 * 
 * This is in infrastructure because it needs system detection.
 */
export class BuildDestinationMapperAdapter implements IBuildDestinationMapper {
  constructor(
    private architectureDetector: SystemArchitectureDetector
  ) {}
  
  /**
   * Converts a BuildDestination to xcodebuild destination string and build settings
   */
  async toXcodeBuildOptions(destination: BuildDestination): Promise<{
    destination: string;
    additionalSettings?: string[];
  }> {
    const currentArch = await this.architectureDetector.getCurrentArchitecture();
    
    switch (destination) {
      // iOS destinations
      case BuildDestination.iOSSimulator:
        // Build for simulator with current architecture only (faster)
        return {
          destination: 'generic/platform=iOS Simulator',
          additionalSettings: [`ARCHS=${currentArch}`, 'ONLY_ACTIVE_ARCH=YES']
        };
        
      case BuildDestination.iOSDevice:
        return { destination: 'generic/platform=iOS' };
        
      case BuildDestination.iOSSimulatorUniversal:
        // Build for all architectures
        return { destination: 'generic/platform=iOS Simulator' };
        
      // tvOS destinations  
      case BuildDestination.tvOSSimulator:
        return {
          destination: 'generic/platform=tvOS Simulator',
          additionalSettings: [`ARCHS=${currentArch}`, 'ONLY_ACTIVE_ARCH=YES']
        };
        
      case BuildDestination.tvOSDevice:
        return { destination: 'generic/platform=tvOS' };
        
      case BuildDestination.tvOSSimulatorUniversal:
        return { destination: 'generic/platform=tvOS Simulator' };
        
      // watchOS destinations
      case BuildDestination.watchOSSimulator:
        return {
          destination: 'generic/platform=watchOS Simulator',
          additionalSettings: [`ARCHS=${currentArch}`, 'ONLY_ACTIVE_ARCH=YES']
        };
        
      case BuildDestination.watchOSDevice:
        return { destination: 'generic/platform=watchOS' };
        
      case BuildDestination.watchOSSimulatorUniversal:
        return { destination: 'generic/platform=watchOS Simulator' };
        
      // visionOS destinations
      case BuildDestination.visionOSSimulator:
        return {
          destination: 'generic/platform=xrOS Simulator',
          additionalSettings: [`ARCHS=${currentArch}`, 'ONLY_ACTIVE_ARCH=YES']
        };
        
      case BuildDestination.visionOSDevice:
        return { destination: 'generic/platform=xrOS' };
        
      case BuildDestination.visionOSSimulatorUniversal:
        return { destination: 'generic/platform=xrOS Simulator' };
        
      // macOS destinations
      case BuildDestination.macOS:
        return {
          destination: 'platform=macOS',
          additionalSettings: [`ARCHS=${currentArch}`, 'ONLY_ACTIVE_ARCH=YES']
        };
        
      case BuildDestination.macOSUniversal:
        return { destination: 'platform=macOS' };
        
      default:
        // Fallback to iOS simulator
        return { destination: 'generic/platform=iOS Simulator' };
    }
  }
}