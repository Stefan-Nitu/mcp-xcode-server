import { describe, it, expect, jest } from '@jest/globals';
import { XcbeautifyFormatterAdapter } from '../../../../infrastructure/adapters/XcbeautifyFormatterAdapter.js';
import { ICommandExecutor } from '../../../../application/ports/CommandPorts.js';
import { OutputFormatterError } from '../../../../domain/entities/BuildResult.js';

describe('XcbeautifyFormatterAdapter', () => {
  function createSUT() {
    const mockExecute = jest.fn<ICommandExecutor['execute']>();
    const mockExecutor: ICommandExecutor = { execute: mockExecute };
    const sut = new XcbeautifyFormatterAdapter(mockExecutor);
    return { sut, mockExecute };
  }

  describe('format', () => {
    it('should format raw output through xcbeautify', async () => {
      // Arrange
      const { sut, mockExecute } = createSUT();
      const rawOutput = 'error: cannot find someFunc in scope';
      const formattedOutput = '❌ error: cannot find someFunc in scope';

      mockExecute.mockResolvedValueOnce({
        stdout: formattedOutput,
        stderr: '',
        exitCode: 0
      });

      // Act
      const result = await sut.format(rawOutput);

      // Assert
      expect(result).toBe(formattedOutput);
      expect(mockExecute).toHaveBeenCalledTimes(1);
    });

    it('should escape single quotes in output', async () => {
      // Arrange
      const { sut, mockExecute } = createSUT();
      const rawOutput = "error: cannot find 'someFunc' in scope";
      const formattedOutput = "❌ error: cannot find 'someFunc' in scope";

      mockExecute.mockResolvedValueOnce({
        stdout: formattedOutput,
        stderr: '',
        exitCode: 0
      });

      // Act
      const result = await sut.format(rawOutput);

      // Assert
      expect(result).toBe(formattedOutput);
      expect(mockExecute).toHaveBeenCalledTimes(1);
    });

    it('should throw OutputFormatterError when xcbeautify fails', async () => {
      // Arrange
      const { sut, mockExecute } = createSUT();
      const rawOutput = 'Build output';
      const errorMessage = 'xcbeautify crashed';

      mockExecute.mockResolvedValue({
        stdout: '',
        stderr: errorMessage,
        exitCode: 1
      });

      // Act & Assert
      await expect(sut.format(rawOutput)).rejects.toThrow(OutputFormatterError);
      await expect(sut.format(rawOutput)).rejects.toThrow(
        expect.objectContaining({
          stderr: errorMessage
        })
      );
    });

    it('should handle empty output', async () => {
      // Arrange
      const { sut, mockExecute } = createSUT();
      const rawOutput = '';

      mockExecute.mockResolvedValueOnce({
        stdout: '',
        stderr: '',
        exitCode: 0
      });

      // Act
      const result = await sut.format(rawOutput);

      // Assert
      expect(result).toBe('');
    });

    it('should handle multi-line output', async () => {
      // Arrange
      const { sut, mockExecute } = createSUT();
      const rawOutput = `line1
line2
line3`;
      const formattedOutput = `✅ line1
✅ line2
✅ line3`;

      mockExecute.mockResolvedValueOnce({
        stdout: formattedOutput,
        stderr: '',
        exitCode: 0
      });

      // Act
      const result = await sut.format(rawOutput);

      // Assert
      expect(result).toBe(formattedOutput);
    });

    it('should preserve xcbeautify headers in output', async () => {
      // Arrange
      const { sut, mockExecute } = createSUT();
      const rawOutput = 'Build succeeded';
      const formattedWithHeader = `----- xcbeautify -----
Version: 2.30.1
----------------------

✅ Build succeeded`;

      mockExecute.mockResolvedValueOnce({
        stdout: formattedWithHeader,
        stderr: '',
        exitCode: 0
      });

      // Act
      const result = await sut.format(rawOutput);

      // Assert
      expect(result).toBe(formattedWithHeader);
    });
  });
});