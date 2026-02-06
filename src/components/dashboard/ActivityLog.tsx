'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollText, MessageSquare, Zap, AlertCircle, CheckCircle } from 'lucide-react';
import { useEffect, useState } from 'react';
import { getGateway } from '@/lib/websocket';
import { useGatewayStore } from '@/stores/gateway';

interface ActivityItem {
  id: string;
  type: 'message' | 'task' | 'error' | 'success';
  title: string;
  detail?: string;
  timestamp: Date;
}

export function ActivityLog() {
  const { connected } = useGatewayStore();
  const [activities, setActivities] = useState<ActivityItem[]>([]);

  useEffect(() => {
    if (!connected) return;

    try {
      const gateway = getGateway();
      
      const unsubscribe = gateway.onMessage((message) => {
        // Handle different message types
        if (typeof message === 'object' && message !== null) {
          const msg = message as Record<string, unknown>;
          
          let activity: ActivityItem | null = null;
          
          if (msg.type === 'chat' || msg.method === 'chat.send') {
            activity = {
              id: `msg-${Date.now()}`,
              type: 'message',
              title: '新消息',
              detail: typeof msg.text === 'string' ? msg.text.slice(0, 50) : undefined,
              timestamp: new Date(),
            };
          } else if (msg.type === 'error' || msg.error) {
            activity = {
              id: `err-${Date.now()}`,
              type: 'error',
              title: '错误',
              detail: typeof msg.error === 'object' && msg.error !== null 
                ? (msg.error as Record<string, unknown>).message as string 
                : String(msg.error || '未知错误'),
              timestamp: new Date(),
            };
          } else if (msg.type === 'tool' || msg.method?.toString().startsWith('tool.')) {
            activity = {
              id: `task-${Date.now()}`,
              type: 'task',
              title: '工具调用',
              detail: msg.tool as string || msg.method as string,
              timestamp: new Date(),
            };
          }
          
          if (activity) {
            setActivities(prev => [activity!, ...prev].slice(0, 20));
          }
        }
      });

      return () => unsubscribe();
    } catch {
      // Gateway not initialized yet
    }
  }, [connected]);

  const getIcon = (type: ActivityItem['type']) => {
    switch (type) {
      case 'message':
        return <MessageSquare className="w-4 h-4 text-blue-500" />;
      case 'task':
        return <Zap className="w-4 h-4 text-yellow-500" />;
      case 'error':
        return <AlertCircle className="w-4 h-4 text-red-500" />;
      case 'success':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
    }
  };

  const formatTime = (date: Date) => {
    return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}:${date.getSeconds().toString().padStart(2, '0')}`;
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-lg">
          <ScrollText className="w-5 h-5" />
          实时活动
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2 max-h-[250px] overflow-y-auto">
          {activities.length > 0 ? (
            activities.map((activity) => (
              <div
                key={activity.id}
                className="flex items-start gap-2 p-2 rounded-lg bg-muted/30 text-sm"
              >
                {getIcon(activity.type)}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{activity.title}</span>
                    <span className="text-xs text-muted-foreground">
                      {formatTime(activity.timestamp)}
                    </span>
                  </div>
                  {activity.detail && (
                    <div className="text-xs text-muted-foreground truncate">
                      {activity.detail}
                    </div>
                  )}
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-8 text-muted-foreground text-sm">
              {connected ? '等待活动...' : '未连接'}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
