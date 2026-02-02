import { readdir, stat } from 'fs/promises';
import { join } from 'path';
import { writeFile } from 'fs/promises';
import {
  VersionsManifest,
  GameDataFileType,
  FILE_TYPE_TO_FILENAME,
} from '../app/lib/types/versionsManifest';

async function generateManifest() {
  const publicPath = join(process.cwd(), 'public');
  const versions = (await readdir(publicPath))
    .filter(v => /^[0-9]+\.[0-9]+\.[0-9]+$/.test(v))
    .sort();

  // Initialize manifest with all file types
  const files: VersionsManifest['files'] = {} as VersionsManifest['files'];
  for (const fileType of Object.keys(FILE_TYPE_TO_FILENAME) as GameDataFileType[]) {
    files[fileType] = {};
  }

  const manifest: VersionsManifest = {
    versions,
    files,
  };

  // Check which files exist in which versions
  // Only add version entries if the file actually exists
  for (const version of versions) {
    for (const [fileType, fileName] of Object.entries(FILE_TYPE_TO_FILENAME) as [
      GameDataFileType,
      string,
    ][]) {
      const filePath = join(publicPath, version, 'game_data', fileName);
      const imagePath = join(publicPath, version, fileName);
      
      try {
        await stat(filePath);
        // File exists in game_data folder
        manifest.files[fileType][version] = {
          path: `/${version}/game_data/${fileName}`,
        };
      } catch {
        try {
          await stat(imagePath);
          // File exists in images folder
          manifest.files[fileType][version] = {
            path: `/${version}/${fileName}`,
          };
        } catch {
          // File doesn't exist for this version - don't add entry
          // The key will simply be undefined
        }
      }
    }
  }

  await writeFile(
    join(publicPath, 'versions-manifest.json'),
    JSON.stringify(manifest, null, 2)
  );
  
  console.log('Versions manifest generated successfully');
}

// Run the generator if this script is executed directly
generateManifest().catch((error) => {
  console.error('Error generating manifest:', error);
  process.exit(1);
});