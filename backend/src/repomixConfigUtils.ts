import fs from 'fs/promises';
import path from 'path';

export interface RepomixConfigOptions {
  style?: 'xml' | 'markdown' | 'plain';
  output?: string;
  compress?: boolean;
  include?: string[];
  ignore?: string[];
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
  const configPath = path.join(repoPath, 'repomix.config.json');
  let config = { ...DEFAULT_REPOMIX_CONFIG, ...overrides };
  try {
    const existing = await fs.readFile(configPath, 'utf8');
    const parsed = JSON.parse(existing);
    config = { ...config, ...parsed, ...overrides };
  } catch {}
  await fs.writeFile(configPath, JSON.stringify(config, null, 2), 'utf8');
}
