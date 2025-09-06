import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { SimulatorControlAdapter } from '../../../../infrastructure/adapters/SimulatorControlAdapter.js';
import { ICommandExecutor } from '../../../../application/ports/CommandPorts.js';

describe('SimulatorControlAdapter', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  function createSUT() {
    const mockExecute = jest.fn<ICommandExecutor['execute']>();
    const mockExecutor: ICommandExecutor = {
      execute: mockExecute
    };
    const sut = new SimulatorControlAdapter(mockExecutor);
    return { sut, mockExecute };
  }

  describe('boot', () => {
    it('should boot simulator successfully', async () => {
      // Arrange
      const { sut, mockExecute } = createSUT();
      mockExecute.mockResolvedValue({
        stdout: '',
        stderr: '',
        exitCode: 0
      });

      // Act
      await sut.boot('ABC-123');

      // Assert
      expect(mockExecute).toHaveBeenCalledWith('xcrun simctl boot "ABC-123"');
    });

    it('should handle already booted simulator gracefully', async () => {
      // Arrange
      const { sut, mockExecute } = createSUT();
      mockExecute.mockResolvedValue({
        stdout: '',
        stderr: 'Unable to boot device in current state: Booted',
        exitCode: 149
      });

      // Act & Assert - should not throw
      await expect(sut.boot('ABC-123')).resolves.toBeUndefined();
    });

    it('should throw error for device not found', async () => {
      // Arrange
      const { sut, mockExecute } = createSUT();
      mockExecute.mockResolvedValue({
        stdout: '',
        stderr: 'Invalid device: ABC-123',
        exitCode: 164
      });

      // Act & Assert
      await expect(sut.boot('ABC-123'))
        .rejects.toThrow('Failed to boot simulator: Invalid device: ABC-123');
    });

    it('should throw error when simulator runtime is not installed on system', async () => {
      // Arrange
      const { sut, mockExecute } = createSUT();
      mockExecute.mockResolvedValue({
        stdout: '',
        stderr: 'The device runtime is not available',
        exitCode: 1
      });

      // Act & Assert
      await expect(sut.boot('ABC-123'))
        .rejects.toThrow('Failed to boot simulator: The device runtime is not available');
    });
  });

  describe('shutdown', () => {
    it('should shutdown simulator successfully', async () => {
      // Arrange
      const { sut, mockExecute } = createSUT();
      mockExecute.mockResolvedValue({
        stdout: '',
        stderr: '',
        exitCode: 0
      });

      // Act
      await sut.shutdown('ABC-123');

      // Assert
      expect(mockExecute).toHaveBeenCalledWith('xcrun simctl shutdown "ABC-123"');
    });

    it('should handle already shutdown simulator gracefully', async () => {
      // Arrange
      const { sut, mockExecute } = createSUT();
      mockExecute.mockResolvedValue({
        stdout: '',
        stderr: 'Unable to shutdown device in current state: Shutdown',
        exitCode: 149
      });

      // Act & Assert - should not throw
      await expect(sut.shutdown('ABC-123')).resolves.toBeUndefined();
    });

    it('should throw error for device not found', async () => {
      // Arrange
      const { sut, mockExecute } = createSUT();
      mockExecute.mockResolvedValue({
        stdout: '',
        stderr: 'Invalid device: ABC-123',
        exitCode: 164
      });

      // Act & Assert
      await expect(sut.shutdown('ABC-123'))
        .rejects.toThrow('Failed to shutdown simulator: Invalid device: ABC-123');
    });
  });
});