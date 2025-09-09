/**
 * Domain Value Object: Build destination types
 * 
 * Defines the available build destinations for Xcode projects.
 * Using string enum values for direct mapping from MCP input.
 * The actual mapping to xcodebuild strings happens in the infrastructure layer.
 */
export enum BuildDestination {
  // Simulator builds for current architecture only (faster for development)
  iOSSimulator = 'iOSSimulator',
  tvOSSimulator = 'tvOSSimulator',
  watchOSSimulator = 'watchOSSimulator',
  visionOSSimulator = 'visionOSSimulator',
  macOS = 'macOS',
  
  // Explicit device builds
  iOSDevice = 'iOSDevice',
  tvOSDevice = 'tvOSDevice',
  watchOSDevice = 'watchOSDevice',
  visionOSDevice = 'visionOSDevice',
  
  // Universal simulator builds (all architectures - slower but compatible)
  iOSSimulatorUniversal = 'iOSSimulatorUniversal',
  tvOSSimulatorUniversal = 'tvOSSimulatorUniversal',
  watchOSSimulatorUniversal = 'watchOSSimulatorUniversal',
  visionOSSimulatorUniversal = 'visionOSSimulatorUniversal',
  
  // Universal macOS build
  macOSUniversal = 'macOSUniversal'
}