/**
 * E2E Test for ListSimulatorsController
 *
 * Tests CRITICAL USER PATH with REAL simulators:
 * - Can the controller actually list real simulators?
 * - Does filtering work with real simulator data?
 * - Does error handling work with real failures?
 *
 * NO MOCKS - uses real simulators
 * This is an E2E test (10% of test suite) for critical user journeys
 *
 * NOTE: This test requires Xcode and iOS simulators to be installed
 */

import { describe, it, expect, beforeAll, beforeEach } from '@jest/globals';
import { MCPController } from '../../../../presentation/interfaces/MCPController.js';
import { ListSimulatorsControllerFactory } from '../../factories/ListSimulatorsControllerFactory.js';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

describe('ListSimulatorsController E2E', () => {
  let controller: MCPController;

  beforeAll(() => {
    controller = ListSimulatorsControllerFactory.create();
  });

  describe('list real simulators', () => {
    it('should list all available simulators', async () => {
      // Arrange, Act, Assert
      const result = await controller.execute({});

      expect(result).toMatchObject({
        content: expect.arrayContaining([
          expect.objectContaining({
            type: 'text',
            text: expect.any(String)
          })
        ])
      });

      const text = result.content[0].text;
      expect(text).toMatch(/Found \d+ simulator/);

      // Verify actual device lines exist
      const deviceLines = text.split('\n').filter((line: string) =>
        line.includes('(') && line.includes(')') && line.includes('-')
      );
      expect(deviceLines.length).toBeGreaterThan(0);
    });

    it('should filter by iOS platform', async () => {
      // Arrange, Act, Assert
      const result = await controller.execute({ platform: 'iOS' });

      const text = result.content[0].text;
      expect(text).toMatch(/Found \d+ simulator/);

      const deviceLines = text.split('\n').filter((line: string) =>
        line.includes('(') && line.includes(')') && line.includes('-')
      );

      expect(deviceLines.length).toBeGreaterThan(0);
      for (const line of deviceLines) {
        // All devices should show iOS runtime since we filtered by iOS platform
        expect(line).toContain(' - iOS ');
        // Should not contain other platform devices
        expect(line).not.toMatch(/Apple TV|Apple Watch/);
      }
    });

    it('should filter by booted state', async () => {
      // First, check if there are any booted simulators
      const checkResult = await execAsync('xcrun simctl list devices booted --json');
      const bootedDevices = JSON.parse(checkResult.stdout);
      const hasBootedDevices = Object.values(bootedDevices.devices).some(
        (devices: any) => devices.length > 0
      );

      // Act
      const result = await controller.execute({ state: 'Booted' });

      // Assert
      const text = result.content[0].text;

      if (hasBootedDevices) {
        expect(text).toMatch(/Found \d+ simulator/);
        const lines = text.split('\n');
        const deviceLines = lines.filter((line: string) =>
          line.includes('(') && line.includes(')') && line.includes('-')
        );

        for (const line of deviceLines) {
          expect(line).toContain('Booted');
        }
      } else {
        expect(text).toBe('⚠️ No simulators found');
      }
    });

    it('should show runtime information', async () => {
      // Arrange, Act, Assert
      const result = await controller.execute({});

      const text = result.content[0].text;
      expect(text).toMatch(/Found \d+ simulator/);

      const deviceLines = text.split('\n').filter((line: string) =>
        line.includes('(') && line.includes(')') && line.includes('-')
      );

      expect(deviceLines.length).toBeGreaterThan(0);
      for (const line of deviceLines) {
        expect(line).toMatch(/iOS \d+\.\d+|tvOS \d+\.\d+|watchOS \d+\.\d+|visionOS \d+\.\d+/);
      }
    });

    it('should filter by tvOS platform', async () => {
      // Arrange, Act, Assert
      const result = await controller.execute({ platform: 'tvOS' });

      const text = result.content[0].text;

      // tvOS simulators might not exist in all environments
      if (text.includes('No simulators found')) {
        expect(text).toBe('⚠️ No simulators found');
      } else {
        expect(text).toMatch(/Found \d+ simulator/);
        const deviceLines = text.split('\n').filter((line: string) =>
          line.includes('(') && line.includes(')') && line.includes('-')
        );

        for (const line of deviceLines) {
          expect(line).toContain('Apple TV');
          expect(line).toContain(' - tvOS ');
        }
      }
    });

    it('should handle combined filters', async () => {
      // Arrange, Act, Assert
      const result = await controller.execute({
        platform: 'iOS',
        state: 'Shutdown'
      });

      const text = result.content[0].text;
      expect(text).toMatch(/Found \d+ simulator/);

      const deviceLines = text.split('\n').filter((line: string) =>
        line.includes('(') && line.includes(')') && line.includes('-')
      );

      expect(deviceLines.length).toBeGreaterThan(0);
      for (const line of deviceLines) {
        expect(line).toContain(' - iOS ');
        expect(line).toContain('Shutdown');
      }
    });
  });

  describe('error handling', () => {
    it('should return error for invalid platform', async () => {
      // Arrange, Act, Assert
      const result = await controller.execute({
        platform: 'Android'
      });

      expect(result.content[0].text).toBe('❌ Invalid platform: Android. Valid values are: iOS, macOS, tvOS, watchOS, visionOS');
    });

    it('should return error for invalid state', async () => {
      // Arrange, Act, Assert
      const result = await controller.execute({
        state: 'Running'
      });

      expect(result.content[0].text).toBe('❌ Invalid simulator state: Running. Valid values are: Booted, Booting, Shutdown, Shutting Down');
    });

    it('should return error for invalid input types', async () => {
      // Arrange, Act, Assert
      const result1 = await controller.execute({
        platform: 123
      });

      expect(result1.content[0].text).toBe('❌ Platform must be a string (one of: iOS, macOS, tvOS, watchOS, visionOS), got number');

      const result2 = await controller.execute({
        state: true
      });

      expect(result2.content[0].text).toBe('❌ Simulator state must be a string (one of: Booted, Booting, Shutdown, Shutting Down), got boolean');
    });
  });

  describe('output formatting', () => {
    it('should format simulator list properly', async () => {
      // Arrange, Act, Assert
      const result = await controller.execute({});

      const text = result.content[0].text;
      expect(text).toMatch(/^✅ Found \d+ simulator/);

      const lines = text.split('\n');
      expect(lines[0]).toMatch(/^✅ Found \d+ simulator/);
      expect(lines[1]).toBe('');

      const deviceLines = lines.filter((line: string) =>
        line.includes('(') && line.includes(')') && line.includes('-')
      );

      expect(deviceLines.length).toBeGreaterThan(0);
      for (const line of deviceLines) {
        expect(line).toMatch(/^• .+ \([A-F0-9-]+\) - (Booted|Booting|Shutdown|Shutting Down|Unknown) - (iOS|tvOS|watchOS|visionOS|macOS|Unknown) \d+\.\d+$/);
      }
    });

    it('should use warning emoji for no results', async () => {
      // Act - filter that likely returns no results
      const result = await controller.execute({
        platform: 'visionOS',
        state: 'Booted'
      });

      // Assert
      const text = result.content[0].text;

      if (text.includes('No simulators found')) {
        expect(text).toBe('⚠️ No simulators found');
      }
    });
  });
});