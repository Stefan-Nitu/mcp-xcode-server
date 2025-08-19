import { z } from 'zod';
import { XcodeBuilder } from '../xcodeBuilder.js';
import { createModuleLogger } from '../logger.js';
import { safePathSchema } from './validators.js';
import { XcodeBuilderAdapter } from './XcodeBuilderAdapter.js';

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
  private adapter: XcodeBuilderAdapter;
  
  constructor(
    xcodeBuilder: XcodeBuilder | typeof XcodeBuilder = XcodeBuilder
  ) {
    this.adapter = new XcodeBuilderAdapter(xcodeBuilder);
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
    
    const resultPath = await this.adapter.exportIPA(
      archivePath,
      exportPath,
      exportMethod
    );
    
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            success: true,
            message: 'Successfully exported IPA',
            exportPath: resultPath,
            exportMethod,
            archivePath
          }, null, 2)
        }
      ]
    };
  }
}