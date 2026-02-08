#!/bin/bash
# 更新 Claude 用量数据到 Dashboard

OUT_DIR="${1:-$(dirname "$0")/../out}"

TOKEN=$(security find-generic-password -s "Claude Code-credentials" -w 2>/dev/null | grep -o '"accessToken":"[^"]*"' | sed 's/"accessToken":"//;s/"//')

if [ -z "$TOKEN" ]; then
  echo '{"error": "no_token"}' > "$OUT_DIR/claude-usage.json"
  exit 1
fi

curl -s https://api.anthropic.com/api/oauth/usage \
  -H "Authorization: Bearer $TOKEN" \
  -H "anthropic-beta: oauth-2025-04-20" 2>/dev/null | python3 << 'PYTHON_SCRIPT' > "$OUT_DIR/claude-usage.json"
import sys, json
from datetime import datetime, timezone
from zoneinfo import ZoneInfo

try:
    data = json.loads(sys.stdin.read())
except:
    print(json.dumps({'error': 'api_error'}))
    sys.exit(1)

if 'error' in data:
    print(json.dumps({'error': data['error'].get('message', 'unknown')}))
    sys.exit(1)

now = datetime.now(timezone.utc)
jst = ZoneInfo('Asia/Tokyo')
weekdays = ['周一', '周二', '周三', '周四', '周五', '周六', '周日']

def parse_session(key):
    d = data.get(key, {})
    util = d.get('utilization', 0)
    reset_str = d.get('resets_at', '')
    if reset_str:
        reset_dt = datetime.fromisoformat(reset_str.replace('Z', '+00:00'))
        diff = reset_dt - now
        total_secs = int(diff.total_seconds())
        if total_secs < 0:
            return util, '已重置', reset_str
        hours = total_secs // 3600
        mins = (total_secs % 3600) // 60
        if hours > 0:
            resets_in = str(hours) + 'h ' + str(mins) + 'm'
        else:
            resets_in = str(mins) + 'm'
        return util, resets_in, reset_str
    return util, 'unknown', ''

def parse_weekly(key):
    d = data.get(key, {})
    util = d.get('utilization', 0)
    reset_str = d.get('resets_at', '')
    if reset_str:
        reset_dt = datetime.fromisoformat(reset_str.replace('Z', '+00:00'))
        reset_jst = reset_dt.astimezone(jst)
        weekday = weekdays[reset_jst.weekday()]
        time_str = reset_jst.strftime('%H:%M')
        resets_in = weekday + ' ' + time_str
        return util, resets_in, reset_str
    return util, 'unknown', ''

session_util, session_in, session_at = parse_session('five_hour')
weekly_util, weekly_in, weekly_at = parse_weekly('seven_day')

result = {
    'session': {'utilization': session_util, 'resets_in': session_in, 'resets_at': session_at},
    'weekly': {'utilization': weekly_util, 'resets_in': weekly_in, 'resets_at': weekly_at},
    'cached_at': now.strftime('%Y-%m-%dT%H:%M:%SZ')
}
print(json.dumps(result, indent=2))
PYTHON_SCRIPT
