/**
 * セッション編集モーダルコンポーネント
 * タイトルとパラメータセットを編集できる
 */

import { useState, useEffect } from 'react';
import { getPsetsTemplates, getModels } from '../api/client';
import type { Model } from '../types';
import type { PsetsTemplate, Session } from '../types';


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

  // 共通スタイル
  const inputCls = "w-full px-3 py-2 bg-[#0f0f23] border border-[#333] rounded-md text-white text-sm focus:outline-none focus:border-[#4a9eff]";
  const labelCls = "block text-[#ccc] text-sm font-medium mb-1";

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[100] p-4" onClick={onClose}>
      <div className="bg-[#16213e] rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-xl" onClick={(e) => e.stopPropagation()}>
        {/* ヘッダー */}
        <div className="flex justify-between items-center px-6 py-4 border-b border-[#333]">
          <h3 className="text-lg font-semibold text-white m-0">セッション編集</h3>
          <button className="text-[#888] hover:text-white hover:bg-[#333] w-8 h-8 flex items-center justify-center rounded text-xl transition-colors" onClick={onClose}>×</button>
        </div>

        <div className="p-6">
          {/* セッション名 */}
          <div className="mb-6">
            <h4 className="text-[#4a9eff] text-sm font-semibold uppercase tracking-wider mb-4 pb-2 border-b border-[#333]">セッション名</h4>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="セッションタイトル"
              className={inputCls}
            />
          </div>

          {/* パラメータセット */}
          <div className="mb-6">
            <h4 className="text-[#4a9eff] text-sm font-semibold uppercase tracking-wider mb-4 pb-2 border-b border-[#333]">パラメータセット</h4>

            <div className="mb-4">
              <label className={labelCls}>テンプレートから読み込む</label>
              <select value={selectedTemplateId} onChange={handleTemplateChange} className={inputCls}>
                <option value="">テンプレートを選択...</option>
                {templates.map(t => (
                  <option key={t.id} value={t.id}>{t.icon} {t.psets_name}</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className={labelCls}>名前</label>
                <input type="text" value={psets.psets_name} onChange={(e) => handlePsetsChange('psets_name', e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>アイコン</label>
                <select value={psets.icon} onChange={(e) => handlePsetsChange('icon', e.target.value)} className={inputCls}>
                  <option value="">なし</option>
                  {ICON_OPTIONS.map(o => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mb-4">
              <label className={labelCls}>説明</label>
              <input type="text" value={psets.description} onChange={(e) => handlePsetsChange('description', e.target.value)} className={inputCls} />
            </div>

            <div className="mb-4">
              <label className={labelCls}>モデル</label>
              <select value={psets.model} onChange={(e) => handlePsetsChange('model', e.target.value)} className={inputCls}>
                <option value="">デフォルト（未指定）</option>
                {models.map(m => (
                  <option key={m.name} value={m.name}>{m.name}</option>
                ))}
              </select>
            </div>

            <div className="mb-4">
              <label className={labelCls}>システムプロンプト</label>
              <textarea
                value={psets.system_prompt}
                onChange={(e) => handlePsetsChange('system_prompt', e.target.value)}
                rows={8}
                className={`${inputCls} font-mono text-xs resize-y`}
              />
            </div>

            {/* LLM パラメータ */}
            {[
              { field: 'max_tokens', label: '最大トークン数', min: 0, max: 8192, step: 128, display: psets.max_tokens === 0 ? 'モデルのデフォルト' : psets.max_tokens, leftLabel: 'デフォルト (0)', rightLabel: '8192', isInt: true },
              { field: 'context_messages', label: '参照メッセージ数', min: 0, max: 50, step: 1, display: psets.context_messages === 0 ? '無制限' : psets.context_messages, leftLabel: '無制限 (0)', rightLabel: '50', isInt: true },
              { field: 'temperature', label: 'Temperature', min: 0, max: 1, step: 0.01, display: Number(psets.temperature).toFixed(2), leftLabel: '0.0（確実）', rightLabel: '1.0（創造的）', isInt: false },
              { field: 'top_p', label: 'Top-p', min: 0, max: 1, step: 0.01, display: Number(psets.top_p).toFixed(2), leftLabel: '0.0', rightLabel: '1.0', isInt: false },
            ].map(({ field, label, min, max, step, display, leftLabel, rightLabel, isInt }) => (
              <div key={field} className="mb-4">
                <label className={`${labelCls} flex justify-between`}>
                  <span>{label}</span>
                  <span className="text-[#4a9eff] font-mono">{display}</span>
                </label>
                <input
                  type="range" min={min} max={max} step={step}
                  value={psets[field as keyof typeof psets] as number}
                  onChange={(e) => handlePsetsChange(field, isInt ? parseInt(e.target.value) : parseFloat(e.target.value))}
                  className="w-full accent-[#4a9eff]"
                />
                <div className="flex justify-between text-xs text-[#666] mt-1">
                  <span>{leftLabel}</span><span>{rightLabel}</span>
                </div>
              </div>
            ))}
          </div>

          <div className="flex gap-3 justify-end pt-4 border-t border-[#333]">
            <button onClick={onClose} className="px-4 py-2 bg-[#333] text-white rounded-md text-sm hover:bg-[#444] transition-colors">キャンセル</button>
            <button onClick={handleSubmit} className="px-4 py-2 bg-[#4a9eff] text-white rounded-md text-sm hover:bg-[#3a8eef] transition-colors">保存</button>
          </div>
        </div>
      </div>

      {/* テンプレート読み込み確認ダイアログ */}
      {showTemplateConfirm && pendingTemplate && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[110]" onClick={() => { setShowTemplateConfirm(false); setSelectedTemplateId(''); }}>
          <div className="bg-[#16213e] rounded-xl p-6 w-full max-w-sm shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-white font-semibold mb-3">テンプレートを読み込みますか？</h3>
            <p className="text-[#ccc] text-sm mb-6">
              「{pendingTemplate.psets_name}」を読み込むと<br />現在のパラメータが上書きされます。
            </p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => { setShowTemplateConfirm(false); setSelectedTemplateId(''); }} className="px-4 py-2 bg-[#333] text-white rounded-md text-sm hover:bg-[#444] transition-colors">キャンセル</button>
              <button onClick={() => applyTemplate(pendingTemplate)} className="px-4 py-2 bg-[#4a9eff] text-white rounded-md text-sm hover:bg-[#3a8eef] transition-colors">読み込む</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
