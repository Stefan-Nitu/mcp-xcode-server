import { existsSync } from 'fs';
import path from 'path';

/**
 * Value Object: Represents a validated project path
 * Ensures the path exists and is a valid Xcode project or workspace
 */
export class ProjectPath {
  private constructor(private readonly value: string) {}
  
  static create(pathString: string): ProjectPath {
    if (!pathString) {
      throw new Error('Project path cannot be empty');
    }
    
    if (!existsSync(pathString)) {
      throw new Error(`Project path does not exist: ${pathString}`);
    }
    
    const ext = path.extname(pathString);
    if (ext !== '.xcodeproj' && ext !== '.xcworkspace') {
      throw new Error('Path must be an .xcodeproj or .xcworkspace file');
    }
    
    return new ProjectPath(pathString);
  }
  
  toString(): string {
    return this.value;
  }
  
  get name(): string {
    return path.basename(this.value, path.extname(this.value));
  }
  
  get isWorkspace(): boolean {
    return path.extname(this.value) === '.xcworkspace';
  }
}