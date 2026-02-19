/**
 * セッション編集モーダルコンポーネント
 * タイトルとパラメータセットを編集できる
 */

import { useState, useEffect } from 'react';
import { getPsetsTemplates, getModels } from '../api/client';
import type { Model } from '../types';
import type { PsetsTemplate, Session } from '../types';
import './ModeForm.css';

interface SessionEditModalProps {
  session: Session;
  currentPsets: {
    psets_name: string;
    icon: string | null;
    description: string | null;
    model: string | null;
    system_prompt: string | null;
    max_tokens: number | null;
    context_messages: number | null;
    temperature: number | null;
    top_p: number | null;
    template_id: number | null;
    template_version: number | null;
  } | null;
  onClose: () => void;
  onSave: (title: string, psets: {
    psets_name: string;
    icon: string | null;
    description: string | null;
    model: string | null;
    system_prompt: string | null;
    max_tokens: number | null;
    context_messages: number | null;
    temperature: number | null;
    top_p: number | null;
    template_id: number | null;
    template_version: number | null;
  }) => void;
}

// アイコン選択肢
const ICON_OPTIONS = [
  { value: '💻', label: '💻 コーディング' },
  { value: '🤖', label: '🤖 AI・ロボット' },
  { value: '✍️', label: '✍️ ライティング' },
  { value: '🎨', label: '🎨 クリエイティブ' },
  { value: '📊', label: '📊 分析・データ' },
  { value: '🔬', label: '🔬 研究・学術' },
  { value: '💼', label: '💼 ビジネス' },
  { value: '🎓', label: '🎓 教育・学習' },
  { value: '🌍', label: '🌍 翻訳・言語' },
  { value: '🎮', label: '🎮 ゲーム' },
  { value: '📚', label: '📚 読書・文学' },
  { value: '🛠️', label: '🛠️ エンジニアリング' },
  { value: '💡', label: '💡 アイデア・創造' },
  { value: '🎯', label: '🎯 目標・計画' },
  { value: '⚡', label: '⚡ 効率化' },
  { value: '🌟', label: '🌟 その他' },
];

export function SessionEditModal({ session, currentPsets, onClose, onSave }: SessionEditModalProps) {
  const [title, setTitle] = useState(session.title || '');
  const [templates, setTemplates] = useState<PsetsTemplate[]>([]);
  const [models, setModels] = useState<Model[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [showTemplateConfirm, setShowTemplateConfirm] = useState(false);
  const [pendingTemplate, setPendingTemplate] = useState<PsetsTemplate | null>(null);

  // パラメータセット編集用の状態
  const [psets, setPsets] = useState({
    psets_name: currentPsets?.psets_name || '',
    icon: currentPsets?.icon || '',
    description: currentPsets?.description || '',
    model: currentPsets?.model || '',
    system_prompt: currentPsets?.system_prompt || '',
    max_tokens: currentPsets?.max_tokens ?? 0,
    context_messages: currentPsets?.context_messages ?? 10,
    temperature: currentPsets?.temperature ?? 0.8,
    top_p: currentPsets?.top_p ?? 0.9,
    template_id: currentPsets?.template_id ?? null,
    template_version: currentPsets?.template_version ?? null,
  });

  useEffect(() => {
    Promise.all([getPsetsTemplates(), getModels()])
      .then(([tmpl, mdls]) => {
        setTemplates(tmpl);
        setModels(mdls);
      })
      .catch(console.error);
  }, []);

  function handleTemplateChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const id = Number(e.target.value);
    if (!id) {
      setSelectedTemplateId('');
      return;
    }
    const template = templates.find(t => t.id === id);
    if (!template) return;

    setPendingTemplate(template);
    setShowTemplateConfirm(true);
    setSelectedTemplateId(e.target.value);
  }

  function applyTemplate(template: PsetsTemplate) {
    setPsets({
      psets_name: template.psets_name,
      icon: template.icon || '',
      description: template.description || '',
      model: template.model || '',
      system_prompt: template.system_prompt || '',
      max_tokens: template.max_tokens ?? 0,
      context_messages: template.context_messages ?? 10,
      temperature: template.temperature ?? 0.8,
      top_p: template.top_p ?? 0.9,
      template_id: template.id,
      template_version: template.version,
    });
    setShowTemplateConfirm(false);
    setPendingTemplate(null);
    setSelectedTemplateId('');
  }

  function handlePsetsChange(field: string, value: string | number | null) {
    setPsets(prev => ({ ...prev, [field]: value }));
  }

  function handleSubmit() {
    onSave(title, {
      psets_name: psets.psets_name,
      icon: psets.icon || null,
      description: psets.description || null,
      model: psets.model || null,
      system_prompt: psets.system_prompt || null,
      max_tokens: psets.max_tokens || null,
      context_messages: psets.context_messages,
      temperature: psets.temperature,
      top_p: psets.top_p,
      template_id: psets.template_id,
      template_version: psets.template_version,
    });
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content modal-content-wide" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>セッション編集</h3>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <div className="mode-form">
          {/* セッション名 */}
          <div className="form-section">
            <h4 className="form-section-title">セッション名</h4>
            <div className="form-group">
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="セッションタイトル"
              />
            </div>
          </div>

          {/* パラメータセット */}
          <div className="form-section">
            <h4 className="form-section-title">パラメータセット</h4>

            {/* テンプレートから読み込む */}
            <div className="form-group">
              <label>テンプレートから読み込む</label>
              <select value={selectedTemplateId} onChange={handleTemplateChange}>
                <option value="">テンプレートを選択...</option>
                {templates.map(t => (
                  <option key={t.id} value={t.id}>
                    {t.icon} {t.psets_name}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>名前</label>
                <input
                  type="text"
                  value={psets.psets_name}
                  onChange={(e) => handlePsetsChange('psets_name', e.target.value)}
                />
              </div>
              <div className="form-group">
                <label>アイコン</label>
                <select
                  value={psets.icon}
                  onChange={(e) => handlePsetsChange('icon', e.target.value)}
                  className="icon-select"
                >
                  <option value="">なし</option>
                  {ICON_OPTIONS.map(o => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="form-group">
              <label>説明</label>
              <input
                type="text"
                value={psets.description}
                onChange={(e) => handlePsetsChange('description', e.target.value)}
              />
            </div>

            <div className="form-group">
              <label>モデル</label>
              <select
                value={psets.model}
                onChange={(e) => handlePsetsChange('model', e.target.value)}
              >
                <option value="">デフォルト（未指定）</option>
                {models.map(m => (
                  <option key={m.name} value={m.name}>{m.name}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>システムプロンプト</label>
              <textarea
                value={psets.system_prompt}
                onChange={(e) => handlePsetsChange('system_prompt', e.target.value)}
                rows={8}
                className="code-textarea"
              />
            </div>

            {/* LLM パラメータ */}
            <div className="form-group">
              <label>
                最大トークン数
                <span className="param-value">
                  {psets.max_tokens === 0 ? 'モデルのデフォルト' : psets.max_tokens}
                </span>
              </label>
              <input
                type="range" min={0} max={8192} step={128}
                value={psets.max_tokens}
                onChange={(e) => handlePsetsChange('max_tokens', parseInt(e.target.value))}
                className="param-slider"
              />
              <div className="slider-labels"><span>デフォルト (0)</span><span>8192</span></div>
            </div>

            <div className="form-group">
              <label>
                参照メッセージ数
                <span className="param-value">
                  {psets.context_messages === 0 ? '無制限' : psets.context_messages}
                </span>
              </label>
              <input
                type="range" min={0} max={50} step={1}
                value={psets.context_messages}
                onChange={(e) => handlePsetsChange('context_messages', parseInt(e.target.value))}
                className="param-slider"
              />
              <div className="slider-labels"><span>無制限 (0)</span><span>50</span></div>
            </div>

            <div className="form-group">
              <label>
                Temperature
                <span className="param-value">{Number(psets.temperature).toFixed(2)}</span>
              </label>
              <input
                type="range" min={0} max={1} step={0.01}
                value={psets.temperature}
                onChange={(e) => handlePsetsChange('temperature', parseFloat(e.target.value))}
                className="param-slider"
              />
              <div className="slider-labels"><span>0.0（確実）</span><span>1.0（創造的）</span></div>
            </div>

            <div className="form-group">
              <label>
                Top-p
                <span className="param-value">{Number(psets.top_p).toFixed(2)}</span>
              </label>
              <input
                type="range" min={0} max={1} step={0.01}
                value={psets.top_p}
                onChange={(e) => handlePsetsChange('top_p', parseFloat(e.target.value))}
                className="param-slider"
              />
              <div className="slider-labels"><span>0.0</span><span>1.0</span></div>
            </div>
          </div>

          <div className="form-actions">
            <button className="btn-secondary" onClick={onClose}>キャンセル</button>
            <button className="btn-primary" onClick={handleSubmit}>保存</button>
          </div>
        </div>
      </div>

      {/* テンプレート読み込み確認ダイアログ */}
      {showTemplateConfirm && pendingTemplate && (
        <div className="modal-overlay" onClick={() => { setShowTemplateConfirm(false); setSelectedTemplateId(''); }}>
          <div className="modal-content" style={{ maxWidth: '400px', padding: '1.5rem' }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ marginTop: 0 }}>テンプレートを読み込みますか？</h3>
            <p>
              「{pendingTemplate.psets_name}」を読み込むと<br />
              現在のパラメータが上書きされます。
            </p>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button className="btn-secondary" onClick={() => { setShowTemplateConfirm(false); setSelectedTemplateId(''); }}>
                キャンセル
              </button>
              <button className="btn-primary" onClick={() => applyTemplate(pendingTemplate)}>
                読み込む
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
