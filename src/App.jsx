import React, { useState } from 'react';
import { GameCanvas } from './components/GameCanvas';
import { ModeSelect } from './components/ModeSelect';
import { SkinPicker } from './components/SkinPicker';
import { useStorage } from './hooks/useStorage';

function App() {
  const [mode, setMode] = useState(null);
  const [skin, setSkin] = useStorage('snake-classic-skin', 'classic');

  return (
    <div className="app">
      <h1 className="title">贪吃蛇大作战</h1>
      <SkinPicker skin={skin} setSkin={setSkin} />
      {!mode ? (
        <ModeSelect onSelect={setMode} />
      ) : (
        <GameCanvas mode={mode} skin={skin} onBack={() => setMode(null)} />
      )}
    </div>
  );
}

export default App;
