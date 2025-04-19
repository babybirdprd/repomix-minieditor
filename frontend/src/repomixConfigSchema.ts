// Repomix config schema/types for frontend use
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
