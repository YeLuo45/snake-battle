export const SKINS = {
  classic: {
    name: 'Classic',
    background: '#1a1a1a',
    gridColor: '#2a2a2a',
    snakeColor: '#76c442',
    snakeBorderColor: '#5a9a2e',
    foodColor: '#ff6b6b',
    textColor: '#76c442',
    buttonBg: '#76c442',
    buttonHover: '#5a9a2e',
  },
  neon: {
    name: 'Neon',
    background: '#0a0a0f',
    gridColor: '#1a1a2e',
    snakeColor: '#39ff14',
    snakeBorderColor: '#2adf0e',
    foodColor: '#ff2e63',
    textColor: '#39ff14',
    buttonBg: '#39ff14',
    buttonHover: '#2adf0e',
  },
  candy: {
    name: 'Candy',
    background: '#1a0a1a',
    gridColor: '#2a1a2a',
    snakeColor: '#ff69b4',
    snakeBorderColor: '#e055a0',
    foodColor: '#ff8c00',
    textColor: '#ff69b4',
    buttonBg: '#ff69b4',
    buttonHover: '#e055a0',
  },
};

export const getSkin = (skinName) => SKINS[skinName] || SKINS.classic;
