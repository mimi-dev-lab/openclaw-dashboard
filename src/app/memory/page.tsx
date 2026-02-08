'use client';

import { Layout } from '@/components/Layout';
import { CardSkeleton, ListItemSkeleton, FlowNodeSkeleton } from '@/components/Skeleton';
import { Brain, FileText, Calendar, Search, X, Copy, Check, Database, Clock, Sparkles, AlertCircle, CheckCircle, ArrowRight, Zap, User, Heart, Globe, Bot, Settings, BookOpen, Lightbulb, RefreshCw, AlertTriangle, TrendingDown, Command, RotateCw } from 'lucide-react';
import { useState, useEffect, useCallback, useRef } from 'react';
import { cn } from '@/lib/utils';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

interface MemoryFile {
  name: string;
  size: number;
  modified: string;
  type: 'core' | 'daily' | 'system' | 'project' | 'hippocampus' | 'other';
}

interface HippocampusMemory {
  id: string;
  domain: string;
  category: string;
  content: string;
  importance: number;
  created: string;
  lastAccessed: string;
  keywords: string[];
  timesReinforced?: number;
}

interface SearchResult {
  file: string;
  path: string;
  line?: number;
  content: string;
  context?: string;
  memoryId?: string;
  importance?: number;
  domain?: string;
}

interface MemoryStats {
  totalFiles: number;
  totalSize: number;
  byType: Record<string, { count: number; size: number }>;
  timeline: { date: string; file: string; size: number }[];
  health: {
    dailyRecent: boolean;
    daysSinceLastDaily: number;
    hippocampusHealth: string;
    lastDecay: string | null;
    status: string;
  };
  files: MemoryFile[];
}

interface HippocampusData {
  version: number;
  lastUpdated: string;
  decayLastRun: string;
  totalMemories: number;
  byDomain: Record<string, { count: number; avgImportance: string }>;
  byImportance: { high: number; medium: number; low: number };
  topMemories: HippocampusMemory[];
  allMemories: HippocampusMemory[];
}

function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  if (bytes >= 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return bytes + ' B';
}

function formatTimeAgo(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  
  if (diffMins < 1) return '刚刚';
  if (diffMins < 60) return `${diffMins}分钟前`;
  if (diffHours < 24) return `${diffHours}小时前`;
  if (diffDays < 7) return `${diffDays}天前`;
  return date.toLocaleDateString();
}

const DOMAIN_COLORS: Record<string, string> = {
  user: '#A855F7',
  self: '#3B82F6',
  relationship: '#EC4899',
  world: '#10B981',
};

const DOMAIN_LABELS: Record<string, string> = {
  user: '用户',
  self: '自我',
  relationship: '关系',
  world: '世界',
};

// Compact Flow Node
function FlowNode({ 
  icon: Icon, 
  title, 
  color, 
  active,
  onClick,
}: { 
  icon: React.ElementType;
  title: string;
  color: string;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <button 
      onClick={onClick}
      className={cn(
        'flex items-center gap-2 px-3 py-2 rounded-xl border-2 transition-all hover:scale-[1.02]',
        active ? 'shadow-lg' : ''
      )}
      style={{ 
        borderColor: active ? color : 'hsl(var(--border))',
        backgroundColor: active ? `${color}10` : 'hsl(var(--card))'
      }}
    >
      <div className="p-1.5 rounded-lg" style={{ backgroundColor: `${color}20` }}>
        <Icon className="w-4 h-4" style={{ color }} />
      </div>
      <span className="text-sm font-medium text-white">{title}</span>
    </button>
  );
}

export default function MemoryPage() {
  const [stats, setStats] = useState<MemoryStats | null>(null);
  const [hippocampus, setHippocampus] = useState<HippocampusData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<MemoryFile | null>(null);
  const [fileContent, setFileContent] = useState<string>('');
  const [contentLoading, setContentLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [search, setSearch] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[] | null>(null);
  const [searching, setSearching] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const baseUrl = typeof window !== 'undefined' ? `http://${window.location.hostname}:18790` : 'http://localhost:18790';

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [statsRes, hippoRes] = await Promise.all([
        fetch(`${baseUrl}/api/memory/stats`),
        fetch(`${baseUrl}/api/memory/hippocampus`),
      ]);
      
      if (statsRes.ok) {
        const data = await statsRes.json();
        if (data.ok) setStats(data);
      }
      if (hippoRes.ok) {
        const data = await hippoRes.json();
        if (data.ok) setHippocampus(data);
      }
    } catch (e) {
      console.error('Failed to fetch:', e);
    } finally {
      setLoading(false);
    }
  }, [baseUrl]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Cmd/Ctrl + K to focus search
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
      // R to refresh
      if (e.key === 'r' && !e.metaKey && !e.ctrlKey && document.activeElement?.tagName !== 'INPUT') {
        fetchData();
      }
      // Escape to close
      if (e.key === 'Escape') {
        if (selectedFile) setSelectedFile(null);
        else if (searchResults) { setSearchResults(null); setSearch(''); }
        else if (activeSection) setActiveSection(null);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [fetchData, selectedFile, searchResults, activeSection]);

  // Categorize files
  const coreFiles = (stats?.files || []).filter(f => f.type === 'core');
  const dailyFiles = (stats?.files || []).filter(f => f.type === 'daily').sort((a, b) => b.name.localeCompare(a.name));
  const projectFiles = (stats?.files || []).filter(f => f.type === 'project');

  // Memories at risk
  const memoriesAtRisk = (hippocampus?.allMemories || [])
    .filter(m => m.importance < 0.5)
    .sort((a, b) => a.importance - b.importance)
    .slice(0, 5);

  // Domain pie data
  const domainPieData = Object.entries(hippocampus?.byDomain || {}).map(([domain, data]) => ({
    name: DOMAIN_LABELS[domain] || domain,
    value: data.count,
    color: DOMAIN_COLORS[domain] || '#6B7280',
  }));

  // Fetch file content
  const fetchFileContent = async (file: MemoryFile) => {
    setSelectedFile(file);
    setContentLoading(true);
    setFileContent('');
    
    try {
      const res = await fetch(`${baseUrl}/api/memory/read?path=${encodeURIComponent(file.name)}`);
      if (res.ok) {
        const data = await res.json();
        setFileContent(data.content || '无法读取文件内容');
      }
    } catch (e) {
      setFileContent('加载失败');
    } finally {
      setContentLoading(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(fileContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Search
  const handleSearch = async () => {
    if (!search.trim()) { setSearchResults(null); return; }
    setSearching(true);
    try {
      const res = await fetch(`${baseUrl}/api/memory/search?q=${encodeURIComponent(search)}`);
      if (res.ok) {
        const data = await res.json();
        if (data.ok) setSearchResults(data.results);
      }
    } catch (e) {
      console.error('Search failed:', e);
    } finally {
      setSearching(false);
    }
  };

  // Skeleton loading
  if (loading && !stats) {
    return (
      <Layout>
        <div className="p-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold text-white flex items-center gap-3">
                <Brain className="w-7 h-7 text-pink-400" />
                记忆系统
              </h1>
            </div>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
            {Array.from({ length: 5 }).map((_, i) => <CardSkeleton key={i} />)}
          </div>
          <div className="bg-[hsl(var(--card))] rounded-2xl border border-[hsl(var(--border))] p-6 mb-6">
            <div className="flex gap-3 flex-wrap">
              {Array.from({ length: 6 }).map((_, i) => <FlowNodeSkeleton key={i} />)}
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="p-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-3">
              <Brain className="w-7 h-7 text-pink-400" />
              记忆系统
            </h1>
            <p className="text-[hsl(var(--muted-foreground))] mt-1">理解 AI 如何记忆、检索和学习</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-[hsl(var(--muted-foreground))] hidden sm:block">⌘K 搜索 · R 刷新</span>
            <button
              onClick={fetchData}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 rounded-xl transition-colors"
            >
              <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
              <span className="text-sm">刷新</span>
            </button>
          </div>
        </div>

        {/* Search Bar - TOP */}
        <div className="bg-[hsl(var(--card))] rounded-2xl border border-[hsl(var(--border))] p-4 mb-6">
          <div className="flex gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[hsl(var(--muted-foreground))]" />
              <input
                ref={searchInputRef}
                type="text"
                placeholder="搜索所有记忆... (⌘K)"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                className="w-full pl-12 pr-4 py-3 bg-[hsl(var(--secondary))] border border-[hsl(var(--border))] rounded-xl text-white placeholder-[hsl(var(--muted-foreground))] focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
              />
              {search && (
                <button
                  onClick={() => { setSearch(''); setSearchResults(null); }}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-[hsl(var(--muted-foreground))] hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
            <button
              onClick={handleSearch}
              disabled={searching || !search.trim()}
              className="px-6 py-3 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 rounded-xl transition-colors font-medium"
            >
              {searching ? '搜索中...' : '搜索'}
            </button>
          </div>
          
          {/* Search Results */}
          {searchResults && (
            <div className="mt-4 border-t border-[hsl(var(--border))] pt-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm text-[hsl(var(--muted-foreground))]">找到 {searchResults.length} 条结果</span>
              </div>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {searchResults.slice(0, 15).map((r, i) => (
                  <div key={i} className="p-3 bg-[hsl(var(--secondary))] rounded-lg hover:bg-[hsl(var(--border))] transition-colors cursor-pointer">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs px-2 py-0.5 bg-purple-500/20 text-purple-400 rounded">{r.file}</span>
                      {r.line && <span className="text-xs text-[hsl(var(--muted-foreground))]">L{r.line}</span>}
                    </div>
                    <p className="text-sm text-white line-clamp-2">{r.content}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Health Stats Row */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
          <div className="bg-[hsl(var(--card))] rounded-xl p-4 border border-[hsl(var(--border))]">
            <div className="flex items-center gap-2 mb-2">
              {stats?.health?.status === 'healthy' ? (
                <CheckCircle className="w-4 h-4 text-green-400" />
              ) : (
                <AlertCircle className="w-4 h-4 text-yellow-400" />
              )}
              <span className="text-xs text-[hsl(var(--muted-foreground))]">系统状态</span>
            </div>
            <div className={cn(
              'text-lg font-bold',
              stats?.health?.status === 'healthy' ? 'text-green-400' : 'text-yellow-400'
            )}>
              {stats?.health?.status === 'healthy' ? '健康' : '正常'}
            </div>
          </div>
          <div className="bg-[hsl(var(--card))] rounded-xl p-4 border border-[hsl(var(--border))]">
            <div className="flex items-center gap-2 mb-2">
              <FileText className="w-4 h-4 text-[hsl(var(--muted-foreground))]" />
              <span className="text-xs text-[hsl(var(--muted-foreground))]">总文件</span>
            </div>
            <div className="text-lg font-bold text-white">{stats?.totalFiles || '-'}</div>
          </div>
          <div className="bg-[hsl(var(--card))] rounded-xl p-4 border border-[hsl(var(--border))]">
            <div className="flex items-center gap-2 mb-2">
              <Database className="w-4 h-4 text-pink-400" />
              <span className="text-xs text-[hsl(var(--muted-foreground))]">Hippocampus</span>
            </div>
            <div className="text-lg font-bold text-pink-400">{hippocampus?.totalMemories || '-'}</div>
          </div>
          <div className="bg-[hsl(var(--card))] rounded-xl p-4 border border-[hsl(var(--border))]">
            <div className="flex items-center gap-2 mb-2">
              <TrendingDown className="w-4 h-4 text-yellow-400" />
              <span className="text-xs text-[hsl(var(--muted-foreground))]">即将衰减</span>
            </div>
            <div className="text-lg font-bold text-yellow-400">{memoriesAtRisk.length}</div>
          </div>
          <div className="bg-[hsl(var(--card))] rounded-xl p-4 border border-[hsl(var(--border))]">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="w-4 h-4 text-[hsl(var(--muted-foreground))]" />
              <span className="text-xs text-[hsl(var(--muted-foreground))]">最近记录</span>
            </div>
            <div className="text-lg font-bold text-white">
              {stats?.health?.daysSinceLastDaily === 0 ? '今天' : `${stats?.health?.daysSinceLastDaily || '-'}天前`}
            </div>
          </div>
        </div>

        {/* Memory Lifecycle - Compact Horizontal */}
        <div className="bg-[hsl(var(--card))] rounded-2xl border border-[hsl(var(--border))] p-6 mb-6">
          <div className="flex items-center gap-2 mb-4">
            <RotateCw className="w-5 h-5 text-purple-400" />
            <span className="font-semibold text-white">记忆生命周期</span>
            <span className="text-xs text-[hsl(var(--muted-foreground))]">点击查看详情</span>
          </div>
          
          <div className="flex items-center gap-2 flex-wrap">
            <FlowNode icon={Bot} title="Session 开始" color="#A855F7" active={activeSection === 'core'} onClick={() => setActiveSection(activeSection === 'core' ? null : 'core')} />
            <ArrowRight className="w-4 h-4 text-[hsl(var(--muted-foreground))] hidden sm:block" />
            <FlowNode icon={Search} title="memory_search" color="#3B82F6" active={activeSection === 'search-info'} onClick={() => setActiveSection(activeSection === 'search-info' ? null : 'search-info')} />
            <ArrowRight className="w-4 h-4 text-[hsl(var(--muted-foreground))] hidden sm:block" />
            <FlowNode icon={Lightbulb} title="加载 Skill" color="#F59E0B" active={activeSection === 'skills'} onClick={() => setActiveSection(activeSection === 'skills' ? null : 'skills')} />
            <ArrowRight className="w-4 h-4 text-[hsl(var(--muted-foreground))] hidden sm:block" />
            <FlowNode icon={Sparkles} title="识别重要信息" color="#10B981" active={activeSection === 'triggers'} onClick={() => setActiveSection(activeSection === 'triggers' ? null : 'triggers')} />
            <ArrowRight className="w-4 h-4 text-[hsl(var(--muted-foreground))] hidden sm:block" />
            <FlowNode icon={Database} title="写入存储" color="#EC4899" active={activeSection === 'storage'} onClick={() => setActiveSection(activeSection === 'storage' ? null : 'storage')} />
            <ArrowRight className="w-4 h-4 text-[hsl(var(--muted-foreground))] hidden sm:block" />
            <FlowNode icon={Heart} title="衰减/强化" color="#EF4444" active={activeSection === 'decay'} onClick={() => setActiveSection(activeSection === 'decay' ? null : 'decay')} />
          </div>
        </div>

        {/* Detail Panel */}
        {activeSection && (
          <div className="bg-[hsl(var(--card))] rounded-2xl border border-[hsl(var(--border))] overflow-hidden mb-6">
            <div className="px-6 py-4 border-b border-[hsl(var(--border))] flex items-center justify-between">
              <span className="font-semibold text-white flex items-center gap-2">
                {activeSection === 'core' && <><Bot className="w-4 h-4" /> Session 开始 - 核心文件加载</>}
                {activeSection === 'search-info' && <><Search className="w-4 h-4" /> memory_search - 语义检索</>}
                {activeSection === 'skills' && <><Lightbulb className="w-4 h-4" /> 加载 Skill</>}
                {activeSection === 'triggers' && <><Sparkles className="w-4 h-4" /> 识别重要信息</>}
                {activeSection === 'storage' && <><Database className="w-4 h-4" /> 写入存储</>}
                {activeSection === 'decay' && <><TrendingDown className="w-4 h-4" /> 衰减与强化</>}
              </span>
              <button onClick={() => setActiveSection(null)} className="text-sm text-[hsl(var(--muted-foreground))] hover:text-white">
                按 ESC 关闭
              </button>
            </div>
            
            <div className="p-6">
              {/* Core Files */}
              {activeSection === 'core' && (
                <div className="space-y-4">
                  <p className="text-sm text-[hsl(var(--muted-foreground))]">
                    每次 Session 开始时，这些文件会自动注入到系统提示词，定义 AI 的身份和行为规则。
                  </p>
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    {coreFiles.map(file => (
                      <div 
                        key={file.name}
                        onClick={() => fetchFileContent(file)}
                        className="p-4 bg-[hsl(var(--secondary))] rounded-xl cursor-pointer hover:bg-[hsl(var(--border))] transition-colors"
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <FileText className="w-4 h-4 text-purple-400" />
                          <span className="font-medium text-white text-sm">{file.name}</span>
                        </div>
                        <div className="text-xs text-[hsl(var(--muted-foreground))]">
                          {formatBytes(file.size)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Search Info */}
              {activeSection === 'search-info' && (
                <div className="space-y-4">
                  <p className="text-sm text-[hsl(var(--muted-foreground))]">
                    回答问题前，AI 会用 memory_search 语义搜索相关记忆，确保回答准确。
                  </p>
                  <div className="bg-[hsl(var(--secondary))] rounded-xl p-4">
                    <code className="text-sm text-green-400">memory_search("关键词")</code>
                    <p className="text-xs text-[hsl(var(--muted-foreground))] mt-2">
                      搜索范围: MEMORY.md + memory/*.md + Hippocampus index
                    </p>
                  </div>
                </div>
              )}

              {/* Skills */}
              {activeSection === 'skills' && (
                <div className="space-y-4">
                  <p className="text-sm text-[hsl(var(--muted-foreground))]">
                    根据任务类型，按需加载对应的 SKILL.md 文件，获取专门领域的知识和工作流程。
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {['github', 'gog', 'weather', 'finance', 'coding-agent', 'deploy-agent'].map(skill => (
                      <span key={skill} className="px-3 py-1.5 bg-[hsl(var(--secondary))] rounded-lg text-sm text-white">
                        {skill}
                      </span>
                    ))}
                    <span className="px-3 py-1.5 text-sm text-[hsl(var(--muted-foreground))]">+更多...</span>
                  </div>
                </div>
              )}

              {/* Triggers */}
              {activeSection === 'triggers' && (
                <div className="space-y-4">
                  <p className="text-sm text-[hsl(var(--muted-foreground))]">
                    当对话中出现以下信号时，AI 会主动记录到对应文件：
                  </p>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-[hsl(var(--secondary))] rounded-xl p-4">
                      <div className="font-medium text-white mb-2 text-sm">高优先级触发词</div>
                      <div className="flex flex-wrap gap-1.5">
                        {['以后都这样', '记住', '规则', '决定', '偏好'].map(w => (
                          <span key={w} className="text-xs px-2 py-1 bg-red-500/20 text-red-400 rounded">{w}</span>
                        ))}
                      </div>
                    </div>
                    <div className="bg-[hsl(var(--secondary))] rounded-xl p-4">
                      <div className="font-medium text-white mb-2 text-sm">中优先级触发词</div>
                      <div className="flex flex-wrap gap-1.5">
                        {['教训', '错误', '流程', '工作流', '标准化'].map(w => (
                          <span key={w} className="text-xs px-2 py-1 bg-yellow-500/20 text-yellow-400 rounded">{w}</span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Storage */}
              {activeSection === 'storage' && (
                <div className="space-y-4">
                  <p className="text-sm text-[hsl(var(--muted-foreground))]">
                    根据内容类型，写入不同的存储位置：
                  </p>
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    <div className="bg-purple-500/10 border border-purple-500/30 rounded-xl p-3">
                      <User className="w-5 h-5 text-purple-400 mb-2" />
                      <div className="text-sm font-medium text-white">USER.md</div>
                      <div className="text-xs text-[hsl(var(--muted-foreground))]">用户偏好、个人信息</div>
                    </div>
                    <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-3">
                      <BookOpen className="w-5 h-5 text-blue-400 mb-2" />
                      <div className="text-sm font-medium text-white">MEMORY.md</div>
                      <div className="text-xs text-[hsl(var(--muted-foreground))]">重大决定、教训</div>
                    </div>
                    <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-3">
                      <Calendar className="w-5 h-5 text-green-400 mb-2" />
                      <div className="text-sm font-medium text-white">每日记录</div>
                      <div className="text-xs text-[hsl(var(--muted-foreground))]">YYYY-MM-DD.md</div>
                    </div>
                    <div className="bg-pink-500/10 border border-pink-500/30 rounded-xl p-3">
                      <Database className="w-5 h-5 text-pink-400 mb-2" />
                      <div className="text-sm font-medium text-white">Hippocampus</div>
                      <div className="text-xs text-[hsl(var(--muted-foreground))]">结构化长期记忆</div>
                    </div>
                  </div>
                </div>
              )}

              {/* Decay */}
              {activeSection === 'decay' && (
                <div className="space-y-4">
                  <p className="text-sm text-[hsl(var(--muted-foreground))]">
                    Hippocampus 中的记忆有重要性分数 (0-1)，会随时间自动衰减，被查询时会强化。
                  </p>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="bg-[hsl(var(--secondary))] rounded-xl p-3 text-center">
                      <div className="text-xl font-bold text-green-400">{hippocampus?.byImportance.high || 0}</div>
                      <div className="text-xs text-[hsl(var(--muted-foreground))]">高重要性 ≥70%</div>
                    </div>
                    <div className="bg-[hsl(var(--secondary))] rounded-xl p-3 text-center">
                      <div className="text-xl font-bold text-yellow-400">{hippocampus?.byImportance.medium || 0}</div>
                      <div className="text-xs text-[hsl(var(--muted-foreground))]">中重要性 40-70%</div>
                    </div>
                    <div className="bg-[hsl(var(--secondary))] rounded-xl p-3 text-center">
                      <div className="text-xl font-bold text-red-400">{hippocampus?.byImportance.low || 0}</div>
                      <div className="text-xs text-[hsl(var(--muted-foreground))]">低重要性 &lt;40%</div>
                    </div>
                  </div>
                  <div className="text-xs text-[hsl(var(--muted-foreground))]">
                    上次衰减: {hippocampus?.decayLastRun || '未知'}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Main Content Grid */}
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Hippocampus Overview */}
          <div className="bg-[hsl(var(--card))] rounded-2xl border border-[hsl(var(--border))] overflow-hidden">
            <div className="px-6 py-4 border-b border-[hsl(var(--border))] flex items-center gap-2">
              <Database className="w-5 h-5 text-pink-400" />
              <span className="font-semibold">Hippocampus</span>
              <span className="text-xs text-[hsl(var(--muted-foreground))]">{hippocampus?.totalMemories || 0} 条</span>
            </div>
            <div className="p-4">
              {/* Domain Distribution Pie */}
              {domainPieData.length > 0 ? (
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-24 h-24">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={domainPieData}
                          cx="50%"
                          cy="50%"
                          innerRadius={20}
                          outerRadius={40}
                          dataKey="value"
                          stroke="none"
                        >
                          {domainPieData.map((entry, index) => (
                            <Cell key={index} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: 'hsl(var(--card))', 
                            border: '1px solid hsl(var(--border))', 
                            borderRadius: '8px', 
                            fontSize: '12px',
                            color: 'white'
                          }}
                          itemStyle={{ color: 'white' }}
                          labelStyle={{ color: 'white' }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="flex-1 space-y-1">
                    {domainPieData.map(d => (
                      <div key={d.name} className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-1.5">
                          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: d.color }} />
                          <span className="text-white">{d.name}</span>
                        </div>
                        <span className="text-[hsl(var(--muted-foreground))]">{d.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="h-24 flex items-center justify-center text-[hsl(var(--muted-foreground))] text-sm">暂无数据</div>
              )}

              {/* Top Memories */}
              <div className="border-t border-[hsl(var(--border))] pt-3">
                <div className="text-xs text-[hsl(var(--muted-foreground))] mb-2">核心记忆</div>
                <div className="space-y-1.5 max-h-40 overflow-y-auto">
                  {hippocampus?.topMemories?.slice(0, 5).map(mem => (
                    <div key={mem.id} className="p-2 bg-[hsl(var(--secondary))] rounded-lg">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs text-white line-clamp-1 flex-1">{mem.content}</p>
                        <span className="text-xs font-medium text-green-400 shrink-0">{(mem.importance * 100).toFixed(0)}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Daily Files */}
          <div className="bg-[hsl(var(--card))] rounded-2xl border border-[hsl(var(--border))] overflow-hidden">
            <div className="px-6 py-4 border-b border-[hsl(var(--border))] flex items-center gap-2">
              <Calendar className="w-5 h-5 text-green-400" />
              <span className="font-semibold">每日记录</span>
              <span className="text-xs text-[hsl(var(--muted-foreground))]">{dailyFiles.length} 个</span>
            </div>
            <div className="p-4 max-h-80 overflow-y-auto">
              <div className="space-y-2">
                {dailyFiles.slice(0, 14).map(file => {
                  const fileName = file.name.split('/').pop() || file.name;
                  const isToday = fileName.startsWith(new Date().toISOString().slice(0, 10));
                  return (
                    <div 
                      key={file.name}
                      onClick={() => fetchFileContent(file)}
                      className={cn(
                        "p-3 rounded-xl cursor-pointer transition-colors",
                        isToday ? "bg-green-500/10 border border-green-500/30" : "bg-[hsl(var(--secondary))] hover:bg-[hsl(var(--border))]"
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <FileText className="w-4 h-4 text-[hsl(var(--muted-foreground))]" />
                          <span className="text-sm text-white">{fileName}</span>
                          {isToday && <span className="text-xs px-1.5 py-0.5 bg-green-500/20 text-green-400 rounded">今日</span>}
                        </div>
                        <span className="text-xs text-[hsl(var(--muted-foreground))]">{formatBytes(file.size)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* At Risk Memories */}
          <div className="bg-[hsl(var(--card))] rounded-2xl border border-[hsl(var(--border))] overflow-hidden">
            <div className="px-6 py-4 border-b border-[hsl(var(--border))] flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-yellow-400" />
              <span className="font-semibold">即将衰减</span>
              <span className="text-xs text-[hsl(var(--muted-foreground))]">{memoriesAtRisk.length} 条</span>
            </div>
            <div className="p-4">
              {memoriesAtRisk.length === 0 ? (
                <div className="text-center text-[hsl(var(--muted-foreground))] py-8 text-sm">
                  <CheckCircle className="w-8 h-8 mx-auto mb-2 text-green-400" />
                  所有记忆都很健康！
                </div>
              ) : (
                <div className="space-y-2">
                  {memoriesAtRisk.map(mem => (
                    <div key={mem.id} className="p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-xl">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 mb-1">
                            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: DOMAIN_COLORS[mem.domain] || '#6B7280' }} />
                            <span className="text-xs text-[hsl(var(--muted-foreground))]">{DOMAIN_LABELS[mem.domain] || mem.domain}</span>
                          </div>
                          <p className="text-sm text-white line-clamp-2">{mem.content}</p>
                        </div>
                        <span className="text-sm font-bold text-yellow-400 shrink-0">{(mem.importance * 100).toFixed(0)}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* File Modal */}
      {selectedFile && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setSelectedFile(null)}>
          <div className="bg-[hsl(var(--card))] rounded-2xl border border-[hsl(var(--border))] w-full max-w-4xl max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-[hsl(var(--border))] flex items-center justify-between shrink-0">
              <span className="font-semibold text-white">{selectedFile.name}</span>
              <div className="flex items-center gap-2">
                <button onClick={handleCopy} className="flex items-center gap-1.5 px-3 py-1.5 bg-[hsl(var(--secondary))] rounded-lg text-sm hover:bg-[hsl(var(--border))]">
                  {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                  {copied ? '已复制' : '复制'}
                </button>
                <button onClick={() => setSelectedFile(null)} className="p-2 hover:bg-[hsl(var(--secondary))] rounded-lg">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-auto p-6">
              {contentLoading ? (
                <div className="text-center text-[hsl(var(--muted-foreground))] py-8">加载中...</div>
              ) : (
                <pre className="whitespace-pre-wrap font-mono text-sm text-[hsl(var(--foreground))] leading-relaxed">{fileContent}</pre>
              )}
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
