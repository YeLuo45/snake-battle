# Proposal Request Intake

## Basic Information

| Field | Value |
|-------|-------|
| Proposal ID | `P-20260419-002` |
| Title | 贪吃蛇大作战（Web + PWA） |
| Requester | boss |
| Coordinator | 小墨 |
| Date | 2026-04-19 |
| Status | `clarifying` |

## Original Request

> 开发一款web、pwa版的贪吃蛇大作战（技术栈参考game1024）

## Clarification

### Round 1

**Q1**: 玩法模式？
**A**: 经典单蛇吃食物长身体 + AI多人对战

**Q2**: PWA功能？
**A**: 需要离线缓存、添加到主屏幕等 PWA 能力

**Q3**: 存档和皮肤系统？
**A**: 需要存档系统和皮肤系统

## Final Assumptions

- **玩法**：经典贪吃蛇（吃食物长身体）+ AI多人对战模式（多蛇同屏，AI互相吞食）
- **技术栈**：React 18 + Vite 5 + vite-plugin-pwa（同 game-1024）
- **渲染**：Canvas 2D
- **PWA**：离线缓存 + 添加到主屏幕
- **系统**：存档系统（localStorage）+ 皮肤系统
- **单局时长**：经典模式不限时，AI对战模式单局3分钟

## Related Proposals

- 参考项目：`game-1024`（React 18 + Vite 5 + vite-plugin-pwa）
- 今日提案 `P-20260419-001`（坦克大作战）保持不变