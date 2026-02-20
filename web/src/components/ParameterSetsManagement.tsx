/**
 * パラメータセット管理コンポーネント
 */

import { useState, useEffect, useRef } from 'react';
import { getPsetsTemplates, disablePsetsTemplate, updatePsetsTemplate, updatePsetsTemplateSortOrder, getModels } from '../api/client';
import type { PsetsTemplate, Model } from '../types';
import { ParameterSetForm } from './ParameterSetForm';


export function ParameterSetsManagement({ onNavigateToChat }: { onNavigateToChat: () => void }) {
  const [templates, setTemplates] = useState<PsetsTemplate[]>([]);
  const [models, setModels] = useState<Model[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<PsetsTemplate | null>(null);
  const [isCopy, setIsCopy] = useState(false);
  // ダイアログ確認用: { id, action: 'disable' | 'enable' }
  const [confirmDialog, setConfirmDialog] = useState<{ id: number; action: 'disable' | 'enable'; name: string } | null>(null);

  // ドラッグ＆ドロップ用
  const dragItem = useRef<number | null>(null);
  const dragOverItem = useRef<number | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      setLoading(true);
      setError(null);
      const [tmpl, mdls] = await Promise.all([getPsetsTemplates(false), getModels()]);
      setTemplates(tmpl);
      setModels(mdls);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }

  function handleCreate() {
    setEditingTemplate(null);
    setIsCopy(false);
    setShowForm(true);
  }

  function handleEdit(template: PsetsTemplate) {
    setEditingTemplate(template);
    setIsCopy(false);
    setShowForm(true);
  }

  function handleCopy(template: PsetsTemplate) {
    setEditingTemplate(template);
    setIsCopy(true);
    setShowForm(true);
  }

  function handleCloseForm() {
    setShowForm(false);
    setEditingTemplate(null);
    setIsCopy(false);
  }

  async function handleFormSuccess() {
    setShowForm(false);
    setEditingTemplate(null);
    setIsCopy(false);
    await loadData();
  }

  async function handleToggleEnabled() {
    if (!confirmDialog) return;
    try {
      setError(null);
      if (confirmDialog.action === 'disable') {
        await disablePsetsTemplate(confirmDialog.id);
      } else {
        await updatePsetsTemplate(confirmDialog.id, { enabled: 1 });
      }
      await loadData();
      setConfirmDialog(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update template');
      setConfirmDialog(null);
    }
  }

  // ドラッグ＆ドロップ
  function handleDragStart(index: number) {
    dragItem.current = index;
  }

  function handleDragEnter(index: number) {
    dragOverItem.current = index;
  }

  async function handleDragEnd() {
    if (dragItem.current === null || dragOverItem.current === null) return;
    if (dragItem.current === dragOverItem.current) return;

    const newTemplates = [...templates];
    const draggedItem = newTemplates.splice(dragItem.current, 1)[0];
    newTemplates.splice(dragOverItem.current, 0, draggedItem);

    // sort_orderを再計算
    const orders = newTemplates.map((t, index) => ({
      id: t.id,
      sort_order: (index + 1) * 10,
    }));

    setTemplates(newTemplates.map((t, index) => ({ ...t, sort_order: (index + 1) * 10 })));
    dragItem.current = null;
    dragOverItem.current = null;

    try {
      await updatePsetsTemplateSortOrder(orders);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update sort order');
      await loadData(); // 失敗したら再読み込み
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-[#1a1a2e] text-[#888]">
        <div className="w-10 h-10 border-4 border-[#333] border-t-[#4a9eff] rounded-full animate-spin mb-4"></div>
        <p>読み込み中...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#1a1a2e] text-white p-6">
      {/* ヘッダー */}
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-4">
          <button onClick={onNavigateToChat} className="px-3 py-2 bg-[#16213e] border border-[#333] text-[#ccc] rounded-md text-sm hover:bg-[#1a1a2e] hover:text-white transition-colors">
            ← チャットに戻る
          </button>
          <h2 className="text-2xl font-semibold text-white m-0">パラメータセット管理</h2>
        </div>
        <button onClick={handleCreate} className="px-4 py-2 bg-[#4a9eff] text-white rounded-md text-sm hover:bg-[#3a8eef] transition-colors">
          新しいテンプレートを作成
        </button>
      </div>

      {error && <div className="bg-[#ff4444]/20 border border-[#ff4444] text-[#ff6666] px-3 py-2 rounded-md mb-4 text-sm">{error}</div>}

      {/* テーブル */}
      <div className="bg-[#16213e] rounded-xl border border-[#333] overflow-hidden">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-[#0f0f23] text-[#888] text-sm">
              <th className="px-3 py-3 text-left w-8"></th>
              <th className="px-3 py-3 text-left">アイコン</th>
              <th className="px-3 py-3 text-left">名前</th>
              <th className="px-3 py-3 text-left">モデル</th>
              <th className="px-3 py-3 text-center">公開</th>
              <th className="px-3 py-3 text-center">有効</th>
              <th className="px-3 py-3 text-center">バージョン</th>
              <th className="px-3 py-3 text-left">操作</th>
            </tr>
          </thead>
          <tbody>
            {templates.map((template, index) => (
              <tr
                key={template.id}
                draggable
                onDragStart={() => handleDragStart(index)}
                onDragEnter={() => handleDragEnter(index)}
                onDragEnd={handleDragEnd}
                onDragOver={(e) => e.preventDefault()}
                className={`border-t border-[#333] transition-colors hover:bg-[#1a1a2e] ${!template.enabled ? 'opacity-50' : ''}`}
              >
                <td className="px-3 py-3 text-[#555] cursor-grab text-lg">⠿</td>
                <td className="px-3 py-3 text-xl">{template.icon || '🤖'}</td>
                <td className="px-3 py-3 text-sm text-white">{template.psets_name}</td>
                <td className="px-3 py-3 text-sm text-[#888]">{template.model || '-'}</td>
                <td className="px-3 py-3 text-center text-sm text-[#888]">{template.visibility === 'public' ? '公開' : '非公開'}</td>
                <td className="px-3 py-3 text-center">{template.enabled ? <span className="text-green-400">✓</span> : <span className="text-[#555]">✗</span>}</td>
                <td className="px-3 py-3 text-center text-sm text-[#888]">v{template.version}</td>
                <td className="px-3 py-3">
                  <div className="flex gap-2">
                    <button onClick={() => handleEdit(template)} className="px-3 py-1 bg-[#333] text-white rounded text-xs hover:bg-[#444] transition-colors">編集</button>
                    <button onClick={() => handleCopy(template)} className="px-3 py-1 bg-[#333] text-white rounded text-xs hover:bg-[#444] transition-colors">コピー</button>
                    <button
                      onClick={() => setConfirmDialog({ id: template.id, action: template.enabled ? 'disable' : 'enable', name: template.psets_name })}
                      className={`px-3 py-1 rounded text-xs transition-colors ${template.enabled ? 'bg-[#dc3545] text-white hover:bg-[#c82333]' : 'bg-[#333] text-[#888] hover:bg-[#444]'}`}
                    >
                      {template.enabled ? '無効化' : '有効化'}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {templates.length === 0 && (
          <div className="text-center py-12 text-[#888]">
            <p>テンプレートがありません</p>
          </div>
        )}
      </div>

      {showForm && (
        <ParameterSetForm
          template={editingTemplate}
          isCopy={isCopy}
          models={models}
          onClose={handleCloseForm}
          onSuccess={handleFormSuccess}
        />
      )}

      {/* 有効/無効確認ダイアログ */}
      {confirmDialog && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[100]" onClick={() => setConfirmDialog(null)}>
          <div className="bg-[#16213e] rounded-xl p-6 w-full max-w-sm shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-white font-semibold mb-3">
              {confirmDialog.action === 'disable' ? '🚫 無効化の確認' : '✅ 有効化の確認'}
            </h3>
            <p className="text-[#ccc] text-sm mb-6">
              「{confirmDialog.name}」を{confirmDialog.action === 'disable' ? '無効化' : '有効化'}しますか？
            </p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setConfirmDialog(null)} className="px-4 py-2 bg-[#333] text-white rounded-md text-sm hover:bg-[#444] transition-colors">キャンセル</button>
              <button
                onClick={handleToggleEnabled}
                className={`px-4 py-2 rounded-md text-sm text-white transition-colors ${confirmDialog.action === 'disable' ? 'bg-[#dc3545] hover:bg-[#c82333]' : 'bg-[#4a9eff] hover:bg-[#3a8eef]'}`}
              >
                {confirmDialog.action === 'disable' ? '無効化する' : '有効化する'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
