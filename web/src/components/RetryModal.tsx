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
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[100]" onClick={onClose}>
      <div className="bg-[#16213e] rounded-xl p-6 w-full max-w-lg shadow-xl" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-white font-semibold mb-2">🔄 別のモデルで再試行</h3>
        <p className="text-[#888] text-sm mb-4">使用するモデルを選択してください</p>
        <div className="flex flex-col gap-2 max-h-[400px] overflow-y-auto">
          {models.map((model) => (
            <button
              key={model.name}
              className={`flex items-center gap-3 px-4 py-3 bg-[#1a1a2e] border rounded-md cursor-pointer text-left text-white transition-colors hover:bg-[#252540] hover:border-[#4a9eff] ${model.name === currentModel ? 'border-[#4a9eff] bg-[#1a2a4e]' : 'border-[#333]'}`}
              onClick={() => { onRetry(model.name); onClose(); }}
            >
              <span className="flex-1 font-medium text-sm">{model.name}</span>
              <span className="text-[#888] text-sm">{model.sizeFormatted}</span>
              {model.name === currentModel && <span className="bg-[#4a9eff] text-white text-xs px-2 py-0.5 rounded">現在</span>}
            </button>
          ))}
        </div>
        <div className="flex justify-end mt-4">
          <button onClick={onClose} className="px-4 py-2 bg-[#333] text-white rounded-md text-sm hover:bg-[#444] transition-colors">キャンセル</button>
        </div>
      </div>
    </div>
  );
}
