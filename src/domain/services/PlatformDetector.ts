import { Platform } from '../value-objects/Platform.js';
import { BuildDestination } from '../value-objects/BuildDestination.js';

/**
 * Domain Service: Detects platform from build destination
 * 
 * Pure domain logic - no external dependencies
 * Used to determine which platform a build destination targets
 */
export class PlatformDetector {
  /**
   * Extract platform from a build destination
   */
  static fromDestination(destination: BuildDestination): Platform {
    if (destination.startsWith('iOS')) return Platform.iOS;
    if (destination.startsWith('macOS')) return Platform.macOS;
    if (destination.startsWith('tvOS')) return Platform.tvOS;
    if (destination.startsWith('watchOS')) return Platform.watchOS;
    if (destination.startsWith('visionOS')) return Platform.visionOS;
    
    // Default to iOS if unknown (shouldn't happen with proper validation)
    return Platform.iOS;
  }
}