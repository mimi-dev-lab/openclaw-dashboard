'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useGatewayStore } from '@/stores/gateway';
import { Users, Bot, MessageSquare } from 'lucide-react';

function getAgentIcon(id: string): string {
  if (id.includes('main') || id.includes('claude')) return '🐱';
  if (id.includes('haiku')) return '🎋';
  if (id.includes('sonnet')) return '📝';
  if (id.includes('gemini')) return '💎';
  return '🤖';
}

function getStatusColor(status: string): string {
  switch (status) {
    case 'active': return 'bg-green-500';
    case 'idle': return 'bg-yellow-500';
    default: return 'bg-gray-400';
  }
}

function formatLastActive(lastActive?: string): string {
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

export function AgentOrgChart() {
  const { agents, sessions } = useGatewayStore();

  const totalSessions = sessions.length;
  const activeAgents = agents.filter(a => a.status === 'active').length;
  const idleAgents = agents.filter(a => a.status === 'idle').length;

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Users className="w-5 h-5" />
            Agent 组织架构
          </CardTitle>
          <Badge variant="outline">全部状态</Badge>
        </div>
      </CardHeader>
      <CardContent>
        {/* Stats Row */}
        <div className="grid grid-cols-4 gap-2 mb-4">
          <div className="text-center p-2 rounded bg-blue-500/10">
            <div className="text-2xl font-bold text-blue-600">{agents.length}</div>
            <div className="text-xs text-muted-foreground">Agent 总数</div>
          </div>
          <div className="text-center p-2 rounded bg-green-500/10">
            <div className="text-2xl font-bold text-green-600">{activeAgents}</div>
            <div className="text-xs text-muted-foreground">活跃中</div>
          </div>
          <div className="text-center p-2 rounded bg-yellow-500/10">
            <div className="text-2xl font-bold text-yellow-600">{idleAgents}</div>
            <div className="text-xs text-muted-foreground">空闲</div>
          </div>
          <div className="text-center p-2 rounded bg-purple-500/10">
            <div className="text-2xl font-bold text-purple-600">{totalSessions}</div>
            <div className="text-xs text-muted-foreground">总会话数</div>
          </div>
        </div>

        {/* Agent List */}
        <div className="space-y-2">
          {agents.map((agent) => (
            <div
              key={agent.id}
              className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
            >
              <div className="relative">
                <Avatar className="w-10 h-10">
                  <AvatarFallback className="text-lg">
                    {getAgentIcon(agent.id)}
                  </AvatarFallback>
                </Avatar>
                <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-background ${getStatusColor(agent.status)}`} />
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium truncate">{agent.name || agent.id}</span>
                  <Badge variant="secondary" className="text-xs">
                    {agent.role || 'agent'}
                  </Badge>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Bot className="w-3 h-3" />
                  <span className="truncate">{agent.model || '-'}</span>
                </div>
              </div>

              <div className="text-right">
                <div className="flex items-center gap-1 text-sm">
                  <MessageSquare className="w-3 h-3" />
                  <span>{agent.sessions}</span>
                </div>
                <div className="text-xs text-muted-foreground">
                  {formatLastActive(agent.lastActive)}
                </div>
              </div>
            </div>
          ))}

          {agents.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              暂无 Agent 数据
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
