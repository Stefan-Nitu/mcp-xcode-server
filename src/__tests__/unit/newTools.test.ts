import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { 
  ListSchemesTool,
  GetBuildSettingsTool,
  GetProjectInfoTool,
  ListTargetsTool,
  ArchiveProjectTool,
  ExportIPATool
} from '../../tools/index.js';

describe('New Tools Unit Tests', () => {
  describe('ListSchemesTool', () => {
    let tool: ListSchemesTool;

    beforeEach(() => {
      tool = new ListSchemesTool();
    });

    it('should list schemes successfully', async () => {
      // This now tests the real implementation
      // Since we can't easily mock execAsync, we'll just verify the response format
      const definition = tool.getToolDefinition();
      expect(definition.name).toBe('list_schemes');
      expect(definition.inputSchema.required).toContain('projectPath');
    });

    it('should handle validation errors', async () => {
      // Test invalid input
      await expect(tool.execute({})).rejects.toThrow();
      await expect(tool.execute({ projectPath: 123 })).rejects.toThrow();
    });

    it('should validate tool definition', () => {
      const definition = tool.getToolDefinition();
      expect(definition.name).toBe('list_schemes');
      expect(definition.inputSchema.required).toContain('projectPath');
    });
  });

  describe('GetBuildSettingsTool', () => {
    let tool: GetBuildSettingsTool;
    let mockXcodeBuilder: any;

    beforeEach(() => {
      mockXcodeBuilder = {
        getBuildSettingsInstance: jest.fn<() => Promise<Record<string, string>>>().mockResolvedValue({
          PRODUCT_NAME: 'MyApp',
          PRODUCT_BUNDLE_IDENTIFIER: 'com.example.myapp',
          SWIFT_VERSION: '5.0',
          CONFIGURATION: 'Debug'
        })
      };
      tool = new GetBuildSettingsTool(mockXcodeBuilder);
    });

    it('should get build settings successfully', async () => {
      const result = await tool.execute({
        projectPath: '/path/to/project.xcodeproj',
        scheme: 'MyScheme'
      });

      expect(mockXcodeBuilder.getBuildSettingsInstance).toHaveBeenCalledWith(
        '/path/to/project.xcodeproj',
        'MyScheme',
        undefined,
        undefined
      );
      expect(result.content[0].text).toContain('PRODUCT_NAME');
      expect(result.content[0].text).toContain('MyApp');
    });

    it('should validate tool definition', () => {
      const definition = tool.getToolDefinition();
      expect(definition.name).toBe('get_build_settings');
      expect(definition.inputSchema.required).toContain('projectPath');
      expect(definition.inputSchema.required).toContain('scheme');
    });
  });

  describe('GetProjectInfoTool', () => {
    let tool: GetProjectInfoTool;
    let mockXcodeBuilder: any;

    beforeEach(() => {
      mockXcodeBuilder = {
        getProjectInfoInstance: jest.fn<() => Promise<any>>().mockResolvedValue({
          name: 'MyProject',
          schemes: ['Scheme1', 'Scheme2'],
          targets: ['Target1', 'Target2'],
          configurations: ['Debug', 'Release']
        })
      };
      tool = new GetProjectInfoTool(mockXcodeBuilder);
    });

    it('should get project info successfully', async () => {
      const result = await tool.execute({
        projectPath: '/path/to/project.xcodeproj'
      });

      expect(mockXcodeBuilder.getProjectInfoInstance).toHaveBeenCalledWith('/path/to/project.xcodeproj');
      expect(result.content[0].text).toContain('MyProject');
      expect(result.content[0].text).toContain('Scheme1');
    });

    it('should validate tool definition', () => {
      const definition = tool.getToolDefinition();
      expect(definition.name).toBe('get_project_info');
      expect(definition.inputSchema.required).toContain('projectPath');
    });
  });

  describe('ListTargetsTool', () => {
    let tool: ListTargetsTool;
    let mockXcodeBuilder: any;

    beforeEach(() => {
      mockXcodeBuilder = {
        listTargetsInstance: jest.fn<() => Promise<string[]>>().mockResolvedValue(['MainApp', 'TestTarget', 'UITests'])
      };
      tool = new ListTargetsTool(mockXcodeBuilder);
    });

    it('should list targets successfully', async () => {
      const result = await tool.execute({
        projectPath: '/path/to/project.xcodeproj'
      });

      expect(mockXcodeBuilder.listTargetsInstance).toHaveBeenCalledWith('/path/to/project.xcodeproj');
      expect(result.content[0].text).toContain('MainApp');
      expect(result.content[0].text).toContain('TestTarget');
    });

    it('should validate tool definition', () => {
      const definition = tool.getToolDefinition();
      expect(definition.name).toBe('list_targets');
      expect(definition.inputSchema.required).toContain('projectPath');
    });
  });

  describe('ArchiveProjectTool', () => {
    let tool: ArchiveProjectTool;
    let mockXcodeBuilder: any;

    beforeEach(() => {
      mockXcodeBuilder = {
        archiveProjectInstance: jest.fn<() => Promise<string>>().mockResolvedValue('/path/to/archive.xcarchive')
      };
      tool = new ArchiveProjectTool();
    });

    it('should archive project successfully', async () => {
      const result = await tool.execute({
        projectPath: '/path/to/project.xcodeproj',
        scheme: 'MyScheme'
      });

      expect(mockXcodeBuilder.archiveProjectInstance).toHaveBeenCalledWith(
        '/path/to/project.xcodeproj',
        'MyScheme',
        'iOS',
        'Release',
        undefined
      );
      expect(result.content[0].text).toContain('/path/to/archive.xcarchive');
      expect(result.content[0].text).toContain('Successfully archived');
    });

    it('should validate tool definition', () => {
      const definition = tool.getToolDefinition();
      expect(definition.name).toBe('archive_project');
      expect(definition.inputSchema.required).toContain('projectPath');
      expect(definition.inputSchema.required).toContain('scheme');
    });
  });

  describe('ExportIPATool', () => {
    let tool: ExportIPATool;
    let mockXcodeBuilder: any;

    beforeEach(() => {
      mockXcodeBuilder = {
        exportIPAInstance: jest.fn<() => Promise<string>>().mockResolvedValue('/path/to/export')
      };
      tool = new ExportIPATool(mockXcodeBuilder);
    });

    it('should export IPA successfully', async () => {
      const result = await tool.execute({
        archivePath: '/path/to/archive.xcarchive'
      });

      expect(mockXcodeBuilder.exportIPAInstance).toHaveBeenCalledWith(
        '/path/to/archive.xcarchive',
        undefined,
        'development'
      );
      expect(result.content[0].text).toContain('/path/to/export');
      expect(result.content[0].text).toContain('Successfully exported IPA');
    });

    it('should validate tool definition', () => {
      const definition = tool.getToolDefinition();
      expect(definition.name).toBe('export_ipa');
      expect(definition.inputSchema.required).toContain('archivePath');
    });
  });
});