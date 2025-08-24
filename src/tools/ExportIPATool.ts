import { z } from 'zod';
import { createModuleLogger } from '../logger.js';
import { safePathSchema } from './validators.js';
import { XcodeArchive } from '../utils/projects/XcodeArchive.js';
import { existsSync } from 'fs';

const logger = createModuleLogger('ExportIPATool');

// Validation schema
export const exportIPASchema = z.object({
  archivePath: safePathSchema,
  exportPath: safePathSchema.optional(),
  exportMethod: z.enum(['app-store', 'ad-hoc', 'enterprise', 'development']).default('development')
});

export type ExportIPAArgs = z.infer<typeof exportIPASchema>;

// Interface for testing
export interface IExportIPATool {
  execute(args: any): Promise<any>;
  getToolDefinition(): any;
}

export class ExportIPATool implements IExportIPATool {
  private xcodeArchive: XcodeArchive;
  
  constructor(xcodeArchive?: XcodeArchive) {
    this.xcodeArchive = xcodeArchive || new XcodeArchive();
  }

  getToolDefinition() {
    return {
      name: 'export_ipa',
      description: 'Export an IPA file from an Xcode archive',
      inputSchema: {
        type: 'object',
        properties: {
          archivePath: {
            type: 'string',
            description: 'Path to the .xcarchive file'
          },
          exportPath: {
            type: 'string',
            description: 'Directory where the IPA should be exported (optional)'
          },
          exportMethod: {
            type: 'string',
            description: 'Export method for the IPA',
            default: 'development',
            enum: ['app-store', 'ad-hoc', 'enterprise', 'development']
          }
        },
        required: ['archivePath']
      }
    };
  }

  async execute(args: any) {
    const validated = exportIPASchema.parse(args);
    const { archivePath, exportPath, exportMethod } = validated;
    
    logger.info({ archivePath, exportPath, exportMethod }, 'Exporting IPA');
    
    try {
      // Check if archive exists
      if (!existsSync(archivePath)) {
        throw new Error(`Archive not found at: ${archivePath}`);
      }
      
      // Export the IPA using XcodeArchive
      const result = await this.xcodeArchive.exportIPA(archivePath, {
        exportMethod,
        exportPath
      });
      
      if (!result.success) {
        throw new Error('Export failed');
      }
      
      logger.info({ ipaPath: result.ipaPath }, 'IPA export succeeded');
      
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: true,
              message: 'Successfully exported IPA',
              exportPath: result.ipaPath,
              exportMethod,
              archivePath
            }, null, 2)
          }
        ]
      };
    } catch (error: any) {
      logger.error({ error: error.message, archivePath }, 'Export failed');
      
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: false,
              message: `Export failed: ${error.message}`
            }, null, 2)
          }
        ]
      };
    }
  }
}