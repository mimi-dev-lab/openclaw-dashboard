'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useGatewayStore } from '@/stores/gateway';
import { getGateway } from '@/lib/websocket';
import { 
  Zap, 
  RefreshCw, 
  Power, 
  Activity,
  Settings,
  RotateCw,
  CheckCircle,
  XCircle,
  Loader2
} from 'lucide-react';
import { useState } from 'react';

type ActionStatus = 'idle' | 'loading' | 'success' | 'error';

interface ActionResult {
  status: ActionStatus;
  message?: string;
}

export function QuickActions() {
  const { connected, refresh } = useGatewayStore();
  const [actionStatus, setActionStatus] = useState<Record<string, ActionResult>>({});

  const updateStatus = (id: string, status: ActionStatus, message?: string) => {
    setActionStatus(prev => ({ ...prev, [id]: { status, message } }));
    
    // Clear status after 3 seconds
    if (status === 'success' || status === 'error') {
      setTimeout(() => {
        setActionStatus(prev => ({ ...prev, [id]: { status: 'idle' } }));
      }, 3000);
    }
  };

  const handleRefresh = async () => {
    updateStatus('refresh', 'loading');
    try {
      await refresh();
      updateStatus('refresh', 'success', '数据已刷新');
    } catch (err) {
      updateStatus('refresh', 'error', String(err));
    }
  };

  const handleRestart = async () => {
    if (!connected) return;
    
    updateStatus('restart', 'loading');
    try {
      const gateway = getGateway();
      await gateway.call('gateway.restart', { reason: 'Dashboard restart button' });
      updateStatus('restart', 'success', 'Gateway 正在重启...');
    } catch (err) {
      updateStatus('restart', 'error', String(err));
    }
  };

  const handleHealthCheck = async () => {
    if (!connected) return;
    
    updateStatus('health', 'loading');
    try {
      const gateway = getGateway();
      const result = await gateway.call<{ ok?: boolean; durationMs?: number }>('health');
      if (result?.ok) {
        updateStatus('health', 'success', `健康检查通过 (${result.durationMs}ms)`);
      } else {
        updateStatus('health', 'error', '健康检查失败');
      }
    } catch (err) {
      updateStatus('health', 'error', String(err));
    }
  };

  const handleTestChannels = async () => {
    if (!connected) return;
    
    updateStatus('channels', 'loading');
    try {
      const gateway = getGateway();
      const result = await gateway.call<{ 
        channels?: Record<string, { running?: boolean }> 
      }>('channels.status');
      
      const channels = result?.channels || {};
      const running = Object.values(channels).filter(c => c.running).length;
      const total = Object.keys(channels).length;
      
      updateStatus('channels', 'success', `${running}/${total} 通道在线`);
    } catch (err) {
      updateStatus('channels', 'error', String(err));
    }
  };

  const getStatusIcon = (id: string) => {
    const status = actionStatus[id]?.status || 'idle';
    switch (status) {
      case 'loading':
        return <Loader2 className="w-4 h-4 animate-spin" />;
      case 'success':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'error':
        return <XCircle className="w-4 h-4 text-red-500" />;
      default:
        return null;
    }
  };

  const actions = [
    {
      id: 'refresh',
      label: '刷新数据',
      icon: RefreshCw,
      onClick: handleRefresh,
      variant: 'default' as const,
    },
    {
      id: 'health',
      label: '健康检查',
      icon: Activity,
      onClick: handleHealthCheck,
      variant: 'outline' as const,
    },
    {
      id: 'channels',
      label: '测试通道',
      icon: Zap,
      onClick: handleTestChannels,
      variant: 'outline' as const,
    },
    {
      id: 'restart',
      label: '重启 Gateway',
      icon: RotateCw,
      onClick: handleRestart,
      variant: 'outline' as const,
    },
  ];

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Power className="w-5 h-5" />
          快捷操作
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-2">
          {actions.map((action) => {
            const status = actionStatus[action.id]?.status || 'idle';
            const isLoading = status === 'loading';
            
            return (
              <Button
                key={action.id}
                variant={action.variant}
                size="sm"
                onClick={action.onClick}
                disabled={!connected || isLoading}
                className="w-full justify-start relative"
              >
                <action.icon className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                {action.label}
                <span className="absolute right-2">
                  {getStatusIcon(action.id)}
                </span>
              </Button>
            );
          })}
        </div>

        {/* Status Messages */}
        {Object.entries(actionStatus).map(([id, result]) => (
          result.message && result.status !== 'idle' && (
            <div 
              key={id}
              className={`mt-2 text-xs p-2 rounded ${
                result.status === 'success' 
                  ? 'bg-green-500/10 text-green-500' 
                  : result.status === 'error'
                  ? 'bg-red-500/10 text-red-500'
                  : 'bg-muted text-muted-foreground'
              }`}
            >
              {result.message}
            </div>
          )
        ))}

        {/* Settings Link */}
        <Button
          variant="ghost"
          size="sm"
          className="w-full mt-4 text-muted-foreground"
          onClick={() => {
            // Get current gateway URL from localStorage
            const url = localStorage.getItem('openclaw-gateway-url') || 'http://127.0.0.1:18789';
            const httpUrl = url.replace('ws://', 'http://').replace('wss://', 'https://');
            window.open(httpUrl, '_blank');
          }}
        >
          <Settings className="w-4 h-4 mr-2" />
          打开 Control UI
        </Button>
      </CardContent>
    </Card>
  );
}
