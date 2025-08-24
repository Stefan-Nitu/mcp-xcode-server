/**
 * Error types for Xcode operations
 */
export enum XcodeErrorType {
  ProjectNotFound = 'PROJECT_NOT_FOUND',
  InvalidProjectType = 'INVALID_PROJECT_TYPE',
  UnknownError = 'UNKNOWN_ERROR'
}

/**
 * Custom error class for Xcode operations
 */
export class XcodeError extends Error {
  constructor(
    public readonly type: XcodeErrorType,
    public readonly path: string,
    message?: string
  ) {
    super(message || XcodeError.getDefaultMessage(type, path));
    this.name = 'XcodeError';
  }

  private static getDefaultMessage(type: XcodeErrorType, path: string): string {
    switch (type) {
      case XcodeErrorType.ProjectNotFound:
        return `No Xcode project or Swift package found at: ${path}`;
      case XcodeErrorType.InvalidProjectType:
        return `Invalid project type at: ${path}`;
      case XcodeErrorType.UnknownError:
        return `Unknown error opening project at: ${path}`;
    }
  }
}