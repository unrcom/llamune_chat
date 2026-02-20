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
    <div className="mb-4 pb-4 border-b border-[#333]">
      <button
        className="flex items-center gap-2 bg-[#1a2a1e] border border-[#2a4a2e] rounded-md px-3 py-2 text-[#6a9a6e] cursor-pointer text-sm hover:bg-[#1e3e22] hover:text-[#8aba8e] transition-colors"
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className="text-xs">{isOpen ? '▼' : '▶'}</span>
        <span>
          システムプロンプト
          {headerParts.length > 0 && ` — ${headerParts.join(' ')}`}
        </span>
      </button>
      {isOpen && (
        <div className="bg-[#0f1a13] border border-[#2a4a2e] border-t-0 rounded-b-md px-4 py-3 text-[#6a9a6e] text-sm whitespace-pre-wrap break-words leading-relaxed max-h-[300px] overflow-y-auto">
          <pre className="font-inherit whitespace-pre-wrap">{systemPrompt}</pre>
        </div>
      )}
    </div>
  );
}
