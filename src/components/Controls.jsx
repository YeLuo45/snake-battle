import React from 'react';

export function Controls({ onDirection, onPause }) {
  return (
    <div>
      <div className="controls">
        <button className="ctrl-btn up" onClick={() => onDirection('UP')}>▲</button>
        <button className="ctrl-btn left" onClick={() => onDirection('LEFT')}>◀</button>
        <button className="ctrl-btn down" onClick={() => onDirection('DOWN')}>▼</button>
        <button className="ctrl-btn right" onClick={() => onDirection('RIGHT')}>▶</button>
      </div>
      <div style={{ marginTop: 8, textAlign: 'center' }}>
        <button className="ctrl-btn" style={{ width: 200 }} onClick={onPause}>⏸ 暂停</button>
      </div>
    </div>
  );
}
