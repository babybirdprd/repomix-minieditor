// Handler for running repomix CLI commands
import { exec } from 'child_process';
import util from 'util';
import path from 'path';
import { ensureRepomixConfig, RepomixConfigOptions } from './repomixConfigUtils.js';
const execPromise = util.promisify(exec);

/**
 * Executes a Repomix command using PowerShell.
 * @param command - The Repomix command and arguments.
 * @param cwd - The current working directory to run the command from (usually the repository root).
 * @returns The standard output of the command.
 * @throws If the command fails.
 */
export async function runRepomixCommand(command: string, cwd: string): Promise<string> {
  console.log(`Executing Repomix command: repomix ${command} in ${cwd}`);
  try {
    // Use PowerShell explicitly
    const { stdout, stderr } = await execPromise(`powershell -Command \"repomix ${command}\"`, { cwd });
    if (stderr) {
      console.error(`Repomix stderr: ${stderr}`);
      // Optionally throw on stderr
    }
    console.log('Repomix command executed successfully.');
    return stdout;
  } catch (error: any) {
    console.error(`Error executing Repomix command: ${error}`);
    throw new Error(`Failed to execute Repomix command: ${error.message}`);
  }
}

/**
 * Generates the initial compressed codebase context using Repomix.
 * @param repoPath - The path to the local repository.
 * @param outputPath - The file path to save the compressed output.
 * @param configOverrides - Optional config overrides for more flexible config-driven orchestration.
 * @returns The path to the generated output file.
 */
export async function generateCompressedCodebaseContext(repoPath: string, outputPath: string, configOverrides: Partial<RepomixConfigOptions> = {}): Promise<string> {
  // Ensure config exists and merge overrides
  await ensureRepomixConfig(repoPath, { ...configOverrides, output: outputPath, compress: true });
  const configPath = path.join(repoPath, 'repomix.config.json');
  const command = `-c "${configPath}" -o "${outputPath}" --compress`;
  await runRepomixCommand(command, repoPath);
  return outputPath;
}

/**
 * Generates uncompressed content for specific files using Repomix.
 * @param repoPath - The path to the local repository.
 * @param filePaths - An array of specific file paths to include.
 * @param outputPath - The file path to save the uncompressed output.
 * @param configOverrides - Optional config overrides for more flexible config-driven orchestration.
 * @returns The path to the generated output file.
 */
export async function generateTargetedUncompressedContext(repoPath: string, filePaths: string[], outputPath: string, configOverrides: Partial<RepomixConfigOptions> = {}): Promise<string> {
  if (!filePaths || filePaths.length === 0) {
    throw new Error('No file paths provided for targeted context generation.');
  }
  await ensureRepomixConfig(repoPath, { ...configOverrides, output: outputPath, include: filePaths, compress: false });
  const includePatterns = filePaths.join(',');
  const configPath = path.join(repoPath, 'repomix.config.json');
  const command = `-c "${configPath}" -o "${outputPath}" --include "${includePatterns}"`;
  await runRepomixCommand(command, repoPath);
  return outputPath;
}
