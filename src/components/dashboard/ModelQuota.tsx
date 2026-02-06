'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Brain, Zap } from 'lucide-react';
import { useMemo } from 'react';
import { useGatewayStore } from '@/stores/gateway';

interface ModelUsage {
  model: string;
  provider: string;
  totalTokens: number;
  requests: number;
}

function formatTokens(value: number): string {
  if (value >= 1000000) return `${(value / 1000000).toFixed(2)}M`;
  if (value >= 1000) return `${(value / 1000).toFixed(1)}k`;
  return value.toString();
}

function getModelIcon(model: string): string {
  const lower = model.toLowerCase();
  if (lower.includes('opus')) return '🎭';
  if (lower.includes('sonnet')) return '📝';
  if (lower.includes('haiku')) return '🎋';
  if (lower.includes('gemini')) return '💎';
  if (lower.includes('gpt')) return '🤖';
  return '🧠';
}

function getProviderColor(provider: string): string {
  switch (provider.toLowerCase()) {
    case 'anthropic': return 'bg-orange-500';
    case 'google': return 'bg-blue-500';
    case 'openai': return 'bg-green-500';
    default: return 'bg-gray-500';
  }
}

export function ModelQuota() {
  const { connected, sessions } = useGatewayStore();

  // Calculate usage from sessions using useMemo
  const { modelUsage, totalTokens, totalRequests } = useMemo(() => {
    const usageMap = new Map<string, ModelUsage>();
    
    sessions.forEach(session => {
      const model = session.model;
      const provider = model.split('/')[0] || 'unknown';
      const modelName = model.split('/').pop() || model;
      
      if (!usageMap.has(model)) {
        usageMap.set(model, {
          model: modelName,
          provider,
          totalTokens: 0,
          requests: 0
        });
      }
      
      const usage = usageMap.get(model)!;
      usage.totalTokens += session.tokens.used;
      usage.requests += 1;
    });
    
    const usageList = Array.from(usageMap.values())
      .sort((a, b) => b.totalTokens - a.totalTokens);
    
    return {
      modelUsage: usageList,
      totalTokens: usageList.reduce((sum, m) => sum + m.totalTokens, 0),
      totalRequests: usageList.reduce((sum, m) => sum + m.requests, 0)
    };
  }, [sessions]);

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Brain className="w-5 h-5" />
            模型使用统计
          </CardTitle>
          <Badge variant="outline" className="gap-1">
            <Zap className="w-3 h-3" />
            {formatTokens(totalTokens)} tokens
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        {/* Summary Stats */}
        <div className="grid grid-cols-3 gap-2 mb-4">
          <div className="text-center p-2 rounded bg-muted/50">
            <div className="text-lg font-bold">{modelUsage.length}</div>
            <div className="text-xs text-muted-foreground">模型</div>
          </div>
          <div className="text-center p-2 rounded bg-muted/50">
            <div className="text-lg font-bold">{formatTokens(totalTokens)}</div>
            <div className="text-xs text-muted-foreground">总 Tokens</div>
          </div>
          <div className="text-center p-2 rounded bg-muted/50">
            <div className="text-lg font-bold">{totalRequests}</div>
            <div className="text-xs text-muted-foreground">会话数</div>
          </div>
        </div>

        {/* Model List */}
        <div className="space-y-3">
          {modelUsage.map((usage) => {
            const percentage = totalTokens > 0 
              ? Math.round((usage.totalTokens / totalTokens) * 100) 
              : 0;
            
            return (
              <div key={usage.model} className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{getModelIcon(usage.model)}</span>
                    <div>
                      <div className="font-medium text-sm">{usage.model}</div>
                      <div className="flex items-center gap-1">
                        <div className={`w-2 h-2 rounded-full ${getProviderColor(usage.provider)}`} />
                        <span className="text-xs text-muted-foreground">
                          {usage.provider}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-medium">
                      {formatTokens(usage.totalTokens)}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {usage.requests} 会话
                    </div>
                  </div>
                </div>
                <Progress value={percentage} className="h-1.5" />
              </div>
            );
          })}

          {modelUsage.length === 0 && (
            <div className="text-center py-6 text-muted-foreground">
              {connected ? '暂无使用数据' : '未连接'}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
