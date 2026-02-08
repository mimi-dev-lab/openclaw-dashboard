'use client';

import { Layout } from '@/components/Layout';
import { 
  Zap, Search, X, Copy, Check, LayoutGrid, List, Trash2, AlertTriangle,
  Package, Wrench, User, Settings, RefreshCw, Download, Star,
  CheckCircle, XCircle, ExternalLink, Filter, MoreHorizontal, TrendingUp,
  Eye, ChevronDown, ChevronRight, AlertCircle, Clock, ArrowUpCircle
} from 'lucide-react';
import { useState, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';

interface Skill {
  name: string;
  description: string;
  source: 'builtin' | 'user' | 'workspace' | 'clawdhub' | 'custom';
  sourceLabel: string;
  category: string;
  path: string;
  modified: string;
  modifiedAt?: number; // timestamp for tooltip
  size: string;
  isCustom?: boolean;
  version?: string;
  hasUpdate?: boolean;
  latestVersion?: string;
  usageCount?: number;
  dependencies?: string[];
  dependenciesMet?: boolean;
}

const categoryLabels: Record<string, { label: string; color: string; bg: string }> = {
  dev: { label: '开发', color: 'text-blue-400', bg: 'bg-blue-500/20' },
  productivity: { label: '效率', color: 'text-green-400', bg: 'bg-green-500/20' },
  finance: { label: '金融', color: 'text-yellow-400', bg: 'bg-yellow-500/20' },
  utility: { label: '工具', color: 'text-cyan-400', bg: 'bg-cyan-500/20' },
  creative: { label: '创作', color: 'text-pink-400', bg: 'bg-pink-500/20' },
  entertainment: { label: '娱乐', color: 'text-purple-400', bg: 'bg-purple-500/20' },
  health: { label: '健康', color: 'text-red-400', bg: 'bg-red-500/20' },
  system: { label: '系统', color: 'text-orange-400', bg: 'bg-orange-500/20' },
  infra: { label: '基础设施', color: 'text-indigo-400', bg: 'bg-indigo-500/20' },
  other: { label: '其他', color: 'text-gray-400', bg: 'bg-gray-500/20' },
};

const sourceConfig: Record<string, { label: string; color: string; bg: string; border: string }> = {
  builtin: { label: '内置', color: 'text-gray-400', bg: 'bg-gray-500/10', border: 'border-gray-500/30' },
  clawdhub: { label: 'ClawdHub', color: 'text-purple-400', bg: 'bg-purple-500/10', border: 'border-purple-500/30' },
  custom: { label: '自建', color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/30' },
  user: { label: '用户', color: 'text-green-400', bg: 'bg-green-500/10', border: 'border-green-500/30' },
  workspace: { label: '工作区', color: 'text-cyan-400', bg: 'bg-cyan-500/10', border: 'border-cyan-500/30' },
};

export default function SkillsPage() {
  const [skills, setSkills] = useState<Skill[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');
  const [selectedSkill, setSelectedSkill] = useState<Skill | null>(null);
  const [skillContent, setSkillContent] = useState('');
  const [contentLoading, setContentLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [sortBy, setSortBy] = useState<'name' | 'category' | 'source' | 'modified' | 'usage'>('name');
  const [sortAsc, setSortAsc] = useState(true);
  const [deleteConfirm, setDeleteConfirm] = useState<Skill | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [updating, setUpdating] = useState<string | null>(null);
  const [showInstall, setShowInstall] = useState(false);
  const [installSearch, setInstallSearch] = useState('');
  const [installResults, setInstallResults] = useState<any[]>([]);
  const [installing, setInstalling] = useState<string | null>(null);
  const [searchingHub, setSearchingHub] = useState(false);
  const [selectedSkills, setSelectedSkills] = useState<Set<string>>(new Set());
  const [showBatchMenu, setShowBatchMenu] = useState(false);
  const [skillDetail, setSkillDetail] = useState<any>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [searchSort, setSearchSort] = useState<'downloads' | 'stars' | 'updated'>('downloads');
  const [checkingUpdates, setCheckingUpdates] = useState(false);
  const [updatesAvailable, setUpdatesAvailable] = useState<Map<string, string>>(new Map());
  const [updatingAll, setUpdatingAll] = useState(false);
  const [groupByCategory, setGroupByCategory] = useState(false);
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set());
  const [usageStats, setUsageStats] = useState<Map<string, number>>(new Map());

  const baseUrl = typeof window !== 'undefined' ? `http://${window.location.hostname}:18790` : '';

  const fetchSkills = useCallback(async () => {
    try {
      const res = await fetch(`${baseUrl}/api/skills`);
      if (res.ok) {
        const data = await res.json();
        setSkills(data.skills || []);
      }
    } catch (e) {
      console.error('Failed to fetch skills:', e);
    } finally {
      setLoading(false);
    }
  }, [baseUrl]);

  // Load favorites from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('skill-favorites');
    if (saved) setFavorites(new Set(JSON.parse(saved)));
  }, []);

  useEffect(() => {
    fetchSkills();
  }, [fetchSkills]);

  const toggleFavorite = (skillPath: string) => {
    const newFavorites = new Set(favorites);
    if (newFavorites.has(skillPath)) {
      newFavorites.delete(skillPath);
    } else {
      newFavorites.add(skillPath);
    }
    setFavorites(newFavorites);
    localStorage.setItem('skill-favorites', JSON.stringify([...newFavorites]));
  };

  const updateSkill = async (skill: Skill) => {
    if (skill.source !== 'clawdhub') return;
    setUpdating(skill.name);
    try {
      const res = await fetch(`${baseUrl}/api/skills/update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ skillName: skill.name }),
      });
      const data = await res.json();
      if (data.ok) {
        fetchSkills();
      } else {
        alert('更新失败: ' + data.error);
      }
    } catch (e) {
      alert('更新失败');
    } finally {
      setUpdating(null);
    }
  };

  const searchClawdHub = async () => {
    if (!installSearch.trim()) return;
    setSearchingHub(true);
    setInstallResults([]);
    try {
      const res = await fetch(`${baseUrl}/api/clawdhub/search?q=${encodeURIComponent(installSearch)}`);
      const data = await res.json();
      const basicResults = data.results || [];
      
      // Fetch details for all results in parallel
      const enrichedResults = await Promise.all(
        basicResults.map(async (r: any) => {
          try {
            const detailRes = await fetch(`${baseUrl}/api/clawdhub/info?slug=${encodeURIComponent(r.name)}`);
            const detailData = await detailRes.json();
            if (detailData.ok) {
              return { ...r, ...detailData.skill, loaded: true };
            }
          } catch {}
          return { ...r, loaded: false };
        })
      );
      
      setInstallResults(enrichedResults);
    } catch (e) {
      console.error('Search failed:', e);
    } finally {
      setSearchingHub(false);
    }
  };

  const fetchSkillDetail = async (slug: string) => {
    setLoadingDetail(true);
    try {
      const res = await fetch(`${baseUrl}/api/clawdhub/info?slug=${encodeURIComponent(slug)}`);
      const data = await res.json();
      if (data.ok) {
        setSkillDetail(data.skill);
      }
    } catch (e) {
      console.error('Failed to fetch skill detail:', e);
    } finally {
      setLoadingDetail(false);
    }
  };

  const installSkill = async (skillName: string) => {
    setInstalling(skillName);
    try {
      const res = await fetch(`${baseUrl}/api/skills/install`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ skillName }),
      });
      const data = await res.json();
      if (data.ok) {
        setShowInstall(false);
        setInstallSearch('');
        setInstallResults([]);
        fetchSkills();
      } else {
        alert('安装失败: ' + data.error);
      }
    } catch (e) {
      alert('安装失败');
    } finally {
      setInstalling(null);
    }
  };

  const toggleSelectSkill = (path: string) => {
    const newSelected = new Set(selectedSkills);
    if (newSelected.has(path)) newSelected.delete(path);
    else newSelected.add(path);
    setSelectedSkills(newSelected);
  };

  const selectAllVisible = () => {
    const allPaths = filteredSkills.filter(s => canDelete(s)).map(s => s.path);
    setSelectedSkills(new Set(allPaths));
  };

  const clearSelection = () => setSelectedSkills(new Set());

  const batchDelete = async () => {
    if (!confirm(`确定要删除 ${selectedSkills.size} 个技能吗？`)) return;
    for (const path of selectedSkills) {
      const skill = skills.find(s => s.path === path);
      if (skill) await handleDelete(skill);
    }
    setSelectedSkills(new Set());
    setShowBatchMenu(false);
  };

  const batchUpdate = async () => {
    const toUpdate = [...selectedSkills]
      .map(path => skills.find(s => s.path === path))
      .filter(s => s?.source === 'clawdhub');
    
    for (const skill of toUpdate) {
      if (skill) await updateSkill(skill);
    }
    setSelectedSkills(new Set());
    setShowBatchMenu(false);
  };

  // Check for updates on all ClawdHub skills
  const checkAllUpdates = async () => {
    setCheckingUpdates(true);
    const clawdhubSkills = skills.filter(s => s.source === 'clawdhub');
    const updates = new Map<string, string>();
    
    for (const skill of clawdhubSkills) {
      try {
        const res = await fetch(`${baseUrl}/api/clawdhub/info?slug=${encodeURIComponent(skill.name)}`);
        const data = await res.json();
        if (data.ok && data.skill?.version) {
          const currentVersion = skill.version;
          const latestVersion = data.skill.version;
          // Only compare if we have a local version - skip if local version unknown
          if (currentVersion && latestVersion !== currentVersion) {
            updates.set(skill.name, latestVersion);
          }
        }
      } catch {}
    }
    
    setUpdatesAvailable(updates);
    setCheckingUpdates(false);
  };

  // Update all ClawdHub skills with available updates
  const updateAllSkills = async () => {
    setUpdatingAll(true);
    const toUpdate = skills.filter(s => updatesAvailable.has(s.name));
    
    for (const skill of toUpdate) {
      await updateSkill(skill);
    }
    
    setUpdatesAvailable(new Map());
    setUpdatingAll(false);
    fetchSkills();
  };

  // Toggle category collapse
  const toggleCategoryCollapse = (category: string) => {
    const newCollapsed = new Set(collapsedCategories);
    if (newCollapsed.has(category)) {
      newCollapsed.delete(category);
    } else {
      newCollapsed.add(category);
    }
    setCollapsedCategories(newCollapsed);
  };

  // Fetch usage stats from token data
  const fetchUsageStats = useCallback(async () => {
    try {
      const res = await fetch(`${baseUrl}/api/skills/usage`);
      if (res.ok) {
        const data = await res.json();
        if (data.ok) {
          setUsageStats(new Map(Object.entries(data.usage || {})));
        }
      }
    } catch {}
  }, [baseUrl]);

  useEffect(() => {
    fetchUsageStats();
  }, [fetchUsageStats]);

  const fetchSkillContent = async (skill: Skill) => {
    setSelectedSkill(skill);
    setContentLoading(true);
    try {
      const res = await fetch(`${baseUrl}/api/skills/read?path=${encodeURIComponent(skill.path)}`);
      if (res.ok) {
        const data = await res.json();
        setSkillContent(data.content || '');
      }
    } catch (e) {
      setSkillContent('加载失败');
    } finally {
      setContentLoading(false);
    }
  };

  const handleDelete = async (skill: Skill) => {
    setDeleting(true);
    try {
      const res = await fetch(`${baseUrl}/api/skills/delete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ skillPath: skill.path }),
      });
      const data = await res.json();
      if (data.ok) {
        setSkills(prev => prev.filter(s => s.path !== skill.path));
        setDeleteConfirm(null);
        if (selectedSkill?.path === skill.path) {
          setSelectedSkill(null);
        }
      } else {
        alert('删除失败: ' + data.error);
      }
    } catch (e) {
      alert('删除失败');
    } finally {
      setDeleting(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(skillContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSort = (key: typeof sortBy) => {
    if (sortBy === key) setSortAsc(!sortAsc);
    else { setSortBy(key); setSortAsc(true); }
  };

  const canDelete = (skill: Skill) => skill.source === 'custom' || skill.source === 'clawdhub';

  const filteredSkills = skills
    .filter(s => {
      if (filter !== 'all' && s.category !== filter) return false;
      if (sourceFilter !== 'all' && s.source !== sourceFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        return s.name.toLowerCase().includes(q) || s.description.toLowerCase().includes(q);
      }
      return true;
    })
    .sort((a, b) => {
      // Favorites always first
      const aFav = favorites.has(a.path) ? 0 : 1;
      const bFav = favorites.has(b.path) ? 0 : 1;
      if (aFav !== bFav) return aFav - bFav;
      
      let cmp = 0;
      if (sortBy === 'name') cmp = a.name.localeCompare(b.name);
      else if (sortBy === 'category') cmp = a.category.localeCompare(b.category);
      else if (sortBy === 'source') cmp = a.source.localeCompare(b.source);
      else if (sortBy === 'modified') cmp = a.modified.localeCompare(b.modified);
      else if (sortBy === 'usage') cmp = (usageStats.get(a.name) || 0) - (usageStats.get(b.name) || 0);
      return sortAsc ? cmp : -cmp;
    });

  const categoryCounts = skills.reduce((acc, s) => { acc[s.category] = (acc[s.category] || 0) + 1; return acc; }, {} as Record<string, number>);
  const sourceCounts = skills.reduce((acc, s) => { acc[s.source] = (acc[s.source] || 0) + 1; return acc; }, {} as Record<string, number>);

  const SortHeader = ({ label, field, className }: { label: string; field: typeof sortBy; className?: string }) => (
    <th onClick={() => handleSort(field)} className={cn("px-4 py-3 text-left text-xs font-medium text-[hsl(var(--muted-foreground))] uppercase tracking-wider cursor-pointer hover:text-white transition-colors", className)}>
      <span className="flex items-center gap-1">{label}{sortBy === field && <span>{sortAsc ? '↑' : '↓'}</span>}</span>
    </th>
  );

  return (
    <Layout>
      <div className="p-8">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">技能库</h1>
            <p className="text-[hsl(var(--muted-foreground))] mt-1">
              {filteredSkills.length} / {skills.length} 个技能
              {favorites.size > 0 && <span className="ml-2 text-yellow-400">({favorites.size} 收藏)</span>}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {/* Batch actions */}
            {selectedSkills.size > 0 && (
              <div className="relative">
                <button 
                  onClick={() => setShowBatchMenu(!showBatchMenu)}
                  className="flex items-center gap-2 px-3 py-2 bg-purple-600 hover:bg-purple-500 rounded-lg text-sm transition-colors"
                >
                  <MoreHorizontal className="w-4 h-4" />
                  已选 {selectedSkills.size} 项
                </button>
                {showBatchMenu && (
                  <div className="absolute right-0 top-full mt-2 w-48 bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-lg shadow-xl z-10">
                    <button onClick={batchUpdate} className="w-full px-4 py-2 text-left text-sm hover:bg-[hsl(var(--secondary))] flex items-center gap-2">
                      <RefreshCw className="w-4 h-4" /> 批量更新
                    </button>
                    <button onClick={batchDelete} className="w-full px-4 py-2 text-left text-sm hover:bg-[hsl(var(--secondary))] text-red-400 flex items-center gap-2">
                      <Trash2 className="w-4 h-4" /> 批量删除
                    </button>
                    <hr className="border-[hsl(var(--border))]" />
                    <button onClick={clearSelection} className="w-full px-4 py-2 text-left text-sm hover:bg-[hsl(var(--secondary))] flex items-center gap-2">
                      <X className="w-4 h-4" /> 取消选择
                    </button>
                  </div>
                )}
              </div>
            )}
            
            {/* Check updates button */}
            {updatesAvailable.size > 0 ? (
              <div className="relative group">
                <button 
                  onClick={updateAllSkills}
                  disabled={updatingAll}
                  className="flex items-center gap-2 px-3 py-2 bg-orange-600 hover:bg-orange-500 rounded-lg text-sm transition-colors disabled:opacity-50"
                >
                  {updatingAll ? <RefreshCw className="w-4 h-4 animate-spin" /> : <ArrowUpCircle className="w-4 h-4" />}
                  更新全部 ({updatesAvailable.size})
                </button>
                {/* Dropdown showing which skills need update */}
                <div className="absolute right-0 top-full mt-2 w-72 bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-20 p-3">
                  <div className="text-xs text-[hsl(var(--muted-foreground))] mb-2">需要更新的技能:</div>
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {[...updatesAvailable.entries()].map(([name, newVersion]) => {
                      const skill = skills.find(s => s.name === name);
                      return (
                        <div key={name} className="flex items-center justify-between text-sm">
                          <span className="text-white">{name}</span>
                          <div className="flex items-center gap-1 text-xs">
                            <span className="text-gray-500">{skill?.version}</span>
                            <ArrowUpCircle className="w-3 h-3 text-orange-400" />
                            <span className="text-orange-400">{newVersion}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            ) : (
              <button 
                onClick={checkAllUpdates}
                disabled={checkingUpdates}
                className="flex items-center gap-2 px-3 py-2 bg-[hsl(var(--card))] hover:bg-[hsl(var(--secondary))] border border-[hsl(var(--border))] rounded-lg text-sm transition-colors disabled:opacity-50"
              >
                {checkingUpdates ? <RefreshCw className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                检查更新
              </button>
            )}
            
            {/* Install button */}
            <button 
              onClick={() => setShowInstall(true)}
              className="flex items-center gap-2 px-3 py-2 bg-green-600 hover:bg-green-500 rounded-lg text-sm transition-colors"
            >
              <Download className="w-4 h-4" />
              安装技能
            </button>
            
            {/* Group by category toggle */}
            <button 
              onClick={() => setGroupByCategory(!groupByCategory)}
              className={cn('p-2 rounded-lg transition-colors', groupByCategory ? 'bg-purple-600 text-white' : 'bg-[hsl(var(--card))] text-[hsl(var(--muted-foreground))] hover:text-white border border-[hsl(var(--border))]')}
              title="按分类分组"
            >
              <Filter className="w-5 h-5" />
            </button>
            
            {/* View toggle */}
            <button onClick={() => setViewMode('table')} className={cn('p-2 rounded-lg transition-colors', viewMode === 'table' ? 'bg-purple-600 text-white' : 'bg-[hsl(var(--card))] text-[hsl(var(--muted-foreground))] hover:text-white')}>
              <List className="w-5 h-5" />
            </button>
            <button onClick={() => setViewMode('grid')} className={cn('p-2 rounded-lg transition-colors', viewMode === 'grid' ? 'bg-purple-600 text-white' : 'bg-[hsl(var(--card))] text-[hsl(var(--muted-foreground))] hover:text-white')}>
              <LayoutGrid className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3 mb-6">
          <div className="flex-1 min-w-[200px] relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[hsl(var(--muted-foreground))]" />
            <input type="text" placeholder="搜索..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full pl-9 pr-4 py-2 bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-lg text-sm text-white placeholder-[hsl(var(--muted-foreground))] focus:outline-none focus:border-purple-500" />
          </div>
          <select value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value)} className="px-3 py-2 bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-lg text-sm text-white focus:outline-none focus:border-purple-500">
            <option value="all">全部来源 ({skills.length})</option>
            {Object.entries(sourceConfig).map(([key, cfg]) => 
              (sourceCounts[key] || 0) > 0 && (
                <option key={key} value={key}>{cfg.label} ({sourceCounts[key]})</option>
              )
            )}
          </select>
          <select value={filter} onChange={(e) => setFilter(e.target.value)} className="px-3 py-2 bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-lg text-sm text-white focus:outline-none focus:border-purple-500">
            <option value="all">全部分类</option>
            {Object.entries(categoryLabels).map(([key, { label }]) => categoryCounts[key] > 0 && <option key={key} value={key}>{label} ({categoryCounts[key]})</option>)}
          </select>
        </div>

        {/* Table View */}
        {viewMode === 'table' && !groupByCategory && (
          <div className="bg-[hsl(var(--card))] rounded-xl border border-[hsl(var(--border))] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-[hsl(var(--secondary))]">
                  <tr>
                    <th className="px-2 py-3 w-10">
                      <input 
                        type="checkbox" 
                        checked={selectedSkills.size > 0 && selectedSkills.size === filteredSkills.filter(s => canDelete(s)).length}
                        onChange={(e) => e.target.checked ? selectAllVisible() : clearSelection()}
                        className="w-4 h-4 rounded border-gray-600 bg-transparent"
                      />
                    </th>
                    <th className="px-2 py-3 w-10"></th>
                    <SortHeader label="名称" field="name" />
                    <th className="px-4 py-3 text-left text-xs font-medium text-[hsl(var(--muted-foreground))] uppercase tracking-wider">描述</th>
                    <SortHeader label="分类" field="category" />
                    <SortHeader label="来源" field="source" />
                    <SortHeader label="调用" field="usage" className="w-16" />
                    <SortHeader label="更新" field="modified" />
                    <th className="px-4 py-3 text-left text-xs font-medium text-[hsl(var(--muted-foreground))] uppercase tracking-wider w-28">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[hsl(var(--border))]">
                  {loading ? (
                    <tr><td colSpan={9} className="px-4 py-8 text-center text-[hsl(var(--muted-foreground))]">加载中...</td></tr>
                  ) : filteredSkills.length === 0 ? (
                    <tr><td colSpan={9} className="px-4 py-8 text-center text-[hsl(var(--muted-foreground))]">没有匹配的技能</td></tr>
                  ) : filteredSkills.map((skill) => {
                    const cat = categoryLabels[skill.category] || categoryLabels.other;
                    const isFavorite = favorites.has(skill.path);
                    const isSelected = selectedSkills.has(skill.path);
                    const hasUpdate = updatesAvailable.has(skill.name);
                    const usage = usageStats.get(skill.name) || 0;
                    return (
                      <tr key={skill.path} className={cn("hover:bg-[hsl(var(--secondary))] transition-colors group", isSelected && "bg-purple-500/10", hasUpdate && "bg-orange-500/5")}>
                        <td className="px-2 py-3">
                          {canDelete(skill) && (
                            <input 
                              type="checkbox" 
                              checked={isSelected}
                              onChange={() => toggleSelectSkill(skill.path)}
                              className="w-4 h-4 rounded border-gray-600 bg-transparent"
                            />
                          )}
                        </td>
                        <td className="px-2 py-3">
                          <button
                            onClick={() => toggleFavorite(skill.path)}
                            className="p-1 rounded transition-colors hover:bg-yellow-500/10"
                          >
                            <Star className={cn("w-4 h-4", isFavorite ? "text-yellow-400 fill-yellow-400" : "text-gray-500 hover:text-yellow-400")} />
                          </button>
                        </td>
                        <td className="px-4 py-3 cursor-pointer" onClick={() => fetchSkillContent(skill)}>
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-white">{skill.name}</span>
                            {skill.version && (
                              <span className="text-xs text-gray-500">v{skill.version}</span>
                            )}
                            {hasUpdate && (
                              <span className="text-xs px-1.5 py-0.5 bg-orange-500/20 text-orange-400 rounded flex items-center gap-1">
                                <ArrowUpCircle className="w-3 h-3" />
                                {updatesAvailable.get(skill.name)}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 max-w-md cursor-pointer" onClick={() => fetchSkillContent(skill)}>
                          <span 
                            className="text-sm text-[hsl(var(--muted-foreground))] line-clamp-1 block"
                            title={skill.description || ''}
                          >
                            {skill.description || '-'}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={cn('text-xs px-2 py-1 rounded', cat.bg, cat.color)}>{cat.label}</span>
                        </td>
                        <td className="px-4 py-3">
                          {(() => {
                            const src = sourceConfig[skill.source] || sourceConfig.other;
                            return (
                              <span className={cn('text-xs px-2 py-1 rounded border', src.bg, src.color, src.border)}>
                                {src?.label || skill.sourceLabel}
                              </span>
                            );
                          })()}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {usage > 0 ? (
                            <span className="text-xs text-[hsl(var(--muted-foreground))] flex items-center justify-center gap-1">
                              <TrendingUp className="w-3 h-3 text-green-400" />
                              {usage}
                            </span>
                          ) : (
                            <span className="text-xs text-gray-600">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span 
                            className="text-xs text-[hsl(var(--muted-foreground))] cursor-help"
                            title={skill.modifiedAt ? new Date(skill.modifiedAt).toLocaleString('zh-CN') : skill.modified}
                          >
                            {skill.modified}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1">
                            {/* View button - always visible */}
                            <button
                              onClick={(e) => { e.stopPropagation(); fetchSkillContent(skill); }}
                              className="p-1.5 rounded-lg text-[hsl(var(--muted-foreground))] hover:text-white hover:bg-[hsl(var(--secondary))] transition-colors"
                              title="查看"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            {/* Update button for ClawdHub skills */}
                            {skill.source === 'clawdhub' && (
                              <button
                                onClick={(e) => { e.stopPropagation(); updateSkill(skill); }}
                                disabled={updating === skill.name}
                                className={cn(
                                  "p-1.5 rounded-lg transition-colors disabled:opacity-50",
                                  hasUpdate 
                                    ? "text-orange-400 hover:bg-orange-500/10" 
                                    : "text-[hsl(var(--muted-foreground))] hover:text-blue-400 hover:bg-blue-500/10"
                                )}
                                title={hasUpdate ? `更新到 v${updatesAvailable.get(skill.name)}` : "更新技能"}
                              >
                                <RefreshCw className={cn("w-4 h-4", updating === skill.name && "animate-spin")} />
                              </button>
                            )}
                            {/* Delete button */}
                            {canDelete(skill) && (
                              <button
                                onClick={(e) => { e.stopPropagation(); setDeleteConfirm(skill); }}
                                className="p-1.5 rounded-lg text-[hsl(var(--muted-foreground))] hover:text-red-400 hover:bg-red-500/10 transition-colors"
                                title="删除技能"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Grouped Table View */}
        {viewMode === 'table' && groupByCategory && (
          <div className="space-y-4">
            {Object.entries(categoryLabels)
              .filter(([key]) => filteredSkills.some(s => s.category === key))
              .map(([categoryKey, cat]) => {
                const categorySkills = filteredSkills.filter(s => s.category === categoryKey);
                const isCollapsed = collapsedCategories.has(categoryKey);
                return (
                  <div key={categoryKey} className="bg-[hsl(var(--card))] rounded-xl border border-[hsl(var(--border))] overflow-hidden">
                    <button
                      onClick={() => toggleCategoryCollapse(categoryKey)}
                      className="w-full px-4 py-3 flex items-center justify-between hover:bg-[hsl(var(--secondary))] transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        {isCollapsed ? <ChevronRight className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                        <span className={cn('text-sm px-2 py-1 rounded', cat.bg, cat.color)}>{cat.label}</span>
                        <span className="text-sm text-[hsl(var(--muted-foreground))]">{categorySkills.length} 个技能</span>
                      </div>
                    </button>
                    {!isCollapsed && (
                      <div className="border-t border-[hsl(var(--border))]">
                        <table className="w-full">
                          <tbody className="divide-y divide-[hsl(var(--border))]">
                            {categorySkills.map((skill) => {
                              const isFavorite = favorites.has(skill.path);
                              const hasUpdate = updatesAvailable.has(skill.name);
                              const src = sourceConfig[skill.source] || sourceConfig.other;
                              return (
                                <tr key={skill.path} className="hover:bg-[hsl(var(--secondary))] transition-colors group">
                                  <td className="px-2 py-3 w-10">
                                    <button onClick={() => toggleFavorite(skill.path)} className="p-1 rounded transition-colors hover:bg-yellow-500/10">
                                      <Star className={cn("w-4 h-4", isFavorite ? "text-yellow-400 fill-yellow-400" : "text-gray-500 hover:text-yellow-400")} />
                                    </button>
                                  </td>
                                  <td className="px-4 py-3 cursor-pointer" onClick={() => fetchSkillContent(skill)}>
                                    <div className="flex items-center gap-2">
                                      <span className="font-medium text-white">{skill.name}</span>
                                      {hasUpdate && <ArrowUpCircle className="w-4 h-4 text-orange-400" />}
                                    </div>
                                  </td>
                                  <td className="px-4 py-3 max-w-md">
                                    <span className="text-sm text-[hsl(var(--muted-foreground))] line-clamp-1">{skill.description || '-'}</span>
                                  </td>
                                  <td className="px-4 py-3">
                                    <span className={cn('text-xs px-2 py-1 rounded border', src.bg, src.color, src.border)}>{src.label}</span>
                                  </td>
                                  <td className="px-4 py-3">
                                    <span className="text-xs text-[hsl(var(--muted-foreground))]">{skill.modified}</span>
                                  </td>
                                  <td className="px-4 py-3 w-24">
                                    <div className="flex items-center gap-1">
                                      <button onClick={() => fetchSkillContent(skill)} className="p-1.5 rounded-lg text-[hsl(var(--muted-foreground))] hover:text-white hover:bg-[hsl(var(--secondary))]">
                                        <Eye className="w-4 h-4" />
                                      </button>
                                      {skill.source === 'clawdhub' && (
                                        <button onClick={() => updateSkill(skill)} disabled={updating === skill.name} className="p-1.5 rounded-lg text-[hsl(var(--muted-foreground))] hover:text-blue-400 hover:bg-blue-500/10 disabled:opacity-50">
                                          <RefreshCw className={cn("w-4 h-4", updating === skill.name && "animate-spin")} />
                                        </button>
                                      )}
                                      {canDelete(skill) && (
                                        <button onClick={() => setDeleteConfirm(skill)} className="p-1.5 rounded-lg text-[hsl(var(--muted-foreground))] hover:text-red-400 hover:bg-red-500/10">
                                          <Trash2 className="w-4 h-4" />
                                        </button>
                                      )}
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                );
              })}
          </div>
        )}

        {/* Grid View */}
        {viewMode === 'grid' && (
          <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
            {loading ? (
              <div className="col-span-full text-center text-[hsl(var(--muted-foreground))] py-8">加载中...</div>
            ) : filteredSkills.length === 0 ? (
              <div className="col-span-full text-center text-[hsl(var(--muted-foreground))] py-8">没有匹配的技能</div>
            ) : filteredSkills.map((skill) => {
              const cat = categoryLabels[skill.category] || categoryLabels.other;
              const src = sourceConfig[skill.source] || sourceConfig.other;
              const isFavorite = favorites.has(skill.path);
              return (
                <div key={skill.path} className={cn(
                  "bg-[hsl(var(--card))] rounded-xl border border-[hsl(var(--border))] p-4 hover:border-purple-600/50 transition-all group relative",
                  isFavorite && "ring-1 ring-yellow-500/30"
                )}>
                  {/* Favorite star */}
                  <button
                    onClick={() => toggleFavorite(skill.path)}
                    className={cn(
                      "absolute top-3 right-3 p-1 rounded transition-colors",
                      isFavorite ? "text-yellow-400" : "text-gray-600 opacity-0 group-hover:opacity-100 hover:text-yellow-400"
                    )}
                  >
                    <Star className={cn("w-4 h-4", isFavorite ? "text-yellow-400 fill-yellow-400" : "text-gray-500")} />
                  </button>
                  
                  <div className="flex items-center gap-3 mb-2">
                    <div onClick={() => fetchSkillContent(skill)} className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer">
                      <div className="w-10 h-10 rounded-lg bg-purple-600/20 flex items-center justify-center shrink-0">
                        <Zap className="w-5 h-5 text-purple-400" />
                      </div>
                      <div className="min-w-0">
                        <div className="font-medium text-white truncate">{skill.name}</div>
                        <div className="text-xs text-[hsl(var(--muted-foreground))]">{skill.modified}</div>
                      </div>
                    </div>
                  </div>
                  
                  {skill.description && (
                    <p 
                      onClick={() => fetchSkillContent(skill)} 
                      className="text-xs text-[hsl(var(--muted-foreground))] line-clamp-2 cursor-pointer mb-3"
                      title={skill.description}
                    >
                      {skill.description}
                    </p>
                  )}
                  
                  <div className="flex items-center justify-between pt-2 border-t border-[hsl(var(--border))]">
                    <div className="flex items-center gap-2">
                      <span className={cn('text-xs px-2 py-0.5 rounded', cat.bg, cat.color)}>{cat.label}</span>
                      <span className={cn('text-xs px-2 py-0.5 rounded border', src.bg, src.color, src.border)}>{src.label}</span>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      {skill.source === 'clawdhub' && (
                        <button
                          onClick={() => updateSkill(skill)}
                          disabled={updating === skill.name}
                          className="p-1 rounded text-[hsl(var(--muted-foreground))] hover:text-blue-400 transition-colors"
                          title="更新"
                        >
                          <RefreshCw className={cn("w-4 h-4", updating === skill.name && "animate-spin")} />
                        </button>
                      )}
                      {canDelete(skill) && (
                        <button 
                          onClick={() => setDeleteConfirm(skill)} 
                          className="p-1 rounded text-[hsl(var(--muted-foreground))] hover:text-red-400 transition-colors"
                          title="删除"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Delete Confirmation */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[hsl(var(--card))] rounded-2xl border border-[hsl(var(--border))] p-6 max-w-md w-full">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center">
                <AlertTriangle className="w-6 h-6 text-red-400" />
              </div>
              <div>
                <h3 className="font-semibold text-white">确认删除</h3>
                <p className="text-sm text-[hsl(var(--muted-foreground))]">此操作不可恢复</p>
              </div>
            </div>
            <p className="text-sm text-[hsl(var(--muted-foreground))] mb-6">
              确定要删除技能 <span className="font-semibold text-white">{deleteConfirm.name}</span> 吗？
              <br />将删除整个目录及所有相关文件。
            </p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setDeleteConfirm(null)} disabled={deleting} className="px-4 py-2 bg-[hsl(var(--secondary))] hover:bg-[hsl(var(--border))] rounded-lg text-sm transition-colors">
                取消
              </button>
              <button onClick={() => handleDelete(deleteConfirm)} disabled={deleting} className="px-4 py-2 bg-red-600 hover:bg-red-500 rounded-lg text-sm transition-colors disabled:opacity-50">
                {deleting ? '删除中...' : '确认删除'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Install Skill Modal */}
      {showInstall && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[hsl(var(--card))] rounded-2xl border border-[hsl(var(--border))] w-full max-w-4xl max-h-[85vh] flex flex-col">
            <div className="px-6 py-4 border-b border-[hsl(var(--border))] flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center">
                  <Download className="w-5 h-5 text-green-400" />
                </div>
                <div>
                  <h3 className="font-semibold text-white">安装技能</h3>
                  <p className="text-xs text-[hsl(var(--muted-foreground))]">从 ClawdHub 搜索并安装</p>
                </div>
              </div>
              <button onClick={() => { setShowInstall(false); setInstallResults([]); setInstallSearch(''); setSkillDetail(null); }} className="p-2 hover:bg-[hsl(var(--secondary))] rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="flex flex-1 overflow-hidden">
              {/* Search results list */}
              <div className={cn("p-6 overflow-y-auto", skillDetail ? "w-1/2 border-r border-[hsl(var(--border))]" : "w-full")}>
                <div className="flex gap-2 mb-4">
                  <div className="flex-1 relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[hsl(var(--muted-foreground))]" />
                    <input
                      type="text"
                      placeholder="搜索技能名称..."
                      value={installSearch}
                      onChange={(e) => setInstallSearch(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && searchClawdHub()}
                      className="w-full pl-9 pr-4 py-2 bg-[hsl(var(--secondary))] border border-[hsl(var(--border))] rounded-lg text-sm text-white placeholder-[hsl(var(--muted-foreground))] focus:outline-none focus:border-purple-500"
                    />
                  </div>
                  <button
                    onClick={searchClawdHub}
                    disabled={searchingHub || !installSearch.trim()}
                    className="px-4 py-2 bg-purple-600 hover:bg-purple-500 rounded-lg text-sm transition-colors disabled:opacity-50 flex items-center gap-2"
                  >
                    {searchingHub ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                    搜索
                  </button>
                </div>
                
                {/* Sort options */}
                {installResults.length > 0 && (
                  <div className="flex items-center gap-2 mb-3 text-xs">
                    <span className="text-[hsl(var(--muted-foreground))]">排序:</span>
                    <button 
                      onClick={() => setSearchSort('downloads')}
                      className={cn("px-2 py-1 rounded transition-colors", searchSort === 'downloads' ? "bg-purple-500/30 text-purple-300" : "hover:bg-[hsl(var(--secondary))]")}
                    >
                      下载量
                    </button>
                    <button 
                      onClick={() => setSearchSort('stars')}
                      className={cn("px-2 py-1 rounded transition-colors", searchSort === 'stars' ? "bg-purple-500/30 text-purple-300" : "hover:bg-[hsl(var(--secondary))]")}
                    >
                      收藏
                    </button>
                    <button 
                      onClick={() => setSearchSort('updated')}
                      className={cn("px-2 py-1 rounded transition-colors", searchSort === 'updated' ? "bg-purple-500/30 text-purple-300" : "hover:bg-[hsl(var(--secondary))]")}
                    >
                      更新时间
                    </button>
                  </div>
                )}
                
                <div className="space-y-2">
                  {installResults.length === 0 && !searchingHub && (
                    <div className="text-center text-[hsl(var(--muted-foreground))] py-8">
                      <Package className="w-12 h-12 mx-auto mb-3 opacity-50" />
                      <p>输入关键词搜索 ClawdHub 技能</p>
                    </div>
                  )}
                  {searchingHub && (
                    <div className="text-center text-[hsl(var(--muted-foreground))] py-8">
                      <RefreshCw className="w-8 h-8 mx-auto mb-3 animate-spin text-purple-400" />
                      <p>搜索中...</p>
                    </div>
                  )}
                  {[...installResults]
                    .sort((a: any, b: any) => {
                      if (searchSort === 'downloads') return (b.downloads || 0) - (a.downloads || 0);
                      if (searchSort === 'stars') return (b.stars || 0) - (a.stars || 0);
                      if (searchSort === 'updated') return (b.updatedAt || 0) - (a.updatedAt || 0);
                      return 0;
                    })
                    .map((result: any) => {
                    const isInstalled = skills.some(s => s.name === result.name || s.name === result.slug);
                    const isSelected = skillDetail?.slug === result.name || skillDetail?.slug === result.slug;
                    return (
                      <div 
                        key={result.name || result.slug} 
                        onClick={() => { setSkillDetail(result.loaded ? result : null); if (!result.loaded) fetchSkillDetail(result.name); }}
                        className={cn(
                          "p-4 rounded-lg cursor-pointer transition-all",
                          isSelected 
                            ? "bg-purple-500/20 border border-purple-500/50" 
                            : "bg-[hsl(var(--secondary))] hover:bg-[hsl(var(--secondary))]/80"
                        )}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-medium text-white">{result.name || result.slug}</span>
                              {result.version && (
                                <span className="text-xs px-1.5 py-0.5 bg-gray-500/20 text-gray-400 rounded">v{result.version}</span>
                              )}
                              {isInstalled && (
                                <span className="text-xs px-2 py-0.5 bg-green-500/20 text-green-400 rounded">已安装</span>
                              )}
                            </div>
                            <p className="text-sm text-[hsl(var(--muted-foreground))] line-clamp-2 mt-1">{result.description}</p>
                            
                            {/* Stats row */}
                            {result.loaded && (
                              <div className="flex items-center gap-4 mt-2 text-xs text-[hsl(var(--muted-foreground))]">
                                <span className="flex items-center gap-1">
                                  <Download className="w-3 h-3" />
                                  {result.downloads?.toLocaleString() || 0}
                                </span>
                                <span className="flex items-center gap-1">
                                  <Star className="w-3 h-3 text-yellow-500" />
                                  {result.stars || 0}
                                </span>
                                {result.author && (
                                  <span className="flex items-center gap-1">
                                    <User className="w-3 h-3" />
                                    {result.author}
                                  </span>
                                )}
                                {result.updatedAt && (
                                  <span>
                                    更新: {new Date(result.updatedAt).toLocaleDateString('zh-CN')}
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                          
                          {/* Quick install button */}
                          <button
                            onClick={(e) => { e.stopPropagation(); installSkill(result.name || result.slug); }}
                            disabled={installing === (result.name || result.slug) || isInstalled}
                            className={cn(
                              "shrink-0 p-2 rounded-lg transition-colors",
                              isInstalled 
                                ? "bg-green-500/10 text-green-400 cursor-not-allowed"
                                : "bg-green-600 hover:bg-green-500 disabled:opacity-50"
                            )}
                            title={isInstalled ? "已安装" : "安装"}
                          >
                            {installing === (result.name || result.slug) ? (
                              <RefreshCw className="w-4 h-4 animate-spin" />
                            ) : isInstalled ? (
                              <CheckCircle className="w-4 h-4" />
                            ) : (
                              <Download className="w-4 h-4" />
                            )}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
              
              {/* Detail panel */}
              {skillDetail && (
                <div className="w-1/2 p-6 overflow-y-auto">
                  {loadingDetail ? (
                    <div className="flex items-center justify-center h-full">
                      <RefreshCw className="w-6 h-6 animate-spin text-purple-400" />
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="text-xl font-bold text-white">{skillDetail.name}</h3>
                          <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">by {skillDetail.author}</p>
                        </div>
                        <span className="text-xs px-2 py-1 bg-purple-500/20 text-purple-400 rounded">
                          v{skillDetail.version}
                        </span>
                      </div>
                      
                      <p className="text-sm text-[hsl(var(--foreground))]">{skillDetail.description}</p>
                      
                      {/* Stats */}
                      <div className="grid grid-cols-3 gap-3">
                        <div className="bg-[hsl(var(--secondary))] rounded-lg p-3 text-center">
                          <Download className="w-4 h-4 mx-auto mb-1 text-blue-400" />
                          <div className="text-lg font-semibold text-white">{skillDetail.downloads?.toLocaleString()}</div>
                          <div className="text-xs text-[hsl(var(--muted-foreground))]">下载</div>
                        </div>
                        <div className="bg-[hsl(var(--secondary))] rounded-lg p-3 text-center">
                          <Star className="w-4 h-4 mx-auto mb-1 text-yellow-400" />
                          <div className="text-lg font-semibold text-white">{skillDetail.stars}</div>
                          <div className="text-xs text-[hsl(var(--muted-foreground))]">收藏</div>
                        </div>
                        <div className="bg-[hsl(var(--secondary))] rounded-lg p-3 text-center">
                          <Package className="w-4 h-4 mx-auto mb-1 text-green-400" />
                          <div className="text-lg font-semibold text-white">{skillDetail.installs}</div>
                          <div className="text-xs text-[hsl(var(--muted-foreground))]">安装</div>
                        </div>
                      </div>
                      
                      {/* Dates */}
                      <div className="text-xs text-[hsl(var(--muted-foreground))] space-y-1">
                        <div className="flex justify-between">
                          <span>创建时间</span>
                          <span>{new Date(skillDetail.createdAt).toLocaleDateString('zh-CN')}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>更新时间</span>
                          <span>{new Date(skillDetail.updatedAt).toLocaleDateString('zh-CN')}</span>
                        </div>
                      </div>
                      
                      {/* Actions */}
                      <div className="flex gap-2 pt-2">
                        <button
                          onClick={() => installSkill(skillDetail.slug)}
                          disabled={installing === skillDetail.slug || skills.some(s => s.name === skillDetail.slug)}
                          className={cn(
                            "flex-1 px-4 py-2 rounded-lg text-sm transition-colors flex items-center justify-center gap-2",
                            skills.some(s => s.name === skillDetail.slug)
                              ? "bg-gray-500/20 text-gray-400 cursor-not-allowed"
                              : "bg-green-600 hover:bg-green-500 disabled:opacity-50"
                          )}
                        >
                          {installing === skillDetail.slug ? (
                            <><RefreshCw className="w-4 h-4 animate-spin" /> 安装中</>
                          ) : skills.some(s => s.name === skillDetail.slug) ? (
                            <><CheckCircle className="w-4 h-4" /> 已安装</>
                          ) : (
                            <><Download className="w-4 h-4" /> 安装</>
                          )}
                        </button>
                        <a
                          href={skillDetail.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-4 py-2 bg-[hsl(var(--secondary))] hover:bg-[hsl(var(--border))] rounded-lg text-sm transition-colors flex items-center gap-2"
                        >
                          <ExternalLink className="w-4 h-4" />
                          ClawdHub
                        </a>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Skill Detail Modal */}
      {selectedSkill && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[hsl(var(--card))] rounded-2xl border border-[hsl(var(--border))] w-full max-w-4xl max-h-[85vh] flex flex-col">
            <div className="px-6 py-4 border-b border-[hsl(var(--border))] flex items-center justify-between shrink-0">
              <div>
                <div className="font-semibold text-white">{selectedSkill.name}</div>
                <div className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">{selectedSkill.sourceLabel} · {selectedSkill.size} · 更新: {selectedSkill.modified}</div>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={handleCopy} className="flex items-center gap-1.5 px-3 py-1.5 bg-[hsl(var(--secondary))] hover:bg-[hsl(var(--border))] rounded-lg text-sm">
                  {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                  {copied ? '已复制' : '复制'}
                </button>
                {canDelete(selectedSkill) && (
                  <button onClick={() => { setSelectedSkill(null); setDeleteConfirm(selectedSkill); }} className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg text-sm">
                    <Trash2 className="w-4 h-4" />
                    删除
                  </button>
                )}
                <button onClick={() => setSelectedSkill(null)} className="p-2 hover:bg-[hsl(var(--secondary))] rounded-lg">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-auto p-6">
              {contentLoading ? (
                <div className="text-center text-[hsl(var(--muted-foreground))] py-8">加载中...</div>
              ) : (
                <pre className="whitespace-pre-wrap font-mono text-sm text-[hsl(var(--foreground))] leading-relaxed">{skillContent}</pre>
              )}
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
