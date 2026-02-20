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

  return (
    <div className="answer-selector">
      <div className="answer-selector-header">
        <span>💡 各回答のアクションを選択してください（{candidates.length}個の候補）</span>
        <div className="answer-selector-hint">
          ※「採用」は1つ必須です
        </div>
      </div>
      <div className="answer-candidates">
        {candidates.map((candidate, index) => (
          <div
            key={index}
            className={`answer-card ${actions[index] || ''} ${index === 0 ? 'original' : 'retry'}`}
          >
            <div className="answer-card-header">
              <span className="answer-label">
                {index === 0 ? '元の回答' : `回答 ${index + 1}`}
              </span>
              {candidate.model && (
                <span className="answer-model">{candidate.model}</span>
              )}
              {actions[index] && (
                <span className={`answer-status ${actions[index]}`}>
                  {actions[index] === 'adopt' && '✓ 採用'}
                  {actions[index] === 'keep' && '📋 履歴に残す'}
                  {actions[index] === 'discard' && '🗑️ 破棄'}
                </span>
              )}
            </div>
            {candidate.thinking && (
              <ThinkingBlock thinking={candidate.thinking} />
            )}
            <div className="answer-content">
              {candidate.content}
            </div>
            <div className="answer-actions">
              <button
                className={`answer-action-btn adopt ${actions[index] === 'adopt' ? 'active' : ''}`}
                onClick={() => setAction(index, 'adopt')}
                disabled={isRetrying}
              >
                ✓ 採用
              </button>
              <button
                className={`answer-action-btn keep ${actions[index] === 'keep' ? 'active' : ''}`}
                onClick={() => setAction(index, 'keep')}
                disabled={isRetrying}
              >
                📋 履歴に残す
              </button>
              <button
                className={`answer-action-btn discard ${actions[index] === 'discard' ? 'active' : ''}`}
                onClick={() => setAction(index, 'discard')}
                disabled={isRetrying}
              >
                🗑️ 破棄
              </button>
            </div>
          </div>
        ))}
      </div>
      <div className="answer-selector-footer">
        {candidates.length < maxCandidates && (
          <button
            className="retry-more-btn"
            onClick={onRetryMore}
            disabled={isRetrying}
          >
            {isRetrying ? '生成中...' : '🔄 別のモデルでもう1つ生成'}
          </button>
        )}
        <button
          className="confirm-btn"
          onClick={handleConfirm}
          disabled={!canConfirm}
        >
          決定
        </button>
      </div>
    </div>
  );
}
