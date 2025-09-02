import { existsSync } from 'fs';
import path from 'path';
import { createModuleLogger } from '../../../logger.js';
import { ModernXcresultParser } from './parsers/ModernXcresultParser.js';
import { LegacyXcresultParser } from './parsers/LegacyXcresultParser.js';
import { OutputTextParser } from './parsers/OutputTextParser.js';

const logger = createModuleLogger('TestResultParser');

export interface TestResult {
  passed: number;
  failed: number;
  success: boolean;
  failingTests?: Array<{ identifier: string; reason: string }>;
}

/**
 * Orchestrates test result parsing from xcresult bundles
 * Single Responsibility: Coordinate parsing strategies for test results
 */
export class TestResultParser {
  constructor(
    private modernParser = new ModernXcresultParser(),
    private legacyParser = new LegacyXcresultParser(),
    private textParser = new OutputTextParser()
  ) {}

  /**
   * Parse test results from xcresult bundle
   */
  async parseXcresult(resultBundlePath: string, output: string = ''): Promise<TestResult> {
    // Extract the actual xcresult path from the output if available
    const actualPath = this.extractXcresultPath(resultBundlePath, output);
    
    // Wait for xcresult to be ready
    const isReady = await this.waitForXcresult(actualPath);
    if (!isReady) {
      logger.warn({ resultBundlePath: actualPath }, 'xcresult bundle not ready, using fallback parsing');
      return this.textParser.parse(output);
    }
    
    // Try parsers in order until one succeeds
    try {
      logger.debug('Attempting modern xcresult parser');
      return await this.modernParser.parse(actualPath);
    } catch (modernError: any) {
      logger.debug({ error: modernError.message }, 'Modern parser failed, trying legacy');
    }
    
    try {
      return await this.legacyParser.parse(actualPath);
    } catch (legacyError: any) {
      logger.warn({ error: legacyError.message }, 'Legacy parser failed, falling back to text');
    }
    
    // Last resort: parse from text output
    return this.textParser.parse(output);
  }
  
  /**
   * Extract actual xcresult path from output
   */
  private extractXcresultPath(defaultPath: string, output: string): string {
    // Try to extract from "Test session results" line
    const resultMatch = output.match(/Test session results.*?\n\s*(.+\.xcresult)/);
    if (resultMatch) {
      const path = resultMatch[1].trim();
      logger.debug({ resultBundlePath: path }, 'Found xcresult path in output');
      return path;
    }
    
    // Try to extract from "Writing result bundle at path" message
    const writingMatch = output.match(/Writing result bundle at path:\s*(.+\.xcresult)/);
    if (writingMatch) {
      const path = writingMatch[1].trim();
      logger.debug({ resultBundlePath: path }, 'Found xcresult path from Writing message');
      return path;
    }
    
    return defaultPath;
  }
  
  /**
   * Wait for xcresult bundle to be fully written
   */
  private async waitForXcresult(resultBundlePath: string): Promise<boolean> {
    const maxWaitTime = 10000;
    const checkInterval = 200;
    let waitTime = 0;
    
    const isXcresultReady = () => {
      if (!existsSync(resultBundlePath)) {
        return false;
      }
      // Check if Info.plist exists inside the bundle, which indicates it's fully written
      const infoPlistPath = path.join(resultBundlePath, 'Info.plist');
      return existsSync(infoPlistPath);
    };
    
    while (!isXcresultReady() && waitTime < maxWaitTime) {
      await new Promise(resolve => setTimeout(resolve, checkInterval));
      waitTime += checkInterval;
    }
    
    if (!isXcresultReady()) {
      return false;
    }
    
    // Give xcresulttool a moment to prepare for reading
    await new Promise(resolve => setTimeout(resolve, 300));
    logger.debug({ resultBundlePath, waitTime }, 'xcresult bundle is ready');
    
    return true;
  }
}