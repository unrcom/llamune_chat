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
    <div style={{ paddingLeft: `${depth * 16}px` }}>
      <div className="flex items-center gap-2 px-2 py-1 rounded cursor-pointer hover:bg-[#1a1a2e] transition-colors">
        <button
          className="text-xs text-[#888] bg-none border-none cursor-pointer w-4"
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? '▼' : '▶'}
        </button>
        <span
          className="text-sm text-[#ccc] flex-1 hover:text-white"
          onClick={() => onSelectDirectory(node.path)}
        >
          📁 {node.name}
        </span>
        <button
          className="px-2 py-0.5 text-xs bg-[#333] border border-[#444] text-white rounded hover:bg-[#444] transition-colors"
          onClick={() => onSelectDirectory(node.path)}
        >
          選択
        </button>
      </div>
      {expanded && node.children && (
        <div className="border-l border-[#333] ml-2 pl-2">
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
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[100]" onClick={onClose}>
      <div className="bg-[#16213e] rounded-xl p-6 w-full max-w-2xl shadow-xl" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-white font-semibold mb-4">📁 プロジェクトフォルダを選択</h3>
        {loading ? (
          <LoadingIndicator message="ディレクトリを読み込み中..." />
        ) : tree ? (
          <div className="max-h-[400px] overflow-y-auto bg-[#0f0f23] border border-[#333] rounded-md p-2 mb-4">
            <DirectoryNode
              node={tree}
              onSelectDirectory={(path) => { onSelect(path); onClose(); }}
              onNavigate={(path) => setCurrentPath(path)}
            />
          </div>
        ) : null}
        <div className="flex justify-end">
          <button onClick={onClose} className="px-4 py-2 bg-[#333] text-white rounded-md text-sm hover:bg-[#444] transition-colors">キャンセル</button>
        </div>
      </div>
    </div>
  );
}
