'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useGatewayStore } from '@/stores/gateway';
import { getGateway } from '@/lib/websocket';
import { 
  Zap, 
  RefreshCw, 
  Trash2, 
  Download, 
  Settings,
  RotateCw
} from 'lucide-react';
import { useState } from 'react';

export function QuickActions() {
  const { connected, refresh } = useGatewayStore();
  const [loading, setLoading] = useState<string | null>(null);

  const handleAction = async (action: string, method?: string) => {
    if (!connected) return;
    
    setLoading(action);
    try {
      if (method) {
        const gateway = getGateway();
        await gateway.call(method);
      }
      
      if (action === 'refresh') {
        await refresh();
      }
      
      // Show success feedback
      console.log(`Action ${action} completed`);
    } catch (err) {
      console.error(`Action ${action} failed:`, err);
    } finally {
      setLoading(null);
    }
  };

  const actions = [
    {
      id: 'refresh',
      label: '刷新数据',
      icon: RefreshCw,
      onClick: () => handleAction('refresh'),
      variant: 'default' as const,
    },
    {
      id: 'restart',
      label: '重启 Gateway',
      icon: RotateCw,
      onClick: () => handleAction('restart', 'config.apply'),
      variant: 'outline' as const,
    },
    {
      id: 'clear-logs',
      label: '清理日志',
      icon: Trash2,
      onClick: () => handleAction('clear-logs'),
      variant: 'outline' as const,
    },
    {
      id: 'export',
      label: '导出日志',
      icon: Download,
      onClick: () => handleAction('export'),
      variant: 'outline' as const,
    },
  ];

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Zap className="w-5 h-5" />
          快捷操作
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-2">
          {actions.map((action) => (
            <Button
              key={action.id}
              variant={action.variant}
              size="sm"
              onClick={action.onClick}
              disabled={!connected || loading === action.id}
              className="w-full justify-start"
            >
              <action.icon className={`w-4 h-4 mr-2 ${loading === action.id ? 'animate-spin' : ''}`} />
              {action.label}
            </Button>
          ))}
        </div>

        {/* Settings Link */}
        <Button
          variant="ghost"
          size="sm"
          className="w-full mt-4 text-muted-foreground"
          onClick={() => window.open('http://127.0.0.1:18789/', '_blank')}
        >
          <Settings className="w-4 h-4 mr-2" />
          打开 Control UI
        </Button>
      </CardContent>
    </Card>
  );
}
