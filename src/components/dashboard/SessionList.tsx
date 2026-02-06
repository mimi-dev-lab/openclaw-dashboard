'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useGatewayStore } from '@/stores/gateway';
import { MessageSquare, Clock } from 'lucide-react';

function formatLastActive(lastActive: string): string {
  if (!lastActive) return '-';
  const date = new Date(lastActive);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  
  if (minutes < 1) return '刚刚';
  if (minutes < 60) return `${minutes}分钟前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}小时前`;
  return `${Math.floor(hours / 24)}天前`;
}

function getSessionName(key: string): string {
  // Extract meaningful name from session key
  // e.g., "agent:claude-main:discord:channel:1234" -> "discord:channel"
  const parts = key.split(':');
  if (parts.length >= 4) {
    return parts.slice(2, 4).join(':');
  }
  return key.split(':').pop() || key;
}

function getTokenColor(percent: number): string {
  if (percent >= 80) return 'bg-red-500';
  if (percent >= 60) return 'bg-yellow-500';
  return 'bg-green-500';
}

export function SessionList() {
  const { sessions } = useGatewayStore();

  // Sort by last active, most recent first
  const sortedSessions = [...sessions].sort((a, b) => {
    if (!a.lastActive) return 1;
    if (!b.lastActive) return -1;
    return new Date(b.lastActive).getTime() - new Date(a.lastActive).getTime();
  });

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <MessageSquare className="w-5 h-5" />
            活跃会话
          </CardTitle>
          <Badge variant="secondary">{sessions.length} 个</Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2 max-h-[400px] overflow-y-auto">
          {sortedSessions.slice(0, 10).map((session) => (
            <div
              key={session.key}
              className="p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Badge variant={session.kind === 'group' ? 'default' : 'outline'} className="text-xs">
                    {session.kind === 'group' ? '群组' : '私聊'}
                  </Badge>
                  <span className="font-medium text-sm truncate max-w-[150px]">
                    {getSessionName(session.key)}
                  </span>
                </div>
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Clock className="w-3 h-3" />
                  {formatLastActive(session.lastActive)}
                </div>
              </div>

              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs text-muted-foreground truncate flex-1">
                  {session.model}
                </span>
                <span className="text-xs">
                  {(session.tokens.used / 1000).toFixed(1)}k / {(session.tokens.limit / 1000).toFixed(0)}k
                </span>
              </div>

              <Progress 
                value={session.tokens.percent} 
                className="h-1.5"
              />
              <div className="text-right text-xs text-muted-foreground mt-1">
                {session.tokens.percent}% 已使用
              </div>
            </div>
          ))}

          {sessions.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              暂无活跃会话
            </div>
          )}

          {sessions.length > 10 && (
            <div className="text-center text-sm text-muted-foreground pt-2">
              还有 {sessions.length - 10} 个会话...
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
