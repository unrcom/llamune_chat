import { useState, useEffect } from 'react';
import type { Message } from '../types';
import { ThinkingBlock } from './ThinkingBlock';

type AnswerAction = 'adopt' | 'keep' | 'discard' | null;

export function AnswerSelector({
  candidates,
  onConfirm,
  onRetryMore,
  isRetrying,
  maxCandidates = 8,
}: {
  candidates: Message[];
  onConfirm: (adoptedIndex: number, keepIndices: number[], discardIndices: number[]) => void;
  onRetryMore: () => void;
  isRetrying: boolean;
  maxCandidates?: number;
}) {
  const [actions, setActions] = useState<AnswerAction[]>(() =>
    candidates.map(() => null)
  );

  useEffect(() => {
    setActions(prev => {
      if (prev.length < candidates.length) {
        return [...prev, ...Array(candidates.length - prev.length).fill(null)];
      }
      return prev.slice(0, candidates.length);
    });
  }, [candidates.length]);

  const hasAdopted = actions.includes('adopt');
  const allSelected = actions.every(a => a !== null);
  const canConfirm = hasAdopted && allSelected && !isRetrying;

  const setAction = (index: number, action: AnswerAction) => {
    setActions(prev => {
      const newActions = [...prev];
      if (action === 'adopt') {
        for (let i = 0; i < newActions.length; i++) {
          if (newActions[i] === 'adopt') {
            newActions[i] = null;
          }
        }
      }
      newActions[index] = action;
      return newActions;
    });
  };

  const handleConfirm = () => {
    const adoptedIndex = actions.findIndex(a => a === 'adopt');
    const keepIndices = actions
      .map((a, i) => a === 'keep' ? i : -1)
      .filter(i => i !== -1);
    const discardIndices = actions
      .map((a, i) => a === 'discard' ? i : -1)
      .filter(i => i !== -1);
    onConfirm(adoptedIndex, keepIndices, discardIndices);
  };

  // カードのボーダー色をactionに応じて決定
  const cardBorder = (action: AnswerAction, isOriginal: boolean) => {
    if (action === 'adopt') return 'border-green-500 bg-[#1a2e1a]';
    if (action === 'keep') return 'border-yellow-400 bg-[#2e2a1a]';
    if (action === 'discard') return 'border-red-500 bg-[#2e1a1a] opacity-70';
    return isOriginal ? 'border-[#555]' : 'border-[#4a9eff]';
  };

  return (
    <div className="my-4 p-4 bg-[#0f0f23] border border-[#333] rounded-lg">
      <div className="text-center pb-3 mb-3 border-b border-[#333]">
        <span className="text-[#4a9eff] font-medium">💡 各回答のアクションを選択してください（{candidates.length}個の候補）</span>
        <div className="text-xs text-[#888] mt-1">※「採用」は1つ必須です</div>
      </div>

      <div className="flex flex-col gap-4">
        {candidates.map((candidate, index) => (
          <div key={index} className={`bg-[#16213e] border-2 rounded-lg p-4 flex flex-col transition-colors ${cardBorder(actions[index], index === 0)}`}>
            <div className="flex justify-between items-center mb-3 pb-2 border-b border-[#333] flex-wrap gap-2">
              <span className={`font-medium text-sm ${index === 0 ? 'text-[#aaa]' : 'text-[#4a9eff]'}`}>
                {index === 0 ? '元の回答' : `回答 ${index + 1}`}
              </span>
              {candidate.model && <span className="text-xs text-[#666] bg-[#222] px-2 py-0.5 rounded">{candidate.model}</span>}
              {actions[index] && (
                <span className={`text-xs px-2 py-0.5 rounded font-medium ${actions[index] === 'adopt' ? 'bg-green-500 text-white' : actions[index] === 'keep' ? 'bg-yellow-400 text-black' : 'bg-red-500 text-white'}`}>
                  {actions[index] === 'adopt' && '✓ 採用'}
                  {actions[index] === 'keep' && '📋 履歴に残す'}
                  {actions[index] === 'discard' && '🗑️ 破棄'}
                </span>
              )}
            </div>
            {candidate.thinking && <ThinkingBlock thinking={candidate.thinking} />}
            <div className="text-[#ccc] text-sm leading-relaxed whitespace-pre-wrap break-words max-h-[300px] overflow-y-auto mb-4">
              {candidate.content}
            </div>
            <div className="flex gap-2">
              {[
                { action: 'adopt' as AnswerAction, label: '✓ 採用', active: 'bg-green-500 border-green-500 text-white', hover: 'hover:bg-green-500 hover:border-green-500 hover:text-white' },
                { action: 'keep' as AnswerAction, label: '📋 履歴に残す', active: 'bg-yellow-400 border-yellow-400 text-black', hover: 'hover:bg-yellow-400 hover:border-yellow-400 hover:text-black' },
                { action: 'discard' as AnswerAction, label: '🗑️ 破棄', active: 'bg-red-500 border-red-500 text-white', hover: 'hover:bg-red-500 hover:border-red-500 hover:text-white' },
              ].map(({ action, label, active, hover }) => (
                <button
                  key={action}
                  className={`flex-1 py-2 px-2 border rounded-md text-xs font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${actions[index] === action ? active : `bg-[#222] border-[#444] text-[#aaa] ${hover}`}`}
                  onClick={() => setAction(index, action)}
                  disabled={isRetrying}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="flex justify-center gap-4 mt-4 pt-4 border-t border-[#333]">
        {candidates.length < maxCandidates && (
          <button
            className="px-6 py-3 bg-transparent border border-[#4a9eff] text-[#4a9eff] rounded-md text-sm cursor-pointer transition-colors hover:bg-[#4a9eff] hover:text-white disabled:opacity-50 disabled:cursor-not-allowed disabled:border-[#555] disabled:text-[#555] disabled:hover:bg-transparent"
            onClick={onRetryMore}
            disabled={isRetrying}
          >
            {isRetrying ? '生成中...' : '🔄 別のモデルでもう1つ生成'}
          </button>
        )}
        <button
          className="px-8 py-3 bg-green-500 border-none text-white rounded-md text-sm font-medium cursor-pointer transition-colors hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-[#555]"
          onClick={handleConfirm}
          disabled={!canConfirm}
        >
          決定
        </button>
      </div>
    </div>
  );
}
