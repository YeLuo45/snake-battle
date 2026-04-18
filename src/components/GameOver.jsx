import React from 'react';

export function GameOver({ score, highScore, isBattle, ranking, onRestart, onBack }) {
  return (
    <div className="modal-overlay">
      <div className="modal">
        <h2>{isBattle ? '对战结束' : '游戏结束'}</h2>

        {isBattle && ranking ? (
          <div className="ranking">
            {ranking.map((entry, i) => (
              <div key={i} className={`rank-row ${entry.isPlayer ? 'player' : ''}`}>
                <span>#{i + 1}</span>
                <span>{entry.name}</span>
                <span>{entry.score}分</span>
              </div>
            ))}
          </div>
        ) : (
          <>
            <div className="final-score">得分：{score}</div>
            {score >= highScore && score > 0 && (
              <div style={{ color: '#ff6b6b' }}>新纪录！</div>
            )}
            <div style={{ color: '#888', fontSize: 14 }}>最高分：{highScore}</div>
          </>
        )}

        <div className="modal-btns">
          <button className="modal-btn primary" onClick={onRestart}>
            再来一局
          </button>
          <button className="modal-btn secondary" onClick={onBack}>
            返回
          </button>
        </div>
      </div>
    </div>
  );
}
