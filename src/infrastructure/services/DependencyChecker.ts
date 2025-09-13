import { IDependencyChecker, MissingDependency } from '../../presentation/interfaces/IDependencyChecker.js';
import { ICommandExecutor } from '../../application/ports/CommandPorts.js';

/**
 * Checks for system dependencies using shell commands
 */
export class DependencyChecker implements IDependencyChecker {
  private readonly dependencyMap: Record<string, { checkCommand: string; installCommand?: string }> = {
    'xcodebuild': {
      checkCommand: 'which xcodebuild',
      installCommand: 'Install Xcode from the App Store'
    },
    'xcrun': {
      checkCommand: 'which xcrun',
      installCommand: 'Install Xcode Command Line Tools: xcode-select --install'
    },
    'xcbeautify': {
      checkCommand: 'which xcbeautify',
      installCommand: 'brew install xcbeautify'
    }
  };

  constructor(
    private readonly executor: ICommandExecutor
  ) {}

  async check(dependencies: string[]): Promise<MissingDependency[]> {
    const missing: MissingDependency[] = [];

    for (const dep of dependencies) {
      const config = this.dependencyMap[dep];
      if (!config) {
        // Unknown dependency - just check with 'which'
        const result = await this.executor.execute(`which ${dep}`, {
          shell: '/bin/bash'
        });

        if (result.exitCode !== 0) {
          missing.push({ name: dep });
        }
        continue;
      }

      // Check using configured command
      const result = await this.executor.execute(config.checkCommand, {
        shell: '/bin/bash'
      });

      if (result.exitCode !== 0) {
        missing.push({
          name: dep,
          installCommand: config.installCommand
        });
      }
    }

    return missing;
  }
}