import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { BuildDestinationMapperAdapter } from '../../../../infrastructure/adapters/BuildDestinationMapperAdapter.js';
import { SystemArchitectureDetector } from '../../../../infrastructure/services/SystemArchitectureDetector.js';
import { BuildDestination } from '../../../../domain/value-objects/BuildDestination.js';

/**
 * Unit tests for BuildDestinationMapper
 * 
 * Following testing philosophy:
 * - Test behavior, not implementation
 * - Mock only dependencies (SystemArchitectureDetector)
 * - Use factory methods for test data
 * - DAMP over DRY for clarity
 */

describe('BuildDestinationMapper', () => {
  // Factory for creating SUT and mocks
  function createSUT(architecture = 'arm64') {
    const mockGetCurrentArchitecture = jest.fn<() => Promise<string>>();
    mockGetCurrentArchitecture.mockResolvedValue(architecture);
    
    // Create a proper mock that extends the class
    const mockDetector = Object.create(SystemArchitectureDetector.prototype);
    mockDetector.isAppleSilicon = jest.fn<() => Promise<boolean>>();
    mockDetector.getCurrentArchitecture = mockGetCurrentArchitecture;
    
    const sut = new BuildDestinationMapperAdapter(mockDetector);
    
    return { sut, mockGetCurrentArchitecture };
  }
  
  describe('toXcodeBuildOptions', () => {
    describe('iOS destinations', () => {
      it('should map iOSSimulator to simulator with architecture optimization', async () => {
        // Arrange
        const { sut } = createSUT('arm64');
        
        // Act
        const result = await sut.toXcodeBuildOptions(BuildDestination.iOSSimulator);
        
        // Assert
        expect(result).toEqual({
          destination: 'generic/platform=iOS Simulator',
          additionalSettings: ['ARCHS=arm64', 'ONLY_ACTIVE_ARCH=YES']
        });
      });
      
      it('should map iOSSimulator with x86_64 architecture', async () => {
        // Arrange
        const { sut } = createSUT('x86_64');
        
        // Act
        const result = await sut.toXcodeBuildOptions(BuildDestination.iOSSimulator);
        
        // Assert
        expect(result).toEqual({
          destination: 'generic/platform=iOS Simulator',
          additionalSettings: ['ARCHS=x86_64', 'ONLY_ACTIVE_ARCH=YES']
        });
      });
      
      it('should map iOSDevice to physical device platform', async () => {
        // Arrange
        const { sut } = createSUT();
        
        // Act
        const result = await sut.toXcodeBuildOptions(BuildDestination.iOSDevice);
        
        // Assert
        expect(result).toEqual({
          destination: 'generic/platform=iOS'
        });
      });
      
      it('should map iOSSimulatorUniversal without architecture restrictions', async () => {
        // Arrange
        const { sut } = createSUT();
        
        // Act
        const result = await sut.toXcodeBuildOptions(BuildDestination.iOSSimulatorUniversal);
        
        // Assert
        expect(result).toEqual({
          destination: 'generic/platform=iOS Simulator'
        });
      });
    });
    
    describe('tvOS destinations', () => {
      it('should map tvOSSimulator to simulator with architecture optimization', async () => {
        // Arrange
        const { sut } = createSUT('arm64');
        
        // Act
        const result = await sut.toXcodeBuildOptions(BuildDestination.tvOSSimulator);
        
        // Assert
        expect(result).toEqual({
          destination: 'generic/platform=tvOS Simulator',
          additionalSettings: ['ARCHS=arm64', 'ONLY_ACTIVE_ARCH=YES']
        });
      });
      
      it('should map tvOSSimulatorUniversal without architecture restrictions', async () => {
        // Arrange
        const { sut } = createSUT();
        
        // Act
        const result = await sut.toXcodeBuildOptions(BuildDestination.tvOSSimulatorUniversal);
        
        // Assert
        expect(result).toEqual({
          destination: 'generic/platform=tvOS Simulator'
        });
      });
    });
    
    describe('watchOS destinations', () => {
      it('should map watchOSSimulator to simulator with architecture optimization', async () => {
        // Arrange
        const { sut } = createSUT('arm64');
        
        // Act
        const result = await sut.toXcodeBuildOptions(BuildDestination.watchOSSimulator);
        
        // Assert
        expect(result).toEqual({
          destination: 'generic/platform=watchOS Simulator',
          additionalSettings: ['ARCHS=arm64', 'ONLY_ACTIVE_ARCH=YES']
        });
      });
      
      it('should map watchOSSimulatorUniversal without architecture restrictions', async () => {
        // Arrange
        const { sut } = createSUT();
        
        // Act
        const result = await sut.toXcodeBuildOptions(BuildDestination.watchOSSimulatorUniversal);
        
        // Assert
        expect(result).toEqual({
          destination: 'generic/platform=watchOS Simulator'
        });
      });
    });
    
    describe('visionOS destinations', () => {
      it('should map visionOSSimulator to xrOS Simulator with architecture optimization', async () => {
        // Arrange
        const { sut } = createSUT('arm64');
        
        // Act
        const result = await sut.toXcodeBuildOptions(BuildDestination.visionOSSimulator);
        
        // Assert
        expect(result).toEqual({
          destination: 'generic/platform=xrOS Simulator',
          additionalSettings: ['ARCHS=arm64', 'ONLY_ACTIVE_ARCH=YES']
        });
      });
      
      it('should map visionOSSimulatorUniversal to xrOS without restrictions', async () => {
        // Arrange
        const { sut } = createSUT();
        
        // Act
        const result = await sut.toXcodeBuildOptions(BuildDestination.visionOSSimulatorUniversal);
        
        // Assert
        expect(result).toEqual({
          destination: 'generic/platform=xrOS Simulator'
        });
      });
    });
    
    describe('macOS destinations', () => {
      it('should map macOSSimulator to macOS with architecture optimization', async () => {
        // Arrange
        const { sut } = createSUT('arm64');
        
        // Act
        const result = await sut.toXcodeBuildOptions(BuildDestination.macOS);
        
        // Assert
        expect(result).toEqual({
          destination: 'platform=macOS',
          additionalSettings: ['ARCHS=arm64', 'ONLY_ACTIVE_ARCH=YES']
        });
      });
      
      it('should map macOSUniversal without architecture restrictions', async () => {
        // Arrange
        const { sut } = createSUT();
        
        // Act
        const result = await sut.toXcodeBuildOptions(BuildDestination.macOSUniversal);
        
        // Assert
        expect(result).toEqual({
          destination: 'platform=macOS'
        });
      });
    });
    
    describe('default fallback', () => {
      it('should fallback to iOS Simulator for unknown destination', async () => {
        // Arrange
        const { sut } = createSUT();
        // Force an invalid enum value through type casting
        const unknownDestination = 'UnknownDestination' as BuildDestination;
        
        // Act
        const result = await sut.toXcodeBuildOptions(unknownDestination);
        
        // Assert
        expect(result).toEqual({
          destination: 'generic/platform=iOS Simulator'
        });
      });
    });
    
    describe('architecture detection integration', () => {
      it('should call architecture detector once per invocation', async () => {
        // Arrange
        const { sut, mockGetCurrentArchitecture } = createSUT();
        
        // Act
        await sut.toXcodeBuildOptions(BuildDestination.iOSSimulator);
        
        // Assert
        expect(mockGetCurrentArchitecture).toHaveBeenCalledTimes(1);
      });
      
      it('should use detected architecture in build settings', async () => {
        // Arrange
        const customArch = 'custom-arch';
        const { sut } = createSUT(customArch);
        
        // Act
        const result = await sut.toXcodeBuildOptions(BuildDestination.macOS);
        
        // Assert
        expect(result.additionalSettings).toContain(`ARCHS=${customArch}`);
      });
    });
  });
  
  describe('platform name mapping', () => {
    it('should correctly map visionOS to xrOS in xcodebuild', async () => {
      // Arrange
      const { sut } = createSUT();
      
      // Act
      const autoResult = await sut.toXcodeBuildOptions(BuildDestination.visionOSSimulator);
      const universalResult = await sut.toXcodeBuildOptions(BuildDestination.visionOSSimulatorUniversal);
      
      // Assert
      expect(autoResult.destination).toContain('xrOS');
      expect(universalResult.destination).toContain('xrOS');
      expect(autoResult.destination).not.toContain('visionOS');
    });
  });
  
  describe('build optimization settings', () => {
    it('should include ONLY_ACTIVE_ARCH for Simulator destinations', async () => {
      // Arrange
      const { sut } = createSUT();
      const autoDestinations = [
        BuildDestination.iOSSimulator,
        BuildDestination.tvOSSimulator,
        BuildDestination.watchOSSimulator,
        BuildDestination.visionOSSimulator,
        BuildDestination.macOS
      ];
      
      // Act & Assert
      for (const destination of autoDestinations) {
        const result = await sut.toXcodeBuildOptions(destination);
        expect(result.additionalSettings).toContain('ONLY_ACTIVE_ARCH=YES');
      }
    });
    
    it('should not include additionalSettings for Universal destinations', async () => {
      // Arrange
      const { sut } = createSUT();
      const universalDestinations = [
        BuildDestination.iOSSimulatorUniversal,
        BuildDestination.tvOSSimulatorUniversal,
        BuildDestination.watchOSSimulatorUniversal,
        BuildDestination.visionOSSimulatorUniversal,
        BuildDestination.macOSUniversal
      ];
      
      // Act & Assert
      for (const destination of universalDestinations) {
        const result = await sut.toXcodeBuildOptions(destination);
        expect(result.additionalSettings).toBeUndefined();
      }
    });
    
    it('should not include additionalSettings for device builds', async () => {
      // Arrange
      const { sut } = createSUT();
      
      // Act
      const result = await sut.toXcodeBuildOptions(BuildDestination.iOSDevice);
      
      // Assert
      expect(result.additionalSettings).toBeUndefined();
    });
  });
});