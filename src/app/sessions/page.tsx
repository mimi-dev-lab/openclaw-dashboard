'use client';

import { Layout } from '@/components/Layout';
import { 
  MessageSquare, Bot, Clock, Search, RefreshCw, X, User,
  ChevronRight, Hash, Globe
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';

interface Session {
  key: string;
  kind: string;
  agentId: string;
  channelId?: string;
  channelName?: string;
  displayName?: string;
  lastActiveAt?: string;
  lastMessage?: string;
  messageCount?: number;
  totalTokens?: number;
}

interface SessionHistory {
  role: string;
  content: string;
  timestamp?: string;
}

export default function SessionsPage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  const [history, setHistory] = useState<SessionHistory[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const baseUrl = typeof window !== 'undefined' ? `http://${window.location.hostname}:18790` : '';

  const fetchSessions = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${baseUrl}/api/sessions`);
      if (res.ok) {
        const data = await res.json();
        setSessions(data.sessions || []);
      }
    } catch (e) {
      console.error('Failed to fetch sessions:', e);
    } finally {
      setLoading(false);
    }
  };

  const fetchHistory = async (session: Session) => {
    setLoadingHistory(true);
    try {
      const res = await fetch(`${baseUrl}/api/sessions/history?key=${encodeURIComponent(session.key)}`);
      if (res.ok) {
        const data = await res.json();
        setHistory(data.history || []);
      }
    } catch (e) {
      console.error('Failed to fetch history:', e);
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    fetchSessions();
  }, []);

  const openDrawer = (session: Session) => {
    setSelectedSession(session);
    setHistory([]);
    fetchHistory(session);
  };

  const closeDrawer = () => {
    setSelectedSession(null);
    setHistory([]);
  };

  const filteredSessions = sessions.filter(s => {
    if (!search) return true;
    const name = s.displayName || s.channelName || s.key;
    return name.toLowerCase().includes(search.toLowerCase());
  });

  // Group by kind
  const mainSessions = filteredSessions.filter(s => s.kind === 'main');
  const channelSessions = filteredSessions.filter(s => s.kind === 'channel');
  const isolatedSessions = filteredSessions.filter(s => s.kind === 'isolated');

  const totalTokens = sessions.reduce((sum, s) => sum + (s.totalTokens || 0), 0);

  const formatTime = (dateStr?: string) => {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    
    if (diff < 60000) return '刚刚';
    if (diff < 3600000) return `${Math.floor(diff / 60000)} 分钟前`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)} 小时前`;
    return `${Math.floor(diff / 86400000)} 天前`;
  };

  const getSessionIcon = (kind: string) => {
    switch (kind) {
      case 'main': return Bot;
      case 'channel': return Hash;
      case 'isolated': return Globe;
      default: return MessageSquare;
    }
  };

  const SessionRow = ({ session }: { session: Session }) => {
    const Icon = getSessionIcon(session.kind);
    return (
      <tr 
        className="hover:bg-[hsl(var(--secondary))] transition-colors cursor-pointer"
        onClick={() => openDrawer(session)}
      >
        <td className="px-4 py-3">
          <div className="flex items-center gap-3">
            <div className={cn(
              'w-8 h-8 rounded-lg flex items-center justify-center',
              session.kind === 'main' ? 'bg-purple-600/20' :
              session.kind === 'channel' ? 'bg-blue-600/20' : 'bg-gray-600/20'
            )}>
              <Icon className={cn(
                'w-4 h-4',
                session.kind === 'main' ? 'text-purple-400' :
                session.kind === 'channel' ? 'text-blue-400' : 'text-gray-400'
              )} />
            </div>
            <div>
              <div className="font-medium text-white">
                {session.displayName || session.channelName || session.key.split(':').slice(-1)[0]}
              </div>
              <div className="text-xs text-[hsl(var(--muted-foreground))]">
                {session.agentId}
              </div>
            </div>
          </div>
        </td>
        <td className="px-4 py-3">
          <span className={cn(
            'text-xs px-2 py-1 rounded-full',
            session.kind === 'main' ? 'bg-purple-500/20 text-purple-400' :
            session.kind === 'channel' ? 'bg-blue-500/20 text-blue-400' : 'bg-gray-500/20 text-gray-400'
          )}>
            {session.kind}
          </span>
        </td>
        <td className="px-4 py-3">
          {session.lastMessage ? (
            <span className="text-sm text-[hsl(var(--muted-foreground))] line-clamp-1 max-w-xs">
              {session.lastMessage.slice(0, 50)}...
            </span>
          ) : (
            <span className="text-sm text-[hsl(var(--muted-foreground))]">-</span>
          )}
        </td>
        <td className="px-4 py-3">
          <span className="text-sm text-[hsl(var(--muted-foreground))]">
            {session.messageCount || 0}
          </span>
        </td>
        <td className="px-4 py-3">
          <span className="text-sm text-[hsl(var(--muted-foreground))]">
            {formatTime(session.lastActiveAt)}
          </span>
        </td>
        <td className="px-4 py-3">
          <ChevronRight className="w-4 h-4 text-[hsl(var(--muted-foreground))]" />
        </td>
      </tr>
    );
  };

  return (
    <Layout>
      <div className="p-8">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">会话</h1>
            <p className="text-[hsl(var(--muted-foreground))] mt-1">
              {sessions.length} 个会话
            </p>
          </div>
          <button
            onClick={fetchSessions}
            disabled={loading}
            className="p-2 bg-[hsl(var(--secondary))] hover:bg-[hsl(var(--border))] rounded-lg transition-colors"
          >
            <RefreshCw className={cn('w-5 h-5', loading && 'animate-spin')} />
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          <div className="bg-[hsl(var(--card))] rounded-xl p-4 border border-[hsl(var(--border))]">
            <div className="text-2xl font-bold text-white">{sessions.length}</div>
            <div className="text-sm text-[hsl(var(--muted-foreground))]">总会话</div>
          </div>
          <div className="bg-[hsl(var(--card))] rounded-xl p-4 border border-[hsl(var(--border))]">
            <div className="text-2xl font-bold text-purple-400">{mainSessions.length}</div>
            <div className="text-sm text-[hsl(var(--muted-foreground))]">Main</div>
          </div>
          <div className="bg-[hsl(var(--card))] rounded-xl p-4 border border-[hsl(var(--border))]">
            <div className="text-2xl font-bold text-blue-400">{channelSessions.length}</div>
            <div className="text-sm text-[hsl(var(--muted-foreground))]">Channel</div>
          </div>
          <div className="bg-[hsl(var(--card))] rounded-xl p-4 border border-[hsl(var(--border))]">
            <div className="text-2xl font-bold text-gray-400">{isolatedSessions.length}</div>
            <div className="text-sm text-[hsl(var(--muted-foreground))]">Isolated</div>
          </div>
        </div>

        {/* Search */}
        <div className="mb-6">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[hsl(var(--muted-foreground))]" />
            <input
              type="text"
              placeholder="搜索会话..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-lg text-sm text-white placeholder-[hsl(var(--muted-foreground))] focus:outline-none focus:border-purple-500"
            />
          </div>
        </div>

        {/* Sessions Table */}
        <div className="bg-[hsl(var(--card))] rounded-xl border border-[hsl(var(--border))] overflow-hidden">
          <table className="w-full">
            <thead className="bg-[hsl(var(--secondary))]">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-[hsl(var(--muted-foreground))] uppercase">会话</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-[hsl(var(--muted-foreground))] uppercase">类型</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-[hsl(var(--muted-foreground))] uppercase">最后消息</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-[hsl(var(--muted-foreground))] uppercase">消息数</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-[hsl(var(--muted-foreground))] uppercase">活跃时间</th>
                <th className="px-4 py-3 w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[hsl(var(--border))]">
              {loading ? (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-[hsl(var(--muted-foreground))]">加载中...</td></tr>
              ) : filteredSessions.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-[hsl(var(--muted-foreground))]">暂无会话</td></tr>
              ) : filteredSessions.map((session) => (
                <SessionRow key={session.key} session={session} />
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* History Drawer */}
      {selectedSession && (
        <>
          <div 
            className="fixed inset-0 bg-black/50 z-40"
            onClick={closeDrawer}
          />
          <div className="fixed right-0 top-0 h-full w-[500px] max-w-[90vw] bg-[hsl(var(--card))] border-l border-[hsl(var(--border))] z-50 overflow-hidden flex flex-col animate-in slide-in-from-right duration-300">
            <div className="flex items-center justify-between p-4 border-b border-[hsl(var(--border))]">
              <div>
                <h2 className="font-semibold text-white">
                  {selectedSession.displayName || selectedSession.channelName || selectedSession.key.split(':').slice(-1)[0]}
                </h2>
                <p className="text-sm text-[hsl(var(--muted-foreground))]">{selectedSession.agentId}</p>
              </div>
              <button
                onClick={closeDrawer}
                className="p-2 hover:bg-[hsl(var(--secondary))] rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-[hsl(var(--muted-foreground))]" />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {loadingHistory ? (
                <div className="flex items-center justify-center py-12">
                  <RefreshCw className="w-6 h-6 animate-spin text-purple-400" />
                </div>
              ) : history.length === 0 ? (
                <div className="text-center text-[hsl(var(--muted-foreground))] py-12">
                  没有历史记录
                </div>
              ) : history.map((msg, i) => (
                <div key={i} className={cn(
                  'p-3 rounded-lg text-sm',
                  msg.role === 'user' 
                    ? 'bg-purple-600/20 ml-8' 
                    : 'bg-[hsl(var(--secondary))] mr-8'
                )}>
                  <div className="flex items-center gap-2 mb-1">
                    {msg.role === 'user' ? (
                      <User className="w-3 h-3 text-purple-400" />
                    ) : (
                      <Bot className="w-3 h-3 text-blue-400" />
                    )}
                    <span className="text-xs text-[hsl(var(--muted-foreground))]">
                      {msg.role === 'user' ? '用户' : 'Assistant'}
                    </span>
                  </div>
                  <div className="text-white whitespace-pre-wrap">
                    {typeof msg.content === 'string' 
                      ? msg.content.slice(0, 500) + (msg.content.length > 500 ? '...' : '')
                      : JSON.stringify(msg.content).slice(0, 500)
                    }
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </Layout>
  );
}
