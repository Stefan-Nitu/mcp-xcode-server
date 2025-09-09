/**
 * Domain Entity: Represents the result of an app installation
 * 
 * Captures the outcome of installing an app on a simulator,
 * including success/failure status and relevant metadata.
 */
export class InstallResult {
  private constructor(
    public readonly isSuccess: boolean,
    public readonly appPath: string,
    public readonly simulatorId?: string,
    public readonly simulatorName?: string,
    public readonly bundleId?: string,
    public readonly error?: string,
    public readonly installedAt: Date = new Date()
  ) {}

  /**
   * Create a successful installation result
   */
  static success(
    bundleId: string,
    simulatorId: string,
    simulatorName: string,
    appPath: string
  ): InstallResult {
    return new InstallResult(
      true,
      appPath,
      simulatorId,
      simulatorName,
      bundleId,
      undefined
    );
  }

  /**
   * Create a failed installation result
   */
  static failure(
    error: string,
    appPath: string,
    simulatorId?: string,
    simulatorName?: string
  ): InstallResult {
    return new InstallResult(
      false,
      appPath,
      simulatorId,
      simulatorName,
      undefined,
      error
    );
  }

  /**
   * String representation for logging/display
   */
  toString(): string {
    if (this.isSuccess) {
      const simulator = this.simulatorName 
        ? `${this.simulatorName} (${this.simulatorId})`
        : this.simulatorId;
      return `Successfully installed ${this.bundleId} on ${simulator}`;
    } else {
      const target = this.simulatorName 
        ? `on ${this.simulatorName} (${this.simulatorId})`
        : this.simulatorId 
        ? `on ${this.simulatorId}` 
        : '';
      return `Failed to install ${this.appPath} ${target}: ${this.error}`;
    }
  }
}