/**
 * Domain Value Object: Represents an app installation request
 * 
 * Contains all the data needed to install an app:
 * - What: appPath (the .app bundle to install)
 * - Where: simulatorId (optional - uses booted simulator if not specified)
 */
export class InstallRequest {
  private constructor(
    public readonly appPath: string,
    public readonly simulatorId?: string
  ) {}

  /**
   * Create an InstallRequest from raw inputs
   * Validates the inputs and creates an immutable request object
   */
  static create(
    appPath: string,
    simulatorId?: string
  ): InstallRequest {
    // Validate app path
    if (!appPath || appPath.trim() === '') {
      throw new Error('App path cannot be empty');
    }

    const trimmedPath = appPath.trim();
    
    // Validate .app extension
    if (!trimmedPath.endsWith('.app')) {
      throw new Error('App path must end with .app');
    }

    // Basic path traversal protection
    if (trimmedPath.includes('../..')) {
      throw new Error('Invalid app path: path traversal detected');
    }

    // Clean up simulator ID if provided
    const cleanSimulatorId = simulatorId?.trim() || undefined;

    return new InstallRequest(trimmedPath, cleanSimulatorId);
  }
}