import { describe, it, expect, jest } from '@jest/globals';
import { XcbeautifyFormatterAdapter } from '../../../../infrastructure/adapters/XcbeautifyFormatterAdapter.js';
import { ICommandExecutor } from '../../../../application/ports/CommandPorts.js';

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
      
      mockExecute.mockResolvedValue({
        stdout: formattedOutput,
        stderr: '',
        exitCode: 0
      });

      // Act
      const result = await sut.format(rawOutput);

      // Assert
      expect(result).toBe(formattedOutput);
      expect(mockExecute).toHaveBeenCalledWith(
        "echo 'error: cannot find someFunc in scope' | xcbeautify",
        { shell: '/bin/bash' }
      );
    });

    it('should escape single quotes in output', async () => {
      // Arrange
      const { sut, mockExecute } = createSUT();
      const rawOutput = "error: cannot find 'someFunc' in scope";
      const formattedOutput = "❌ error: cannot find 'someFunc' in scope";
      
      mockExecute.mockResolvedValue({
        stdout: formattedOutput,
        stderr: '',
        exitCode: 0
      });

      // Act
      const result = await sut.format(rawOutput);

      // Assert
      expect(result).toBe(formattedOutput);
      expect(mockExecute).toHaveBeenCalledWith(
        "echo 'error: cannot find '\\''someFunc'\\'' in scope' | xcbeautify",
        { shell: '/bin/bash' }
      );
    });

    it('should throw when xcbeautify is not available', async () => {
      // Arrange
      const { sut, mockExecute } = createSUT();
      const rawOutput = 'Build output';
      
      mockExecute.mockRejectedValue(new Error('Command not found: xcbeautify'));

      // Act & Assert
      await expect(sut.format(rawOutput)).rejects.toThrow('Command not found: xcbeautify');
    });

    it('should handle empty output', async () => {
      // Arrange
      const { sut, mockExecute } = createSUT();
      const rawOutput = '';
      
      mockExecute.mockResolvedValue({
        stdout: '',
        stderr: '',
        exitCode: 0
      });

      // Act
      const result = await sut.format(rawOutput);

      // Assert
      expect(result).toBe('');
      expect(mockExecute).toHaveBeenCalledWith(
        "echo '' | xcbeautify",
        { shell: '/bin/bash' }
      );
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
      
      mockExecute.mockResolvedValue({
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
      
      mockExecute.mockResolvedValue({
        stdout: formattedWithHeader,
        stderr: '',
        exitCode: 0
      });

      // Act
      const result = await sut.format(rawOutput);

      // Assert
      expect(result).toBe(formattedWithHeader);
    });

    it('should return stdout even when xcbeautify returns non-zero exit code', async () => {
      // Arrange
      const { sut, mockExecute } = createSUT();
      const rawOutput = 'Build output';
      
      // xcbeautify might return non-zero but still produce output
      mockExecute.mockResolvedValue({
        stdout: 'Formatted output',
        stderr: 'Warning: some lines could not be parsed',
        exitCode: 1
      });

      // Act
      const result = await sut.format(rawOutput);

      // Assert
      expect(result).toBe('Formatted output');
    });
  });
});