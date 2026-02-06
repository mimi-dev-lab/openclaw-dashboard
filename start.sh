#!/bin/bash
# OpenClaw Dashboard 快速启动脚本

cd "$(dirname "$0")"

# 获取 Gateway token
TOKEN=$(openclaw gateway call status --params '{}' 2>/dev/null | head -1)
if [ -z "$TOKEN" ]; then
    echo "⚠️  无法连接到 Gateway，请确保 openclaw gateway 正在运行"
    exit 1
fi

# 从 openclaw dashboard 获取完整 token URL
DASHBOARD_URL=$(openclaw dashboard 2>&1 | grep -o 'http://[^?]*?token=[^[:space:]]*' | head -1)
TOKEN_PARAM=$(echo "$DASHBOARD_URL" | grep -o 'token=[^&]*' | cut -d= -f2)

echo "🦞 OpenClaw Dashboard"
echo "===================="
echo ""

# 启动开发服务器
echo "📦 启动开发服务器..."
pnpm dev &
DEV_PID=$!

# 等待服务器启动
sleep 3

# 打开浏览器
if [ -n "$TOKEN_PARAM" ]; then
    URL="http://localhost:3000?token=$TOKEN_PARAM"
    echo "🌐 打开浏览器: $URL"
    open "$URL" 2>/dev/null || xdg-open "$URL" 2>/dev/null || echo "请手动打开: $URL"
else
    echo "🌐 请手动打开: http://localhost:3000"
    echo "   然后输入 Gateway Token 连接"
fi

echo ""
echo "按 Ctrl+C 停止服务器"

# 等待进程
wait $DEV_PID
