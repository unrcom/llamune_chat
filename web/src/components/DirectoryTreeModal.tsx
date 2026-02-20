import { useState, useEffect } from 'react';
import * as api from '../api/client';
import { LoadingIndicator } from './LoadingIndicator';

function DirectoryNode({
  node,
  onSelectDirectory,
  onNavigate,
  depth = 0,
}: {
  node: api.DirectoryNode;
  onSelectDirectory: (path: string) => void;
  onNavigate: (path: string) => void;
  depth?: number;
}) {
  const [expanded, setExpanded] = useState(depth === 0);

  if (!node.isDirectory) return null;

  return (
    <div className="dir-node" style={{ paddingLeft: `${depth * 16}px` }}>
      <div className="dir-item">
        <button
          className="dir-expand"
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? '▼' : '▶'}
        </button>
        <span className="dir-name" onClick={() => onSelectDirectory(node.path)}>
          📁 {node.name}
        </span>
        <button
          className="dir-select-btn"
          onClick={() => onSelectDirectory(node.path)}
        >
          選択
        </button>
      </div>
      {expanded && node.children && (
        <div className="dir-children">
          {node.children
            .filter((child) => child.isDirectory)
            .map((child) => (
              <DirectoryNode
                key={child.path}
                node={child}
                onSelectDirectory={onSelectDirectory}
                onNavigate={onNavigate}
                depth={depth + 1}
              />
            ))}
        </div>
      )}
    </div>
  );
}

export function DirectoryTreeModal({
  isOpen,
  onClose,
  onSelect,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (path: string) => void;
}) {
  const [tree, setTree] = useState<api.DirectoryNode | null>(null);
  const [loading, setLoading] = useState(false);
  const [currentPath, setCurrentPath] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (isOpen) {
      loadTree(currentPath);
    }
  }, [isOpen, currentPath]);

  const loadTree = async (path?: string) => {
    setLoading(true);
    try {
      const data = await api.getDirectoryTree(path);
      setTree(data);
    } catch (err) {
      console.error('Failed to load directory tree:', err);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal directory-modal" onClick={(e) => e.stopPropagation()}>
        <h3>📁 プロジェクトフォルダを選択</h3>
        {loading ? (
          <LoadingIndicator message="ディレクトリを読み込み中..." />
        ) : tree ? (
          <div className="directory-tree">
            <DirectoryNode
              node={tree}
              onSelectDirectory={(path) => {
                onSelect(path);
                onClose();
              }}
              onNavigate={(path) => setCurrentPath(path)}
            />
          </div>
        ) : null}
        <div className="modal-actions">
          <button onClick={onClose}>キャンセル</button>
        </div>
      </div>
    </div>
  );
}
