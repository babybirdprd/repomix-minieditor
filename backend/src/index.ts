import express from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import path from 'path';
import fs from 'fs/promises';
import { exec } from 'child_process';
import { handlePrompt } from './promptHandler.js';
import { orchestrateCodeModification } from './orchestrator.js';

// Import utility modules to ensure type safety and integration
import './fileUtils.js';
import './xmlUtils.js';
import './repomixHandler.js';

const app = express();
const DEFAULT_PORT = 5174;
let PORT = DEFAULT_PORT;
const HISTORY_DIR = path.join(process.cwd(), '.ide-history');

app.use(cors());
app.use(bodyParser.json());

// --- Mini-IDE Endpoints ---

// 1. File Tree Endpoint
app.get('/api/files', async (req, res) => {
  try {
    const rootDir = req.query.rootDir ? String(req.query.rootDir) : process.cwd();
    async function walk(dir: string): Promise<any[]> {
      const dirents = await fs.readdir(dir, { withFileTypes: true });
      const files = await Promise.all(dirents.map(async (dirent) => {
        const resPath = path.resolve(dir, dirent.name);
        if (dirent.isDirectory()) {
          return { name: dirent.name, type: 'directory', children: await walk(resPath) };
        } else {
          return { name: dirent.name, type: 'file' };
        }
      }));
      return files;
    }
    const tree = await walk(rootDir);
    res.json(tree);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// 2. File Content Endpoint
app.get('/api/file', async (req, res) => {
  try {
    const filePath = req.query.path ? String(req.query.path) : '';
    const rootDir = req.query.rootDir ? String(req.query.rootDir) : process.cwd();
    if (!filePath) return res.status(400).json({ error: 'Missing file path' });
    // Resolve relative to rootDir
    const absPath = path.isAbsolute(filePath) ? filePath : path.join(rootDir, filePath);
    const content = await fs.readFile(absPath, 'utf8');
    res.json({ content });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// 2b. File Save Endpoint (with history)
app.post('/api/file', async (req, res) => {
  try {
    const { path: relPath, content } = req.body;
    if (!relPath) return res.status(400).json({ error: 'Missing file path' });
    const absPath = path.resolve(process.cwd(), relPath);
    // Save to file
    await fs.writeFile(absPath, content, 'utf8');
    // Save to history
    const historyFile = path.join(HISTORY_DIR, relPath.replace(/\\/g, '/').replace(/\//g, '__') + '.json');
    await fs.mkdir(path.dirname(historyFile), { recursive: true });
    let history: any[] = [];
    try {
      const prev = await fs.readFile(historyFile, 'utf8');
      history = JSON.parse(prev);
    } catch {}
    history.push({ timestamp: Date.now(), content });
    await fs.writeFile(historyFile, JSON.stringify(history, null, 2), 'utf8');
    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// 2c. File History List Endpoint
app.get('/api/history', async (req, res) => {
  try {
    const relPath = req.query.path ? String(req.query.path) : '';
    if (!relPath) return res.status(400).json({ error: 'Missing file path' });
    const historyFile = path.join(HISTORY_DIR, relPath.replace(/\\/g, '/').replace(/\//g, '__') + '.json');
    let history: any[] = [];
    try {
      const prev = await fs.readFile(historyFile, 'utf8');
      history = JSON.parse(prev);
    } catch {}
    res.json({ history });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// 2d. File History Restore Endpoint
app.post('/api/history/revert', async (req, res) => {
  try {
    const { path: relPath, timestamp } = req.body;
    if (!relPath || !timestamp) return res.status(400).json({ error: 'Missing file path or timestamp' });
    const historyFile = path.join(HISTORY_DIR, relPath.replace(/\\/g, '/').replace(/\//g, '__') + '.json');
    const absPath = path.resolve(process.cwd(), relPath);
    let history: any[] = [];
    try {
      const prev = await fs.readFile(historyFile, 'utf8');
      history = JSON.parse(prev);
    } catch {}
    const entry = history.find((h) => h.timestamp === timestamp);
    if (!entry) return res.status(404).json({ error: 'Version not found' });
    await fs.writeFile(absPath, entry.content, 'utf8');
    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// 3. Git Status Endpoint
app.get('/api/git/status', (req, res) => {
  exec('git status --porcelain', { cwd: process.cwd() }, (err, stdout, stderr) => {
    if (err) return res.status(500).json({ error: stderr || err.message });
    const status = stdout.split('\n').filter(Boolean).map(line => {
      // e.g. ' M file.txt' or 'A  file2.js'
      return { code: line.slice(0, 2), file: line.slice(3) };
    });
    res.json({ status });
  });
});

// 4. Git Commit Endpoint
app.post('/api/git/commit', (req, res) => {
  const { message } = req.body;
  if (!message) return res.status(400).json({ error: 'Missing commit message' });
  exec('git add .', { cwd: process.cwd() }, (err) => {
    if (err) return res.status(500).json({ error: 'Failed to stage changes' });
    exec(`git commit -m "${message.replace(/"/g, '\"')}"`, { cwd: process.cwd() }, (err2, stdout, stderr2) => {
      if (err2) return res.status(500).json({ error: stderr2 || err2.message });
      res.json({ message: 'Committed', stdout });
    });
  });
});

// --- Directory browser endpoint ---
app.get('/api/browse', async (req, res) => {
  try {
    const root = req.query.root ? String(req.query.root) : process.cwd();
    const relPath = req.query.path ? String(req.query.path) : '';
    const absPath = path.isAbsolute(relPath) ? relPath : path.join(root, relPath);
    const entries = await fs.readdir(absPath, { withFileTypes: true });
    // DEBUG LOGGING
    console.log('Browsing:', absPath, 'Entries:', entries.map(e => e.name));
    // Show ALL directories (no filtering)
    const dirs = entries.filter(e => e.isDirectory()).map(e => e.name);
    const files = entries.filter(e => e.isFile()).map(e => e.name);
    res.json({ path: absPath, dirs, files });
  } catch (e) {
    console.error('Browse error:', e);
    res.status(500).json({ error: e instanceof Error ? e.message : String(e) });
  }
});

// --- Health/Info endpoint for port discovery and cwd info ---
app.get('/api/info', (req, res) => {
  res.json({ port: PORT, status: 'ok', cwd: process.cwd(), env: process.env.NODE_ENV || null });
});

// --- Existing endpoints ---

app.post('/api/prompt', handlePrompt);

app.post('/api/orchestrate', async (req, res) => {
  try {
    const { projectPath, appDir, docsDir, apiKey, baseUrl, prompt, model, repomixConfig } = req.body;
    if (!projectPath || !appDir || !docsDir || !apiKey || !prompt) {
      return res.status(400).json({ error: 'Missing required fields.' });
    }
    // Resolve absolute paths (Windows-safe)
    const root = process.cwd();
    const absProjectRoot = path.resolve(root, projectPath.replace(/^@/, ''));
    // Resolve appDir and docsDir relative to the resolved project root
    const repoPath = path.resolve(absProjectRoot, appDir);
    const docsPath = path.resolve(absProjectRoot, docsDir);
    // Pass repomixConfig to orchestrator, but default to undefined if not provided
    const result = await orchestrateCodeModification({
      repoPath,
      docsPath,
      userTask: prompt,
      apiKey,
      baseUrl,
      model,
      repomixConfig // may be undefined, orchestrator will handle defaults
    });
    res.json(result);
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Error running orchestration.' });
  }
});

function startServer(port: number) {
  const server = app.listen(port, () => {
    console.log(`Backend listening on http://localhost:${port}`);
  });
  server.on('error', (err: NodeJS.ErrnoException) => {
    if (err.code === 'EADDRINUSE') {
      console.warn(`Port ${port} is already in use. Trying next port...`);
      startServer(port + 1);
    } else {
      throw err;
    }
  });
}

startServer(PORT);
