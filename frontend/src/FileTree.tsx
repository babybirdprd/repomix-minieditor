import React, { useEffect, useState } from 'react';
import { HiOutlineFolder, HiOutlineDocument } from 'react-icons/hi';

export interface FileNode {
  name: string;
  type: 'file' | 'directory';
  children?: FileNode[];
  path?: string;
}

interface FileTreeProps {
  onSelect: (path: string) => void;
  rootDir?: string;
  backendUrl?: string | null;
}

function buildPaths(nodes: FileNode[], parent: string = ''): FileNode[] {
  return nodes.map(n => {
    const path = parent ? `${parent}/${n.name}` : n.name;
    return {
      ...n,
      path,
      children: n.children ? buildPaths(n.children, path) : undefined
    };
  });
}

export const FileTree: React.FC<FileTreeProps> = ({ onSelect, rootDir, backendUrl }) => {
  const [tree, setTree] = useState<FileNode[]>([]);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!backendUrl) return;
    fetch(`${backendUrl}/api/files${rootDir ? `?rootDir=${encodeURIComponent(rootDir)}` : ''}`)
      .then(res => res.json())
      .then(data => setTree(buildPaths(data)));
  }, [rootDir, backendUrl]);

  const toggle = (path: string) => {
    setExpanded(e => ({ ...e, [path]: !e[path] }));
  };

  const renderTree = (nodes: FileNode[], parent: string = '', level: number = 0) => (
    <ul className="menu bg-base-200 rounded-box">
      {nodes.map(node => (
        <li key={node.path}>
          {node.type === 'directory' ? (
            <>
              <button className="btn btn-ghost btn-sm flex gap-2 items-center" onClick={() => node.path && toggle(node.path)}>
                <HiOutlineFolder />
                <span className="text-xs">{node.path && expanded[node.path] ? '▼' : '▶'}</span>
                <span>{node.name}</span>
              </button>
              {node.path && expanded[node.path] && node.children && renderTree(node.children, node.path, level + 1)}
            </>
          ) : (
            <button className="btn btn-ghost btn-xs flex gap-2 items-center" onClick={() => node.path && onSelect(node.path)}>
              <HiOutlineDocument /> <span>{node.name}</span>
            </button>
          )}
        </li>
      ))}
    </ul>
  );

  return (
    <div className="p-2">
      {renderTree(tree)}
    </div>
  );
};
