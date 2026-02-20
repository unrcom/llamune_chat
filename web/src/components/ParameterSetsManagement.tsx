/**
 * パラメータセット管理コンポーネント
 */

import { useState, useEffect, useRef } from 'react';
import { getPsetsTemplates, disablePsetsTemplate, updatePsetsTemplate, updatePsetsTemplateSortOrder, getModels } from '../api/client';
import type { PsetsTemplate, Model } from '../types';
import { ParameterSetForm } from './ParameterSetForm';
import './ModesManagement.css';

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
      <div className="modes-management">
        <div className="loading">
          <div className="spinner"></div>
          <p>読み込み中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="modes-management">
      <div className="modes-header">
        <div className="modes-header-left">
          <button className="btn-back" onClick={onNavigateToChat}>← チャットに戻る</button>
          <h2>パラメータセット管理</h2>
        </div>
        <button className="btn-primary" onClick={handleCreate}>新しいテンプレートを作成</button>
      </div>

      {error && <div className="error-message">{error}</div>}

      <div className="modes-table-container">
        <table className="modes-table">
          <thead>
            <tr>
              <th></th>
              <th>アイコン</th>
              <th>名前</th>
              <th>モデル</th>
              <th>公開</th>
              <th>有効</th>
              <th>バージョン</th>
              <th>操作</th>
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
                className={`draggable-row ${!template.enabled ? 'row-disabled' : ''}`}
              >
                <td className="drag-handle">⠿</td>
                <td className="mode-icon">{template.icon || '🤖'}</td>
                <td className="mode-display-name">{template.psets_name}</td>
                <td className="mode-description">{template.model || '-'}</td>
                <td>{template.visibility === 'public' ? '公開' : '非公開'}</td>
                <td>{template.enabled ? '✓' : '✗'}</td>
                <td>v{template.version}</td>
                <td className="mode-actions">
                  <button className="btn-small btn-secondary" onClick={() => handleEdit(template)}>
                    編集
                  </button>
                  <button className="btn-small btn-secondary" onClick={() => handleCopy(template)}>
                    コピー
                  </button>
                  <button
                    className={`btn-small ${template.enabled ? 'btn-danger' : 'btn-secondary'}`}
                    onClick={() => setConfirmDialog({
                      id: template.id,
                      action: template.enabled ? 'disable' : 'enable',
                      name: template.psets_name,
                    })}
                  >
                    {template.enabled ? '無効化' : '有効化'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {templates.length === 0 && (
          <div className="empty-state">
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
        <div className="modal-overlay" onClick={() => setConfirmDialog(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3 style={{ marginTop: 0 }}>
              {confirmDialog.action === 'disable' ? '🚫 無効化の確認' : '✅ 有効化の確認'}
            </h3>
            <p style={{ color: '#ccc', marginBottom: '1.5rem' }}>
              「{confirmDialog.name}」を
              {confirmDialog.action === 'disable' ? '無効化' : '有効化'}しますか？
            </p>
            <div className="modal-actions">
              <button className="btn-secondary" onClick={() => setConfirmDialog(null)}>
                キャンセル
              </button>
              <button
                className={confirmDialog.action === 'disable' ? 'btn-danger' : 'btn-primary'}
                onClick={handleToggleEnabled}
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
