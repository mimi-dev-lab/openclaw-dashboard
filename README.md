# 🦞 OpenClaw 作战指挥中心

OpenClaw AI Agent 监控仪表盘 - 实时查看 Gateway 状态、Agent、会话、通道健康度。

**🌐 在线访问**: https://openclaw.mimi-bot.com

## 功能特性

- 📊 **系统概览** - Gateway 状态、CPU、内存、运行时间
- 👥 **Agent 组织架构** - Agent 列表、在线状态、会话统计
- 📡 **通道状态** - Telegram/Discord/WhatsApp 等多通道监控
- 💚 **健康度监控** - 健康分数、问题列表、趋势图
- 💬 **活跃会话** - 实时会话列表、Token 使用率
- ⚡ **快捷操作** - 刷新、重启 Gateway 等

## 快速开始

```bash
# 安装依赖
pnpm install

# 启动开发服务器
pnpm dev

# 打开浏览器
open http://localhost:3000
```

## 连接 Gateway

### 方式 1：URL 参数（推荐）

```bash
# 获取 token
openclaw dashboard

# 浏览器打开（替换 YOUR_TOKEN）
open "http://localhost:3000?token=YOUR_TOKEN"
```

### 方式 2：手动输入

1. 打开 http://localhost:3000
2. 输入 Gateway URL: `ws://127.0.0.1:18789`
3. 输入 Token（运行 `openclaw dashboard` 获取）
4. 点击连接

## 技术栈

- **框架**: Next.js 14 (App Router)
- **UI**: shadcn/ui + Tailwind CSS
- **图表**: Recharts
- **状态**: Zustand
- **通信**: WebSocket (原生)

## 项目结构

```
src/
├── app/                    # Next.js App Router
├── components/
│   ├── dashboard/          # Dashboard 组件
│   │   ├── SystemOverview.tsx
│   │   ├── AgentOrgChart.tsx
│   │   ├── ChannelStatus.tsx
│   │   ├── HealthScore.tsx
│   │   ├── QuickActions.tsx
│   │   ├── SessionList.tsx
│   │   └── ConnectionPanel.tsx
│   └── ui/                 # shadcn 基础组件
├── lib/
│   ├── websocket.ts        # WebSocket 连接管理
│   ├── types.ts            # 类型定义
│   └── utils.ts            # 工具函数
└── stores/
    └── gateway.ts          # Zustand 状态管理
```

## 开发

```bash
# 开发模式
pnpm dev

# 构建生产版本
pnpm build

# 本地预览
pnpm start
```

## 部署

支持部署到 Cloudflare Pages：

```bash
# 构建
pnpm build

# 部署
wrangler pages deploy .next
```

---

Built with 🐱 by Mimi
