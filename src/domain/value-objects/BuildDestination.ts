/**
 * Domain Value Object: Build destination types
 * 
 * Defines the available build destinations for Xcode projects.
 * This is pure domain logic - no infrastructure dependencies.
 * The actual mapping to xcodebuild strings happens in the infrastructure layer.
 */
export enum BuildDestination {
  // Simulator builds for current architecture only (faster for development)
  iOSSimulator,              // Current arch only
  tvOSSimulator,            // Current arch only
  watchOSSimulator,      // Current arch only
  visionOSSimulator,    // Current arch only
  macOS,                             // Current arch
  
  // Explicit device builds
  iOSDevice,            // ARM64 for physical iOS devices
  tvOSDevice,          // ARM64 for physical tvOS devices
  watchOSDevice,    // ARM64 for physical watchOS devices
  visionOSDevice,  // ARM64 for physical visionOS devices
  
  // Universal simulator builds (all architectures - slower but compatible)
  iOSSimulatorUniversal,
  tvOSSimulatorUniversal,
  watchOSSimulatorUniversal,
  visionOSSimulatorUniversal,
  
  // Universal macOS build
  macOSUniversal,
}