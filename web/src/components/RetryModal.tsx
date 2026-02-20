import type { Model } from '../types';

export function RetryModal({
  isOpen,
  onClose,
  models,
  currentModel,
  onRetry,
}: {
  isOpen: boolean;
  onClose: () => void;
  models: Model[];
  currentModel: string;
  onRetry: (model: string) => void;
}) {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal retry-modal" onClick={(e) => e.stopPropagation()}>
        <h3>🔄 別のモデルで再試行</h3>
        <p>使用するモデルを選択してください</p>
        <div className="model-list">
          {models.map((model) => (
            <button
              key={model.name}
              className={`model-item ${model.name === currentModel ? 'current' : ''}`}
              onClick={() => {
                onRetry(model.name);
                onClose();
              }}
            >
              <span className="model-name">{model.name}</span>
              <span className="model-size">{model.sizeFormatted}</span>
              {model.name === currentModel && <span className="current-badge">現在</span>}
            </button>
          ))}
        </div>
        <div className="modal-actions">
          <button onClick={onClose}>キャンセル</button>
        </div>
      </div>
    </div>
  );
}
