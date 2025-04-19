// List of supported CodeMirror language extensions and their import paths
// Add or remove as needed based on @codemirror/lang-* support
// Dockerfile: use legacy mode integration for CodeMirror 6
import { StreamLanguage } from '@codemirror/language';

export const CODEMIRROR_LANGUAGES = [
  { name: 'JavaScript', extension: 'js', loader: () => import('@codemirror/lang-javascript').then(m => m.javascript()) },
  { name: 'TypeScript', extension: 'ts', loader: () => import('@codemirror/lang-javascript').then(m => m.javascript({ typescript: true })) },
  { name: 'Python', extension: 'py', loader: () => import('@codemirror/lang-python').then(m => m.python()) },
  { name: 'Markdown', extension: 'md', loader: () => import('@codemirror/lang-markdown').then(m => m.markdown()) },
  { name: 'HTML', extension: 'html', loader: () => import('@codemirror/lang-html').then(m => m.html()) },
  { name: 'CSS', extension: 'css', loader: () => import('@codemirror/lang-css').then(m => m.css()) },
  { name: 'JSON', extension: 'json', loader: () => import('@codemirror/lang-json').then(m => m.json()) },
  { name: 'C++', extension: 'cpp', loader: () => import('@codemirror/lang-cpp').then(m => m.cpp()) },
  { name: 'C', extension: 'c', loader: () => import('@codemirror/lang-cpp').then(m => m.cpp()) },
  { name: 'Java', extension: 'java', loader: () => import('@codemirror/lang-java').then(m => m.java()) },
  { name: 'Rust', extension: 'rs', loader: () => import('@codemirror/lang-rust').then(m => m.rust()) },
  { name: 'PHP', extension: 'php', loader: () => import('@codemirror/lang-php').then(m => m.php()) },
  { name: 'XML', extension: 'xml', loader: () => import('@codemirror/lang-xml').then(m => m.xml()) },
  { name: 'Go', extension: 'go', loader: () => import('@codemirror/lang-go').then(m => m.go()) },
  { name: 'SQL', extension: 'sql', loader: () => import('@codemirror/lang-sql').then(m => m.sql()) },
  { name: 'YAML', extension: 'yaml', loader: () => import('@codemirror/lang-yaml').then(m => m.yaml()) },
  { name: 'Dockerfile', extension: 'dockerfile', loader: () => import('@codemirror/legacy-modes/mode/dockerfile').then(m => [StreamLanguage.define(m.dockerFile)]) }
];
