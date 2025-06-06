import React, { useEffect, useState, useRef } from 'react';
import { FileTree } from './FileTree';
import CodeMirror from '@uiw/react-codemirror';
import { CODEMIRROR_LANGUAGES } from './codemirrorLanguages';
import { HiOutlineDocument, HiOutlineFolder, HiOutlineX, HiOutlinePlus } from 'react-icons/hi';
import { DEFAULT_REPOMIX_CONFIG, RepomixConfigOptions } from './repomixConfigSchema';
import { FolderPickerModal } from './FolderPickerModal';
import './global.css';
import Split from 'react-split';
import LogsPage from './LogsPage';

const PROVIDERS = [
  { value: 'openai', label: 'OpenAI Compatible' },
  { value: 'openrouter', label: 'OpenRouter' },
  { value: 'gemini', label: 'Gemini' }
];

const BACKEND_PORTS = [5174, 5175, 5176, 5177, 5178, 5179, 5180];

async function detectBackendUrl() {
  for (const port of BACKEND_PORTS) {
    try {
      const res = await fetch(`http://localhost:${port}/api/info`, { method: 'GET' });
      if (res.ok) {
        return `http://localhost:${port}`;
      }
    } catch {}
  }
  return null;
}

export default function App() {
  const [backendUrl, setBackendUrl] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [openTabs, setOpenTabs] = useState<string[]>([]);
  const [fileContent, setFileContent] = useState('');
  const [history, setHistory] = useState<any[]>([]);
  const [response, setResponse] = useState('');
  const [loading, setLoading] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  // AI panel state
  const [projectPath, setProjectPath] = useState('');
  const [appDir, setAppDir] = useState('');
  const [docsDir, setDocsDir] = useState('');
  const [model, setModel] = useState('deepseek-chat');
  const [provider, setProvider] = useState('openai');
  const [apiKey, setApiKey] = useState('');
  const [baseUrl, setBaseUrl] = useState('https://api.deepseek.com/v1');
  const [prompt, setPrompt] = useState('');
  // Repomix config state for UI
  const [repomixConfig, setRepomixConfig] = useState<RepomixConfigOptions>({ ...DEFAULT_REPOMIX_CONFIG });
  const [configErrors, setConfigErrors] = useState<string[]>([]);
  const [apiError, setApiError] = useState<string | null>(null);
  const [editorExtensions, setEditorExtensions] = useState<any[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<{ connected: boolean, port?: number, cwd?: string, env?: string } | null>(null);
  const [pickerOpen, setPickerOpen] = useState<null | 'project' | 'app' | 'docs'>(null);
  const [loadingFile, setLoadingFile] = useState(false);
  const [showLogs, setShowLogs] = useState(false);

  useEffect(() => {
    (async () => {
      for (const port of BACKEND_PORTS) {
        try {
          const res = await fetch(`http://localhost:${port}/api/info`, { method: 'GET' });
          if (res.ok) {
            const info = await res.json();
            setBackendUrl(`http://localhost:${port}`);
            setConnectionStatus({ connected: true, port: info.port, cwd: info.cwd, env: info.env });
            return;
          }
        } catch {}
      }
      setBackendUrl(null);
      setConnectionStatus({ connected: false });
    })();
  }, []);

  useEffect(() => {
    if (selectedFile && backendUrl && projectPath) {
      setLoadingFile(true);
      fetch(`${backendUrl}/api/file?path=${encodeURIComponent(selectedFile)}&rootDir=${encodeURIComponent(projectPath)}`)
        .then(res => res.json())
        .then(data => {
          setFileContent(data.content || '');
          setLoadingFile(false);
        });
      fetch(`${backendUrl}/api/history?path=${encodeURIComponent(selectedFile)}`)
        .then(res => res.json())
        .then(data => setHistory(data.history || []));
    }
  }, [selectedFile, backendUrl, projectPath]);

  useEffect(() => {
    if (!selectedFile || !backendUrl || !projectPath) return;
    setLoadingFile(true);
    fetch(`${backendUrl}/api/file?path=${encodeURIComponent(selectedFile)}&rootDir=${encodeURIComponent(projectPath)}`)
      .then(res => res.json())
      .then(data => {
        setFileContent(data.content ?? '');
        setLoadingFile(false);
      });
  }, [selectedFile, backendUrl, projectPath]);

  useEffect(() => {
    setConfigErrors(validateRepomixConfig(repomixConfig));
  }, [repomixConfig]);

  useEffect(() => {
    if (!selectedFile) return setEditorExtensions([]);
    const loader = getLanguageExtension(selectedFile);
    loader().then(ext => setEditorExtensions(Array.isArray(ext) ? ext : [ext]));
  }, [selectedFile]);

  // Tab logic
  const openFile = (file: string) => {
    setSelectedFile(null); // Force unmount/remount for CodeMirror
    setTimeout(() => {
      setSelectedFile(file);
      setOpenTabs(tabs => tabs.includes(file) ? tabs : [...tabs, file]);
    }, 10);
  };

  const closeTab = (file: string) => {
    setOpenTabs(tabs => tabs.filter(f => f !== file));
    if (selectedFile === file) {
      // Switch to another open tab if available
      setSelectedFile(openTabs.filter(f => f !== file)[0] || null);
    }
  };

  const handleSend = async () => {
    setLoading(true);
    setResponse('');
    setApiError(null);
    try {
      const res = await fetch(`${backendUrl}/api/orchestrate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectPath, appDir, docsDir, provider, apiKey, baseUrl, model, prompt, repomixConfig })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Unknown error');
      setResponse(data.message || data.error || 'No response');
    } catch (err: any) {
      setApiError(err.message);
    }
    setLoading(false);
  };

  const handleFileSave = async () => {
    if (!selectedFile) return;
    const res = await fetch(`${backendUrl}/api/file`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: selectedFile, content: fileContent })
    });
    if (res.ok) {
      // Saved!
    } else {
      // Error saving
    }
  };

  const fetchHistory = async () => {
    if (!selectedFile) return;
    setShowHistory(true);
    const res = await fetch(`${backendUrl}/api/history?path=${encodeURIComponent(selectedFile)}`);
    const data = await res.json();
    setHistory(data.history || []);
  };

  const handleRevert = async (timestamp: number) => {
    if (!selectedFile) return;
    await fetch(`${backendUrl}/api/history/revert`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: selectedFile, timestamp })
    });
    setShowHistory(false);
    openFile(selectedFile);
  };

  function getLanguageExtension(filename: string) {
    const ext = filename.split('.').pop()?.toLowerCase();
    const lang = CODEMIRROR_LANGUAGES.find(l => l.extension === ext);
    return lang ? lang.loader : () => Promise.resolve([]);
  }

  function validateRepomixConfig(config: RepomixConfigOptions) {
    const errors: string[] = [];
    if (config.include && !Array.isArray(config.include)) errors.push('Include must be a comma-separated list.');
    if (config.ignore && !Array.isArray(config.ignore)) errors.push('Ignore must be a comma-separated list.');
    // Add more validation as needed
    return errors;
  }

  const openPicker = (which: 'project' | 'app' | 'docs') => setPickerOpen(which);
  const closePicker = () => setPickerOpen(null);
  const handleSelect = (path: string) => {
    if (pickerOpen === 'project') setProjectPath(path);
    if (pickerOpen === 'app') setAppDir(path);
    if (pickerOpen === 'docs') setDocsDir(path);
    closePicker();
  };

  const Tooltip = ({ text }: { text: string }) => (
    <span className="tooltip" data-tip={text}>?</span>
  );

  const allDirsSet = !!projectPath && !!appDir && !!docsDir;

  return (
    <div className="min-h-screen bg-base-200 text-base-content font-sans">
      <Split className="flex h-screen" direction="horizontal" gutterSize={8} minSize={[200,200,200]} sizes={[20,60,20]}
             gutterAlign="center" snapOffset={30}>
        {/* Sidebar / Explorer */}
        <aside className="w-96 resize-x overflow-auto min-w-[200px] max-w-[600px] bg-base-300 border-r border-base-200 flex flex-col p-4 gap-2 shadow-xl min-h-[80vh]">
          <div className="text-xl font-bold mb-4 tracking-tight">Mini IDE</div>
          <div className="mb-2">
            <button className="btn btn-sm btn-primary w-full mb-1" onClick={() => backendUrl && connectionStatus?.connected && openPicker('project')} disabled={!backendUrl || !connectionStatus?.connected}>
              <span className="pr-2"><HiOutlineFolder /></span>Pick Project Folder
            </button>
            <button className="btn btn-sm btn-secondary w-full mb-1" onClick={() => backendUrl && connectionStatus?.connected && openPicker('app')} disabled={!backendUrl || !connectionStatus?.connected}>
              <span className="pr-2"><HiOutlineFolder /></span>Pick App Folder
            </button>
            <button className="btn btn-sm btn-accent w-full" onClick={() => backendUrl && connectionStatus?.connected && openPicker('docs')} disabled={!backendUrl || !connectionStatus?.connected}>
              <span className="pr-2"><HiOutlineFolder /></span>Pick Docs Folder
            </button>
          </div>
          <div className="flex-1 overflow-y-auto mt-4">
            <div className="card bg-base-100 shadow-xl p-4 min-h-[700px] max-h-[85vh] h-full flex flex-col">
              <div className="font-bold text-base mb-2 text-base-content/80">Project File Explorer</div>
              <div className="flex-1 overflow-y-auto">
                <FileTree
                  onSelect={openFile}
                  rootDir={projectPath}
                  backendUrl={backendUrl}
                />
              </div>
            </div>
          </div>
        </aside>
        {/* Main Content */}
        <main className="flex-1 flex flex-col items-center justify-center px-8 py-6">
          {selectedFile ? (
            <div className="w-full h-full flex flex-col items-center justify-center">
              <div className="w-full max-w-5xl h-[80vh] card bg-base-100 shadow-xl p-4 flex flex-col">
                <div className="tabs tabs-boxed mb-2 overflow-x-auto">
                  {openTabs.map(file => (
                    <button
                      key={file}
                      onClick={() => openFile(file)}
                      className={`tab ${selectedFile === file ? 'tab-active' : ''}`}>
                      <span className="truncate max-w-xs">{file}</span>
                      <HiOutlineX
                        className="ml-2 text-error"
                        onClick={e => { e.stopPropagation(); closeTab(file); }}
                      />
                    </button>
                  ))}
                </div>
                <div className="flex-1 min-h-0 relative">
                  {loadingFile && (
                    <div className="absolute inset-0 flex items-center justify-center bg-base-100 z-10">
                      <span className="loading loading-spinner loading-lg"></span>
                    </div>
                  )}
                  <CodeMirror
                    value={fileContent}
                    height="100%"
                    width="100%"
                    theme="dark"
                    extensions={editorExtensions}
                    onChange={v => setFileContent(v)}
                  />
                </div>
                <div className="flex justify-end mt-4">
                  <button className="btn btn-primary" onClick={handleFileSave} title="Save file (Ctrl+S)">Save</button>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center text-base-content/60">Please select your Project Root, App Directory, and Docs Directory using the folder pickers above. Files will appear once all three are selected.</div>
          )}
        </main>
        {/* AI Prompt Control Panel (right sidebar) */}
        <aside className="w-80 resize-x overflow-auto min-w-[200px] max-w-[600px] bg-base-300 border-l border-base-200 flex flex-col p-4 gap-2 shadow-xl">
          <div className="text-lg font-bold mb-4">AI Prompt Control Panel</div>
          <form className="flex flex-col gap-2">
            <label className="label" htmlFor="model">Model</label>
            <input id="model" className="input input-bordered w-full" value={model} onChange={e => setModel(e.target.value)} placeholder="deepseek-chat" />
            <label className="label" htmlFor="provider">Provider</label>
            <select id="provider" className="select select-bordered w-full" value={provider} onChange={e => setProvider(e.target.value)}>
              {PROVIDERS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
            <label className="label" htmlFor="api-key">API Key</label>
            <input id="api-key" className="input input-bordered w-full" value={apiKey} onChange={e => setApiKey(e.target.value)} placeholder="API Key..." />
            <label className="label" htmlFor="base-url">Base URL</label>
            <input id="base-url" className="input input-bordered w-full" value={baseUrl} onChange={e => setBaseUrl(e.target.value)} placeholder="https://api.deepseek.com/v1" />
            <label className="label" htmlFor="prompt">Prompt</label>
            <textarea id="prompt" className="textarea textarea-bordered w-full" value={prompt} onChange={e => setPrompt(e.target.value)} rows={3} placeholder="Enter your prompt..." />
            <button type="button" className="btn btn-primary mt-2 flex items-center justify-center" onClick={handleSend} disabled={loading} title="Send prompt (Ctrl+Enter)">
              {loading && <span className="loading loading-spinner loading-xs mr-2"></span>}
              Send Prompt
            </button>
            {apiError && <div className="text-error mt-1">{apiError}</div>}
            <div className="mt-2">
              <label className="label">Repomix Config</label>
              <div className="flex flex-col gap-1">
                <input className="input input-bordered w-full" value={repomixConfig.style ?? ''} onChange={e => setRepomixConfig({...repomixConfig, style: e.target.value as 'xml' | 'markdown' | 'plain'})} placeholder="Style (xml, markdown, plain)" />
                <input className="input input-bordered w-full" value={repomixConfig.include?.join(',') ?? ''} onChange={e => setRepomixConfig({...repomixConfig, include: e.target.value.split(',')})} placeholder="Include Patterns" />
                <input className="input input-bordered w-full" value={repomixConfig.ignore?.join(',') ?? ''} onChange={e => setRepomixConfig({...repomixConfig, ignore: e.target.value.split(',')})} placeholder="Ignore Patterns" />
                <label className="flex items-center gap-2"><input type="checkbox" checked={!!repomixConfig.compress} onChange={e => setRepomixConfig({...repomixConfig, compress: e.target.checked})} />Compressed?</label>
              </div>
              {configErrors.length > 0 && <div className="text-error mt-1">{configErrors.join(', ')}</div>}
            </div>
          </form>
        </aside>
        {/* Logs Button */}
        <button
          className="btn btn-neutral mt-4"
          style={{ position: 'absolute', bottom: 16, left: '50%', transform: 'translateX(-50%)' }}
          onClick={() => setShowLogs(true)}
        >
          Logs
        </button>
        {showLogs && (
          <div className="fixed inset-0 z-50 bg-black bg-opacity-60 flex items-center justify-center">
            <div className="bg-base-100 max-w-4xl w-full rounded-lg shadow-lg relative">
              <button className="btn btn-sm btn-circle absolute right-2 top-2" onClick={() => setShowLogs(false)}>✕</button>
              <LogsPage />
            </div>
          </div>
        )}
      </Split>
      {backendUrl && connectionStatus?.connected && (
        <FolderPickerModal
          backendUrl={backendUrl}
          isOpen={pickerOpen !== null}
          onClose={closePicker}
          onSelect={handleSelect}
        />
      )}
    </div>
  );
}
