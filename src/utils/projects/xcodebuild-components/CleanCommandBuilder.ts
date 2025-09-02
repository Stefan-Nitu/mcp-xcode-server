/**
 * Builds xcodebuild command for clean operations
 * Single Responsibility: Construct clean commands only
 */
export class CleanCommandBuilder {
  build(
    projectPath: string,
    isWorkspace: boolean,
    options: { scheme?: string; configuration?: string } = {}
  ): string {
    const { scheme, configuration = 'Debug' } = options;
    
    const projectFlag = isWorkspace ? '-workspace' : '-project';
    let command = `xcodebuild ${projectFlag} "${projectPath}"`;
    
    if (scheme) {
      command += ` -scheme "${scheme}"`;
    }
    
    command += ` -configuration "${configuration}" clean`;
    
    return command;
  }
}