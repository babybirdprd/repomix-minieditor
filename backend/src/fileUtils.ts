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
  console.log('Applying code changes...');
  for (const filePath in fileChanges) {
    if (Object.hasOwnProperty.call(fileChanges, filePath)) {
      const fullPath = path.join(repoPath, filePath);
      const content = fileChanges[filePath];
      console.log(`Writing changes to: ${fullPath}`);
      await writeFileContent(fullPath, content);
    }
  }
  console.log('Code changes applied.');
}
