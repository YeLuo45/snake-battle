import React from 'react';

export function ModeSelect({ onSelect }) {
  return (
    <div className="mode-select">
      <button className="mode-btn classic" onClick={() => onSelect('classic')}>
        经典模式
      </button>
      <button className="mode-btn battle" onClick={() => onSelect('battle')}>
        AI 对战
      </button>
    </div>
  );
}
