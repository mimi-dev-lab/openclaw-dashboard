'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  LayoutDashboard, Brain, Zap, FolderOpen, FileOutput, 
  Clock, MessageSquare, Settings, RefreshCw, Bot
} from 'lucide-react';
import { useGatewayStore } from '@/stores/gateway';
import { cn } from '@/lib/utils';

const navItems = [
  { href: '/', icon: LayoutDashboard, label: '仪表盘' },
  { href: '/models', icon: Bot, label: 'AI 模型' },
  { href: '/memory', icon: Brain, label: '记忆系统' },
  { href: '/skills', icon: Zap, label: '技能库' },
  { href: '/projects', icon: FolderOpen, label: '项目' },
  { href: '/output', icon: FileOutput, label: '输出文件' },
  { href: '/cron', icon: Clock, label: '定时任务' },
  { href: '/sessions', icon: MessageSquare, label: '会话' },
  { href: '/settings', icon: Settings, label: '设置' },
];

export function Layout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { isLoading, refresh } = useGatewayStore();

  return (
    <div className="min-h-screen bg-[hsl(var(--background))] text-white flex">
      {/* 左侧导航 */}
      <aside className="w-64 bg-[hsl(var(--card))] border-r border-[hsl(var(--border))] flex flex-col fixed h-screen">
        {/* Logo */}
        <div className="p-6 border-b border-[hsl(var(--border))]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-600 flex items-center justify-center">
              <span className="text-xl">🐱</span>
            </div>
            <div>
              <h1 className="text-lg font-bold text-white">OpenClaw</h1>
              <p className="text-xs text-[hsl(var(--muted-foreground))]">指挥中心</p>
            </div>
          </div>
        </div>

        {/* 导航菜单 */}
        <nav className="flex-1 p-3 overflow-y-auto">
          <ul className="space-y-1">
            {navItems.map((item) => {
              const isActive = pathname === item.href || 
                (item.href !== '/' && pathname.startsWith(item.href));
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={cn(
                      'flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200',
                      isActive 
                        ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/25' 
                        : 'text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--secondary))] hover:text-white'
                    )}
                  >
                    <item.icon className="w-5 h-5" />
                    <span className="font-medium">{item.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* 底部刷新按钮 */}
        <div className="p-4 border-t border-[hsl(var(--border))]">
          <button
            onClick={refresh}
            disabled={isLoading}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[hsl(var(--secondary))] hover:bg-[hsl(var(--border))] transition-colors disabled:opacity-50"
          >
            <RefreshCw className={cn('w-4 h-4', isLoading && 'animate-spin')} />
            <span className="text-sm font-medium">
              {isLoading ? '刷新中...' : '刷新数据'}
            </span>
          </button>
        </div>
      </aside>

      {/* 主内容区 */}
      <main className="flex-1 ml-64 min-h-screen">
        {children}
      </main>
    </div>
  );
}
