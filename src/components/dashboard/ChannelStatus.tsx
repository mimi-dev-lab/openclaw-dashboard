'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useGatewayStore } from '@/stores/gateway';
import { Radio } from 'lucide-react';

function getChannelIcon(name: string): string {
  const lower = name.toLowerCase();
  if (lower.includes('whatsapp')) return '📱';
  if (lower.includes('telegram')) return '✈️';
  if (lower.includes('discord')) return '🎮';
  if (lower.includes('slack')) return '💼';
  if (lower.includes('feishu') || lower.includes('lark')) return '🐦';
  if (lower.includes('signal')) return '🔒';
  if (lower.includes('imessage')) return '💬';
  return '📡';
}

function getStatusBadge(status: string, enabled: boolean) {
  if (!enabled) {
    return <Badge variant="outline" className="text-gray-500">禁用</Badge>;
  }
  
  switch (status) {
    case 'ok':
      return <Badge className="bg-green-500 hover:bg-green-600">正常</Badge>;
    case 'error':
      return <Badge variant="destructive">错误</Badge>;
    case 'warning':
      return <Badge className="bg-yellow-500 hover:bg-yellow-600">警告</Badge>;
    default:
      return <Badge variant="secondary">离线</Badge>;
  }
}

export function ChannelStatus() {
  const { channels } = useGatewayStore();

  const enabledChannels = channels.filter(c => c.enabled);
  const healthyChannels = channels.filter(c => c.enabled && c.status === 'ok');

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Radio className="w-5 h-5" />
          通道状态
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* Summary */}
        <div className="flex items-center gap-2 mb-4 text-sm text-muted-foreground">
          <span>{healthyChannels.length}/{enabledChannels.length} 通道正常</span>
        </div>

        {/* Channel List */}
        <div className="grid grid-cols-2 gap-2">
          {channels.map((channel) => (
            <div
              key={channel.name}
              className="flex items-center gap-2 p-2 rounded-lg border bg-card"
            >
              <span className="text-xl">{getChannelIcon(channel.name)}</span>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm capitalize truncate">
                  {channel.name}
                </div>
                {channel.detail && (
                  <div className="text-xs text-muted-foreground truncate">
                    {channel.detail}
                  </div>
                )}
              </div>
              {getStatusBadge(channel.status, channel.enabled)}
            </div>
          ))}

          {channels.length === 0 && (
            <div className="col-span-2 text-center py-4 text-muted-foreground">
              暂无通道数据
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
