/**
 * Checks if a command is an xcodebuild command
 */
export function isXcodebuildCommand(cmd: string): boolean {
  return cmd.startsWith('xcodebuild') || 
         cmd.includes(' xcodebuild ') || 
         cmd.includes('|xcodebuild') || 
         cmd.includes('&& xcodebuild');
}