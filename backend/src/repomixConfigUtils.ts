import fs from 'fs/promises';
import path from 'path';

export interface RepomixConfigOptions {
  style?: 'xml' | 'markdown' | 'plain';
  output?: string | { path: string };
  compress?: boolean;
  include?: string[];
  ignore?: string[] | { patterns: string[] };
  outputShowLineNumbers?: boolean;
  noFileSummary?: boolean;
  noDirectoryStructure?: boolean;
  [key: string]: any;
}

export const DEFAULT_REPOMIX_CONFIG: RepomixConfigOptions = {
  style: 'xml',
  output: 'temp/repomix.xml',
  compress: false,
  include: ['src/**/*.js'],
  ignore: ['node_modules', 'temp'],
  outputShowLineNumbers: false,
  noFileSummary: false,
  noDirectoryStructure: false,
};

/**
 * Creates or updates a repomix.config.json file in the given repo root.
 * Merges DEFAULT_REPOMIX_CONFIG with any overrides provided.
 */
export async function ensureRepomixConfig(
  repoPath: string,
  overrides: Partial<RepomixConfigOptions> = {}
): Promise<void> {
  // Use path.join assuming repoPath is already absolute
  const configPath = path.join(repoPath, 'repomix.config.json');
  let config = { ...DEFAULT_REPOMIX_CONFIG, ...overrides };
  try {
    const existing = await fs.readFile(configPath, 'utf8');
    const parsed = JSON.parse(existing);
    config = { ...config, ...parsed, ...overrides };
  } catch {}

  // Ensure output is an object { path: string }
  if (typeof config.output === 'string') {
    config.output = { path: config.output };
  } else if (config.output && typeof config.output === 'object' && !config.output.path) {
    // Handle potential existing object structure without 'path'
    // This case might need adjustment based on actual expected object structure
    console.warn('Repomix config: output object structure might be incorrect.');
  }

  // Ensure ignore is an object { patterns: string[] }
  if (Array.isArray(config.ignore)) {
    config.ignore = { patterns: config.ignore };
  } else if (config.ignore && typeof config.ignore === 'object' && !config.ignore.patterns) {
    // Handle potential existing object structure without 'patterns'
    console.warn('Repomix config: ignore object structure might be incorrect.');
  }

  // Patch: If repoPath contains a 'src' directory, and include patterns are relative to 'src',
  // but config is being generated inside 'src', fix include patterns to match files correctly.
  // This ensures '*.js' matches files in the current directory and subdirectories.
  if (repoPath.match(/\\src$/i) && Array.isArray(config.include)) {
    config.include = config.include.map((pattern: string) => {
      // Replace leading 'src/' or './src/' with '' if present
      return pattern.replace(/^src\//, '').replace(/^\.\/src\//, '');
    });
    // If after replacement it's empty, default to ['**/*.js']
    if (config.include.length === 0) {
      config.include = ['**/*.js'];
    }
  }

  await fs.writeFile(configPath, JSON.stringify(config, null, 2), 'utf8');
}
