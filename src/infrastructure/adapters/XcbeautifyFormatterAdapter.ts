import { IOutputFormatter } from '../../application/ports/OutputFormatterPorts.js';
import { ICommandExecutor } from '../../application/ports/CommandPorts.js';
import { OutputFormatterError } from '../../domain/entities/BuildResult.js';

/**
 * Infrastructure adapter that formats xcodebuild output using xcbeautify
 * 
 * This separates the formatting concern from the build execution,
 * making testing easier and the architecture cleaner.
 */
export class XcbeautifyFormatterAdapter implements IOutputFormatter {
  constructor(
    private readonly executor: ICommandExecutor
  ) {}

  async format(rawOutput: string): Promise<string> {
    // First check if xcbeautify is available
    const whichResult = await this.executor.execute('which xcbeautify', {
      shell: '/bin/bash'
    });
    
    if (whichResult.exitCode !== 0) {
      throw new OutputFormatterError('xcbeautify', 'brew install xcbeautify');
    }
    
    // Pass the raw output through xcbeautify using echo and pipe
    // We need to escape the output for shell
    const escapedOutput = rawOutput.replace(/'/g, "'\\''");
    const command = `echo '${escapedOutput}' | xcbeautify`;
    
    const result = await this.executor.execute(command, {
      shell: '/bin/bash'
    });
    
    // Return the formatted output
    return result.stdout;
  }
}