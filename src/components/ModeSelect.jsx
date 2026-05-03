import React from 'react';
import { AI_PERSONALITIES } from '../hooks/useAI';

const MAP_OPTIONS = [
  { id: 'classic_map', label: '经典', emoji: '⬜' },
  { id: 'obstacle_map', label: '障碍', emoji: '🪨' },
  { id: 'haven_map', label: '安全区', emoji: '🟢' },
  { id: 'portal_map', label: '传送门', emoji: '🌀' },
  { id: 'mixed_map', label: '混合', emoji: '🎲' },
];

const AI_PERSONALITY_OPTIONS = [
  { id: AI_PERSONALITIES.GREEDY, label: '贪婪', emoji: '🍎', desc: '追食物' },
  { id: AI_PERSONALITIES.AGGRESSIVE, label: '激进', emoji: '⚔️', desc: '追玩家' },
  { id: AI_PERSONALITIES.RANDOM, label: '随机', emoji: '🎲', desc: '随机移动' },
];

export function ModeSelect({ onSelect, onMapSelect, currentMap, onAIPersonalitySelect, currentAIPersonality }) {
  const handleModeSelect = (mode) => {
    // If battle mode, require AI personality to be selected first
    if (mode === 'battle' && (!currentAIPersonality)) {
      return; // Don't navigate yet, wait for AI personality
    }
    onSelect(mode);
  };

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
      <div className="ai-personality-selector">
        <div className="ai-personality-label">AI 人格（AI对战模式）：</div>
        <div className="ai-personality-buttons">
          {AI_PERSONALITY_OPTIONS.map(opt => (
            <button
              key={opt.id}
              className={`ai-personality-btn ${currentAIPersonality === opt.id ? 'selected' : ''}`}
              onClick={() => onAIPersonalitySelect(opt.id)}
              title={opt.desc}
            >
              <span className="ai-personality-emoji">{opt.emoji}</span>
              <span className="ai-personality-name">{opt.label}</span>
            </button>
          ))}
        </div>
      </div>
      <div className="mode-buttons">
        <button className="mode-btn classic" onClick={() => handleModeSelect('classic')}>
          经典模式
        </button>
        <button className="mode-btn battle" onClick={() => handleModeSelect('battle')}>
          AI 对战
        </button>
        <button className="mode-btn endless" onClick={() => handleModeSelect('endless')}>
          无尽模式
        </button>
      </div>
    </div>
  );
}
