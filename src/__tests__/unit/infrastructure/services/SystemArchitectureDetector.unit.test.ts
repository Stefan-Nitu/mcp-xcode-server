import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { SystemArchitectureDetector } from '../../../../infrastructure/services/SystemArchitectureDetector.js';
import { ICommandExecutor, ExecutionResult } from '../../../../application/ports/CommandPorts.js';

/**
 * Unit tests for SystemArchitectureDetector
 * 
 * Following testing philosophy:
 * - Test behavior, not implementation
 * - Mock only at boundaries (command executor)
 * - Use factory methods for test data
 * - DAMP over DRY for clarity
 */

describe('SystemArchitectureDetector', () => {
  // Factory for creating SUT and mocks
  function createSUT() {
    const mockExecute = jest.fn<(command: string) => Promise<ExecutionResult>>();
    const mockExecutor: ICommandExecutor = { execute: mockExecute };
    const sut = new SystemArchitectureDetector(mockExecutor);
    
    return { sut, mockExecute };
  }
  
  // Factory for execution results
  function createSuccessResult(stdout: string): ExecutionResult {
    return {
      stdout,
      stderr: '',
      exitCode: 0
    };
  }
  
  function createErrorResult(): ExecutionResult {
    return {
      stdout: '',
      stderr: 'Command not found',
      exitCode: 1
    };
  }
  
  describe('isAppleSilicon', () => {
    describe('Apple Silicon detection', () => {
      it('should detect Apple Silicon when sysctl returns 1', async () => {
        // Arrange
        const { sut, mockExecute } = createSUT();
        mockExecute.mockResolvedValueOnce(createSuccessResult('1\n'));
        
        // Act
        const result = await sut.isAppleSilicon();
        
        // Assert
        expect(result).toBe(true);
        expect(mockExecute).toHaveBeenCalledWith('sysctl -n hw.optional.arm64');
      });
      
      it('should detect Apple Silicon when sysctl fails but uname returns arm64', async () => {
        // Arrange
        const { sut, mockExecute } = createSUT();
        mockExecute
          .mockRejectedValueOnce(new Error('sysctl failed'))
          .mockResolvedValueOnce(createSuccessResult('arm64\n'));
        
        // Act
        const result = await sut.isAppleSilicon();
        
        // Assert
        expect(result).toBe(true);
        expect(mockExecute).toHaveBeenCalledWith('sysctl -n hw.optional.arm64');
        expect(mockExecute).toHaveBeenCalledWith('uname -m');
      });
    });
    
    describe('Intel detection', () => {
      it('should detect Intel when sysctl returns 0', async () => {
        // Arrange
        const { sut, mockExecute } = createSUT();
        mockExecute.mockResolvedValueOnce(createSuccessResult('0\n'));
        
        // Act
        const result = await sut.isAppleSilicon();
        
        // Assert
        expect(result).toBe(false);
        expect(mockExecute).toHaveBeenCalledWith('sysctl -n hw.optional.arm64');
      });
      
      it('should detect Intel when sysctl returns empty string', async () => {
        // Arrange
        const { sut, mockExecute } = createSUT();
        mockExecute.mockResolvedValueOnce(createSuccessResult(''));
        
        // Act
        const result = await sut.isAppleSilicon();
        
        // Assert
        expect(result).toBe(false);
      });
      
      it('should detect Intel when sysctl fails and uname returns x86_64', async () => {
        // Arrange
        const { sut, mockExecute } = createSUT();
        mockExecute
          .mockRejectedValueOnce(new Error('sysctl failed'))
          .mockResolvedValueOnce(createSuccessResult('x86_64\n'));
        
        // Act
        const result = await sut.isAppleSilicon();
        
        // Assert
        expect(result).toBe(false);
        expect(mockExecute).toHaveBeenCalledWith('uname -m');
      });
    });
    
    describe('error handling', () => {
      it('should default to Intel when both commands fail', async () => {
        // Arrange
        const { sut, mockExecute } = createSUT();
        mockExecute
          .mockRejectedValueOnce(new Error('sysctl failed'))
          .mockRejectedValueOnce(new Error('uname failed'));
        
        // Act
        const result = await sut.isAppleSilicon();
        
        // Assert
        expect(result).toBe(false);
        expect(mockExecute).toHaveBeenCalledTimes(2);
      });
      
      it('should handle non-standard output gracefully', async () => {
        // Arrange
        const { sut, mockExecute } = createSUT();
        mockExecute.mockResolvedValueOnce(createSuccessResult('unexpected output'));
        
        // Act
        const result = await sut.isAppleSilicon();
        
        // Assert
        expect(result).toBe(false);
      });
    });
    
    describe('caching behavior', () => {
      it('should cache the result and not re-execute commands', async () => {
        // Arrange
        const { sut, mockExecute } = createSUT();
        mockExecute.mockResolvedValueOnce(createSuccessResult('1'));
        
        // Act
        const result1 = await sut.isAppleSilicon();
        const result2 = await sut.isAppleSilicon();
        const result3 = await sut.isAppleSilicon();
        
        // Assert
        expect(result1).toBe(true);
        expect(result2).toBe(true);
        expect(result3).toBe(true);
        expect(mockExecute).toHaveBeenCalledTimes(1); // Only called once
      });
      
      it('should cache false result as well', async () => {
        // Arrange
        const { sut, mockExecute } = createSUT();
        mockExecute.mockResolvedValueOnce(createSuccessResult('0'));
        
        // Act
        const result1 = await sut.isAppleSilicon();
        const result2 = await sut.isAppleSilicon();
        
        // Assert
        expect(result1).toBe(false);
        expect(result2).toBe(false);
        expect(mockExecute).toHaveBeenCalledTimes(1);
      });
      
      it('should cache result even after fallback', async () => {
        // Arrange
        const { sut, mockExecute } = createSUT();
        mockExecute
          .mockRejectedValueOnce(new Error('sysctl failed'))
          .mockResolvedValueOnce(createSuccessResult('arm64'));
        
        // Act
        const result1 = await sut.isAppleSilicon();
        const result2 = await sut.isAppleSilicon();
        
        // Assert
        expect(result1).toBe(true);
        expect(result2).toBe(true);
        expect(mockExecute).toHaveBeenCalledTimes(2); // sysctl + uname, but only once
      });
    });
    
    describe('whitespace handling', () => {
      it('should trim whitespace from sysctl output', async () => {
        // Arrange
        const { sut, mockExecute } = createSUT();
        mockExecute.mockResolvedValueOnce(createSuccessResult('  1  \n'));
        
        // Act
        const result = await sut.isAppleSilicon();
        
        // Assert
        expect(result).toBe(true);
      });
      
      it('should trim whitespace from uname output', async () => {
        // Arrange
        const { sut, mockExecute } = createSUT();
        mockExecute
          .mockRejectedValueOnce(new Error('sysctl failed'))
          .mockResolvedValueOnce(createSuccessResult('  arm64  \n'));
        
        // Act
        const result = await sut.isAppleSilicon();
        
        // Assert
        expect(result).toBe(true);
      });
    });
  });
  
  describe('getCurrentArchitecture', () => {
    it('should return arm64 for Apple Silicon', async () => {
      // Arrange
      const { sut, mockExecute } = createSUT();
      mockExecute.mockResolvedValueOnce(createSuccessResult('1'));
      
      // Act
      const arch = await sut.getCurrentArchitecture();
      
      // Assert
      expect(arch).toBe('arm64');
    });
    
    it('should return x86_64 for Intel', async () => {
      // Arrange
      const { sut, mockExecute } = createSUT();
      mockExecute.mockResolvedValueOnce(createSuccessResult('0'));
      
      // Act
      const arch = await sut.getCurrentArchitecture();
      
      // Assert
      expect(arch).toBe('x86_64');
    });
    
    it('should use cached detection result', async () => {
      // Arrange
      const { sut, mockExecute } = createSUT();
      mockExecute.mockResolvedValueOnce(createSuccessResult('1'));
      
      // Act
      await sut.isAppleSilicon(); // Prime the cache
      const arch1 = await sut.getCurrentArchitecture();
      const arch2 = await sut.getCurrentArchitecture();
      
      // Assert
      expect(arch1).toBe('arm64');
      expect(arch2).toBe('arm64');
      expect(mockExecute).toHaveBeenCalledTimes(1); // Only called once for initial detection
    });
    
    it('should handle detection failure gracefully', async () => {
      // Arrange
      const { sut, mockExecute } = createSUT();
      mockExecute
        .mockRejectedValueOnce(new Error('sysctl failed'))
        .mockRejectedValueOnce(new Error('uname failed'));
      
      // Act
      const arch = await sut.getCurrentArchitecture();
      
      // Assert
      expect(arch).toBe('x86_64'); // Defaults to Intel
    });
  });
  
  describe('edge cases', () => {
    it('should handle sysctl returning non-numeric values', async () => {
      // Arrange
      const { sut, mockExecute } = createSUT();
      mockExecute.mockResolvedValueOnce(createSuccessResult('yes'));
      
      // Act
      const result = await sut.isAppleSilicon();
      
      // Assert
      expect(result).toBe(false);
    });
    
    it('should handle uname returning unknown architecture', async () => {
      // Arrange
      const { sut, mockExecute } = createSUT();
      mockExecute
        .mockRejectedValueOnce(new Error('sysctl failed'))
        .mockResolvedValueOnce(createSuccessResult('powerpc'));
      
      // Act
      const result = await sut.isAppleSilicon();
      
      // Assert
      expect(result).toBe(false);
    });
    
    it('should handle empty stdout from commands', async () => {
      // Arrange
      const { sut, mockExecute } = createSUT();
      mockExecute
        .mockResolvedValueOnce(createSuccessResult(''))
        .mockResolvedValueOnce(createSuccessResult(''));
      
      // Act
      const result = await sut.isAppleSilicon();
      
      // Assert
      expect(result).toBe(false);
    });
  });
});