import { useState } from 'react';

export function ThinkingBlock({ thinking }: { thinking: string }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="thinking-block">
      <button
        className="thinking-toggle"
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className="thinking-icon">{isOpen ? '▼' : '▶'}</span>
        <span>思考過程</span>
      </button>
      {isOpen && (
        <div className="thinking-content">
          {thinking}
        </div>
      )}
    </div>
  );
}
