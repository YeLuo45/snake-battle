import React, { useState } from 'react';
import { GameCanvas } from './components/GameCanvas';
import { ModeSelect } from './components/ModeSelect';
import { SkinPicker } from './components/SkinPicker';
import { useStorage } from './hooks/useStorage';
import { AI_PERSONALITIES } from './hooks/useAI';

function App() {
  const [mode, setMode] = useState(null);
  const [mapType, setMapType] = useState('classic_map');
  const [skin, setSkin] = useStorage('snake-classic-skin', 'classic');
  const [aiPersonality, setAiPersonality] = useState(AI_PERSONALITIES.GREEDY);

  return (
    <div className="app">
      <h1 className="title">贪吃蛇大作战</h1>
      <SkinPicker skin={skin} setSkin={setSkin} />
      {!mode ? (
        <ModeSelect
          onSelect={setMode}
          onMapSelect={setMapType}
          currentMap={mapType}
          onAIPersonalitySelect={setAiPersonality}
          currentAIPersonality={aiPersonality}
        />
      ) : (
        <GameCanvas
          mode={mode}
          mapType={mapType}
          skin={skin}
          aiPersonality={aiPersonality}
          onBack={() => setMode(null)}
        />
      )}
    </div>
  );
}

export default App;
