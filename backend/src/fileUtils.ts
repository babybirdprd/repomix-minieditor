// Utility functions for file operations
// (Refactored for backend usage, add Node.js imports as needed)

import { promises as fs } from 'fs';
import path from 'path';

/**
 * Reads the content of a file.
 * @param filePath - The path to the file.
 * @returns The content of the file.
 * @throws If the file cannot be read.
 */
export async function readFileContent(filePath: string): Promise<string> {
  try {
    const content = await fs.readFile(filePath, 'utf8');
    return content;
  } catch (error: any) {
    console.error(`Error reading file ${filePath}: ${error}`);
    throw new Error(`Failed to read file ${filePath}: ${error.message}`);
  }
}

/**
 * Writes content to a file, creating directories if they don't exist.
 * @param filePath - The path to the file.
 * @param content - The content to write.
 * @throws If the file cannot be written.
 */
export async function writeFileContent(filePath: string, content: string): Promise<void> {
  try {
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, content, 'utf8');
    console.log(`Successfully wrote to file: ${filePath}`);
  } catch (error: any) {
    console.error(`Error writing file ${filePath}: ${error}`);
    throw new Error(`Failed to write file ${filePath}: ${error.message}`);
  }
}

/**
 * Applies code changes from an object (e.g., parsed XML) to the filesystem.
 * Assumes the object has a structure representing files and their content.
 * @param fileChanges - An object where keys are file paths and values are file contents.
 * @param repoPath - The root path of the repository to apply changes within.
 */
export async function applyCodeChanges(fileChanges: Record<string, string>, repoPath: string): Promise<void> {
  const resolveFilePath = async (repoRoot: string, filePath: string): Promise<string | null> => {
    const absPath = path.join(repoRoot, filePath);
    try {
      if (await fs.stat(absPath).then(stat => stat.isFile()).catch(() => false)) return absPath;
    } catch {}
    // Fallback: search for matching filename anywhere in repo
    const matches: string[] = [];
    async function searchDir(dir: string) {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) await searchDir(full);
        else if (entry.name === path.basename(filePath)) matches.push(full);
      }
    }
    await searchDir(repoRoot);
    if (matches.length === 1) return matches[0];
    if (matches.length > 1) {
      console.warn(`Multiple matches for ${filePath}:`, matches);
      // Choose the shortest path, or prompt user, or pick first
      return matches.sort((a, b) => a.length - b.length)[0];
    }
    return null;
  };

  console.log('Applying code changes...');
  for (const filePath in fileChanges) {
    if (Object.hasOwnProperty.call(fileChanges, filePath)) {
      const resolvedPath = await resolveFilePath(repoPath, filePath);
      const targetPath = resolvedPath || path.join(repoPath, filePath); // fallback: use as given
      const content = fileChanges[filePath];
      console.log(`Writing changes to: ${targetPath}`);
      await writeFileContent(targetPath, content);
      if (!resolvedPath) {
        console.warn(`File path '${filePath}' did not match existing files. Created new file at: ${targetPath}`);
      }
    }
  }
  console.log('Code changes applied.');
}
