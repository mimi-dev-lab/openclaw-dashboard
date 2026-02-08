'use client';

import { Layout } from '@/components/Layout';
import { 
  FolderOpen, Github, ExternalLink, Search, RefreshCw, 
  Star, StarOff, X, GitCommit, GitBranch, Play, Square,
  RotateCw, ExternalLink as LinkIcon, Clock, FileText,
  Circle, Loader2
} from 'lucide-react';
import { useState, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';
import ReactMarkdown from 'react-markdown';

interface Project {
  name: string;
  description: string;
  language: string;
  modified: string;
  modifiedMs: number;
  size: string;
  sizeBytes: number;
  path: string;
  hasGit: boolean;
  gitRemote: string | null;
  gitDirty: boolean;
  hasDocker: boolean;
  hasNodeModules: boolean;
  isWebProject: boolean;
  devPort: string | null;
  scripts: string[];
  dependencies: number;
}

interface ProjectDetails {
  readme: string | null;
  gitStatus: {
    clean: boolean;
    modified: number;
    untracked: number;
    staged: number;
    ahead: number;
    behind: number;
    branch: string;
  } | null;
  recentCommits: { hash: string; message: string; time: string }[];
  health: {
    nodeModules: boolean;
    lockfileFresh: boolean;
    hasUncommitted: boolean;
    hasTodos: boolean;
  };
}

interface RunningStatus {
  docker: Record<string, { status: string; port: string | null; raw: string }>;
  ports: Record<string, { command: string; pid: string }>;
}

const languageColors: Record<string, string> = {
  TypeScript: 'bg-blue-500',
  JavaScript: 'bg-yellow-400',
  Python: 'bg-green-500',
  Go: 'bg-cyan-500',
  Rust: 'bg-orange-500',
  Other: 'bg-gray-500',
};

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [languageFilter, setLanguageFilter] = useState('all');
  const [sortBy, setSortBy] = useState<'modified' | 'size' | 'status'>('modified');
  const [sortAsc, setSortAsc] = useState(false);
  
  // Drawer state
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [details, setDetails] = useState<ProjectDetails | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  
  // Running status
  const [runningStatus, setRunningStatus] = useState<RunningStatus>({ docker: {}, ports: {} });
  
  // Favorites
  const [favorites, setFavorites] = useState<string[]>([]);
  
  // Action loading
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const baseUrl = typeof window !== 'undefined' ? `http://${window.location.hostname}:18790` : '';

  const fetchProjects = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${baseUrl}/api/projects`);
      if (res.ok) {
        const data = await res.json();
        setProjects(data.projects || []);
      }
    } catch (e) {
      console.error('Failed to fetch projects:', e);
    } finally {
      setLoading(false);
    }
  };

  const fetchRunningStatus = async () => {
    try {
      const res = await fetch(`${baseUrl}/api/projects/running`);
      if (res.ok) {
        const data = await res.json();
        setRunningStatus({ docker: data.docker || {}, ports: data.ports || {} });
      }
    } catch (e) {
      console.error('Failed to fetch running status:', e);
    }
  };

  const fetchFavorites = async () => {
    try {
      const res = await fetch(`${baseUrl}/api/projects/favorites`);
      if (res.ok) {
        const data = await res.json();
        setFavorites(data.favorites || []);
      }
    } catch (e) {
      console.error('Failed to fetch favorites:', e);
    }
  };

  const fetchDetails = async (project: Project) => {
    setLoadingDetails(true);
    try {
      const res = await fetch(`${baseUrl}/api/projects/details?path=${encodeURIComponent(project.path)}`);
      if (res.ok) {
        const data = await res.json();
        setDetails(data);
      }
    } catch (e) {
      console.error('Failed to fetch details:', e);
    } finally {
      setLoadingDetails(false);
    }
  };

  useEffect(() => {
    fetchProjects();
    fetchRunningStatus();
    fetchFavorites();
    
    // Refresh running status every 10s
    const interval = setInterval(fetchRunningStatus, 10000);
    return () => clearInterval(interval);
  }, []);

  const openDrawer = (project: Project) => {
    setSelectedProject(project);
    setDetails(null);
    fetchDetails(project);
  };

  const closeDrawer = () => {
    setSelectedProject(null);
    setDetails(null);
  };

  const toggleFavorite = async (projectName: string) => {
    const newFavorites = favorites.includes(projectName)
      ? favorites.filter(f => f !== projectName)
      : [...favorites, projectName];
    
    setFavorites(newFavorites);
    
    try {
      await fetch(`${baseUrl}/api/projects/favorites`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ favorites: newFavorites }),
      });
    } catch (e) {
      console.error('Failed to save favorites:', e);
    }
  };

  const handleDockerAction = async (action: string, containerName?: string) => {
    if (!selectedProject) return;
    setActionLoading(action);
    try {
      await fetch(`${baseUrl}/api/projects/docker`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          action, 
          containerName: containerName || selectedProject.name,
          projectPath: selectedProject.path 
        }),
      });
      // Refresh running status
      setTimeout(fetchRunningStatus, 2000);
    } catch (e) {
      console.error('Docker action failed:', e);
    } finally {
      setActionLoading(null);
    }
  };

  // Get the host for service URLs (use same host as current page, which works with Tailscale)
  const serviceHost = typeof window !== 'undefined' ? window.location.hostname : 'localhost';

  const getProjectRunningStatus = useCallback((project: Project) => {
    // Check Docker container
    const dockerStatus = runningStatus.docker[project.name];
    if (dockerStatus?.status === 'running') {
      return { 
        running: true, 
        type: 'docker', 
        port: dockerStatus.port,
        url: dockerStatus.port ? `http://${serviceHost}:${dockerStatus.port}` : null
      };
    }
    
    // Check dev port
    if (project.devPort && runningStatus.ports[project.devPort]) {
      return { 
        running: true, 
        type: 'dev', 
        port: project.devPort,
        url: `http://${serviceHost}:${project.devPort}`
      };
    }
    
    // Check common ports for this project type
    const commonPorts = ['3000', '3001', '5173', '8000', '8080'];
    for (const port of commonPorts) {
      if (runningStatus.ports[port]) {
        // Can't be sure it's this project, skip
      }
    }
    
    return { running: false, type: null, port: null, url: null };
  }, [runningStatus, serviceHost]);

  const handleSort = (key: typeof sortBy) => {
    if (sortBy === key) setSortAsc(!sortAsc);
    else { setSortBy(key); setSortAsc(false); }
  };

  const filteredProjects = projects
    .filter(p => {
      if (languageFilter !== 'all' && p.language !== languageFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        return p.name.toLowerCase().includes(q) || p.description.toLowerCase().includes(q);
      }
      return true;
    })
    .sort((a, b) => {
      // Favorites first
      const aFav = favorites.includes(a.name) ? 1 : 0;
      const bFav = favorites.includes(b.name) ? 1 : 0;
      if (aFav !== bFav) return bFav - aFav;
      
      // Then by sort criteria
      let cmp = 0;
      if (sortBy === 'modified') {
        cmp = a.modifiedMs - b.modifiedMs;
      } else if (sortBy === 'size') {
        cmp = a.sizeBytes - b.sizeBytes;
      } else if (sortBy === 'status') {
        const aRunning = getProjectRunningStatus(a).running ? 1 : 0;
        const bRunning = getProjectRunningStatus(b).running ? 1 : 0;
        cmp = aRunning - bRunning;
      }
      return sortAsc ? cmp : -cmp;
    });

  const languageCounts = projects.reduce((acc, p) => {
    acc[p.language] = (acc[p.language] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const runningCount = projects.filter(p => getProjectRunningStatus(p).running).length;

  return (
    <Layout>
      <div className="p-8">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">项目</h1>
            <p className="text-[hsl(var(--muted-foreground))] mt-1">
              {filteredProjects.length} 个项目
              {runningCount > 0 && (
                <span className="ml-2 text-green-400">• {runningCount} 个运行中</span>
              )}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <a
              href="https://github.com/mimi-dev-lab"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-4 py-2 bg-[hsl(var(--secondary))] hover:bg-[hsl(var(--border))] rounded-lg text-sm transition-colors"
            >
              <Github className="w-4 h-4" />
              GitHub
              <ExternalLink className="w-3 h-3" />
            </a>
            <button
              onClick={() => { fetchProjects(); fetchRunningStatus(); }}
              disabled={loading}
              className="p-2 bg-[hsl(var(--secondary))] hover:bg-[hsl(var(--border))] rounded-lg transition-colors"
            >
              <RefreshCw className={cn('w-5 h-5', loading && 'animate-spin')} />
            </button>
          </div>
        </div>

        {/* Running Services Quick Access */}
        {runningCount > 0 && (
          <div className="mb-6 bg-[hsl(var(--card))] rounded-xl border border-[hsl(var(--border))] p-4">
            <div className="flex items-center gap-2 mb-3">
              <Circle className="w-3 h-3 text-green-400 fill-green-400" />
              <span className="text-sm font-medium text-white">运行中 ({runningCount})</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {projects
                .map(p => ({ project: p, status: getProjectRunningStatus(p) }))
                .filter(({ status }) => status.running)
                .map(({ project, status }) => (
                  <a
                    key={project.path}
                    href={status.url || '#'}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 px-3 py-2 bg-green-600/20 hover:bg-green-600/30 border border-green-600/30 rounded-lg text-sm transition-colors"
                  >
                    <span className="text-white font-medium">{project.name}</span>
                    <span className="text-green-400">:{status.port}</span>
                    <ExternalLink className="w-3 h-3 text-green-400" />
                  </a>
                ))
              }
            </div>
          </div>
        )}

        {/* Search */}
        <div className="mb-6">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[hsl(var(--muted-foreground))]" />
            <input
              type="text"
              placeholder="搜索项目..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-lg text-sm text-white placeholder-[hsl(var(--muted-foreground))] focus:outline-none focus:border-purple-500"
            />
          </div>
        </div>

        {/* Table */}
        <div className="bg-[hsl(var(--card))] rounded-xl border border-[hsl(var(--border))] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-[hsl(var(--secondary))]">
                <tr>
                  <th className="px-4 py-3 w-10"></th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-[hsl(var(--muted-foreground))] uppercase tracking-wider">项目</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-[hsl(var(--muted-foreground))] uppercase tracking-wider">语言</th>
                  <th 
                    onClick={() => handleSort('status')}
                    className="px-4 py-3 text-left text-xs font-medium text-[hsl(var(--muted-foreground))] uppercase tracking-wider cursor-pointer hover:text-white"
                  >
                    <span className="flex items-center gap-1">
                      状态
                      {sortBy === 'status' && <span>{sortAsc ? '↑' : '↓'}</span>}
                    </span>
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-[hsl(var(--muted-foreground))] uppercase tracking-wider">访问</th>
                  <th 
                    onClick={() => handleSort('size')}
                    className="px-4 py-3 text-left text-xs font-medium text-[hsl(var(--muted-foreground))] uppercase tracking-wider cursor-pointer hover:text-white"
                  >
                    <span className="flex items-center gap-1">
                      大小
                      {sortBy === 'size' && <span>{sortAsc ? '↑' : '↓'}</span>}
                    </span>
                  </th>
                  <th 
                    onClick={() => handleSort('modified')}
                    className="px-4 py-3 text-left text-xs font-medium text-[hsl(var(--muted-foreground))] uppercase tracking-wider cursor-pointer hover:text-white"
                  >
                    <span className="flex items-center gap-1">
                      更新
                      {sortBy === 'modified' && <span>{sortAsc ? '↑' : '↓'}</span>}
                    </span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[hsl(var(--border))]">
                {loading ? (
                  <tr><td colSpan={7} className="px-4 py-8 text-center text-[hsl(var(--muted-foreground))]">加载中...</td></tr>
                ) : filteredProjects.length === 0 ? (
                  <tr><td colSpan={7} className="px-4 py-8 text-center text-[hsl(var(--muted-foreground))]">没有找到项目</td></tr>
                ) : filteredProjects.map((project) => {
                  const status = getProjectRunningStatus(project);
                  const isFavorite = favorites.includes(project.name);
                  
                  return (
                    <tr 
                      key={project.path} 
                      className="hover:bg-[hsl(var(--secondary))] transition-colors cursor-pointer"
                      onClick={() => openDrawer(project)}
                    >
                      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => toggleFavorite(project.name)}
                          className={cn(
                            'p-1 rounded transition-colors',
                            isFavorite ? 'text-yellow-400' : 'text-[hsl(var(--muted-foreground))] hover:text-yellow-400'
                          )}
                        >
                          {isFavorite ? <Star className="w-4 h-4 fill-current" /> : <StarOff className="w-4 h-4" />}
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-purple-600/20 flex items-center justify-center shrink-0">
                            <FolderOpen className="w-4 h-4 text-purple-400" />
                          </div>
                          <div>
                            <div className="font-medium text-white">{project.name}</div>
                            {project.description && (
                              <div className="text-xs text-[hsl(var(--muted-foreground))] line-clamp-1 max-w-xs">
                                {project.description}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="flex items-center gap-1.5 text-xs">
                          <span className={cn('w-2.5 h-2.5 rounded-full', languageColors[project.language] || 'bg-gray-500')} />
                          {project.language}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {status.running ? (
                            <span className="flex items-center gap-1.5 text-xs px-2 py-1 rounded-full bg-green-500/20 text-green-400">
                              <Circle className="w-2 h-2 fill-current" />
                              {status.type === 'docker' ? 'Docker' : 'Dev'}
                            </span>
                          ) : project.hasDocker ? (
                            <span className="flex items-center gap-1.5 text-xs px-2 py-1 rounded-full bg-gray-500/20 text-gray-400">
                              <Circle className="w-2 h-2" />
                              停止
                            </span>
                          ) : (
                            <span className="text-xs text-[hsl(var(--muted-foreground))]">-</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        {status.url ? (
                          <a
                            href={status.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-xs text-purple-400 hover:text-purple-300"
                          >
                            <LinkIcon className="w-3 h-3" />
                            :{status.port}
                          </a>
                        ) : project.gitRemote ? (
                          <a
                            href={project.gitRemote}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-xs text-[hsl(var(--muted-foreground))] hover:text-white"
                          >
                            <Github className="w-3 h-3" />
                            GitHub
                          </a>
                        ) : (
                          <span className="text-xs text-[hsl(var(--muted-foreground))]">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs text-[hsl(var(--muted-foreground))]">{project.size}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs text-[hsl(var(--muted-foreground))]">{project.modified}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Drawer */}
      {selectedProject && (
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-black/50 z-40"
            onClick={closeDrawer}
          />
          
          {/* Drawer Panel */}
          <div className="fixed right-0 top-0 h-full w-[600px] max-w-[90vw] bg-[hsl(var(--card))] border-l border-[hsl(var(--border))] z-50 overflow-hidden flex flex-col animate-in slide-in-from-right duration-300">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-[hsl(var(--border))]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-purple-600/20 flex items-center justify-center">
                  <FolderOpen className="w-5 h-5 text-purple-400" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-white">{selectedProject.name}</h2>
                  <p className="text-sm text-[hsl(var(--muted-foreground))]">{selectedProject.language}</p>
                </div>
              </div>
              <button
                onClick={closeDrawer}
                className="p-2 hover:bg-[hsl(var(--secondary))] rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-[hsl(var(--muted-foreground))]" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {loadingDetails ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-6 h-6 animate-spin text-purple-400" />
                </div>
              ) : (
                <>
                  {/* Quick Actions */}
                  <div className="flex flex-wrap gap-2">
                    {(() => {
                      const status = getProjectRunningStatus(selectedProject);
                      if (status.running) {
                        return (
                          <>
                            <a
                              href={status.url || '#'}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-500 rounded-lg text-sm transition-colors"
                            >
                              <ExternalLink className="w-4 h-4" />
                              打开 :{status.port}
                            </a>
                            {status.type === 'docker' && (
                              <button
                                onClick={() => handleDockerAction('stop')}
                                disabled={actionLoading === 'stop'}
                                className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-500 rounded-lg text-sm transition-colors disabled:opacity-50"
                              >
                                {actionLoading === 'stop' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Square className="w-4 h-4" />}
                                停止
                              </button>
                            )}
                          </>
                        );
                      } else if (selectedProject.hasDocker) {
                        return (
                          <>
                            <button
                              onClick={() => handleDockerAction('start')}
                              disabled={actionLoading === 'start'}
                              className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-500 rounded-lg text-sm transition-colors disabled:opacity-50"
                            >
                              {actionLoading === 'start' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                              启动
                            </button>
                            <button
                              onClick={() => handleDockerAction('build-start')}
                              disabled={actionLoading === 'build-start'}
                              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm transition-colors disabled:opacity-50"
                            >
                              {actionLoading === 'build-start' ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCw className="w-4 h-4" />}
                              构建并启动
                            </button>
                          </>
                        );
                      }
                      return null;
                    })()}
                    
                    {selectedProject.gitRemote && (
                      <a
                        href={selectedProject.gitRemote}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 px-4 py-2 bg-[hsl(var(--secondary))] hover:bg-[hsl(var(--border))] rounded-lg text-sm transition-colors"
                      >
                        <Github className="w-4 h-4" />
                        GitHub
                      </a>
                    )}
                  </div>

                  {/* Git Status */}
                  {details?.gitStatus && (
                    <div className="bg-[hsl(var(--secondary))] rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <GitBranch className="w-4 h-4 text-purple-400" />
                        <span className="font-medium text-white">Git</span>
                        <span className="text-sm text-[hsl(var(--muted-foreground))] font-mono">{details.gitStatus.branch}</span>
                      </div>
                      <div className="flex items-center gap-4 text-sm">
                        <span className={details.gitStatus.clean ? 'text-green-400' : 'text-yellow-400'}>
                          {details.gitStatus.clean ? '✓ 干净' : `${details.gitStatus.modified} 修改, ${details.gitStatus.untracked} 未跟踪`}
                        </span>
                        {details.gitStatus.ahead > 0 && (
                          <span className="text-green-400">↑ {details.gitStatus.ahead}</span>
                        )}
                        {details.gitStatus.behind > 0 && (
                          <span className="text-red-400">↓ {details.gitStatus.behind}</span>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Recent Commits */}
                  {details?.recentCommits && details.recentCommits.length > 0 && (
                    <div>
                      <h3 className="flex items-center gap-2 text-sm font-medium text-white mb-3">
                        <GitCommit className="w-4 h-4 text-purple-400" />
                        最近提交
                      </h3>
                      <div className="space-y-2">
                        {details.recentCommits.map((commit) => (
                          <div key={commit.hash} className="flex items-start gap-3 text-sm">
                            <span className="font-mono text-purple-400 shrink-0">{commit.hash}</span>
                            <span className="text-white flex-1 line-clamp-1">{commit.message}</span>
                            <span className="text-[hsl(var(--muted-foreground))] shrink-0 flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {commit.time}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* README */}
                  {details?.readme && (
                    <div>
                      <h3 className="flex items-center gap-2 text-sm font-medium text-white mb-3">
                        <FileText className="w-4 h-4 text-purple-400" />
                        README
                      </h3>
                      <div className="bg-[hsl(var(--secondary))] rounded-lg p-4 prose prose-invert prose-sm max-w-none overflow-x-auto">
                        <ReactMarkdown
                          components={{
                            h1: ({ children }) => <h1 className="text-xl font-bold text-white mt-0 mb-4">{children}</h1>,
                            h2: ({ children }) => <h2 className="text-lg font-semibold text-white mt-6 mb-3">{children}</h2>,
                            h3: ({ children }) => <h3 className="text-base font-medium text-white mt-4 mb-2">{children}</h3>,
                            p: ({ children }) => <p className="text-[hsl(var(--muted-foreground))] mb-3">{children}</p>,
                            ul: ({ children }) => <ul className="list-disc list-inside text-[hsl(var(--muted-foreground))] mb-3">{children}</ul>,
                            ol: ({ children }) => <ol className="list-decimal list-inside text-[hsl(var(--muted-foreground))] mb-3">{children}</ol>,
                            li: ({ children }) => <li className="mb-1">{children}</li>,
                            code: ({ className, children }) => {
                              const isInline = !className;
                              return isInline 
                                ? <code className="bg-[hsl(var(--card))] px-1.5 py-0.5 rounded text-purple-300 text-xs">{children}</code>
                                : <code className="block bg-[hsl(var(--card))] p-3 rounded-lg text-xs overflow-x-auto">{children}</code>;
                            },
                            pre: ({ children }) => <pre className="bg-[hsl(var(--card))] p-3 rounded-lg overflow-x-auto mb-3">{children}</pre>,
                            a: ({ href, children }) => <a href={href} target="_blank" rel="noopener noreferrer" className="text-purple-400 hover:underline">{children}</a>,
                            strong: ({ children }) => <strong className="text-white font-semibold">{children}</strong>,
                            blockquote: ({ children }) => <blockquote className="border-l-2 border-purple-500 pl-4 italic text-[hsl(var(--muted-foreground))]">{children}</blockquote>,
                          }}
                        >
                          {details.readme}
                        </ReactMarkdown>
                      </div>
                    </div>
                  )}

                  {/* Project Info */}
                  <div className="bg-[hsl(var(--secondary))] rounded-lg p-4">
                    <h3 className="text-sm font-medium text-white mb-3">项目信息</h3>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <span className="text-[hsl(var(--muted-foreground))]">大小</span>
                        <span className="text-white ml-2">{selectedProject.size}</span>
                      </div>
                      <div>
                        <span className="text-[hsl(var(--muted-foreground))]">依赖</span>
                        <span className="text-white ml-2">{selectedProject.dependencies} 个</span>
                      </div>
                      <div>
                        <span className="text-[hsl(var(--muted-foreground))]">更新</span>
                        <span className="text-white ml-2">{selectedProject.modified}</span>
                      </div>
                      <div>
                        <span className="text-[hsl(var(--muted-foreground))]">路径</span>
                        <span className="text-white ml-2 text-xs font-mono">{selectedProject.path.replace('/Users/lifan/clawd/projects/', '')}</span>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </>
      )}
    </Layout>
  );
}
