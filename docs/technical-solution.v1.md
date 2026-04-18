# 贪吃蛇大作战 — 技术方案 v1.0

## 1. 技术栈

| 层级 | 技术 | 版本 |
|------|------|------|
| 框架 | React | ^18.2.0 |
| 构建 | Vite | ^5.1.0 |
| PWA | vite-plugin-pwa | ^0.19.0 |
| 渲染 | Canvas 2D API | 原生 |
| 存档 | localStorage | 原生 |
| 图标 | React 组件（SVG内联） | - |

**与 game-1024 完全一致**，最大程度复用技能和构建流程。

---

## 2. 项目结构

```
src/
├── main.jsx                  # 入口
├── App.jsx                   # 根组件
├── App.css                   # 全局样式
├── components/
│   ├── GameCanvas.jsx        # Canvas 渲染层（核心）
│   ├── ModeSelect.jsx        # 模式选择（经典/AI对战）
│   ├── GameOver.jsx          # 结算弹窗
│   ├── ScoreBoard.jsx        # 实时分数/时长显示
│   ├── SkinPicker.jsx        # 皮肤选择器
│   ├── Controls.jsx          # 方向控制（触屏/键盘）
│   └── PauseModal.jsx        # 暂停弹窗
├── hooks/
│   ├── useGameLoop.js        # requestAnimationFrame 游戏循环
│   ├── useSnake.js           # 贪吃蛇状态管理（移动/生长/死亡）
│   ├── useFood.js            # 食物生成逻辑
│   ├── useAI.js              # AI蛇行为（路径规划/追逐/躲避）
│   └── useStorage.js         # localStorage 存档（复用 game-1024）
├── utils/
│   ├── skins.js              # 皮肤配置（classic/neon/candy）
│   ├── constants.js          # 网格大小、速度、颜色常量
│   └──碰撞检测.js             # 蛇身/墙壁/蛇体碰撞
```

---

## 3. 游戏引擎设计

### 3.1 坐标系

- 网格：20×20 格
- 每格像素：Canvas 宽度 / 20（响应式，适配不同屏幕）
- 蛇身：每节占 1 格
- 食物：占 1 格

### 3.2 游戏循环

```
requestAnimationFrame → 计算 deltaTime → 累加计时器 → 达间隔阈值 → 执行 tick()
```

- **经典模式**：每 150ms 一次 tick（速度恒定）
- **AI对战模式**：每 120ms 一次 tick（节奏更快）
- 暂停时停止 loop

### 3.3 经典模式

- 单蛇，初始长度 3，初始方向向右
- 键盘/触屏控制方向（朝当前方向的反方向移动无效）
- 吃食物 → 蛇尾 +1 格 → 分数 +10
- 撞墙或撞自己 → Game Over
- localStorage 存档：每次 tick 后自动保存（蛇身位置、分数、食物位置）

### 3.4 AI对战模式

- 1 条玩家蛇 + 3 条 AI 蛇（同屏）
- 单局 3 分钟，倒计时结束按分数排名
- AI 蛇撞墙/撞其他蛇身 → 该蛇死亡（消失，留下一堆食物）
- 蛇吃食物长身体，被撞到头部（正面）则死亡
- 玩家蛇死亡后可旁观剩余 AI 继续对战至本局结束
- 游戏结束 → 显示排名榜

### 3.5 AI 行为决策

每条 AI 蛇独立决策，优先级：

1. **生存第一**：若下一步会撞墙/撞蛇，优先换方向
2. **追逐食物**：计算到最近食物的最短路径（贪心，非A*，保证性能）
3. **躲避大型蛇**：若附近有比自己长的蛇头靠近，向反方向移动
4. **随机性**：10% 概率随机移动，增加趣味性

---

## 4. 皮肤系统

完全复用 game-1024 的 `skins.js` 架构：

| 皮肤 | 蛇身颜色 | 背景色 | 食物颜色 |
|------|---------|--------|---------|
| classic | 绿 #76c442 | 深绿 #1a1a1a | 红 #ff6b6b |
| neon | 荧光绿 #39ff14 | 黑 #0a0a0f | 粉 #ff2e63 |
| candy | 粉色 #ff69b4 | 浅粉 #fff0f5 | 橙 #ff8c00 |

每种皮肤影响：蛇身、食物、背景、网格线、分数文字颜色。

---

## 5. PWA 配置

复用 game-1024 的 `vite.config.js`：

- `registerType: 'autoUpdate'`
- 离线缓存：所有静态资源（js/css/html/图片/woff2）
- Google Fonts 缓存（CacheFirst，1年）
- Web App Manifest：name/shor_name/display: standalone/icons
- 图标生成：256×256 + 512×512 PNG（SVG 转 PNG 内联到 public/icons/）

---

## 6. 存档系统

| Key | 内容 |
|-----|------|
| `snake-classic-skin` | 当前皮肤名 |
| `snake-classic-highscore` | 经典模式最高分 |
| `snake-classic-state` | 经典模式当前进度（蛇身/食物/分数/方向） |
| `snake-battle-highscore` | AI对战模式最高分 |

- 存档时机：每次 tick 后自动保存
- AI对战模式不存档（每局独立）

---

## 7. 响应式 / 触屏适配

- Canvas 宽高 = `min(window.innerWidth, window.innerHeight) * 0.9`
- 触屏方向键：Canvas 正下方，6 个按钮（↑↓←→ + 暂停 + 加速）
- 键盘：方向键 / WASD / 空格（暂停）
- 竖屏横屏均可，Canvas 自动适应

---

## 8. 构建与部署

- 构建命令：`npm run build`
- 部署：GitHub Pages（`/snake-battle/` 子路径）
- base path：`/snake-battle/`
- 复用 game-1024 的 gh-pages 部署策略（本地 build → 推 dist 到 gh-pages 分支）

---

## 9. 验收标准

- [ ] 经典模式：吃食物长身体、撞墙/自撞判定死亡、分数显示、Game Over 弹窗
- [ ] AI对战模式：3条AI蛇实时移动、死亡后留食物、3分钟倒计时、排名结算
- [ ] PWA：离线可玩（关闭网络刷新页面）、可添加到主屏幕
- [ ] 皮肤切换：3套皮肤实时生效，切换不中断游戏
- [ ] 存档：刷新页面后经典模式进度恢复
- [ ] 触屏：方向键可正常控制蛇移动
- [ ] 构建：`npm run build` 成功，dist 非空