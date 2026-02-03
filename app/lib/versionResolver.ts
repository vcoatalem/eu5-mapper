import {
  VersionsManifest,
  GameDataFileType,
} from './types/versionsManifest';

export class VersionResolver {
  private manifest: VersionsManifest | null = null;


  public async loadVersionsManifest(): Promise<VersionsManifest> {
    if (this.manifest) {
      return this.manifest;
    }
    
    const isNodeEnv = typeof window === 'undefined';
    
    if (isNodeEnv) {
      const fs = await import('fs/promises');
      const path = await import('path');
      const manifestPath = path.join(process.cwd(), 'public/versions-manifest.json');
      const manifestContent = await fs.readFile(manifestPath, 'utf-8');
      const manifest = JSON.parse(manifestContent) as VersionsManifest;
      this.manifest = manifest;
      return manifest;
    } else {
      const response = await fetch('/versions-manifest.json');
      if (!response.ok) {
        throw new Error('Failed to load versions manifest');
      }
      const manifest = await response.json() as VersionsManifest;
      this.manifest = manifest;
      return manifest;
    }
  }


  public async resolveFileVersion(
    fileType: GameDataFileType,
    targetVersion: string
  ): Promise<string> {
    if (!this.manifest) {
      throw new Error('Manifest not loaded. Call loadVersionsManifest() first.');
    }
    
    const fileManifest = this.manifest.files[fileType];
    
    if (!fileManifest) {
      throw new Error(`File type ${fileType} not found in manifest`);
    }
  
    // Get available versions for this file (only versions that exist as keys)
    const availableVersions = Object.keys(fileManifest)
      .filter(version => fileManifest[version] !== undefined)
      .sort();
  
    if (availableVersions.length === 0) {
      throw new Error(`No versions available for file type ${fileType}`);
    }
  
    return this.getClosestVersion(availableVersions, targetVersion);
  }

  /**
   * Get the file path for a resolved version
   */
  public getFilePath(fileType: GameDataFileType, resolvedVersion: string): string {
    if (!this.manifest) {
      throw new Error('Manifest not loaded. Call loadVersionsManifest() first.');
    }
    
    const fileManifest = this.manifest.files[fileType];
    if (!fileManifest || !fileManifest[resolvedVersion]) {
      throw new Error(`File type ${fileType} not found for version ${resolvedVersion}`);
    }
    
    return fileManifest[resolvedVersion].path;
  }

  /**
   * @param availableVersions list of available semver versions (ex: 0.0.11, 0.1.0, 0.1.1, 1.0.0)
   * @returns the targetVersion if found, the closest previous version otherwise
   */
  private getClosestVersion = (
    availableVersions: string[],
    targetVersion: string,
  ): string => {
    if (availableVersions.includes(targetVersion)) {
      return targetVersion;
    }

    let closestMatch: string | null = null;

    for (const version of availableVersions) {
      // Validate semver format - skip if not valid
      if (!/^[0-9]+\.[0-9]+\.[0-9]+$/.test(version)) {
        continue;
      }
      // We count on semver versions being alphabetically ordered
      if (version < targetVersion) {
        if (!closestMatch || version > closestMatch) {
          closestMatch = version;
        }
      }
    }
    
    if (!closestMatch) {
      throw new Error(
        `Could not find any suitable version for target version ${targetVersion}`,
      );
    }

    return closestMatch;
  };


}




 



/* export async function getFilePath(
  fileName: string,
  targetVersion: string
): Promise<string> {
  const manifest = await loadVersionsManifest();
  const resolvedVersion = await resolveFileVersion(fileName, targetVersion);
  return manifest.files[fileName][resolvedVersion].path;
} */