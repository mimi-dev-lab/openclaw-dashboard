#!/usr/bin/env python3
"""更新 Claude 用量数据到 Dashboard"""

import sys
import json
import subprocess
from datetime import datetime, timezone
from zoneinfo import ZoneInfo
from pathlib import Path

def get_token():
    """从 Keychain 获取 OAuth token"""
    try:
        result = subprocess.run(
            ['security', 'find-generic-password', '-s', 'Claude Code-credentials', '-w'],
            capture_output=True, text=True
        )
        if result.returncode != 0:
            return None
        creds = json.loads(result.stdout)
        return creds.get('claudeAiOauth', {}).get('accessToken')
    except:
        return None

def fetch_usage(token):
    """从 API 获取用量数据"""
    import urllib.request
    req = urllib.request.Request(
        'https://api.anthropic.com/api/oauth/usage',
        headers={
            'Authorization': f'Bearer {token}',
            'anthropic-beta': 'oauth-2025-04-20'
        }
    )
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            return json.loads(resp.read())
    except:
        return None

def main():
    out_dir = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(__file__).parent.parent / 'out'
    out_file = out_dir / 'claude-usage.json'
    
    token = get_token()
    if not token:
        out_file.write_text(json.dumps({'error': 'no_token'}))
        return 1
    
    data = fetch_usage(token)
    if not data or 'error' in data:
        out_file.write_text(json.dumps({'error': 'api_error'}))
        return 1
    
    now = datetime.now(timezone.utc)
    jst = ZoneInfo('Asia/Tokyo')
    weekdays = ['周一', '周二', '周三', '周四', '周五', '周六', '周日']
    
    # Session (5-hour)
    d = data.get('five_hour', {})
    session_util = d.get('utilization', 0)
    reset_str = d.get('resets_at', '')
    if reset_str:
        reset_dt = datetime.fromisoformat(reset_str.replace('Z', '+00:00'))
        diff = reset_dt - now
        total_secs = int(diff.total_seconds())
        hours = max(0, total_secs // 3600)
        mins = max(0, (total_secs % 3600) // 60)
        session_in = f'{hours}h {mins}m' if hours > 0 else f'{mins}m'
    else:
        session_in = 'unknown'
    
    # Weekly (7-day)
    d = data.get('seven_day', {})
    weekly_util = d.get('utilization', 0)
    reset_str = d.get('resets_at', '')
    if reset_str:
        reset_dt = datetime.fromisoformat(reset_str.replace('Z', '+00:00'))
        reset_jst = reset_dt.astimezone(jst)
        weekday = weekdays[reset_jst.weekday()]
        weekly_in = f'{weekday} {reset_jst.strftime("%H:%M")}'
    else:
        weekly_in = 'unknown'
    
    result = {
        'session': {'utilization': session_util, 'resets_in': session_in},
        'weekly': {'utilization': weekly_util, 'resets_in': weekly_in},
        'cached_at': now.strftime('%Y-%m-%dT%H:%M:%SZ')
    }
    
    out_file.write_text(json.dumps(result, indent=2, ensure_ascii=False))
    return 0

if __name__ == '__main__':
    sys.exit(main())
