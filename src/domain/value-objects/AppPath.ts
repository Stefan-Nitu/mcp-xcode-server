import { z } from 'zod';

/**
 * Value object for an app bundle path
 * Ensures the path ends with .app extension
 */
export class AppPath {
  private constructor(private readonly value: string) {}

  static create(path: string): AppPath {
    const schema = z.string()
      .min(1, 'App path cannot be empty')
      .refine(p => p.endsWith('.app') || p.endsWith('.app/'), 'Path must end with .app extension')
      .refine(p => !p.includes('..'), 'Path cannot contain directory traversal')
      .refine(p => !p.includes('\0'), 'Path cannot contain null characters');
    
    const validated = schema.parse(path);
    return new AppPath(validated);
  }

  toString(): string {
    return this.value;
  }

  get name(): string {
    // Handle both forward slash and backslash for cross-platform support
    const separatorPattern = /[/\\]/;
    const parts = this.value.split(separatorPattern);
    const lastPart = parts[parts.length - 1];
    
    // If path ends with /, the last part will be empty, so take the second to last
    return lastPart || parts[parts.length - 2];
  }
}