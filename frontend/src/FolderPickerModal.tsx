import React, { useEffect, useState } from 'react';
import { HiOutlineFolder, HiChevronRight, HiChevronUp } from 'react-icons/hi';

interface FolderPickerModalProps {
  backendUrl: string;
  root?: string;
  initialPath?: string;
  isOpen: boolean;
  onClose: () => void;
  onSelect: (path: string) => void;
}

export const FolderPickerModal: React.FC<FolderPickerModalProps> = ({
  backendUrl,
  root,
  initialPath = '',
  isOpen,
  onClose,
  onSelect,
}) => {
  const [currentPath, setCurrentPath] = useState<string>(initialPath);
  const [dirs, setDirs] = useState<string[]>([]);
  const [files, setFiles] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    setError(null);
    fetch(`${backendUrl}/api/browse?${root ? `root=${encodeURIComponent(root)}&` : ''}path=${encodeURIComponent(currentPath)}`)
      .then(res => res.json())
      .then(data => {
        setDirs(data.dirs || []);
        setFiles(data.files || []);
        setCurrentPath(data.path || currentPath);
        setLoading(false);
      })
      .catch(e => {
        setError(e.message);
        setLoading(false);
      });
  }, [backendUrl, root, currentPath, isOpen]);

  if (!isOpen) return null;

  // Helper for going up one directory
  function goUp() {
    if (!currentPath) return;
    const split = currentPath.replace(/\\/g, '/').split('/');
    if (split.length > 1) {
      setCurrentPath(split.slice(0, -1).join('/'));
    } else {
      setCurrentPath('');
    }
  }

  return (
    <div style={{ position: 'fixed', zIndex: 1000, top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(30,30,30,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: '#23272e', padding: 32, borderRadius: 10, minWidth: 440, minHeight: 360, color: '#fff', boxShadow: '0 4px 32px #000a', fontFamily: 'Segoe UI, sans-serif' }}>
        <div style={{ fontWeight: 700, fontSize: 22, marginBottom: 8 }}>Pick a Folder</div>
        <div style={{ fontSize: 14, color: '#aaa', marginBottom: 18, wordBreak: 'break-all' }}>Current: {currentPath}</div>
        {error && <div style={{ color: '#ff6a6a', marginBottom: 8 }}>{error}</div>}
        {loading ? (
          <div>Loading...</div>
        ) : (
          <>
            <div style={{ marginBottom: 8 }}>
              <button style={{ display: 'flex', alignItems: 'center', gap: 4, border: 'none', background: 'none', color: '#6af', fontSize: 15, cursor: 'pointer', marginBottom: 6, opacity: currentPath ? 1 : 0.5 }} disabled={!currentPath} onClick={goUp}>
                <HiChevronUp /> Up
              </button>
            </div>
            <div style={{ maxHeight: 210, overflowY: 'auto', background: '#20232a', borderRadius: 6, padding: '8px 0', marginBottom: 20 }}>
              {dirs.length === 0 && <div style={{ color: '#888', padding: '8px 16px' }}>No subfolders</div>}
              {dirs.map(dir => (
                <button
                  key={dir}
                  style={{
                    display: 'flex', alignItems: 'center', width: '100%', background: 'none', border: 'none', color: '#fff', fontSize: 16, padding: '8px 16px', textAlign: 'left', cursor: 'pointer', borderRadius: 4, marginBottom: 2, transition: 'background 0.15s',
                  }}
                  onClick={() => setCurrentPath(currentPath ? `${currentPath.replace(/[\\/]$/, '')}/${dir}` : dir)}
                  onMouseOver={e => (e.currentTarget.style.background = '#2a2d36')}
                  onMouseOut={e => (e.currentTarget.style.background = 'none')}
                >
                  <HiOutlineFolder style={{ marginRight: 8, color: '#6af', fontSize: 18 }} />
                  {dir}
                  <HiChevronRight style={{ marginLeft: 'auto', color: '#888', fontSize: 18 }} />
                </button>
              ))}
            </div>
            <div style={{ marginTop: 8, display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button className="vscode-btn" style={{ minWidth: 90 }} onClick={onClose}>Cancel</button>
              <button className="vscode-btn" style={{ background: '#3794ff', color: '#fff', minWidth: 140, fontWeight: 600 }} onClick={() => { onSelect(currentPath); onClose(); }}>Select This Folder</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
