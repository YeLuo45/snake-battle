import React, { useState } from 'react';
import { GameCanvas } from './components/GameCanvas';
import { ModeSelect } from './components/ModeSelect';
import { SkinPicker } from './components/SkinPicker';

function App() {
  const [mode, setMode] = useState(null); // null | 'classic' | 'battle'
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

function useStorage(key, initialValue) {
  const [storedValue, setStoredValue] = useState(() => {
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch {
      return initialValue;
    }
  });

  const setValue = (value) => {
    try {
      const valueToStore = value instanceof Function ? value(storedValue) : value;
      setStoredValue(valueToStore);
      window.localStorage.setItem(key, JSON.stringify(valueToStore));
    } catch {}
  };

  return [storedValue, setValue];
}

export default App;
