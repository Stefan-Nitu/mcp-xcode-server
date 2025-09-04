/**
 * Port interfaces for mapping between domain and infrastructure concepts
 */

import { BuildDestination } from '../../domain/value-objects/BuildDestination.js';

/**
 * Maps BuildDestination to xcodebuild-specific options
 */
export interface IBuildDestinationMapper {
  /**
   * Map a domain BuildDestination to xcodebuild destination string and settings
   */
  toXcodeBuildOptions(destination: BuildDestination): Promise<{
    destination: string;
    additionalSettings?: string[];
  }>;
}