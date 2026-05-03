import React from 'react';

const MAP_OPTIONS = [
  { id: 'classic_map', label: '经典', emoji: '⬜' },
  { id: 'obstacle_map', label: '障碍', emoji: '🪨' },
  { id: 'haven_map', label: '安全区', emoji: '🟢' },
  { id: 'portal_map', label: '传送门', emoji: '🌀' },
  { id: 'mixed_map', label: '混合', emoji: '🎲' },
];

export function ModeSelect({ onSelect, onMapSelect, currentMap }) {
  return (
    <div className="mode-select">
      <div className="map-selector">
        <div className="map-label">选择地图：</div>
        <div className="map-buttons">
          {MAP_OPTIONS.map(opt => (
            <button
              key={opt.id}
              className={`map-btn ${currentMap === opt.id ? 'selected' : ''}`}
              onClick={() => onMapSelect(opt.id)}
              title={opt.label}
            >
              <span className="map-emoji">{opt.emoji}</span>
              <span className="map-name">{opt.label}</span>
            </button>
          ))}
        </div>
      </div>
      <div className="mode-buttons">
        <button className="mode-btn classic" onClick={() => onSelect('classic')}>
          经典模式
        </button>
        <button className="mode-btn battle" onClick={() => onSelect('battle')}>
          AI 对战
        </button>
        <button className="mode-btn endless" onClick={() => onSelect('endless')}>
          无尽模式
        </button>
        <button className="mode-btn boss" onClick={() => onSelect('boss')}>
          BOSS 战
        </button>
      </div>
    </div>
  );
}
