'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { useGatewayStore } from '@/stores/gateway';
import { getGateway } from '@/lib/websocket';
import { 
  MessageSquare, 
  Clock, 
  ChevronDown, 
  ChevronUp, 
  RefreshCw,
  Trash2,
  AlertTriangle
} from 'lucide-react';
import { useState } from 'react';

interface Session {
  key: string;
  kind: 'direct' | 'group';
  model: string;
  tokens: {
    used: number;
    limit: number;
    percent: number;
  };
  lastActive: string;
  agentId: string;
}

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
  const parts = key.split(':');
  if (parts.length >= 4) {
    // agent:xxx:discord:channel:123 -> discord:channel
    const channelParts = parts.slice(2, 4);
    if (channelParts[0] === 'discord' && channelParts[1] === 'channel') {
      return `Discord #${parts[4]?.slice(-6) || 'unknown'}`;
    }
    if (channelParts[0] === 'telegram') {
      return `Telegram ${parts[3]?.slice(-6) || 'chat'}`;
    }
    if (channelParts[0] === 'cron') {
      return `Cron ${parts[3]?.slice(0, 8) || 'job'}`;
    }
    return channelParts.join(':');
  }
  return key.split(':').pop() || key;
}

function getTokenColor(percent: number): string {
  if (percent >= 80) return 'text-red-500';
  if (percent >= 60) return 'text-yellow-500';
  return 'text-green-500';
}

function SessionCard({ 
  session, 
  expanded, 
  onToggle,
  onReset 
}: { 
  session: Session; 
  expanded: boolean;
  onToggle: () => void;
  onReset: () => void;
}) {
  const isHighUsage = session.tokens.percent >= 70;
  
  return (
    <div
      className={`rounded-lg border bg-card transition-all ${
        isHighUsage ? 'border-yellow-500/50' : ''
      }`}
    >
      {/* Header - Always Visible */}
      <div 
        className="p-3 cursor-pointer hover:bg-accent/50 transition-colors"
        onClick={onToggle}
      >
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Badge variant={session.kind === 'group' ? 'default' : 'outline'} className="text-xs">
              {session.kind === 'group' ? '群组' : '私聊'}
            </Badge>
            <span className="font-medium text-sm truncate max-w-[150px]">
              {getSessionName(session.key)}
            </span>
            {isHighUsage && (
              <AlertTriangle className="w-4 h-4 text-yellow-500" />
            )}
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Clock className="w-3 h-3" />
              {formatLastActive(session.lastActive)}
            </div>
            {expanded ? (
              <ChevronUp className="w-4 h-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="w-4 h-4 text-muted-foreground" />
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs text-muted-foreground truncate flex-1">
            {session.model}
          </span>
          <span className={`text-xs font-medium ${getTokenColor(session.tokens.percent)}`}>
            {(session.tokens.used / 1000).toFixed(1)}k / {(session.tokens.limit / 1000).toFixed(0)}k
          </span>
        </div>

        <Progress 
          value={session.tokens.percent} 
          className="h-1.5"
        />
      </div>

      {/* Expanded Details */}
      {expanded && (
        <div className="px-3 pb-3 pt-1 border-t bg-muted/30">
          <div className="grid grid-cols-2 gap-2 text-xs mb-3">
            <div>
              <span className="text-muted-foreground">Agent: </span>
              <span>{session.agentId}</span>
            </div>
            <div>
              <span className="text-muted-foreground">使用率: </span>
              <span className={getTokenColor(session.tokens.percent)}>
                {session.tokens.percent}%
              </span>
            </div>
            <div className="col-span-2">
              <span className="text-muted-foreground">Session Key: </span>
              <span className="font-mono text-xs break-all">{session.key}</span>
            </div>
          </div>
          
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                onReset();
              }}
              className="flex-1"
            >
              <Trash2 className="w-3 h-3 mr-1" />
              Reset Session
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export function SessionList() {
  const { sessions, connected, refresh } = useGatewayStore();
  const [expandedSession, setExpandedSession] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Sort by last active, most recent first
  const sortedSessions = [...sessions].sort((a, b) => {
    if (!a.lastActive) return 1;
    if (!b.lastActive) return -1;
    return new Date(b.lastActive).getTime() - new Date(a.lastActive).getTime();
  });

  // Count high usage sessions
  const highUsageCount = sessions.filter(s => s.tokens.percent >= 70).length;

  const handleReset = async (sessionKey: string) => {
    if (!connected) return;
    
    setLoading(true);
    try {
      const gateway = getGateway();
      await gateway.call('sessions.reset', { key: sessionKey });
      // Refresh after reset
      setTimeout(() => refresh(), 500);
    } catch (err) {
      console.error('Failed to reset session:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <MessageSquare className="w-5 h-5" />
            活跃会话
          </CardTitle>
          <div className="flex items-center gap-2">
            {highUsageCount > 0 && (
              <Badge variant="outline" className="text-yellow-500 border-yellow-500">
                {highUsageCount} 高使用
              </Badge>
            )}
            <Badge variant="secondary">{sessions.length} 个</Badge>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => refresh()}
              disabled={loading}
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2 max-h-[400px] overflow-y-auto">
          {sortedSessions.slice(0, 15).map((session) => (
            <SessionCard
              key={session.key}
              session={session}
              expanded={expandedSession === session.key}
              onToggle={() => setExpandedSession(
                expandedSession === session.key ? null : session.key
              )}
              onReset={() => handleReset(session.key)}
            />
          ))}

          {sessions.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              暂无活跃会话
            </div>
          )}

          {sessions.length > 15 && (
            <div className="text-center text-sm text-muted-foreground pt-2">
              还有 {sessions.length - 15} 个会话...
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
