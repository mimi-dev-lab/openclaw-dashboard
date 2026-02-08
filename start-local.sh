#!/bin/bash
# OpenClaw Dashboard 本地启动脚本
# 自动读取 Gateway 配置，无需手动输入 token

set -e

# 读取 Gateway 配置
CONFIG_FILE="${HOME}/.openclaw/openclaw.json"

if [ ! -f "$CONFIG_FILE" ]; then
  echo "❌ 找不到 OpenClaw 配置文件: $CONFIG_FILE"
  exit 1
fi

# 提取 token 和端口
GATEWAY_TOKEN=$(grep -o '"token": "[^"]*"' "$CONFIG_FILE" | tail -1 | cut -d'"' -f4)
GATEWAY_PORT=$(grep -o '"port": [0-9]*' "$CONFIG_FILE" | head -1 | grep -o '[0-9]*')
GATEWAY_PORT=${GATEWAY_PORT:-18789}

if [ -z "$GATEWAY_TOKEN" ]; then
  echo "❌ 无法从配置中读取 Gateway token"
  exit 1
fi

# 获取本机 IP（优先 Tailscale）
if command -v tailscale &> /dev/null && tailscale status &> /dev/null; then
  TAILSCALE_IP=$(tailscale ip -4 2>/dev/null)
else
  TAILSCALE_IP=""
fi

if [ -n "$TAILSCALE_IP" ]; then
  GATEWAY_HOST="$TAILSCALE_IP"
  REMOTE_URL="http://${TAILSCALE_IP}:3210"
else
  GATEWAY_HOST="127.0.0.1"
  REMOTE_URL="(Tailscale 未运行)"
fi

GATEWAY_URL="http://${GATEWAY_HOST}:${GATEWAY_PORT}"
DASHBOARD_PORT=3210

echo "🦞 OpenClaw Dashboard"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Gateway: $GATEWAY_URL"
echo "Dashboard: http://localhost:$DASHBOARD_PORT"
echo ""
echo "远程访问: $REMOTE_URL"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# 生成配置文件
cat > out/config.json << EOF
{
  "gatewayUrl": "$GATEWAY_URL",
  "gatewayToken": "$GATEWAY_TOKEN"
}
EOF

# 更新 Claude 用量数据
USAGE_SCRIPT="$(dirname "$0")/scripts/update-usage.py"
if [ -x "$USAGE_SCRIPT" ]; then
  echo "📊 更新 Claude 用量数据..."
  python3 "$USAGE_SCRIPT" "$(dirname "$0")/out"
  
  # 后台定时更新（每5分钟）
  (
    while true; do
      sleep 300
      python3 "$USAGE_SCRIPT" "$(dirname "$0")/out" 2>/dev/null
    done
  ) &
  UPDATER_PID=$!
  trap "kill $UPDATER_PID 2>/dev/null" EXIT
fi

# 启动静态服务器
cd "$(dirname "$0")/out"
echo ""
echo "✨ 启动中..."
npx serve -l $DASHBOARD_PORT
