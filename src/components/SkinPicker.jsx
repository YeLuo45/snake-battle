import React from 'react';
import { SKINS } from '../utils/skins';

export function SkinPicker({ skin, setSkin }) {
  return (
    <div className="skin-picker">
      <span>皮肤：</span>
      {Object.entries(SKINS).map(([key, s]) => (
        <div
          key={key}
          className={`skin-dot ${skin === key ? 'active' : ''}`}
          style={{ background: s.snakeColor }}
          title={s.name}
          onClick={() => setSkin(key)}
        />
      ))}
    </div>
  );
}
