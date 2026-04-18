# 贪吃蛇大作战

Web + PWA 版贪吃蛇游戏，支持经典模式和 AI 对战。

## 功能特性

- **经典模式**：单蛇吃食物长身体，撞墙/自撞判定结束
- **AI 对战**：1 玩家蛇 + 3 AI 蛇同屏，3 分钟倒计时，按分数排名
- **PWA 支持**：离线缓存，可添加到主屏幕
- **皮肤系统**：Classic / Neon / Candy 三套皮肤
- **存档系统**：经典模式自动保存最高分和当前进度
- **响应式**：适配手机和桌面，触屏 + 键盘双控制

## 技术栈

- React 18 + Vite 5
- vite-plugin-pwa
- Canvas 2D 渲染

## 目录结构

```
src/
├── main.jsx
├── App.jsx / App.css
├── components/
│   ├── GameCanvas.jsx   # 核心游戏 Canvas
│   ├── ModeSelect.jsx   # 模式选择
│   ├── SkinPicker.jsx   # 皮肤选择
│   ├── Controls.jsx     # 方向控制（触屏）
│   └── GameOver.jsx     # 结算弹窗
├── hooks/
│   ├── useGameLoop.js   # requestAnimationFrame 循环
│   ├── useSnake.js      # 蛇状态管理
│   ├── useFood.js       # 食物生成
│   ├── useAI.js         # AI 决策
│   └── useStorage.js    # localStorage 存档
└── utils/
    ├── constants.js     # 网格/速度常量
    ├── skins.js         # 皮肤配置
    └── collision.js     # 碰撞检测
```

## 本地运行

```bash
npm install
npm run dev
```

## 构建部署

```bash
npm run build
```

构建产物在 `dist/`，推送到 GitHub Pages 的 `gh-pages` 分支即可部署。

## 访问地址

https://yeluo45.github.io/snake-battle/