'use client';

import { Layout } from '@/components/Layout';
import { 
  FileOutput, Image, FileText, FileCode, Folder, Download, Trash2, 
  RefreshCw, X, Search, AlertTriangle, Star, Settings, 
  CheckSquare, Square, HardDrive, Sparkles, Lock, Unlock,
  ArrowUpDown, ArrowUp, ArrowDown, Grid, List, Package,
  PieChart
} from 'lucide-react';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { cn } from '@/lib/utils';

interface OutputFile {
  name: string;
  folder: string;
  size: string;
  sizeBytes?: number;
  modified: string;
  modifiedTs?: number;
  path: string;
}

interface FolderStats {
  name: string;
  count: number;
  size: number;
}

interface CleanupSettings {
  enabled: boolean;
  globalRetentionDays: number;
  folderRetention: Record<string, number>;
  maxSizeMB: number;
  sizeCleanupEnabled: boolean;
  protectRecent24h: boolean;
}

type SortField = 'name' | 'folder' | 'size' | 'modified';
type SortOrder = 'asc' | 'desc';
type ViewMode = 'list' | 'grid';

const DEFAULT_CLEANUP_SETTINGS: CleanupSettings = {
  enabled: true,
  globalRetentionDays: 30,
  folderRetention: {
    cards: 7,
    documents: 90,
    'icons/attributes': 14,
    images: 30,
  },
  maxSizeMB: 500,
  sizeCleanupEnabled: true,
  protectRecent24h: true,
};

const folderIcons: Record<string, { icon: React.ElementType; color: string }> = {
  images: { icon: Image, color: 'text-pink-400' },
  documents: { icon: FileText, color: 'text-blue-400' },
  data: { icon: FileCode, color: 'text-green-400' },
  web: { icon: Folder, color: 'text-orange-400' },
  cards: { icon: Image, color: 'text-purple-400' },
  'icons/attributes': { icon: Sparkles, color: 'text-cyan-400' },
  root: { icon: FileOutput, color: 'text-purple-400' },
};

// Pie chart colors
const PIE_COLORS = [
  '#a855f7', // purple
  '#ec4899', // pink
  '#3b82f6', // blue
  '#22c55e', // green
  '#f97316', // orange
  '#06b6d4', // cyan
  '#eab308', // yellow
  '#ef4444', // red
];

function getFileIcon(filename: string): { icon: React.ElementType; color: string } {
  const ext = filename.split('.').pop()?.toLowerCase();
  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(ext || '')) {
    return { icon: Image, color: 'text-pink-400' };
  }
  if (['md', 'txt', 'doc', 'pdf'].includes(ext || '')) {
    return { icon: FileText, color: 'text-blue-400' };
  }
  if (['json', 'csv', 'xml', 'yaml', 'yml'].includes(ext || '')) {
    return { icon: FileCode, color: 'text-green-400' };
  }
  return { icon: FileText, color: 'text-gray-400' };
}

function isPreviewable(filename: string): 'image' | 'text' | null {
  const ext = filename.split('.').pop()?.toLowerCase();
  if (['png', 'jpg', 'jpeg', 'gif', 'webp'].includes(ext || '')) return 'image';
  if (['md', 'txt', 'json', 'csv', 'yaml', 'yml', 'xml', 'html', 'css', 'js', 'ts'].includes(ext || '')) return 'text';
  return null;
}

function isImageFile(filename: string): boolean {
  const ext = filename.split('.').pop()?.toLowerCase();
  return ['png', 'jpg', 'jpeg', 'gif', 'webp'].includes(ext || '');
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function parseSize(sizeStr: string): number {
  const match = sizeStr.match(/^([\d.]+)\s*(B|KB|MB|GB)$/i);
  if (!match) return 0;
  const num = parseFloat(match[1]);
  const unit = match[2].toUpperCase();
  const multipliers: Record<string, number> = { B: 1, KB: 1024, MB: 1024 * 1024, GB: 1024 * 1024 * 1024 };
  return num * (multipliers[unit] || 1);
}

function parseRelativeTime(timeStr: string): number {
  const now = Date.now();
  if (timeStr.includes('秒前')) {
    const secs = parseInt(timeStr) || 0;
    return now - secs * 1000;
  }
  if (timeStr.includes('分钟前')) {
    const mins = parseInt(timeStr) || 0;
    return now - mins * 60 * 1000;
  }
  if (timeStr.includes('小时前')) {
    const hours = parseInt(timeStr) || 0;
    return now - hours * 60 * 60 * 1000;
  }
  if (timeStr.includes('天前')) {
    const days = parseInt(timeStr) || 0;
    return now - days * 24 * 60 * 60 * 1000;
  }
  return now;
}

function formatFullDate(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getDaysOld(modifiedTs: number): number {
  return Math.floor((Date.now() - modifiedTs) / (24 * 60 * 60 * 1000));
}

// Simple Pie Chart Component
function PieChartComponent({ data }: { data: { name: string; value: number; color: string }[] }) {
  const total = data.reduce((sum, d) => sum + d.value, 0);
  if (total === 0) return null;
  
  let currentAngle = -90; // Start from top
  
  const paths = data.map((segment, i) => {
    const percentage = segment.value / total;
    const angle = percentage * 360;
    const startAngle = currentAngle;
    const endAngle = currentAngle + angle;
    currentAngle = endAngle;
    
    // Calculate arc path
    const startRad = (startAngle * Math.PI) / 180;
    const endRad = (endAngle * Math.PI) / 180;
    const x1 = 50 + 40 * Math.cos(startRad);
    const y1 = 50 + 40 * Math.sin(startRad);
    const x2 = 50 + 40 * Math.cos(endRad);
    const y2 = 50 + 40 * Math.sin(endRad);
    const largeArc = angle > 180 ? 1 : 0;
    
    const pathD = `M 50 50 L ${x1} ${y1} A 40 40 0 ${largeArc} 1 ${x2} ${y2} Z`;
    
    return (
      <path
        key={i}
        d={pathD}
        fill={segment.color}
        className="hover:opacity-80 transition-opacity cursor-pointer"
      >
        <title>{segment.name}: {formatBytes(segment.value)} ({(percentage * 100).toFixed(1)}%)</title>
      </path>
    );
  });
  
  return (
    <svg viewBox="0 0 100 100" className="w-full h-full">
      {paths}
      {/* Center hole for donut effect */}
      <circle cx="50" cy="50" r="20" fill="hsl(var(--card))" />
    </svg>
  );
}

export default function OutputPage() {
  const [files, setFiles] = useState<OutputFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [folderFilter, setFolderFilter] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ file: OutputFile; content: string | null; type: 'image' | 'text' } | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<OutputFile | null>(null);
  const [deleting, setDeleting] = useState(false);
  
  // File management states
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [locked, setLocked] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [selectMode, setSelectMode] = useState(false);
  const [showCleanupSettings, setShowCleanupSettings] = useState(false);
  const [cleanupSettings, setCleanupSettings] = useState<CleanupSettings>(DEFAULT_CLEANUP_SETTINGS);
  const [showCleanupPreview, setShowCleanupPreview] = useState(false);
  const [cleaningUp, setCleaningUp] = useState(false);
  
  // New states for enhanced features
  const [sortField, setSortField] = useState<SortField>('modified');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [showStorageAnalysis, setShowStorageAnalysis] = useState(false);
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);
  const [pendingDeleteFiles, setPendingDeleteFiles] = useState<OutputFile[]>([]);
  const [lastClickedIndex, setLastClickedIndex] = useState<number | null>(null);

  const baseUrl = typeof window !== 'undefined' ? `http://${window.location.hostname}:18790` : '';

  // Load settings from localStorage
  useEffect(() => {
    const savedFavorites = localStorage.getItem('output-favorites');
    const savedLocked = localStorage.getItem('output-locked');
    const savedSettings = localStorage.getItem('output-cleanup-settings');
    const savedViewMode = localStorage.getItem('output-view-mode');
    
    if (savedFavorites) setFavorites(new Set(JSON.parse(savedFavorites)));
    if (savedLocked) setLocked(new Set(JSON.parse(savedLocked)));
    if (savedSettings) setCleanupSettings({ ...DEFAULT_CLEANUP_SETTINGS, ...JSON.parse(savedSettings) });
    if (savedViewMode) setViewMode(savedViewMode as ViewMode);
  }, []);

  const saveFavorites = useCallback((favs: Set<string>) => {
    localStorage.setItem('output-favorites', JSON.stringify([...favs]));
    setFavorites(favs);
  }, []);

  const saveLocked = useCallback((locks: Set<string>) => {
    localStorage.setItem('output-locked', JSON.stringify([...locks]));
    setLocked(locks);
  }, []);

  const saveCleanupSettings = useCallback((settings: CleanupSettings) => {
    localStorage.setItem('output-cleanup-settings', JSON.stringify(settings));
    setCleanupSettings(settings);
  }, []);

  const saveViewMode = useCallback((mode: ViewMode) => {
    localStorage.setItem('output-view-mode', mode);
    setViewMode(mode);
  }, []);

  const fetchFiles = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${baseUrl}/api/output`);
      if (res.ok) {
        const data = await res.json();
        const filesWithMeta = (data.files || []).map((f: OutputFile) => ({
          ...f,
          sizeBytes: parseSize(f.size),
          modifiedTs: parseRelativeTime(f.modified),
        }));
        setFiles(filesWithMeta);
      }
    } catch (e) {
      console.error('Failed to fetch output files:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFiles();
  }, []);

  const handlePreview = async (file: OutputFile) => {
    const type = isPreviewable(file.name);
    if (!type) return;

    setLoadingPreview(true);
    setPreview({ file, content: null, type });

    if (type === 'image') {
      setPreview({ file, content: `${baseUrl}/api/output/file?path=${encodeURIComponent(file.path)}`, type });
      setLoadingPreview(false);
    } else {
      try {
        const res = await fetch(`${baseUrl}/api/output/read?path=${encodeURIComponent(file.path)}`);
        if (res.ok) {
          const data = await res.json();
          setPreview({ file, content: data.content || '', type });
        }
      } catch (e) {
        console.error('Failed to load preview:', e);
      } finally {
        setLoadingPreview(false);
      }
    }
  };

  const handleDownload = (file: OutputFile) => {
    const url = `${baseUrl}/api/output/file?path=${encodeURIComponent(file.path)}&download=1`;
    window.open(url, '_blank');
  };

  // Batch download - trigger downloads one by one
  const handleBatchDownload = async () => {
    if (selected.size === 0) return;
    
    const paths = [...selected];
    
    // Create hidden iframe for downloads
    for (let i = 0; i < paths.length; i++) {
      const path = paths[i];
      const url = `${baseUrl}/api/output/file?path=${encodeURIComponent(path)}&download=1`;
      
      // Stagger downloads to avoid browser blocking
      setTimeout(() => {
        const iframe = document.createElement('iframe');
        iframe.style.display = 'none';
        iframe.src = url;
        document.body.appendChild(iframe);
        
        // Clean up iframe after download starts
        setTimeout(() => {
          document.body.removeChild(iframe);
        }, 5000);
      }, i * 300); // 300ms delay between each download
    }
  };

  const handleDelete = async (file: OutputFile) => {
    if (locked.has(file.path)) {
      alert('此文件已锁定，请先解锁');
      return;
    }
    setDeleting(true);
    try {
      const res = await fetch(`${baseUrl}/api/output/delete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: file.path }),
      });
      if (res.ok) {
        setFiles(files.filter(f => f.path !== file.path));
        setDeleteConfirm(null);
        if (favorites.has(file.path)) {
          const newFavs = new Set(favorites);
          newFavs.delete(file.path);
          saveFavorites(newFavs);
        }
        if (locked.has(file.path)) {
          const newLocked = new Set(locked);
          newLocked.delete(file.path);
          saveLocked(newLocked);
        }
      }
    } catch (e) {
      console.error('Failed to delete file:', e);
    } finally {
      setDeleting(false);
    }
  };

  const toggleFavorite = (path: string) => {
    const newFavs = new Set(favorites);
    if (newFavs.has(path)) {
      newFavs.delete(path);
    } else {
      newFavs.add(path);
    }
    saveFavorites(newFavs);
  };

  const toggleLocked = (path: string) => {
    const newLocked = new Set(locked);
    if (newLocked.has(path)) {
      newLocked.delete(path);
    } else {
      newLocked.add(path);
    }
    saveLocked(newLocked);
  };

  const toggleSelect = (path: string, shiftKey: boolean = false) => {
    const currentIndex = filteredFiles.findIndex(f => f.path === path);
    
    // Shift+Click range selection
    if (shiftKey && lastClickedIndex !== null && currentIndex !== -1) {
      const start = Math.min(lastClickedIndex, currentIndex);
      const end = Math.max(lastClickedIndex, currentIndex);
      const newSelected = new Set(selected);
      
      for (let i = start; i <= end; i++) {
        const file = filteredFiles[i];
        if (!favorites.has(file.path) && !locked.has(file.path)) {
          newSelected.add(file.path);
        }
      }
      setSelected(newSelected);
    } else {
      // Normal toggle
      const newSelected = new Set(selected);
      if (newSelected.has(path)) {
        newSelected.delete(path);
      } else {
        newSelected.add(path);
      }
      setSelected(newSelected);
    }
    
    setLastClickedIndex(currentIndex);
  };

  // Fixed: Select all skips favorites and locked files
  const selectAll = () => {
    const selectableFiles = filteredFiles.filter(f => !favorites.has(f.path) && !locked.has(f.path));
    setSelected(new Set(selectableFiles.map(f => f.path)));
  };

  const selectNone = () => {
    setSelected(new Set());
    setLastClickedIndex(null);
  };

  // Fixed: Cleanup calculation based on retention days, not 24h protection
  const getFilesToCleanup = useCallback(() => {
    return files.filter(file => {
      // Skip favorites
      if (favorites.has(file.path)) return false;
      // Skip locked
      if (locked.has(file.path)) return false;
      
      const daysOld = getDaysOld(file.modifiedTs || Date.now());
      
      // Protect recent 24h if enabled
      if (cleanupSettings.protectRecent24h && daysOld < 1) {
        return false;
      }
      
      // Check folder-specific retention
      const folderRetention = cleanupSettings.folderRetention[file.folder];
      const retentionDays = folderRetention ?? cleanupSettings.globalRetentionDays;
      
      return daysOld >= retentionDays;
    });
  }, [files, favorites, locked, cleanupSettings]);

  const handleBulkCleanup = async () => {
    const toDelete = showCleanupPreview 
      ? getFilesToCleanup() 
      : [...selected].map(p => files.find(f => f.path === p)).filter(Boolean) as OutputFile[];
    
    if (toDelete.length === 0) {
      alert('没有文件需要删除');
      return;
    }

    // Show custom confirmation modal
    setPendingDeleteFiles(toDelete);
    setShowBulkDeleteConfirm(true);
  };

  // Execute the actual bulk delete
  const executeBulkDelete = async () => {
    const toDelete = pendingDeleteFiles;
    if (toDelete.length === 0) return;

    setCleaningUp(true);
    let deleted = 0;
    const deletedPaths: string[] = [];
    
    for (const file of toDelete) {
      if (locked.has(file.path)) continue;
      try {
        const res = await fetch(`${baseUrl}/api/output/delete`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ path: file.path }),
        });
        const data = await res.json();
        if (res.ok && data.ok) {
          deleted++;
          deletedPaths.push(file.path);
        }
      } catch (e) {
        // Silent fail
      }
    }
    
    // Clean up favorites and locked for deleted files
    const newFavs = new Set(favorites);
    const newLocked = new Set(locked);
    deletedPaths.forEach(p => {
      newFavs.delete(p);
      newLocked.delete(p);
    });
    if (newFavs.size !== favorites.size) saveFavorites(newFavs);
    if (newLocked.size !== locked.size) saveLocked(newLocked);
    
    setCleaningUp(false);
    setShowCleanupPreview(false);
    setShowBulkDeleteConfirm(false);
    setPendingDeleteFiles([]);
    setSelected(new Set());
    
    if (deleted > 0) {
      // Force refresh to update the list
      await fetchFiles();
    }
  };

  // Sorting
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder(field === 'name' ? 'asc' : 'desc');
    }
  };

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) return <ArrowUpDown className="w-3 h-3 opacity-30" />;
    return sortOrder === 'asc' 
      ? <ArrowUp className="w-3 h-3 text-purple-400" /> 
      : <ArrowDown className="w-3 h-3 text-purple-400" />;
  };

  // Calculate stats
  const totalSize = files.reduce((acc, f) => acc + (f.sizeBytes || 0), 0);
  const maxSizeBytes = cleanupSettings.maxSizeMB * 1024 * 1024;
  const usagePercent = Math.min(100, Math.round((totalSize / maxSizeBytes) * 100));
  
  const folderStats = useMemo(() => {
    return files.reduce((acc, file) => {
      const folder = file.folder || 'root';
      if (!acc[folder]) acc[folder] = { name: folder, count: 0, size: 0 };
      acc[folder].count++;
      acc[folder].size += file.sizeBytes || 0;
      return acc;
    }, {} as Record<string, FolderStats>);
  }, [files]);

  // Selected files size
  const selectedSize = useMemo(() => {
    return [...selected].reduce((acc, path) => {
      const file = files.find(f => f.path === path);
      return acc + (file?.sizeBytes || 0);
    }, 0);
  }, [selected, files]);

  // Pie chart data
  const pieData = useMemo(() => {
    return Object.values(folderStats).map((folder, i) => ({
      name: folder.name,
      value: folder.size,
      color: PIE_COLORS[i % PIE_COLORS.length],
    }));
  }, [folderStats]);

  // Filtered and sorted files
  const filteredFiles = useMemo(() => {
    let result = files.filter(f => {
      if (folderFilter && f.folder !== folderFilter) return false;
      if (search) {
        return f.name.toLowerCase().includes(search.toLowerCase());
      }
      return true;
    });

    // Sort
    result.sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case 'name':
          cmp = a.name.localeCompare(b.name);
          break;
        case 'folder':
          cmp = a.folder.localeCompare(b.folder);
          break;
        case 'size':
          cmp = (a.sizeBytes || 0) - (b.sizeBytes || 0);
          break;
        case 'modified':
          cmp = (a.modifiedTs || 0) - (b.modifiedTs || 0);
          break;
      }
      return sortOrder === 'asc' ? cmp : -cmp;
    });

    // Favorites and locked always on top (after sort)
    result.sort((a, b) => {
      const aFav = favorites.has(a.path) ? 2 : locked.has(a.path) ? 1 : 0;
      const bFav = favorites.has(b.path) ? 2 : locked.has(b.path) ? 1 : 0;
      return bFav - aFav;
    });

    return result;
  }, [files, folderFilter, search, sortField, sortOrder, favorites, locked]);

  const filesToCleanup = getFilesToCleanup();

  // Check if current folder filter is an image folder
  const isImageFolder = folderFilter && ['images', 'cards', 'icons/attributes'].includes(folderFilter);

  return (
    <Layout>
      <div className="p-8">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">输出文件</h1>
            <p className="text-[hsl(var(--muted-foreground))] mt-1">
              {files.length} 个文件 · {formatBytes(totalSize)}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowStorageAnalysis(!showStorageAnalysis)}
              className={cn(
                "p-2 rounded-lg transition-colors",
                showStorageAnalysis ? "bg-purple-600 text-white" : "bg-[hsl(var(--secondary))] hover:bg-[hsl(var(--border))]"
              )}
              title="存储分析"
            >
              <PieChart className="w-5 h-5" />
            </button>
            <button
              onClick={() => setShowCleanupSettings(!showCleanupSettings)}
              className={cn(
                "p-2 rounded-lg transition-colors",
                showCleanupSettings ? "bg-purple-600 text-white" : "bg-[hsl(var(--secondary))] hover:bg-[hsl(var(--border))]"
              )}
              title="清理设置"
            >
              <Settings className="w-5 h-5" />
            </button>
            <button
              onClick={() => setShowCleanupPreview(true)}
              className="flex items-center gap-2 px-3 py-2 bg-orange-600/20 hover:bg-orange-600/30 border border-orange-600/30 text-orange-400 rounded-lg transition-colors"
              title="一键清理"
            >
              <Trash2 className="w-4 h-4" />
              <span className="text-sm">清理 ({filesToCleanup.length})</span>
            </button>
            <button
              onClick={fetchFiles}
              disabled={loading}
              className="p-2 bg-[hsl(var(--secondary))] hover:bg-[hsl(var(--border))] rounded-lg transition-colors"
            >
              <RefreshCw className={cn('w-5 h-5', loading && 'animate-spin')} />
            </button>
          </div>
        </div>

        {/* Storage Usage Bar */}
        <div className="mb-6 bg-[hsl(var(--card))] rounded-xl border border-[hsl(var(--border))] p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <HardDrive className="w-4 h-4 text-purple-400" />
              <span className="text-sm text-white">存储使用</span>
            </div>
            <span className="text-sm text-[hsl(var(--muted-foreground))]">
              {formatBytes(totalSize)} / {cleanupSettings.maxSizeMB} MB
            </span>
          </div>
          <div className="h-2 bg-[hsl(var(--secondary))] rounded-full overflow-hidden">
            <div 
              className={cn(
                "h-full rounded-full transition-all",
                usagePercent > 90 ? "bg-red-500" : usagePercent > 70 ? "bg-orange-500" : "bg-purple-600"
              )}
              style={{ width: `${usagePercent}%` }}
            />
          </div>
        </div>

        {/* Storage Analysis Panel */}
        {showStorageAnalysis && (
          <div className="mb-6 bg-[hsl(var(--card))] rounded-xl border border-[hsl(var(--border))] overflow-hidden">
            <div className="px-4 py-3 border-b border-[hsl(var(--border))] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <PieChart className="w-4 h-4 text-purple-400" />
                <span className="font-medium text-white">存储分析</span>
              </div>
              <button onClick={() => setShowStorageAnalysis(false)} className="p-1 hover:bg-[hsl(var(--secondary))] rounded">
                <X className="w-4 h-4 text-[hsl(var(--muted-foreground))]" />
              </button>
            </div>
            <div className="p-4 flex flex-col md:flex-row gap-6">
              {/* Pie Chart */}
              <div className="w-40 h-40 mx-auto md:mx-0">
                <PieChartComponent data={pieData} />
              </div>
              {/* Legend */}
              <div className="flex-1 grid grid-cols-2 gap-2">
                {Object.values(folderStats).map((folder, i) => {
                  const percentage = totalSize > 0 ? ((folder.size / totalSize) * 100).toFixed(1) : '0';
                  return (
                    <div key={folder.name} className="flex items-center gap-2 bg-[hsl(var(--secondary))] rounded-lg px-3 py-2">
                      <div 
                        className="w-3 h-3 rounded-full" 
                        style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm text-white truncate">{folder.name}</div>
                        <div className="text-xs text-[hsl(var(--muted-foreground))]">
                          {formatBytes(folder.size)} ({percentage}%)
                        </div>
                      </div>
                      <div className="text-xs text-[hsl(var(--muted-foreground))]">
                        {folder.count} 个
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Cleanup Settings Panel */}
        {showCleanupSettings && (
          <div className="mb-6 bg-[hsl(var(--card))] rounded-xl border border-[hsl(var(--border))] overflow-hidden">
            <div className="px-4 py-3 border-b border-[hsl(var(--border))] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Settings className="w-4 h-4 text-purple-400" />
                <span className="font-medium text-white">清理设置</span>
              </div>
              <button onClick={() => setShowCleanupSettings(false)} className="p-1 hover:bg-[hsl(var(--secondary))] rounded">
                <X className="w-4 h-4 text-[hsl(var(--muted-foreground))]" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              {/* Global toggle */}
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium text-white">启用自动清理建议</div>
                  <div className="text-xs text-[hsl(var(--muted-foreground))]">显示符合清理条件的文件数量</div>
                </div>
                <button 
                  onClick={() => saveCleanupSettings({ ...cleanupSettings, enabled: !cleanupSettings.enabled })}
                  className={cn(
                    "w-10 h-5 rounded-full relative transition-colors",
                    cleanupSettings.enabled ? "bg-purple-600" : "bg-[hsl(var(--secondary))]"
                  )}
                >
                  <span className={cn(
                    "absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all",
                    cleanupSettings.enabled ? "right-0.5" : "left-0.5"
                  )} />
                </button>
              </div>

              {/* Global retention */}
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium text-white">默认保留天数</div>
                  <div className="text-xs text-[hsl(var(--muted-foreground))]">超过此时间的文件将被建议清理</div>
                </div>
                <select 
                  value={cleanupSettings.globalRetentionDays}
                  onChange={(e) => saveCleanupSettings({ ...cleanupSettings, globalRetentionDays: parseInt(e.target.value) })}
                  className="bg-[hsl(var(--secondary))] border border-[hsl(var(--border))] rounded-lg px-3 py-1.5 text-sm text-white"
                >
                  <option value={7}>7 天</option>
                  <option value={14}>14 天</option>
                  <option value={30}>30 天</option>
                  <option value={60}>60 天</option>
                  <option value={90}>90 天</option>
                  <option value={365}>1 年</option>
                </select>
              </div>

              {/* Max size */}
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium text-white">容量上限</div>
                  <div className="text-xs text-[hsl(var(--muted-foreground))]">显示进度条的最大值</div>
                </div>
                <select 
                  value={cleanupSettings.maxSizeMB}
                  onChange={(e) => saveCleanupSettings({ ...cleanupSettings, maxSizeMB: parseInt(e.target.value) })}
                  className="bg-[hsl(var(--secondary))] border border-[hsl(var(--border))] rounded-lg px-3 py-1.5 text-sm text-white"
                >
                  <option value={100}>100 MB</option>
                  <option value={250}>250 MB</option>
                  <option value={500}>500 MB</option>
                  <option value={1024}>1 GB</option>
                  <option value={2048}>2 GB</option>
                </select>
              </div>

              {/* Protect recent */}
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium text-white">保护最近 24 小时</div>
                  <div className="text-xs text-[hsl(var(--muted-foreground))]">最近创建的文件不会被清理</div>
                </div>
                <button 
                  onClick={() => saveCleanupSettings({ ...cleanupSettings, protectRecent24h: !cleanupSettings.protectRecent24h })}
                  className={cn(
                    "w-10 h-5 rounded-full relative transition-colors",
                    cleanupSettings.protectRecent24h ? "bg-purple-600" : "bg-[hsl(var(--secondary))]"
                  )}
                >
                  <span className={cn(
                    "absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all",
                    cleanupSettings.protectRecent24h ? "right-0.5" : "left-0.5"
                  )} />
                </button>
              </div>

              {/* Folder-specific settings */}
              <div>
                <div className="text-sm font-medium text-white mb-2">文件夹独立设置</div>
                <div className="space-y-2">
                  {Object.keys(folderStats).map(folder => {
                    const { icon: Icon, color } = folderIcons[folder] || folderIcons.root;
                    return (
                      <div key={folder} className="flex items-center justify-between bg-[hsl(var(--secondary))] rounded-lg px-3 py-2">
                        <div className="flex items-center gap-2">
                          <Icon className={cn('w-4 h-4', color)} />
                          <span className="text-sm text-white">{folder}</span>
                          <span className="text-xs text-[hsl(var(--muted-foreground))]">
                            ({folderStats[folder].count} · {formatBytes(folderStats[folder].size)})
                          </span>
                        </div>
                        <select 
                          value={cleanupSettings.folderRetention[folder] ?? cleanupSettings.globalRetentionDays}
                          onChange={(e) => {
                            const val = parseInt(e.target.value);
                            const newRetention = { ...cleanupSettings.folderRetention };
                            if (val === cleanupSettings.globalRetentionDays) {
                              delete newRetention[folder];
                            } else {
                              newRetention[folder] = val;
                            }
                            saveCleanupSettings({ ...cleanupSettings, folderRetention: newRetention });
                          }}
                          className="bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded px-2 py-1 text-xs text-white"
                        >
                          <option value={7}>7 天</option>
                          <option value={14}>14 天</option>
                          <option value={30}>30 天</option>
                          <option value={60}>60 天</option>
                          <option value={90}>90 天</option>
                          <option value={365}>1 年</option>
                        </select>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Folder Stats - with sizes */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-6">
          <div
            onClick={() => setFolderFilter(null)}
            className={cn(
              'bg-[hsl(var(--card))] rounded-xl p-4 border cursor-pointer transition-all',
              !folderFilter ? 'border-purple-600' : 'border-[hsl(var(--border))] hover:border-purple-600/50'
            )}
          >
            <div className="flex items-center gap-2 mb-2">
              <FileOutput className="w-5 h-5 text-purple-400" />
              <span className="font-medium text-white">全部</span>
            </div>
            <div className="text-sm text-[hsl(var(--muted-foreground))]">{files.length} 文件</div>
            <div className="text-xs text-[hsl(var(--muted-foreground))]">{formatBytes(totalSize)}</div>
          </div>
          {Object.values(folderStats).map((folder) => {
            const { icon: Icon, color } = folderIcons[folder.name] || folderIcons.root;
            return (
              <div
                key={folder.name}
                onClick={() => setFolderFilter(folderFilter === folder.name ? null : folder.name)}
                className={cn(
                  'bg-[hsl(var(--card))] rounded-xl p-4 border cursor-pointer transition-all',
                  folderFilter === folder.name ? 'border-purple-600' : 'border-[hsl(var(--border))] hover:border-purple-600/50'
                )}
              >
                <div className="flex items-center gap-2 mb-2">
                  <Icon className={cn('w-5 h-5', color)} />
                  <span className="font-medium text-white">{folder.name}</span>
                </div>
                <div className="text-sm text-[hsl(var(--muted-foreground))]">{folder.count} 文件</div>
                <div className="text-xs text-[hsl(var(--muted-foreground))]">{formatBytes(folder.size)}</div>
              </div>
            );
          })}
        </div>

        {/* Search & Batch Actions */}
        <div className="mb-6 flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[hsl(var(--muted-foreground))]" />
            <input
              type="text"
              placeholder="搜索文件..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-lg text-sm text-white placeholder-[hsl(var(--muted-foreground))] focus:outline-none focus:border-purple-500"
            />
          </div>
          <div className="flex items-center gap-2">
            {/* View Mode Toggle */}
            <div className="flex items-center bg-[hsl(var(--secondary))] rounded-lg p-1">
              <button
                onClick={() => saveViewMode('list')}
                className={cn(
                  "p-1.5 rounded transition-colors",
                  viewMode === 'list' ? "bg-purple-600 text-white" : "text-[hsl(var(--muted-foreground))] hover:text-white"
                )}
                title="列表视图"
              >
                <List className="w-4 h-4" />
              </button>
              <button
                onClick={() => saveViewMode('grid')}
                className={cn(
                  "p-1.5 rounded transition-colors",
                  viewMode === 'grid' ? "bg-purple-600 text-white" : "text-[hsl(var(--muted-foreground))] hover:text-white"
                )}
                title="网格视图"
              >
                <Grid className="w-4 h-4" />
              </button>
            </div>

            <button
              onClick={() => { setSelectMode(!selectMode); setSelected(new Set()); }}
              className={cn(
                "flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors",
                selectMode ? "bg-purple-600 text-white" : "bg-[hsl(var(--secondary))] hover:bg-[hsl(var(--border))]"
              )}
            >
              <CheckSquare className="w-4 h-4" />
              多选
            </button>
            {selectMode && (
              <>
                <button onClick={selectAll} className="px-3 py-2 bg-[hsl(var(--secondary))] hover:bg-[hsl(var(--border))] rounded-lg text-sm transition-colors">
                  全选
                </button>
                <button onClick={selectNone} className="px-3 py-2 bg-[hsl(var(--secondary))] hover:bg-[hsl(var(--border))] rounded-lg text-sm transition-colors">
                  取消
                </button>
                {selected.size > 0 && (
                  <>
                    <button 
                      onClick={handleBatchDownload}
                      className="flex items-center gap-1 px-3 py-2 bg-blue-600/20 hover:bg-blue-600/30 border border-blue-600/30 text-blue-400 rounded-lg text-sm transition-colors"
                      title="批量下载"
                    >
                      <Package className="w-4 h-4" />
                      下载 ({selected.size})
                    </button>
                    <button 
                      onClick={handleBulkCleanup}
                      className="flex items-center gap-1 px-3 py-2 bg-red-600/20 hover:bg-red-600/30 border border-red-600/30 text-red-400 rounded-lg text-sm transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                      删除 ({selected.size})
                    </button>
                    <span className="text-xs text-[hsl(var(--muted-foreground))] ml-2">
                      {formatBytes(selectedSize)}
                    </span>
                  </>
                )}
              </>
            )}
          </div>
        </div>

        {/* Grid View */}
        {viewMode === 'grid' ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-4">
            {loading ? (
              <div className="col-span-full text-center py-12 text-[hsl(var(--muted-foreground))]">加载中...</div>
            ) : filteredFiles.length === 0 ? (
              <div className="col-span-full text-center py-12 text-[hsl(var(--muted-foreground))]">没有文件</div>
            ) : filteredFiles.map((file) => {
              const { icon: Icon, color } = getFileIcon(file.name);
              const isFavorite = favorites.has(file.path);
              const isLocked = locked.has(file.path);
              const isSelected = selected.has(file.path);
              const isImage = isImageFile(file.name);
              
              return (
                <div
                  key={file.path}
                  className={cn(
                    "bg-[hsl(var(--card))] rounded-xl border overflow-hidden transition-all cursor-pointer group",
                    isSelected ? "border-purple-600 ring-2 ring-purple-600/30" : "border-[hsl(var(--border))] hover:border-purple-600/50"
                  )}
                  onClick={(e) => selectMode ? toggleSelect(file.path, e.shiftKey) : handlePreview(file)}
                >
                  {/* Thumbnail / Icon */}
                  <div className="aspect-square bg-[hsl(var(--secondary))] relative overflow-hidden">
                    {isImage ? (
                      <img 
                        src={`${baseUrl}/api/output/file?path=${encodeURIComponent(file.path)}`}
                        alt={file.name}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Icon className={cn('w-12 h-12', color)} />
                      </div>
                    )}
                    
                    {/* Badges */}
                    <div className="absolute top-2 left-2 flex gap-1">
                      {isFavorite && (
                        <div className="w-6 h-6 rounded-full bg-yellow-500/90 flex items-center justify-center">
                          <Star className="w-3 h-3 text-white fill-white" />
                        </div>
                      )}
                      {isLocked && (
                        <div className="w-6 h-6 rounded-full bg-blue-500/90 flex items-center justify-center">
                          <Lock className="w-3 h-3 text-white" />
                        </div>
                      )}
                    </div>

                    {/* Select checkbox */}
                    {selectMode && (
                      <div className="absolute top-2 right-2">
                        {isSelected ? (
                          <CheckSquare className="w-6 h-6 text-purple-400 bg-black/50 rounded" />
                        ) : (
                          <Square className="w-6 h-6 text-white/70 bg-black/50 rounded" />
                        )}
                      </div>
                    )}

                    {/* Quick actions on hover */}
                    {!selectMode && (
                      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                        <button
                          onClick={(e) => { e.stopPropagation(); toggleFavorite(file.path); }}
                          className={cn(
                            "p-2 rounded-full transition-colors",
                            isFavorite ? "bg-yellow-500 text-white" : "bg-white/20 hover:bg-white/30 text-white"
                          )}
                        >
                          <Star className={cn("w-4 h-4", isFavorite && "fill-white")} />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDownload(file); }}
                          className="p-2 rounded-full bg-white/20 hover:bg-white/30 text-white transition-colors"
                        >
                          <Download className="w-4 h-4" />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); setDeleteConfirm(file); }}
                          disabled={isLocked}
                          className={cn(
                            "p-2 rounded-full transition-colors",
                            isLocked ? "bg-white/10 text-white/30 cursor-not-allowed" : "bg-white/20 hover:bg-red-500 text-white"
                          )}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>
                  
                  {/* File info */}
                  <div className="p-2">
                    <div className="text-sm text-white truncate" title={file.name}>{file.name}</div>
                    <div className="text-xs text-[hsl(var(--muted-foreground))]">{file.size}</div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* List View */
          <div className="bg-[hsl(var(--card))] rounded-xl border border-[hsl(var(--border))] overflow-hidden">
            <table className="w-full">
              <thead className="bg-[hsl(var(--secondary))]">
                <tr>
                  {selectMode && <th className="px-4 py-3 w-10"></th>}
                  <th 
                    className="px-4 py-3 text-left text-xs font-medium text-[hsl(var(--muted-foreground))] uppercase cursor-pointer hover:text-white transition-colors"
                    onClick={() => handleSort('name')}
                  >
                    <div className="flex items-center gap-1">
                      文件 {getSortIcon('name')}
                    </div>
                  </th>
                  <th 
                    className="px-4 py-3 text-left text-xs font-medium text-[hsl(var(--muted-foreground))] uppercase cursor-pointer hover:text-white transition-colors"
                    onClick={() => handleSort('folder')}
                  >
                    <div className="flex items-center gap-1">
                      文件夹 {getSortIcon('folder')}
                    </div>
                  </th>
                  <th 
                    className="px-4 py-3 text-left text-xs font-medium text-[hsl(var(--muted-foreground))] uppercase cursor-pointer hover:text-white transition-colors"
                    onClick={() => handleSort('size')}
                  >
                    <div className="flex items-center gap-1">
                      大小 {getSortIcon('size')}
                    </div>
                  </th>
                  <th 
                    className="px-4 py-3 text-left text-xs font-medium text-[hsl(var(--muted-foreground))] uppercase cursor-pointer hover:text-white transition-colors"
                    onClick={() => handleSort('modified')}
                  >
                    <div className="flex items-center gap-1">
                      修改时间 {getSortIcon('modified')}
                    </div>
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-[hsl(var(--muted-foreground))] uppercase w-44">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[hsl(var(--border))]">
                {loading ? (
                  <tr><td colSpan={selectMode ? 6 : 5} className="px-4 py-8 text-center text-[hsl(var(--muted-foreground))]">加载中...</td></tr>
                ) : filteredFiles.length === 0 ? (
                  <tr><td colSpan={selectMode ? 6 : 5} className="px-4 py-8 text-center text-[hsl(var(--muted-foreground))]">没有文件</td></tr>
                ) : filteredFiles.map((file, index) => {
                  const { icon: Icon, color } = getFileIcon(file.name);
                  const canPreview = isPreviewable(file.name);
                  const isFavorite = favorites.has(file.path);
                  const isLocked = locked.has(file.path);
                  const isSelected = selected.has(file.path);
                  const isImage = isImageFile(file.name);
                  
                  return (
                    <tr 
                      key={file.path} 
                      className={cn(
                        "transition-colors",
                        isSelected ? "bg-purple-600/10" : index % 2 === 1 ? "bg-[hsl(var(--secondary))]/30" : "",
                        "hover:bg-[hsl(var(--secondary))]"
                      )}
                    >
                      {selectMode && (
                        <td className="px-4 py-3">
                          <button onClick={(e) => toggleSelect(file.path, e.shiftKey)} disabled={isLocked}>
                            {isSelected ? (
                              <CheckSquare className="w-5 h-5 text-purple-400" />
                            ) : (
                              <Square className={cn("w-5 h-5", isLocked ? "text-gray-600" : "text-[hsl(var(--muted-foreground))]")} />
                            )}
                          </button>
                        </td>
                      )}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          {/* Thumbnail/Icon - clickable for preview */}
                          {isImage ? (
                            <div 
                              className="w-10 h-10 rounded overflow-hidden bg-[hsl(var(--secondary))] flex-shrink-0 cursor-pointer hover:ring-2 hover:ring-purple-500 transition-all"
                              onClick={() => handlePreview(file)}
                              title="点击预览"
                            >
                              <img 
                                src={`${baseUrl}/api/output/file?path=${encodeURIComponent(file.path)}`}
                                alt={file.name}
                                className="w-full h-full object-cover"
                                loading="lazy"
                              />
                            </div>
                          ) : (
                            <div
                              className={cn(
                                "p-2 rounded cursor-pointer hover:bg-[hsl(var(--secondary))] transition-colors",
                                canPreview && "hover:ring-2 hover:ring-purple-500"
                              )}
                              onClick={() => canPreview && handlePreview(file)}
                              title={canPreview ? "点击预览" : undefined}
                            >
                              <Icon className={cn('w-5 h-5', color)} />
                            </div>
                          )}
                          <span className="text-white">{file.name}</span>
                          {isFavorite && <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />}
                          {isLocked && <Lock className="w-4 h-4 text-blue-400" />}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm text-[hsl(var(--muted-foreground))]">{file.folder}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm text-[hsl(var(--muted-foreground))]">{file.size}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span 
                          className="text-sm text-[hsl(var(--muted-foreground))] cursor-help"
                          title={formatFullDate(file.modifiedTs || Date.now())}
                        >
                          {file.modified}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => toggleFavorite(file.path)}
                            className={cn(
                              "p-1.5 rounded-lg transition-colors",
                              isFavorite ? "text-yellow-400 bg-yellow-500/10" : "text-[hsl(var(--muted-foreground))] hover:text-yellow-400 hover:bg-yellow-500/10"
                            )}
                            title={isFavorite ? "取消收藏" : "收藏"}
                          >
                            <Star className={cn("w-4 h-4", isFavorite && "fill-yellow-400")} />
                          </button>
                          <button
                            onClick={() => toggleLocked(file.path)}
                            className={cn(
                              "p-1.5 rounded-lg transition-colors",
                              isLocked ? "text-blue-400 bg-blue-500/10" : "text-[hsl(var(--muted-foreground))] hover:text-blue-400 hover:bg-blue-500/10"
                            )}
                            title={isLocked ? "解锁" : "锁定"}
                          >
                            {isLocked ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
                          </button>
                          <button
                            onClick={() => handleDownload(file)}
                            className="p-1.5 rounded-lg text-[hsl(var(--muted-foreground))] hover:text-green-400 hover:bg-green-500/10 transition-colors"
                            title="下载"
                          >
                            <Download className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setDeleteConfirm(file)}
                            disabled={isLocked}
                            className={cn(
                              "p-1.5 rounded-lg transition-colors",
                              isLocked ? "text-gray-600 cursor-not-allowed" : "text-[hsl(var(--muted-foreground))] hover:text-red-400 hover:bg-red-500/10"
                            )}
                            title={isLocked ? "文件已锁定" : "删除"}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
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

      {/* Preview Modal */}
      {preview && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4" onClick={() => setPreview(null)}>
          <div 
            className="bg-[hsl(var(--card))] rounded-2xl border border-[hsl(var(--border))] max-w-4xl max-h-[90vh] w-full overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 border-b border-[hsl(var(--border))]">
              <span className="font-medium text-white">{preview.file.name}</span>
              <button
                onClick={() => setPreview(null)}
                className="p-2 hover:bg-[hsl(var(--secondary))] rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-[hsl(var(--muted-foreground))]" />
              </button>
            </div>
            <div className="p-4 overflow-auto max-h-[calc(90vh-80px)]">
              {loadingPreview ? (
                <div className="flex items-center justify-center py-12">
                  <RefreshCw className="w-6 h-6 animate-spin text-purple-400" />
                </div>
              ) : preview.type === 'image' ? (
                <img 
                  src={preview.content || ''} 
                  alt={preview.file.name}
                  className="max-w-full h-auto mx-auto rounded-lg"
                />
              ) : (
                <pre className="text-sm text-white bg-[hsl(var(--secondary))] p-4 rounded-lg overflow-x-auto whitespace-pre-wrap">
                  {preview.content}
                </pre>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[hsl(var(--card))] rounded-2xl border border-[hsl(var(--border))] p-6 max-w-md w-full">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center">
                <AlertTriangle className="w-6 h-6 text-red-400" />
              </div>
              <div>
                <h3 className="font-semibold text-white">删除文件</h3>
                <p className="text-sm text-[hsl(var(--muted-foreground))]">此操作不可恢复</p>
              </div>
            </div>
            <p className="text-sm text-[hsl(var(--muted-foreground))] mb-6">
              确定要删除 <span className="font-semibold text-white">{deleteConfirm.name}</span> 吗？
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

      {/* Bulk Delete Confirmation Modal */}
      {showBulkDeleteConfirm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[hsl(var(--card))] rounded-2xl border border-[hsl(var(--border))] p-6 max-w-md w-full">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center">
                <Trash2 className="w-6 h-6 text-red-400" />
              </div>
              <div>
                <h3 className="font-semibold text-white">批量删除</h3>
                <p className="text-sm text-[hsl(var(--muted-foreground))]">此操作不可恢复</p>
              </div>
            </div>
            <p className="text-sm text-[hsl(var(--muted-foreground))] mb-2">
              确定要删除以下 <span className="font-semibold text-white">{pendingDeleteFiles.length}</span> 个文件吗？
            </p>
            <div className="max-h-40 overflow-y-auto mb-4 bg-[hsl(var(--secondary))] rounded-lg p-2">
              {pendingDeleteFiles.map(file => (
                <div key={file.path} className="text-sm text-white py-1 px-2 flex items-center gap-2">
                  <span className="text-[hsl(var(--muted-foreground))]">•</span>
                  <span className="truncate">{file.name}</span>
                  <span className="text-xs text-[hsl(var(--muted-foreground))] ml-auto">{file.size}</span>
                </div>
              ))}
            </div>
            <p className="text-xs text-[hsl(var(--muted-foreground))] mb-4">
              将释放 {formatBytes(pendingDeleteFiles.reduce((acc, f) => acc + (f.sizeBytes || 0), 0))}
            </p>
            <div className="flex gap-3 justify-end">
              <button 
                onClick={() => { setShowBulkDeleteConfirm(false); setPendingDeleteFiles([]); }} 
                disabled={cleaningUp} 
                className="px-4 py-2 bg-[hsl(var(--secondary))] hover:bg-[hsl(var(--border))] rounded-lg text-sm transition-colors"
              >
                取消
              </button>
              <button 
                onClick={executeBulkDelete} 
                disabled={cleaningUp} 
                className="px-4 py-2 bg-red-600 hover:bg-red-500 rounded-lg text-sm transition-colors disabled:opacity-50"
              >
                {cleaningUp ? '删除中...' : `确认删除 (${pendingDeleteFiles.length})`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cleanup Preview Modal */}
      {showCleanupPreview && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[hsl(var(--card))] rounded-2xl border border-[hsl(var(--border))] max-w-2xl w-full max-h-[80vh] overflow-hidden">
            <div className="px-6 py-4 border-b border-[hsl(var(--border))] flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-orange-500/20 flex items-center justify-center">
                  <Trash2 className="w-5 h-5 text-orange-400" />
                </div>
                <div>
                  <h3 className="font-semibold text-white">一键清理</h3>
                  <p className="text-sm text-[hsl(var(--muted-foreground))]">
                    {filesToCleanup.length} 个文件符合清理条件
                  </p>
                </div>
              </div>
              <button onClick={() => setShowCleanupPreview(false)} className="p-2 hover:bg-[hsl(var(--secondary))] rounded-lg">
                <X className="w-5 h-5 text-[hsl(var(--muted-foreground))]" />
              </button>
            </div>
            
            <div className="p-4 max-h-[50vh] overflow-y-auto">
              {filesToCleanup.length === 0 ? (
                <div className="text-center py-8 text-[hsl(var(--muted-foreground))]">
                  <Sparkles className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>太棒了！没有需要清理的文件 🎉</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {filesToCleanup.map(file => {
                    const { icon: Icon, color } = getFileIcon(file.name);
                    const daysOld = getDaysOld(file.modifiedTs || Date.now());
                    return (
                      <div key={file.path} className="flex items-center justify-between bg-[hsl(var(--secondary))] rounded-lg px-3 py-2">
                        <div className="flex items-center gap-2">
                          <Icon className={cn('w-4 h-4', color)} />
                          <span className="text-sm text-white truncate max-w-[200px]">{file.name}</span>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-[hsl(var(--muted-foreground))]">
                          <span>{file.folder}</span>
                          <span>{file.size}</span>
                          <span className="text-orange-400">{daysOld} 天前</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t border-[hsl(var(--border))] flex items-center justify-between">
              <div className="text-sm text-[hsl(var(--muted-foreground))]">
                将释放 {formatBytes(filesToCleanup.reduce((acc, f) => acc + (f.sizeBytes || 0), 0))}
              </div>
              <div className="flex gap-3">
                <button 
                  onClick={() => setShowCleanupPreview(false)} 
                  className="px-4 py-2 bg-[hsl(var(--secondary))] hover:bg-[hsl(var(--border))] rounded-lg text-sm transition-colors"
                >
                  取消
                </button>
                <button 
                  onClick={handleBulkCleanup}
                  disabled={filesToCleanup.length === 0 || cleaningUp}
                  className="px-4 py-2 bg-orange-600 hover:bg-orange-500 rounded-lg text-sm transition-colors disabled:opacity-50"
                >
                  {cleaningUp ? '清理中...' : `清理 ${filesToCleanup.length} 个文件`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
