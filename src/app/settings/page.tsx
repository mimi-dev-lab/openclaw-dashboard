'use client';

import { Layout } from '@/components/Layout';
import { useGatewayStore } from '@/stores/gateway';
import { Settings, Server, Key, Bell, Palette, Power, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function SettingsPage() {
  const { url, restartGateway } = useGatewayStore();

  const handleRestart = async () => {
    if (!confirm('确定要重启 Gateway 吗？')) return;
    const ok = await restartGateway();
    alert(ok ? '✓ 重启指令已发送' : '✗ 重启失败');
  };

  return (
    <Layout>
      <div className="p-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-white">设置</h1>
          <p className="text-[hsl(var(--muted-foreground))] mt-1">系统配置和偏好设置</p>
        </div>

        <div className="space-y-6">
          {/* 连接设置 */}
          <div className="bg-[hsl(var(--card))] rounded-2xl border border-[hsl(var(--border))] overflow-hidden">
            <div className="px-6 py-4 border-b border-[hsl(var(--border))] flex items-center gap-2">
              <Server className="w-5 h-5 text-blue-400" />
              <span className="font-medium">连接设置</span>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm text-[hsl(var(--muted-foreground))] mb-2">Gateway 地址</label>
                <input
                  type="text"
                  value={url || ''}
                  readOnly
                  className="w-full bg-[hsl(var(--secondary))] border border-[hsl(var(--border))] rounded-xl px-4 py-3 text-white"
                />
              </div>
              <div className="flex gap-3">
                <button
                  onClick={handleRestart}
                  className="flex items-center gap-2 px-4 py-2 bg-orange-600/20 hover:bg-orange-600/30 border border-orange-600/30 text-orange-400 rounded-xl transition-colors"
                >
                  <Power className="w-4 h-4" />
                  <span className="text-sm">重启 Gateway</span>
                </button>
                <button className="flex items-center gap-2 px-4 py-2 bg-[hsl(var(--secondary))] hover:bg-[hsl(var(--border))] rounded-xl transition-colors">
                  <RefreshCw className="w-4 h-4" />
                  <span className="text-sm">检查更新</span>
                </button>
              </div>
            </div>
          </div>

          {/* 外观设置 */}
          <div className="bg-[hsl(var(--card))] rounded-2xl border border-[hsl(var(--border))] overflow-hidden">
            <div className="px-6 py-4 border-b border-[hsl(var(--border))] flex items-center gap-2">
              <Palette className="w-5 h-5 text-pink-400" />
              <span className="font-medium">外观设置</span>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium text-white">主题</div>
                  <div className="text-sm text-[hsl(var(--muted-foreground))]">选择界面主题</div>
                </div>
                <select className="bg-[hsl(var(--secondary))] border border-[hsl(var(--border))] rounded-xl px-4 py-2 text-white">
                  <option>深色</option>
                  <option>浅色</option>
                  <option>跟随系统</option>
                </select>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium text-white">主题色</div>
                  <div className="text-sm text-[hsl(var(--muted-foreground))]">选择强调色</div>
                </div>
                <div className="flex gap-2">
                  {['bg-purple-600', 'bg-blue-600', 'bg-green-600', 'bg-orange-600', 'bg-pink-600'].map((color) => (
                    <button
                      key={color}
                      className={cn('w-8 h-8 rounded-full', color, color === 'bg-purple-600' && 'ring-2 ring-white ring-offset-2 ring-offset-[hsl(var(--card))]')}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* 通知设置 */}
          <div className="bg-[hsl(var(--card))] rounded-2xl border border-[hsl(var(--border))] overflow-hidden">
            <div className="px-6 py-4 border-b border-[hsl(var(--border))] flex items-center gap-2">
              <Bell className="w-5 h-5 text-yellow-400" />
              <span className="font-medium">通知设置</span>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium text-white">桌面通知</div>
                  <div className="text-sm text-[hsl(var(--muted-foreground))]">接收系统通知</div>
                </div>
                <button className="w-12 h-6 bg-purple-600 rounded-full relative">
                  <span className="absolute right-1 top-1 w-4 h-4 bg-white rounded-full" />
                </button>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium text-white">声音提醒</div>
                  <div className="text-sm text-[hsl(var(--muted-foreground))]">播放提示音</div>
                </div>
                <button className="w-12 h-6 bg-[hsl(var(--secondary))] rounded-full relative">
                  <span className="absolute left-1 top-1 w-4 h-4 bg-white rounded-full" />
                </button>
              </div>
            </div>
          </div>

          {/* 关于 */}
          <div className="bg-[hsl(var(--card))] rounded-2xl border border-[hsl(var(--border))] overflow-hidden">
            <div className="px-6 py-4 border-b border-[hsl(var(--border))] flex items-center gap-2">
              <Settings className="w-5 h-5 text-gray-400" />
              <span className="font-medium">关于</span>
            </div>
            <div className="p-6">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-2xl bg-purple-600 flex items-center justify-center">
                  <span className="text-3xl">🐱</span>
                </div>
                <div>
                  <div className="font-bold text-xl text-white">OpenClaw Dashboard</div>
                  <div className="text-[hsl(var(--muted-foreground))]">v1.0.0</div>
                  <div className="text-sm text-[hsl(var(--muted-foreground))] mt-1">
                    Made with 💜 by Mimi
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
