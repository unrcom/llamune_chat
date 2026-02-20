import { useState } from 'react';

export function ThinkingBlock({ thinking }: { thinking: string }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="mb-2">
      <button
        className="flex items-center gap-2 bg-[#1a1a2e] border border-[#333] rounded-md px-3 py-2 text-[#888] cursor-pointer text-sm hover:bg-[#222] hover:text-[#aaa] transition-colors"
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className="text-xs">{isOpen ? '▼' : '▶'}</span>
        <span>思考過程</span>
      </button>
      {isOpen && (
        <div className="bg-[#0f0f23] border border-[#333] border-t-0 rounded-b-md px-4 py-3 text-[#888] text-sm whitespace-pre-wrap break-words leading-relaxed max-h-[300px] overflow-y-auto">
          {thinking}
        </div>
      )}
    </div>
  );
}
