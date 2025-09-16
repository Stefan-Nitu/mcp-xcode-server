import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { AppInstallerAdapter } from '../../infrastructure/AppInstallerAdapter.js';
import { ICommandExecutor } from '../../../../application/ports/CommandPorts.js';

describe('AppInstallerAdapter', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  function createSUT() {
    const mockExecute = jest.fn<ICommandExecutor['execute']>();
    const mockExecutor: ICommandExecutor = {
      execute: mockExecute
    };
    const sut = new AppInstallerAdapter(mockExecutor);
    return { sut, mockExecute };
  }

  describe('installApp', () => {
    it('should install app successfully', async () => {
      // Arrange
      const { sut, mockExecute } = createSUT();
      mockExecute.mockResolvedValue({
        stdout: '',
        stderr: '',
        exitCode: 0
      });

      // Act
      await sut.installApp('/path/to/MyApp.app', 'ABC-123');

      // Assert
      expect(mockExecute).toHaveBeenCalledWith(
        'xcrun simctl install "ABC-123" "/path/to/MyApp.app"'
      );
    });

    it('should handle paths with spaces', async () => {
      // Arrange
      const { sut, mockExecute } = createSUT();
      mockExecute.mockResolvedValue({
        stdout: '',
        stderr: '',
        exitCode: 0
      });

      // Act
      await sut.installApp('/path/to/My Cool App.app', 'ABC-123');

      // Assert
      expect(mockExecute).toHaveBeenCalledWith(
        'xcrun simctl install "ABC-123" "/path/to/My Cool App.app"'
      );
    });

    it('should throw error for invalid app bundle', async () => {
      // Arrange
      const { sut, mockExecute } = createSUT();
      mockExecute.mockResolvedValue({
        stdout: '',
        stderr: 'An error was encountered processing the command (domain=NSPOSIXErrorDomain, code=2):\nFailed to install "/path/to/NotAnApp.app"',
        exitCode: 1
      });

      // Act & Assert
      await expect(sut.installApp('/path/to/NotAnApp.app', 'ABC-123'))
        .rejects.toThrow('An error was encountered processing the command');
    });

    it('should throw error when device not found', async () => {
      // Arrange
      const { sut, mockExecute } = createSUT();
      mockExecute.mockResolvedValue({
        stdout: '',
        stderr: 'Invalid device: NON-EXISTENT',
        exitCode: 164
      });

      // Act & Assert
      await expect(sut.installApp('/path/to/MyApp.app', 'NON-EXISTENT'))
        .rejects.toThrow('Invalid device: NON-EXISTENT');
    });

    it('should throw error when simulator not booted', async () => {
      // Arrange
      const { sut, mockExecute } = createSUT();
      mockExecute.mockResolvedValue({
        stdout: '',
        stderr: 'Unable to install "/path/to/MyApp.app"\nAn error was encountered processing the command (domain=com.apple.CoreSimulator.SimError, code=405):\nUnable to install applications when the device is not booted.',
        exitCode: 149
      });

      // Act & Assert
      await expect(sut.installApp('/path/to/MyApp.app', 'ABC-123'))
        .rejects.toThrow('Unable to install applications when the device is not booted');
    });

    it('should throw generic error when stderr is empty', async () => {
      // Arrange
      const { sut, mockExecute } = createSUT();
      mockExecute.mockResolvedValue({
        stdout: '',
        stderr: '',
        exitCode: 1
      });

      // Act & Assert
      await expect(sut.installApp('/path/to/MyApp.app', 'ABC-123'))
        .rejects.toThrow('Failed to install app');
    });

    it('should throw error for app with invalid signature', async () => {
      // Arrange
      const { sut, mockExecute } = createSUT();
      mockExecute.mockResolvedValue({
        stdout: '',
        stderr: 'The code signature version is no longer supported',
        exitCode: 1
      });

      // Act & Assert
      await expect(sut.installApp('/path/to/MyApp.app', 'ABC-123'))
        .rejects.toThrow('The code signature version is no longer supported');
    });
  });
});