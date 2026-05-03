import React from 'react';

export function GameOver({ score, highScore, isBattle, isEndless, isBoss, victory, wave, endlessTop5, ranking, onRestart, onBack }) {
  return (
    <div className="modal-overlay">
      <div className="modal">
        <h2>{isBattle ? '对战结束' : isEndless ? '游戏结束' : isBoss ? (victory ? '胜利！' : '挑战失败') : '游戏结束'}</h2>

        {isBoss ? (
          <div className="boss-result">
            {victory ? (
              <div style={{ color: '#76c442', fontSize: 20, fontWeight: 'bold' }}>恭喜击败BOSS！</div>
            ) : (
              <div style={{ color: '#e94560', fontSize: 18 }}>BOSS 仍然存活...</div>
            )}
            <div className="final-score">得分：{score}</div>
          </div>
        ) : isEndless ? (
          <div className="endless-result">
            <div className="wave-result">波次：<strong>{wave}</strong></div>
            <div className="final-score">得分：{score}</div>
            {score >= highScore && score > 0 && (
              <div style={{ color: '#ff6b6b' }}>新纪录！</div>
            )}
            <div style={{ color: '#888', fontSize: 14 }}>最高分：{highScore}</div>

            {endlessTop5 && endlessTop5.length > 0 && (
              <div className="endless-top5">
                <h4>排行榜 Top5</h4>
                <div className="top5-list">
                  {endlessTop5.map((entry, i) => (
                    <div key={i} className={`top5-row ${i === 0 ? 'first' : ''}`}>
                      <span className="rank">#{i + 1}</span>
                      <span className="wave">波次 {entry.wave}</span>
                      <span className="score">{entry.score}分</span>
                      <span className="date">{entry.date}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : isBattle && ranking ? (
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
