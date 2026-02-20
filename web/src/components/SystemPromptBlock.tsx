import { useState } from 'react';

export function SystemPromptBlock({
  systemPrompt,
  psetsIcon,
  psetsName,
  model,
}: {
  systemPrompt: string;
  psetsIcon?: string;
  psetsName?: string;
  model?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);

  const headerParts: string[] = [];
  if (psetsIcon) headerParts.push(psetsIcon);
  if (psetsName) headerParts.push(psetsName);
  if (model) headerParts.push(`(${model})`);

  return (
    <div className="system-prompt-block">
      <button
        className="system-prompt-toggle"
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className="thinking-icon">{isOpen ? '▼' : '▶'}</span>
        <span>
          システムプロンプト
          {headerParts.length > 0 && ` — ${headerParts.join(' ')}`}
        </span>
      </button>
      {isOpen && (
        <div className="system-prompt-content">
          <pre>{systemPrompt}</pre>
        </div>
      )}
    </div>
  );
}
