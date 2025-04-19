import React, { useEffect, useState } from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';

interface LogEntry {
  level: string;
  time: string;
  msg: string;
  prompt?: string;
  response?: string;
  [key: string]: any;
}

function parseLogLine(line: string): LogEntry | null {
  try {
    const obj = JSON.parse(line);
    return {
      ...obj,
      time: obj.time ? new Date(obj.time).toLocaleString() : '',
      level: obj.level === 30 ? 'info' : obj.level === 40 ? 'warn' : obj.level === 50 ? 'error' : String(obj.level),
    };
  } catch {
    // fallback for plain text or malformed
    return null;
  }
}

const levelColor: Record<string, string> = {
  info: 'text-info',
  warn: 'text-warning',
  error: 'text-error',
};

function detectLang(content?: string) {
  if (!content) return 'text';
  if (/^\s*\{[\s\S]*\}$/.test(content.trim())) return 'json';
  if (/^\s*<\/?[\w\-]+/.test(content.trim())) return 'xml';
  return 'text';
}

// Utility to strip ANSI escape codes
function stripAnsi(str: string = ''): string {
  return str.replace(/\u001b\[[0-9;]*m|\u001b\][0-9;]*;?|\u001b\(B|\u001b\[\?25[hl]|\u001b\[K|\u001b\[1A|\u001b\[2K|\u001b\[G/g, '');
}

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      className="btn btn-xs btn-outline ml-2"
      onClick={e => {
        e.stopPropagation();
        navigator.clipboard.writeText(value);
        setCopied(true);
        setTimeout(() => setCopied(false), 1200);
      }}
      title="Copy to clipboard"
    >
      {copied ? 'Copied!' : 'Copy'}
    </button>
  );
}

export default function LogsPage() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [filter, setFilter] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});

  const fetchLogs = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/logs/ai');
      if (!res.ok) throw new Error('Failed to fetch logs');
      const text = await res.text();
      const lines = text.split('\n').filter(Boolean);
      setLogs(lines.map(parseLogLine).filter(Boolean) as LogEntry[]);
    } catch (e: any) {
      setError(e.message);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const handleClear = async () => {
    setLoading(true);
    await fetch('/api/logs/ai', { method: 'DELETE' });
    await fetchLogs();
    setLoading(false);
  };

  const filteredLogs = logs.filter(l =>
    (!filter || l.msg.toLowerCase().includes(filter.toLowerCase()) || l.level.toLowerCase().includes(filter.toLowerCase()))
  );

  const toggleExpand = (idx: number) => setExpanded(e => ({ ...e, [idx]: !e[idx] }));

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-bold">AI Logs</h2>
        <button className="btn btn-error btn-sm" onClick={handleClear} disabled={loading}>Clear Logs</button>
      </div>
      <input
        className="input input-bordered w-full mb-4"
        placeholder="Search logs by message or level..."
        value={filter}
        onChange={e => setFilter(e.target.value)}
      />
      {error && <div className="text-error mb-2">{error}</div>}
      <div className="bg-base-200 rounded-lg p-2 overflow-auto h-[60vh] font-mono text-sm">
        {loading ? (
          <div className="text-center text-base-content/60">Loading...</div>
        ) : filteredLogs.length === 0 ? (
          <div className="text-center text-base-content/60">No logs found.</div>
        ) : (
          filteredLogs.map((log, i) => {
            const hasDetails = log.prompt || log.response;
            const cleanPrompt = stripAnsi(log.prompt);
            const cleanResponse = stripAnsi(log.response);
            return (
              <div key={i} className={`py-1 border-b border-base-300 ${levelColor[log.level] || ''}`}
                style={{ cursor: hasDetails ? 'pointer' : 'default', userSelect: 'text' }}
                onClick={() => hasDetails && toggleExpand(i)}
              >
                <span className="mr-2 opacity-60">[{log.time}]</span>
                <span className="font-bold uppercase mr-2">{log.level}</span>
                <span>{log.msg}</span>
                {log.event && <span className="ml-2 opacity-60">({log.event})</span>}
                {hasDetails && (
                  <span className="ml-2 badge badge-outline badge-info align-middle">{expanded[i] ? 'Hide' : 'Show'} details</span>
                )}
                {expanded[i] && (
                  <div className="mt-2 p-2 bg-base-100 rounded border border-base-300">
                    {log.prompt && (
                      <div className="mb-2">
                        <div className="font-bold mb-1 flex items-center">Prompt:
                          <span className="badge badge-xs badge-outline ml-2">{detectLang(cleanPrompt)}</span>
                          <CopyButton value={cleanPrompt} />
                        </div>
                        <div className="max-h-60 overflow-auto rounded">
                          <SyntaxHighlighter language={detectLang(cleanPrompt)} style={oneDark} customStyle={{ background: 'transparent', fontSize: 13 }}>
                            {cleanPrompt}
                          </SyntaxHighlighter>
                        </div>
                      </div>
                    )}
                    {log.response && (
                      <div>
                        <div className="font-bold mb-1 flex items-center">Response:
                          <span className="badge badge-xs badge-outline ml-2">{detectLang(cleanResponse)}</span>
                          <CopyButton value={cleanResponse} />
                        </div>
                        <div className="max-h-60 overflow-auto rounded">
                          <SyntaxHighlighter language={detectLang(cleanResponse)} style={oneDark} customStyle={{ background: 'transparent', fontSize: 13 }}>
                            {cleanResponse}
                          </SyntaxHighlighter>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
