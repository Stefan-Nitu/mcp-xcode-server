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
import { MCPController } from '../../presentation/interfaces/MCPController.js';
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
      // Act
      const result = await controller.execute({});

      // Assert
      expect(result).toMatchObject({
        content: expect.arrayContaining([
          expect.objectContaining({
            type: 'text',
            text: expect.any(String)
          })
        ])
      });

      const text = result.content[0].text;
      if (text.includes('No simulators found')) {
        expect(text).toBe('⚠️ No simulators found');
      } else {
        expect(text).toMatch(/Found \d+ simulator/);
      }
    });

    it('should filter by iOS platform', async () => {
      // Act
      const result = await controller.execute({ platform: 'iOS' });

      // Assert
      const text = result.content[0].text;

      if (!text.includes('No simulators found')) {
        const lines = text.split('\n');
        const deviceLines = lines.filter(line =>
          line.includes('(') && line.includes(')') && line.includes('-')
        );

        for (const line of deviceLines) {
          expect(line).toMatch(/iPhone|iPad|iPod/);
          expect(line).not.toMatch(/Apple TV|Apple Watch/);
        }
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
        const deviceLines = lines.filter(line =>
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
      // Act
      const result = await controller.execute({});

      // Assert
      const text = result.content[0].text;

      if (!text.includes('No simulators found')) {
        const lines = text.split('\n');
        const deviceLines = lines.filter(line =>
          line.includes('(') && line.includes(')') && line.includes('-')
        );

        if (deviceLines.length > 0) {
          for (const line of deviceLines) {
            expect(line).toMatch(/iOS \d+\.\d+|tvOS \d+\.\d+|watchOS \d+\.\d+|visionOS \d+\.\d+/);
          }
        }
      }
    });

    it('should filter by tvOS platform', async () => {
      // Act
      const result = await controller.execute({ platform: 'tvOS' });

      // Assert
      const text = result.content[0].text;

      if (!text.includes('No simulators found')) {
        const lines = text.split('\n');
        const deviceLines = lines.filter(line =>
          line.includes('(') && line.includes(')') && line.includes('-')
        );

        for (const line of deviceLines) {
          expect(line).toContain('Apple TV');
        }
      }
    });

    it('should handle combined filters', async () => {
      // Act
      const result = await controller.execute({
        platform: 'iOS',
        state: 'Shutdown'
      });

      // Assert
      const text = result.content[0].text;

      if (!text.includes('No simulators found')) {
        const lines = text.split('\n');
        const deviceLines = lines.filter(line =>
          line.includes('(') && line.includes(')') && line.includes('-')
        );

        for (const line of deviceLines) {
          expect(line).toMatch(/iPhone|iPad|iPod/);
          expect(line).toContain('Shutdown');
        }
      }
    });
  });

  describe('error handling', () => {
    it('should reject invalid platform', async () => {
      // Act & Assert
      await expect(controller.execute({
        platform: 'Android'
      })).rejects.toThrow();
    });

    it('should reject invalid state', async () => {
      // Act & Assert
      await expect(controller.execute({
        state: 'Running'
      })).rejects.toThrow();
    });

    it('should handle invalid input types', async () => {
      // Act & Assert
      await expect(controller.execute({
        platform: 123
      })).rejects.toThrow();

      await expect(controller.execute({
        state: true
      })).rejects.toThrow();
    });
  });

  describe('output formatting', () => {
    it('should format simulator list properly', async () => {
      // Act
      const result = await controller.execute({});

      // Assert
      const text = result.content[0].text;

      if (!text.includes('No simulators found')) {
        expect(text).toMatch(/^✅ Found \d+ simulator/);

        const lines = text.split('\n');
        expect(lines[0]).toMatch(/^✅ Found \d+ simulator/);

        if (lines.length > 1) {
          expect(lines[1]).toBe('');
        }

        const deviceLines = lines.filter(line =>
          line.includes('(') && line.includes(')') && line.includes('-')
        );

        for (const line of deviceLines) {
          expect(line).toMatch(/^• .+ \([A-F0-9-]+\) - (Booted|Shutdown) - (iOS|tvOS|watchOS|visionOS) \d+\.\d+$/);
        }
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