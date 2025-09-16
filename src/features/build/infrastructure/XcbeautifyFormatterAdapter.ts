import { IOutputFormatter } from '../../../application/ports/OutputFormatterPorts.js';
import { ICommandExecutor } from '../../../application/ports/CommandPorts.js';
import { OutputFormatterError } from '../domain/BuildResult.js';

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
    const escapedOutput = rawOutput.replace(/'/g, "'\\''");
    const command = `echo '${escapedOutput}' | xcbeautify --renderer terminal`;

    const result = await this.executor.execute(command, {
      shell: '/bin/bash'
    });

    if (result.exitCode !== 0) {
      throw new OutputFormatterError(result.stderr || 'Unknown error');
    }

    return result.stdout;
  }
}