/**
 * パラメータセット作成・編集フォームコンポーネント
 */

import { useState, useEffect } from 'react';
import { createPsetsTemplate, updatePsetsTemplate } from '../api/client';
import type { PsetsTemplate, Model } from '../types';


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
  { value: '🎵', label: '🎵 音楽' },
  { value: '🏃', label: '🏃 健康・フィットネス' },
  { value: '🍳', label: '🍳 料理・レシピ' },
  { value: '🛠️', label: '🛠️ エンジニアリング' },
  { value: '💡', label: '💡 アイデア・創造' },
  { value: '📱', label: '📱 テクノロジー' },
  { value: '🎯', label: '🎯 目標・計画' },
  { value: '⚡', label: '⚡ 効率化' },
  { value: '🌟', label: '🌟 その他' },
];

interface ParameterSetFormProps {
  template: PsetsTemplate | null;
  isCopy?: boolean;
  models: Model[];
  onClose: () => void;
  onSuccess: () => void;
}

interface FormData {
  psets_name: string;
  visibility: 'public' | 'private';
  icon: string;
  description: string;
  model: string;
  system_prompt: string;
  max_tokens: number;
  context_messages: number;
  temperature: number;
  top_p: number;
  enabled: number;
}

export function ParameterSetForm({ template, isCopy = false, models, onClose, onSuccess }: ParameterSetFormProps) {
  const [formData, setFormData] = useState<FormData>({
    psets_name: '',
    visibility: 'private',
    icon: '',
    description: '',
    model: '',
    system_prompt: '',
    max_tokens: 0,
    context_messages: 10,
    temperature: 0.8,
    top_p: 0.9,
    enabled: 1,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (template) {
      setFormData({
        psets_name: isCopy ? `${template.psets_name} のコピー` : template.psets_name,
        visibility: template.visibility,
        icon: template.icon || '',
        description: template.description || '',
        model: template.model || '',
        system_prompt: template.system_prompt || '',
        max_tokens: template.max_tokens ?? 0,
        context_messages: template.context_messages ?? 10,
        temperature: template.temperature ?? 0.8,
        top_p: template.top_p ?? 0.9,
        enabled: template.enabled,
      });
    }
  }, [template, isCopy]);

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) {
    const { name, value, type } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'number' || type === 'range' ? parseFloat(value) : value,
    }));
  }

  function handleSliderChange(name: string, value: number) {
    setFormData((prev) => ({ ...prev, [name]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (!formData.model) {
      setError('モデルを選択してください');
      setLoading(false);
      return;
    }

    try {
      const payload = {
        psets_name: formData.psets_name,
        visibility: formData.visibility,
        icon: formData.icon || null,
        description: formData.description || null,
        model: formData.model,
        system_prompt: formData.system_prompt || null,
        max_tokens: formData.max_tokens || null,
        context_messages: formData.context_messages,
        temperature: formData.temperature,
        top_p: formData.top_p,
      };

      if (template && !isCopy) {
        await updatePsetsTemplate(template.id, { ...payload, enabled: formData.enabled });
      } else {
        await createPsetsTemplate(payload);
      }
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setLoading(false);
    }
  }

  const isEdit = template !== null && !isCopy;
  const title = isCopy ? 'テンプレートをコピー' : isEdit ? 'テンプレートを編集' : '新しいテンプレートを作成';

  // 共通の入力スタイル
  const inputCls = "w-full px-3 py-2 bg-[#0f0f23] border border-[#333] rounded-md text-white text-sm focus:outline-none focus:border-[#4a9eff]";
  const labelCls = "block text-[#ccc] text-sm font-medium mb-1";

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[100] p-4" onClick={onClose}>
      <div className="bg-[#16213e] rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-xl" onClick={(e) => e.stopPropagation()}>
        {/* ヘッダー */}
        <div className="flex justify-between items-center px-6 py-4 border-b border-[#333]">
          <h3 className="text-lg font-semibold text-white m-0">{title}</h3>
          <button className="text-[#888] hover:text-white hover:bg-[#333] w-8 h-8 flex items-center justify-center rounded text-xl transition-colors" onClick={onClose}>×</button>
        </div>

        <form className="p-6" onSubmit={handleSubmit}>
          {error && <div className="bg-[#ff4444]/20 border border-[#ff4444] text-[#ff6666] px-3 py-2 rounded-md mb-4 text-sm">{error}</div>}

          {/* 基本情報 */}
          <div className="mb-6">
            <h4 className="text-[#4a9eff] text-sm font-semibold uppercase tracking-wider mb-4 pb-2 border-b border-[#333]">基本情報</h4>

            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label htmlFor="psets_name" className={labelCls}>名前 <span className="text-[#ff4444]">*</span></label>
                <input type="text" id="psets_name" name="psets_name" value={formData.psets_name} onChange={handleChange} required placeholder="例: あなたの本職を支援" className={inputCls} />
              </div>
              <div>
                <label htmlFor="icon" className={labelCls}>アイコン</label>
                <select id="icon" name="icon" value={formData.icon} onChange={handleChange} className={inputCls}>
                  <option value="">選択してください</option>
                  {ICON_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label htmlFor="visibility" className={labelCls}>公開範囲</label>
                <select id="visibility" name="visibility" value={formData.visibility} onChange={handleChange} className={inputCls}>
                  <option value="private">プライベート</option>
                  <option value="public">パブリック</option>
                </select>
              </div>
              {isEdit && (
                <div>
                  <label htmlFor="enabled" className={labelCls}>有効</label>
                  <select id="enabled" name="enabled" value={formData.enabled} onChange={handleChange} className={inputCls}>
                    <option value={1}>有効</option>
                    <option value={0}>無効</option>
                  </select>
                </div>
              )}
            </div>

            <div>
              <label htmlFor="description" className={labelCls}>説明</label>
              <textarea id="description" name="description" value={formData.description} onChange={handleChange} rows={2} placeholder="このテンプレートの簡単な説明" className={inputCls} />
            </div>
          </div>

          {/* モデル・システムプロンプト */}
          <div className="mb-6">
            <h4 className="text-[#4a9eff] text-sm font-semibold uppercase tracking-wider mb-4 pb-2 border-b border-[#333]">モデル・システムプロンプト</h4>

            <div className="mb-4">
              <label htmlFor="model" className={labelCls}>モデル <span className="text-[#ff4444]">*</span></label>
              <select id="model" name="model" value={formData.model} onChange={handleChange} required className={inputCls}>
                <option value="">モデルを選択してください</option>
                {models.map((m) => (
                  <option key={m.name} value={m.name}>{m.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="system_prompt" className={labelCls}>システムプロンプト</label>
              <textarea
                id="system_prompt" name="system_prompt" value={formData.system_prompt} onChange={handleChange} rows={10}
                placeholder="LLMに送信される初期指示。空の場合はデフォルトの動作になります。"
                className={`${inputCls} font-mono text-xs resize-y min-h-[200px]`}
              />
            </div>
          </div>

          {/* LLM パラメータ */}
          <div className="mb-6">
            <h4 className="text-[#4a9eff] text-sm font-semibold uppercase tracking-wider mb-4 pb-2 border-b border-[#333]">LLM パラメータ</h4>

            {[
              { name: 'max_tokens', label: '最大トークン数', min: 0, max: 8192, step: 128, display: formData.max_tokens === 0 ? 'モデルのデフォルト' : formData.max_tokens, leftLabel: 'デフォルト (0)', rightLabel: '8192', isInt: true },
              { name: 'context_messages', label: '参照メッセージ数', min: 0, max: 50, step: 1, display: formData.context_messages === 0 ? '無制限' : formData.context_messages, leftLabel: '無制限 (0)', rightLabel: '50', isInt: true },
              { name: 'temperature', label: 'Temperature', min: 0, max: 1, step: 0.01, display: formData.temperature.toFixed(2), leftLabel: '0.0（確実）', rightLabel: '1.0（創造的）', isInt: false },
              { name: 'top_p', label: 'Top-p', min: 0, max: 1, step: 0.01, display: formData.top_p.toFixed(2), leftLabel: '0.0', rightLabel: '1.0', isInt: false },
            ].map(({ name, label, min, max, step, display, leftLabel, rightLabel, isInt }) => (
              <div key={name} className="mb-4">
                <label className={`${labelCls} flex justify-between`}>
                  <span>{label}</span>
                  <span className="text-[#4a9eff] font-mono">{display}</span>
                </label>
                <input
                  type="range" min={min} max={max} step={step}
                  value={formData[name as keyof FormData] as number}
                  onChange={(e) => handleSliderChange(name, isInt ? parseInt(e.target.value) : parseFloat(e.target.value))}
                  className="w-full accent-[#4a9eff]"
                />
                <div className="flex justify-between text-xs text-[#666] mt-1">
                  <span>{leftLabel}</span><span>{rightLabel}</span>
                </div>
              </div>
            ))}
          </div>

          <div className="flex gap-3 justify-end pt-4 border-t border-[#333]">
            <button type="button" onClick={onClose} disabled={loading} className="px-4 py-2 bg-[#333] text-white rounded-md text-sm hover:bg-[#444] disabled:opacity-50 transition-colors">
              キャンセル
            </button>
            <button type="submit" disabled={loading} className="px-4 py-2 bg-[#4a9eff] text-white rounded-md text-sm hover:bg-[#3a8eef] disabled:opacity-50 transition-colors">
              {loading ? '保存中...' : isEdit ? '更新' : '作成'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
