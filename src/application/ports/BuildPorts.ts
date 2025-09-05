/**
 * Port interfaces specific to build operations
 * 
 * These ports define how the application layer
 * interacts with build-specific infrastructure.
 */

// Options for the build command builder (infrastructure concerns)
export interface BuildCommandOptions {
  scheme: string;
  configuration?: string;
  destination: string;  // Already mapped destination string
  additionalSettings?: string[];
  derivedDataPath?: string;
}

export interface IBuildCommandBuilder {
  build(
    projectPath: string,
    isWorkspace: boolean,
    options: BuildCommandOptions
  ): string;
}