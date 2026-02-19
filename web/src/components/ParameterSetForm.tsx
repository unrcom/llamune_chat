/**
 * パラメータセット作成・編集フォームコンポーネント
 */

import { useState, useEffect } from 'react';
import { createPsetsTemplate, updatePsetsTemplate } from '../api/client';
import type { PsetsTemplate, Model } from '../types';
import './ModeForm.css';

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

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content modal-content-wide" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{title}</h3>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <form className="mode-form" onSubmit={handleSubmit}>
          {error && <div className="error-message">{error}</div>}

          {/* 基本情報 */}
          <div className="form-section">
            <h4 className="form-section-title">基本情報</h4>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="psets_name">名前 <span className="required">*</span></label>
                <input
                  type="text"
                  id="psets_name"
                  name="psets_name"
                  value={formData.psets_name}
                  onChange={handleChange}
                  required
                  placeholder="例: あなたの本職を支援"
                />
              </div>

              <div className="form-group">
                <label htmlFor="icon">アイコン</label>
                <select id="icon" name="icon" value={formData.icon} onChange={handleChange} className="icon-select">
                  <option value="">選択してください</option>
                  {ICON_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="visibility">公開範囲</label>
                <select id="visibility" name="visibility" value={formData.visibility} onChange={handleChange}>
                  <option value="private">プライベート</option>
                  <option value="public">パブリック</option>
                </select>
              </div>

              {isEdit && (
                <div className="form-group">
                  <label htmlFor="enabled">有効</label>
                  <select id="enabled" name="enabled" value={formData.enabled} onChange={handleChange}>
                    <option value={1}>有効</option>
                    <option value={0}>無効</option>
                  </select>
                </div>
              )}
            </div>

            <div className="form-group">
              <label htmlFor="description">説明</label>
              <textarea
                id="description"
                name="description"
                value={formData.description}
                onChange={handleChange}
                rows={2}
                placeholder="このテンプレートの簡単な説明"
              />
            </div>
          </div>

          {/* モデル・システムプロンプト */}
          <div className="form-section">
            <h4 className="form-section-title">モデル・システムプロンプト</h4>

            <div className="form-group">
              <label htmlFor="model">モデル <span className="required">*</span></label>
              <select id="model" name="model" value={formData.model} onChange={handleChange} required>
                <option value="">モデルを選択してください</option>
                {models.map((m) => (
                  <option key={m.name} value={m.name}>{m.name}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="system_prompt">システムプロンプト</label>
              <textarea
                id="system_prompt"
                name="system_prompt"
                value={formData.system_prompt}
                onChange={handleChange}
                rows={10}
                placeholder="LLMに送信される初期指示。空の場合はデフォルトの動作になります。"
                className="code-textarea"
              />
            </div>
          </div>

          {/* LLM パラメータ */}
          <div className="form-section">
            <h4 className="form-section-title">LLM パラメータ</h4>

            <div className="form-group">
              <label>
                最大トークン数
                <span className="param-value">
                  {formData.max_tokens === 0 ? 'モデルのデフォルト' : formData.max_tokens}
                </span>
              </label>
              <input
                type="range"
                min={0}
                max={8192}
                step={128}
                value={formData.max_tokens}
                onChange={(e) => handleSliderChange('max_tokens', parseInt(e.target.value))}
                className="param-slider"
              />
              <div className="slider-labels">
                <span>デフォルト (0)</span>
                <span>8192</span>
              </div>
            </div>

            <div className="form-group">
              <label>
                参照メッセージ数
                <span className="param-value">
                  {formData.context_messages === 0 ? '無制限' : formData.context_messages}
                </span>
              </label>
              <input
                type="range"
                min={0}
                max={50}
                step={1}
                value={formData.context_messages}
                onChange={(e) => handleSliderChange('context_messages', parseInt(e.target.value))}
                className="param-slider"
              />
              <div className="slider-labels">
                <span>無制限 (0)</span>
                <span>50</span>
              </div>
            </div>

            <div className="form-group">
              <label>
                Temperature
                <span className="param-value">{formData.temperature.toFixed(2)}</span>
              </label>
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={formData.temperature}
                onChange={(e) => handleSliderChange('temperature', parseFloat(e.target.value))}
                className="param-slider"
              />
              <div className="slider-labels">
                <span>0.0（確実）</span>
                <span>1.0（創造的）</span>
              </div>
            </div>

            <div className="form-group">
              <label>
                Top-p
                <span className="param-value">{formData.top_p.toFixed(2)}</span>
              </label>
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={formData.top_p}
                onChange={(e) => handleSliderChange('top_p', parseFloat(e.target.value))}
                className="param-slider"
              />
              <div className="slider-labels">
                <span>0.0</span>
                <span>1.0</span>
              </div>
            </div>
          </div>

          <div className="form-actions">
            <button type="button" className="btn-secondary" onClick={onClose} disabled={loading}>
              キャンセル
            </button>
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? '保存中...' : isEdit ? '更新' : '作成'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
