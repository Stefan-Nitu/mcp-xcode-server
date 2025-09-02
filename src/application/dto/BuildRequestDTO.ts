import { Platform } from '../../types.js';

/**
 * Data Transfer Object for build requests
 * Used to pass data into use cases
 */
export class BuildRequestDTO {
  constructor(
    public readonly projectPath: string,
    public readonly scheme?: string,
    public readonly configuration?: string,
    public readonly platform?: Platform,
    public readonly deviceId?: string,
    public readonly derivedDataPath?: string
  ) {}
  
  static fromMCPArgs(args: any): BuildRequestDTO {
    return new BuildRequestDTO(
      args.projectPath,
      args.scheme,
      args.configuration,
      args.platform,
      args.deviceId,
      args.derivedDataPath
    );
  }
}