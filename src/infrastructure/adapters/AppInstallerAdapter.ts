import { IAppInstaller } from '../../application/ports/SimulatorPorts.js';
import { ICommandExecutor } from '../../application/ports/CommandPorts.js';

/**
 * Installs apps on simulators using xcrun simctl
 */
export class AppInstallerAdapter implements IAppInstaller {
  constructor(private executor: ICommandExecutor) {}

  async installApp(appPath: string, simulatorId: string): Promise<void> {
    const result = await this.executor.execute(
      `xcrun simctl install "${simulatorId}" "${appPath}"`
    );
    
    if (result.exitCode !== 0) {
      throw new Error(result.stderr || 'Failed to install app');
    }
  }
}