#!/usr/bin/env node
/**
 * OpenClaw Gateway HTTP Proxy
 * 
 * Provides HTTP API for Gateway WebSocket, enabling static deployment.
 * 
 * Usage: node proxy-server.js [port]
 * Default port: 18790
 */

const http = require('http');
const WebSocket = require('ws');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || process.argv[2] || 18790;
const GATEWAY_URL = process.env.GATEWAY_URL || 'ws://100.122.211.68:18789';
const WORKSPACE = process.env.WORKSPACE || '/Users/lifan/clawd';

// Simple in-memory cache with TTL
const cache = {
  data: {},
  get(key) {
    const item = this.data[key];
    if (!item) return null;
    if (Date.now() > item.expiresAt) {
      delete this.data[key];
      return null;
    }
    return item.value;
  },
  set(key, value, ttlMs = 30000) {
    this.data[key] = { value, expiresAt: Date.now() + ttlMs };
  }
};

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

// Build connect params
function buildConnectParams(token) {
  const params = {
    minProtocol: 3,
    maxProtocol: 3,
    client: { id: 'openclaw-control-ui', version: '0.1.0', platform: 'nodejs', mode: 'ui' },
    role: 'operator',
    scopes: ['operator.admin'],
    caps: [],
    userAgent: 'openclaw-dashboard-proxy/0.1.0'
  };
  if (token && token !== 'insecure') {
    params.auth = { token };
  }
  return params;
}

// Make RPC call to Gateway
async function gatewayRpc(token, method, params = {}, timeoutMs = 15000) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => { ws?.close(); reject(new Error('Timeout')); }, timeoutMs);
    let ws = null;
    let authenticated = false;
    const requestId = `req-${Date.now()}`;

    try {
      ws = new WebSocket(GATEWAY_URL, {
        headers: { origin: 'http://localhost:3000' }
      });
      ws.on('message', (data) => {
        try {
          const msg = JSON.parse(data.toString());
          if (msg.type === 'event' && msg.event === 'connect.challenge') {
            ws.send(JSON.stringify({ type: 'req', id: `connect-${Date.now()}`, method: 'connect', params: buildConnectParams(token) }));
            return;
          }
          if (msg.type === 'res' && msg.id?.startsWith('connect-')) {
            if (msg.ok) {
              authenticated = true;
              ws.send(JSON.stringify({ type: 'req', id: requestId, method, params }));
            } else {
              clearTimeout(timeout); ws.close(); reject(new Error(msg.error?.message || 'Auth failed'));
            }
            return;
          }
          if (msg.type === 'res' && msg.id === requestId) {
            clearTimeout(timeout); ws.close();
            msg.ok ? resolve(msg.payload) : reject(new Error(msg.error?.message || 'Request failed'));
          }
        } catch (err) { console.error('[Proxy] Parse error:', err); }
      });
      ws.on('error', (err) => { clearTimeout(timeout); reject(new Error('WebSocket error: ' + err.message)); });
      ws.on('close', () => { if (!authenticated) { clearTimeout(timeout); reject(new Error('Connection closed')); } });
    } catch (err) { clearTimeout(timeout); reject(err); }
  });
}

// Get memory files list
function getMemoryFiles() {
  const files = [];
  const memoryDir = path.join(WORKSPACE, 'memory');
  
  // Core files in workspace root
  const coreFiles = ['MEMORY.md', 'USER.md', 'SOUL.md', 'AGENTS.md', 'TOOLS.md', 'HEARTBEAT.md', 'IDENTITY.md'];
  for (const name of coreFiles) {
    const filePath = path.join(WORKSPACE, name);
    if (fs.existsSync(filePath)) {
      const stat = fs.statSync(filePath);
      files.push({
        name,
        size: formatSize(stat.size),
        modified: formatTime(stat.mtime),
        type: 'core',
        path: name
      });
    }
  }

  // Memory directory files
  if (fs.existsSync(memoryDir)) {
    const memoryFiles = fs.readdirSync(memoryDir).filter(f => f.endsWith('.md'));
    for (const name of memoryFiles) {
      const filePath = path.join(memoryDir, name);
      const stat = fs.statSync(filePath);
      let type = 'system';
      if (/^\d{4}-\d{2}-\d{2}\.md$/.test(name)) type = 'daily';
      else if (name.startsWith('project-')) type = 'project';
      
      files.push({
        name,
        size: formatSize(stat.size),
        modified: formatTime(stat.mtime),
        type,
        path: `memory/${name}`
      });
    }
  }

  // Sort: core first, then by modified time
  files.sort((a, b) => {
    if (a.type === 'core' && b.type !== 'core') return -1;
    if (a.type !== 'core' && b.type === 'core') return 1;
    return 0;
  });

  return files;
}

// Read file content
function readMemoryFile(filePath) {
  // Security: only allow files in workspace
  const fullPath = path.join(WORKSPACE, filePath);
  const resolved = path.resolve(fullPath);
  if (!resolved.startsWith(WORKSPACE)) {
    throw new Error('Access denied');
  }
  if (!fs.existsSync(resolved)) {
    throw new Error('File not found');
  }
  return fs.readFileSync(resolved, 'utf-8');
}

// Get skills list with details
function getSkillsList() {
  const skills = [];
  const skillDirs = [
    { path: '/opt/homebrew/lib/node_modules/openclaw/skills', source: 'builtin', label: '内置' },
    { path: path.join(process.env.HOME || '', '.openclaw/skills'), source: 'user', label: '用户' },
    { path: path.join(WORKSPACE, 'skills'), source: 'workspace', label: '工作区' },
  ];
  
  // Category detection keywords
  const categoryKeywords = {
    dev: ['code', 'git', 'github', 'deploy', 'test', 'api', 'swagger', 'coding', 'schema', 'commit', 'action', 'vercel', 'react', 'cloudflare', 'wrangler', 'mentor', 'backtest', 'claude-code'],
    productivity: ['gog', 'google', 'notion', 'obsidian', 'note', 'reminder', 'remind', 'calendar', 'research', 'apple-note', 'apple-remind', 'memo', 'todo', 'task'],
    finance: ['finance', 'stock', 'trading', 'wealth', 'crypto', 'bit', 'market', 'invest'],
    utility: ['weather', 'summarize', 'video', 'pdf', 'image', 'browser', 'search', 'qmd', 'peekaboo', 'mcporter', '1password', 'skiplagged', 'flight', 'tts', 'fetch'],
    creative: ['image-gen', 'excalidraw', 'component', 'frontend', 'design', 'ui-skill', 'ux', 'flowchart', 'diagram'],
    entertainment: ['yugioh', 'game', 'lifepath', 'tmdb', 'movie', 'tv', 'language-learn', 'youtube'],
    health: ['workout', 'weight', 'muscle', 'endurance', 'hevy', 'fitness', 'interval', 'coach', 'training'],
    system: ['cron', 'healthcheck', 'updater', 'gateway', 'skill-creator', 'compound', 'self-improv', 'proactive', 'router', 'session', 'hippocampus', 'memory', 'humanizer', 'gemini'],
    infra: ['aws', 'infra', 'docker', 'node', 'server', 'ssh'],
  };
  
  function detectCategory(name, description) {
    const text = (name + ' ' + description).toLowerCase();
    for (const [cat, keywords] of Object.entries(categoryKeywords)) {
      if (keywords.some(kw => text.includes(kw))) return cat;
    }
    return 'other';
  }
  
  function extractDescription(content) {
    // Method 1: Look for <description> tag (used in available_skills)
    const descMatch = content.match(/<description>([\s\S]*?)<\/description>/i);
    if (descMatch) {
      return descMatch[1].trim().replace(/\n/g, ' ');
    }
    
    // Method 2: Parse YAML frontmatter for description field
    if (content.startsWith('---')) {
      const fmEnd = content.indexOf('---', 3);
      if (fmEnd > 0) {
        const frontmatter = content.slice(3, fmEnd);
        const descLine = frontmatter.match(/^description:\s*(.+)$/m);
        if (descLine) {
          return descLine[1].trim().replace(/^["']|["']$/g, '');
        }
      }
    }
    
    // Method 3: Find first meaningful paragraph after headers
    const lines = content.split('\n');
    let inFrontmatter = false;
    let inCodeBlock = false;
    
    for (let i = 0; i < Math.min(lines.length, 30); i++) {
      const line = lines[i].trim();
      
      // Track frontmatter
      if (line === '---') {
        inFrontmatter = !inFrontmatter;
        continue;
      }
      if (inFrontmatter) continue;
      
      // Track code blocks
      if (line.startsWith('```')) {
        inCodeBlock = !inCodeBlock;
        continue;
      }
      if (inCodeBlock) continue;
      
      // Skip headers, empty lines, and metadata-like lines
      if (line.startsWith('#') || line === '') continue;
      if (line.startsWith('name:') || line.startsWith('trigger:')) continue;
      if (line.startsWith('-') || line.startsWith('*') && line.length < 20) continue;
      
      // Found a good description line
      if (line.length > 15 && line.length < 400) {
        return line.replace(/^\*+|\*+$/g, '').replace(/\[.*?\]/g, '').trim();
      }
    }
    return '';
  }
  
  for (const { path: dir, source, label } of skillDirs) {
    if (!fs.existsSync(dir)) continue;
    try {
      const entries = fs.readdirSync(dir);
      for (const name of entries) {
        const skillDir = path.join(dir, name);
        const skillPath = path.join(skillDir, 'SKILL.md');
        if (fs.existsSync(skillPath)) {
          let description = '';
          let content = '';
          try {
            content = fs.readFileSync(skillPath, 'utf-8');
            description = extractDescription(content);
          } catch (e) { /* ignore */ }
          
          const category = detectCategory(name, description);
          const stat = fs.statSync(skillPath);
          
          // Check if installed from ClawdHub (has .clawdhub directory)
          const hasClawdhub = fs.existsSync(path.join(skillDir, '.clawdhub'));
          const isCustom = source === 'workspace' && !hasClawdhub;
          
          let actualSource = source;
          let actualLabel = label;
          if (source === 'workspace') {
            if (hasClawdhub) {
              actualSource = 'clawdhub';
              actualLabel = 'ClawdHub';
            } else {
              actualSource = 'custom';
              actualLabel = '自建';
            }
          }
          
          // Try to extract version from .clawdhub/origin.json first (most reliable for ClawdHub skills)
          let version = null;
          const clawdhubOrigin = path.join(skillDir, '.clawdhub', 'origin.json');
          if (fs.existsSync(clawdhubOrigin)) {
            try {
              const origin = JSON.parse(fs.readFileSync(clawdhubOrigin, 'utf-8'));
              if (origin.installedVersion) version = origin.installedVersion;
            } catch {}
          }
          
          // Fallback: try to extract from SKILL.md content
          if (!version) {
            const versionMatch = content.match(/version:\s*["']?([\d.]+)["']?/i) || 
                                content.match(/^##?\s*v?([\d.]+)/m);
            if (versionMatch) version = versionMatch[1];
          }
          
          skills.push({ 
            name, 
            description: description.slice(0, 150) + (description.length > 150 ? '...' : ''),
            source: actualSource,
            sourceLabel: actualLabel,
            category,
            path: skillPath,
            modified: formatTime(stat.mtime),
            modifiedAt: stat.mtime.getTime(),
            size: formatSize(stat.size),
            isCustom,
            version,
          });
        }
      }
    } catch (e) { /* ignore */ }
  }
  
  // Sort: workspace first, then user, then builtin
  const sourceOrder = { workspace: 0, user: 1, builtin: 2 };
  skills.sort((a, b) => sourceOrder[a.source] - sourceOrder[b.source] || a.name.localeCompare(b.name));
  
  return skills;
}

// Get output files
function getOutputFiles() {
  const files = [];
  const outputDir = path.join(WORKSPACE, 'output');
  
  const scanDir = (dir, prefix = '') => {
    if (!fs.existsSync(dir)) return;
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory()) {
          scanDir(path.join(dir, entry.name), prefix + entry.name + '/');
        } else {
          const filePath = path.join(dir, entry.name);
          const stat = fs.statSync(filePath);
          files.push({
            name: entry.name,
            folder: prefix.slice(0, -1) || 'root',
            size: formatSize(stat.size),
            modified: formatTime(stat.mtime),
            path: prefix + entry.name
          });
        }
      }
    } catch (e) { /* ignore */ }
  };
  
  scanDir(outputDir);
  return files.slice(0, 50); // Limit to 50 files
}

// Get projects from local directory with detailed info
function getProjects() {
  const projects = [];
  const projectsDir = path.join(WORKSPACE, 'projects');
  
  // Get directory size (approximate)
  function getDirSize(dir, depth = 0) {
    if (depth > 3) return 0; // Limit depth for performance
    let size = 0;
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.name.startsWith('.') || entry.name === 'node_modules' || entry.name === '.git') continue;
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          size += getDirSize(fullPath, depth + 1);
        } else {
          size += fs.statSync(fullPath).size;
        }
      }
    } catch (e) { /* ignore */ }
    return size;
  }
  
  // Get git remote URL
  function getGitRemote(projectPath) {
    const gitConfig = path.join(projectPath, '.git', 'config');
    if (!fs.existsSync(gitConfig)) return null;
    try {
      const content = fs.readFileSync(gitConfig, 'utf-8');
      const match = content.match(/url\s*=\s*(.+)/);
      if (match) {
        let url = match[1].trim();
        // Convert git@ to https
        if (url.startsWith('git@github.com:')) {
          url = 'https://github.com/' + url.slice(15).replace('.git', '');
        }
        return url.replace('.git', '');
      }
    } catch (e) { /* ignore */ }
    return null;
  }
  
  if (fs.existsSync(projectsDir)) {
    try {
      const entries = fs.readdirSync(projectsDir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory()) {
          const projectPath = path.join(projectsDir, entry.name);
          const stat = fs.statSync(projectPath);
          const pkgPath = path.join(projectPath, 'package.json');
          const dockerPath = path.join(projectPath, 'Dockerfile');
          const readmePath = path.join(projectPath, 'README.md');
          
          let language = 'Other';
          let description = '';
          let scripts = [];
          let dependencies = 0;
          
          // Detect language and read package.json
          if (fs.existsSync(pkgPath)) {
            try {
              const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
              description = pkg.description || '';
              scripts = Object.keys(pkg.scripts || {});
              dependencies = Object.keys(pkg.dependencies || {}).length + Object.keys(pkg.devDependencies || {}).length;
              
              // Detect TypeScript
              if (pkg.devDependencies?.typescript || fs.existsSync(path.join(projectPath, 'tsconfig.json'))) {
                language = 'TypeScript';
              } else {
                language = 'JavaScript';
              }
            } catch (e) { /* ignore */ }
          } else if (fs.existsSync(path.join(projectPath, 'requirements.txt')) || 
                     fs.existsSync(path.join(projectPath, 'pyproject.toml')) ||
                     fs.existsSync(path.join(projectPath, 'setup.py'))) {
            language = 'Python';
          } else if (fs.existsSync(path.join(projectPath, 'go.mod'))) {
            language = 'Go';
          } else if (fs.existsSync(path.join(projectPath, 'Cargo.toml'))) {
            language = 'Rust';
          }
          
          // Try to get description from README if not in package.json
          if (!description && fs.existsSync(readmePath)) {
            try {
              const readme = fs.readFileSync(readmePath, 'utf-8');
              const lines = readme.split('\n');
              for (const line of lines.slice(0, 10)) {
                const trimmed = line.trim();
                if (trimmed && !trimmed.startsWith('#') && trimmed.length > 10 && trimmed.length < 200) {
                  description = trimmed;
                  break;
                }
              }
            } catch (e) { /* ignore */ }
          }
          
          const gitRemote = getGitRemote(projectPath);
          const hasDocker = fs.existsSync(dockerPath);
          const size = getDirSize(projectPath);
          const hasGit = fs.existsSync(path.join(projectPath, '.git'));
          const hasNodeModules = fs.existsSync(path.join(projectPath, 'node_modules'));
          const hasPkg = fs.existsSync(pkgPath);
          
          // Quick git status (just clean/dirty)
          let gitDirty = false;
          if (hasGit) {
            try {
              const { execSync } = require('child_process');
              const status = execSync('git status --porcelain', { cwd: projectPath, encoding: 'utf-8', timeout: 3000 });
              gitDirty = status.trim().length > 0;
            } catch (e) { /* ignore */ }
          }
          
          // Detect if it's a web project (has dev script)
          const isWebProject = scripts.includes('dev') || scripts.includes('start');
          
          // Dev port detection
          let devPort = null;
          if (hasPkg) {
            try {
              const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
              const devScript = pkg.scripts?.dev || '';
              const portMatch = devScript.match(/-p\s*(\d+)|--port\s*(\d+)|PORT=(\d+)/);
              if (portMatch) devPort = portMatch[1] || portMatch[2] || portMatch[3];
              else if (devScript.includes('next')) devPort = '3000';
              else if (devScript.includes('vite')) devPort = '5173';
            } catch (e) { /* ignore */ }
          }
          
          projects.push({
            name: entry.name,
            description: description.slice(0, 100) + (description.length > 100 ? '...' : ''),
            language,
            modified: formatTime(stat.mtime),
            modifiedMs: stat.mtime.getTime(),
            size: formatSize(size),
            sizeBytes: size,
            path: projectPath,
            hasGit,
            gitRemote,
            gitDirty,
            hasDocker,
            hasNodeModules,
            isWebProject,
            devPort,
            scripts,
            dependencies,
          });
        }
      }
    } catch (e) { /* ignore */ }
  }
  
  // Sort by modified time (most recent first)
  projects.sort((a, b) => b.modified.localeCompare(a.modified));
  
  return projects;
}

function formatSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function formatTime(date) {
  const now = new Date();
  const diff = now - date;
  if (diff < 60000) return '刚刚';
  if (diff < 3600000) return Math.floor(diff / 60000) + '分钟前';
  if (diff < 86400000) return Math.floor(diff / 3600000) + '小时前';
  if (diff < 172800000) return '昨天';
  return Math.floor(diff / 86400000) + '天前';
}

// HTTP Server
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  
  // CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, corsHeaders);
    res.end();
    return;
  }

  // Health check
  if (url.pathname === '/health' && req.method === 'GET') {
    res.writeHead(200, { ...corsHeaders, 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, gateway: GATEWAY_URL }));
    return;
  }

  // Memory files list
  if (url.pathname === '/api/memory/files' && req.method === 'GET') {
    try {
      const files = getMemoryFiles();
      res.writeHead(200, { ...corsHeaders, 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, files }));
    } catch (err) {
      res.writeHead(500, { ...corsHeaders, 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: false, error: err.message }));
    }
    return;
  }

  // Read memory file
  if (url.pathname === '/api/memory/read' && req.method === 'GET') {
    try {
      const filePath = url.searchParams.get('path');
      if (!filePath) {
        res.writeHead(400, { ...corsHeaders, 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: 'Missing path parameter' }));
        return;
      }
      const content = readMemoryFile(filePath);
      res.writeHead(200, { ...corsHeaders, 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, content }));
    } catch (err) {
      res.writeHead(500, { ...corsHeaders, 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: false, error: err.message }));
    }
    return;
  }

  // Hippocampus memory data
  if (url.pathname === '/api/memory/hippocampus' && req.method === 'GET') {
    try {
      const indexPath = path.join(WORKSPACE, 'memory/index.json');
      let hippocampus = { memories: [], version: 0, lastUpdated: null, decayLastRun: null };
      
      if (fs.existsSync(indexPath)) {
        hippocampus = JSON.parse(fs.readFileSync(indexPath, 'utf-8'));
      }
      
      // Calculate stats
      const memories = hippocampus.memories || [];
      const byDomain = {};
      const byImportance = { high: 0, medium: 0, low: 0 };
      
      for (const mem of memories) {
        // By domain
        const domain = mem.domain || 'unknown';
        if (!byDomain[domain]) byDomain[domain] = { count: 0, avgImportance: 0, totalImportance: 0 };
        byDomain[domain].count++;
        byDomain[domain].totalImportance += mem.importance || 0;
        
        // By importance
        const imp = mem.importance || 0;
        if (imp >= 0.7) byImportance.high++;
        else if (imp >= 0.4) byImportance.medium++;
        else byImportance.low++;
      }
      
      // Calculate averages
      for (const domain of Object.keys(byDomain)) {
        byDomain[domain].avgImportance = byDomain[domain].count > 0 
          ? (byDomain[domain].totalImportance / byDomain[domain].count).toFixed(2) 
          : 0;
      }
      
      // Top memories by importance
      const topMemories = [...memories]
        .sort((a, b) => (b.importance || 0) - (a.importance || 0))
        .slice(0, 10);
      
      // Recent memories
      const recentMemories = [...memories]
        .sort((a, b) => (b.lastAccessed || '').localeCompare(a.lastAccessed || ''))
        .slice(0, 10);
      
      res.writeHead(200, { ...corsHeaders, 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ 
        ok: true,
        version: hippocampus.version,
        lastUpdated: hippocampus.lastUpdated,
        decayLastRun: hippocampus.decayLastRun,
        totalMemories: memories.length,
        byDomain,
        byImportance,
        topMemories,
        recentMemories,
        allMemories: memories
      }));
    } catch (err) {
      res.writeHead(500, { ...corsHeaders, 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: false, error: err.message }));
    }
    return;
  }

  // Memory search (simple text search, returns snippets)
  if (url.pathname === '/api/memory/search' && req.method === 'GET') {
    try {
      const query = url.searchParams.get('q') || '';
      if (!query) {
        res.writeHead(400, { ...corsHeaders, 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: 'Missing query parameter' }));
        return;
      }
      
      const results = [];
      const queryLower = query.toLowerCase();
      
      // Search in memory files
      const memoryDir = path.join(WORKSPACE, 'memory');
      const workspaceFiles = ['MEMORY.md', 'USER.md', 'SOUL.md', 'AGENTS.md', 'TOOLS.md'];
      
      // Search workspace files
      for (const file of workspaceFiles) {
        const filePath = path.join(WORKSPACE, file);
        if (fs.existsSync(filePath)) {
          const content = fs.readFileSync(filePath, 'utf-8');
          const lines = content.split('\n');
          for (let i = 0; i < lines.length; i++) {
            if (lines[i].toLowerCase().includes(queryLower)) {
              results.push({
                file,
                path: file,
                line: i + 1,
                content: lines[i].trim().slice(0, 200),
                context: lines.slice(Math.max(0, i - 1), Math.min(lines.length, i + 2)).join('\n').slice(0, 300)
              });
            }
          }
        }
      }
      
      // Search memory directory files
      if (fs.existsSync(memoryDir)) {
        const files = fs.readdirSync(memoryDir).filter(f => f.endsWith('.md'));
        for (const file of files) {
          const filePath = path.join(memoryDir, file);
          const content = fs.readFileSync(filePath, 'utf-8');
          const lines = content.split('\n');
          for (let i = 0; i < lines.length; i++) {
            if (lines[i].toLowerCase().includes(queryLower)) {
              results.push({
                file: `memory/${file}`,
                path: `memory/${file}`,
                line: i + 1,
                content: lines[i].trim().slice(0, 200),
                context: lines.slice(Math.max(0, i - 1), Math.min(lines.length, i + 2)).join('\n').slice(0, 300)
              });
            }
          }
        }
      }
      
      // Search hippocampus memories
      const indexPath = path.join(WORKSPACE, 'memory/index.json');
      if (fs.existsSync(indexPath)) {
        const hippocampus = JSON.parse(fs.readFileSync(indexPath, 'utf-8'));
        for (const mem of (hippocampus.memories || [])) {
          if (mem.content?.toLowerCase().includes(queryLower) ||
              mem.keywords?.some(k => k.toLowerCase().includes(queryLower))) {
            results.push({
              file: 'hippocampus',
              path: 'memory/index.json',
              memoryId: mem.id,
              content: mem.content,
              importance: mem.importance,
              domain: mem.domain,
              keywords: mem.keywords
            });
          }
        }
      }
      
      res.writeHead(200, { ...corsHeaders, 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, query, count: results.length, results: results.slice(0, 50) }));
    } catch (err) {
      res.writeHead(500, { ...corsHeaders, 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: false, error: err.message }));
    }
    return;
  }

  // Memory stats and timeline
  if (url.pathname === '/api/memory/stats' && req.method === 'GET') {
    try {
      const memoryDir = path.join(WORKSPACE, 'memory');
      const workspaceFiles = ['MEMORY.md', 'USER.md', 'SOUL.md', 'AGENTS.md', 'TOOLS.md', 'HEARTBEAT.md'];
      
      // File stats
      const fileStats = [];
      let totalSize = 0;
      
      // Workspace core files
      for (const file of workspaceFiles) {
        const filePath = path.join(WORKSPACE, file);
        if (fs.existsSync(filePath)) {
          const stat = fs.statSync(filePath);
          fileStats.push({
            name: file,
            size: stat.size,
            modified: stat.mtime.toISOString(),
            type: 'core'
          });
          totalSize += stat.size;
        }
      }
      
      // Memory directory files
      const timeline = [];
      if (fs.existsSync(memoryDir)) {
        const files = fs.readdirSync(memoryDir).filter(f => f.endsWith('.md') || f.endsWith('.json'));
        for (const file of files) {
          const filePath = path.join(memoryDir, file);
          const stat = fs.statSync(filePath);
          
          // Determine type
          let type = 'other';
          if (file.match(/^\d{4}-\d{2}-\d{2}\.md$/)) type = 'daily';
          else if (file.startsWith('project-')) type = 'project';
          else if (file === 'index.json') type = 'hippocampus';
          else if (file === 'corrections.md') type = 'system';
          
          fileStats.push({
            name: `memory/${file}`,
            size: stat.size,
            modified: stat.mtime.toISOString(),
            type
          });
          totalSize += stat.size;
          
          // Build timeline from daily files
          if (type === 'daily') {
            const dateMatch = file.match(/^(\d{4}-\d{2}-\d{2})\.md$/);
            if (dateMatch) {
              timeline.push({
                date: dateMatch[1],
                file: `memory/${file}`,
                size: stat.size
              });
            }
          }
        }
      }
      
      // Sort timeline by date
      timeline.sort((a, b) => b.date.localeCompare(a.date));
      
      // Calculate stats by type
      const byType = {};
      for (const f of fileStats) {
        if (!byType[f.type]) byType[f.type] = { count: 0, size: 0 };
        byType[f.type].count++;
        byType[f.type].size += f.size;
      }
      
      // Health check
      const now = new Date();
      const lastDailyFile = timeline[0];
      const daysSinceLastDaily = lastDailyFile 
        ? Math.floor((now.getTime() - new Date(lastDailyFile.date).getTime()) / (1000 * 60 * 60 * 24))
        : 999;
      
      const indexPath = path.join(WORKSPACE, 'memory/index.json');
      let hippocampusHealth = 'unknown';
      let lastDecay = null;
      if (fs.existsSync(indexPath)) {
        const hippocampus = JSON.parse(fs.readFileSync(indexPath, 'utf-8'));
        lastDecay = hippocampus.decayLastRun;
        const daysSinceDecay = lastDecay 
          ? Math.floor((now.getTime() - new Date(lastDecay).getTime()) / (1000 * 60 * 60 * 24))
          : 999;
        hippocampusHealth = daysSinceDecay <= 1 ? 'healthy' : daysSinceDecay <= 3 ? 'stale' : 'outdated';
      }
      
      res.writeHead(200, { ...corsHeaders, 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ 
        ok: true,
        totalFiles: fileStats.length,
        totalSize,
        byType,
        timeline: timeline.slice(0, 30),
        health: {
          dailyRecent: daysSinceLastDaily <= 1,
          daysSinceLastDaily,
          hippocampusHealth,
          lastDecay,
          status: daysSinceLastDaily <= 1 && hippocampusHealth === 'healthy' ? 'healthy' : 
                  daysSinceLastDaily <= 3 ? 'ok' : 'needs_attention'
        },
        files: fileStats.sort((a, b) => new Date(b.modified).getTime() - new Date(a.modified).getTime())
      }));
    } catch (err) {
      res.writeHead(500, { ...corsHeaders, 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: false, error: err.message }));
    }
    return;
  }

  // Skills list
  if (url.pathname === '/api/skills' && req.method === 'GET') {
    try {
      const skills = getSkillsList();
      res.writeHead(200, { ...corsHeaders, 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, skills }));
    } catch (err) {
      res.writeHead(500, { ...corsHeaders, 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: false, error: err.message }));
    }
    return;
  }

  // Delete skill (entire directory)
  if (url.pathname === '/api/skills/delete' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        const { skillPath } = JSON.parse(body);
        if (!skillPath) {
          res.writeHead(400, { ...corsHeaders, 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: false, error: 'Missing skillPath' }));
          return;
        }
        
        // Security: only allow deleting from workspace skills directory
        const skillDir = path.dirname(skillPath);
        const workspaceSkills = path.join(WORKSPACE, 'skills');
        const resolved = path.resolve(skillDir);
        
        if (!resolved.startsWith(workspaceSkills)) {
          res.writeHead(403, { ...corsHeaders, 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: false, error: '只能删除工作区的技能' }));
          return;
        }
        
        if (!fs.existsSync(resolved)) {
          res.writeHead(404, { ...corsHeaders, 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: false, error: '技能不存在' }));
          return;
        }
        
        // Get skill name for response
        const skillName = path.basename(skillDir);
        
        // Delete entire directory recursively
        fs.rmSync(resolved, { recursive: true, force: true });
        
        res.writeHead(200, { ...corsHeaders, 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true, deleted: skillName }));
      } catch (err) {
        res.writeHead(500, { ...corsHeaders, 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: err.message }));
      }
    });
    return;
  }

  // Update skill from ClawdHub
  if (url.pathname === '/api/skills/update' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        const { skillName } = JSON.parse(body);
        if (!skillName) {
          res.writeHead(400, { ...corsHeaders, 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: false, error: 'Missing skillName' }));
          return;
        }
        
        const { exec } = require('child_process');
        exec(`clawdhub update ${skillName}`, { cwd: WORKSPACE }, (error, stdout, stderr) => {
          if (error) {
            res.writeHead(500, { ...corsHeaders, 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ ok: false, error: stderr || error.message }));
            return;
          }
          res.writeHead(200, { ...corsHeaders, 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: true, output: stdout }));
        });
      } catch (err) {
        res.writeHead(500, { ...corsHeaders, 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: err.message }));
      }
    });
    return;
  }

  // Install skill from ClawdHub
  if (url.pathname === '/api/skills/install' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        const { skillName } = JSON.parse(body);
        if (!skillName) {
          res.writeHead(400, { ...corsHeaders, 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: false, error: 'Missing skillName' }));
          return;
        }
        
        const { exec } = require('child_process');
        exec(`clawdhub install ${skillName}`, { cwd: WORKSPACE }, (error, stdout, stderr) => {
          if (error) {
            res.writeHead(500, { ...corsHeaders, 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ ok: false, error: stderr || error.message }));
            return;
          }
          res.writeHead(200, { ...corsHeaders, 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: true, output: stdout }));
        });
      } catch (err) {
        res.writeHead(500, { ...corsHeaders, 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: err.message }));
      }
    });
    return;
  }

  // Get ClawdHub skill details
  if (url.pathname === '/api/clawdhub/info' && req.method === 'GET') {
    const slug = url.searchParams.get('slug') || '';
    if (!slug) {
      res.writeHead(400, { ...corsHeaders, 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: false, error: 'Missing slug parameter' }));
      return;
    }
    
    const https = require('https');
    https.get(`https://clawhub.ai/api/v1/skills/${slug}`, (apiRes) => {
      let data = '';
      apiRes.on('data', chunk => data += chunk);
      apiRes.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json.skill) {
            const skill = json.skill;
            const owner = json.owner || {};
            const latest = json.latestVersion || {};
            res.writeHead(200, { ...corsHeaders, 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
              ok: true,
              skill: {
                slug: skill.slug,
                name: skill.displayName || skill.slug,
                description: skill.summary || '',
                version: latest.version || skill.tags?.latest || '?',
                downloads: skill.stats?.downloads || 0,
                stars: skill.stats?.stars || 0,
                installs: skill.stats?.installsAllTime || 0,
                author: owner.handle || owner.displayName || 'unknown',
                authorAvatar: owner.image || '',
                createdAt: skill.createdAt,
                updatedAt: skill.updatedAt,
                url: `https://clawhub.ai/${owner.handle}/${skill.slug}`,
                changelog: latest.changelog || ''
              }
            }));
          } else {
            res.writeHead(404, { ...corsHeaders, 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ ok: false, error: 'Skill not found' }));
          }
        } catch (e) {
          res.writeHead(500, { ...corsHeaders, 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: false, error: 'Failed to parse response' }));
        }
      });
    }).on('error', (e) => {
      res.writeHead(500, { ...corsHeaders, 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: false, error: e.message }));
    });
    return;
  }

  // Search ClawdHub
  if (url.pathname === '/api/clawdhub/search' && req.method === 'GET') {
    const query = url.searchParams.get('q') || '';
    if (!query) {
      res.writeHead(400, { ...corsHeaders, 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: false, error: 'Missing query parameter' }));
      return;
    }
    
    const { exec } = require('child_process');
    exec(`clawdhub search "${query}"`, { cwd: WORKSPACE }, (error, stdout, stderr) => {
      if (error) {
        res.writeHead(500, { ...corsHeaders, 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: stderr || error.message, results: [] }));
        return;
      }
      
      // Parse text output: "name v1.0.0  Description  (0.448)"
      const results = [];
      const lines = stdout.split('\n').filter(l => l.trim() && !l.includes('Searching'));
      for (const line of lines) {
        // Match: skillname v1.0.0  Description text  (score)
        const match = line.match(/^(\S+)\s+v[\d.]+\s+(.+?)\s+\([\d.]+\)$/);
        if (match) {
          results.push({ name: match[1], description: match[2].trim() });
        }
      }
      res.writeHead(200, { ...corsHeaders, 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, results }));
    });
    return;
  }

  // Get skill usage stats
  if (url.pathname === '/api/skills/usage' && req.method === 'GET') {
    try {
      // Scan session files for skill usage
      const usage = {};
      const agentsBase = process.env.HOME + '/.openclaw/agents';
      const agentDirs = ['main', 'claude-main', 'claude-haiku', 'claude-sonnet'];
      
      for (const agentDir of agentDirs) {
        const sessionsDir = path.join(agentsBase, agentDir, 'sessions');
        if (!fs.existsSync(sessionsDir)) continue;
        
        const files = fs.readdirSync(sessionsDir).filter(f => f.endsWith('.jsonl'));
        for (const file of files.slice(-50)) { // Only last 50 session files
          try {
            const content = fs.readFileSync(path.join(sessionsDir, file), 'utf-8');
            const lines = content.split('\n').filter(l => l.trim());
            
            for (const line of lines) {
              try {
                const entry = JSON.parse(line);
                // Look for skill mentions in tool calls or system messages
                if (entry.message?.content) {
                  const contentStr = JSON.stringify(entry.message.content);
                  // Match skill names from SKILL.md references
                  const skillMatches = contentStr.match(/skills\/([a-z0-9-]+)\/SKILL\.md/gi);
                  if (skillMatches) {
                    for (const match of skillMatches) {
                      const skillName = match.replace(/skills\//i, '').replace(/\/SKILL\.md/i, '');
                      usage[skillName] = (usage[skillName] || 0) + 1;
                    }
                  }
                }
              } catch {}
            }
          } catch {}
        }
      }
      
      res.writeHead(200, { ...corsHeaders, 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, usage }));
    } catch (err) {
      res.writeHead(500, { ...corsHeaders, 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: false, error: err.message }));
    }
    return;
  }

  // Read skill content
  if (url.pathname === '/api/skills/read' && req.method === 'GET') {
    try {
      const skillPath = url.searchParams.get('path');
      if (!skillPath) {
        res.writeHead(400, { ...corsHeaders, 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: 'Missing path parameter' }));
        return;
      }
      // Security check
      if (!skillPath.endsWith('SKILL.md')) {
        res.writeHead(403, { ...corsHeaders, 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: 'Only SKILL.md files allowed' }));
        return;
      }
      if (!fs.existsSync(skillPath)) {
        res.writeHead(404, { ...corsHeaders, 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: 'File not found' }));
        return;
      }
      const content = fs.readFileSync(skillPath, 'utf-8');
      res.writeHead(200, { ...corsHeaders, 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, content }));
    } catch (err) {
      res.writeHead(500, { ...corsHeaders, 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: false, error: err.message }));
    }
    return;
  }

  // Output files list
  if (url.pathname === '/api/output' && req.method === 'GET') {
    try {
      const files = getOutputFiles();
      res.writeHead(200, { ...corsHeaders, 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, files }));
    } catch (err) {
      res.writeHead(500, { ...corsHeaders, 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: false, error: err.message }));
    }
    return;
  }

  // Read output file content (for text preview)
  if (url.pathname === '/api/output/read' && req.method === 'GET') {
    try {
      const filePath = url.searchParams.get('path');
      if (!filePath) {
        res.writeHead(400, { ...corsHeaders, 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: 'Missing path' }));
        return;
      }
      
      const outputDir = path.join(WORKSPACE, 'output');
      const fullPath = path.join(outputDir, filePath);
      const resolved = path.resolve(fullPath);
      
      if (!resolved.startsWith(outputDir)) {
        res.writeHead(403, { ...corsHeaders, 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: 'Access denied' }));
        return;
      }
      
      if (!fs.existsSync(resolved)) {
        res.writeHead(404, { ...corsHeaders, 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: 'File not found' }));
        return;
      }
      
      const content = fs.readFileSync(resolved, 'utf-8').slice(0, 100000); // Limit to 100KB
      res.writeHead(200, { ...corsHeaders, 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, content }));
    } catch (err) {
      res.writeHead(500, { ...corsHeaders, 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: false, error: err.message }));
    }
    return;
  }

  // Serve output file (for download/image preview)
  if (url.pathname === '/api/output/file' && req.method === 'GET') {
    try {
      const filePath = url.searchParams.get('path');
      const download = url.searchParams.get('download');
      
      if (!filePath) {
        res.writeHead(400, { ...corsHeaders, 'Content-Type': 'text/plain' });
        res.end('Missing path');
        return;
      }
      
      const outputDir = path.join(WORKSPACE, 'output');
      const fullPath = path.join(outputDir, filePath);
      const resolved = path.resolve(fullPath);
      
      if (!resolved.startsWith(outputDir)) {
        res.writeHead(403, { ...corsHeaders, 'Content-Type': 'text/plain' });
        res.end('Access denied');
        return;
      }
      
      if (!fs.existsSync(resolved)) {
        res.writeHead(404, { ...corsHeaders, 'Content-Type': 'text/plain' });
        res.end('File not found');
        return;
      }
      
      const stat = fs.statSync(resolved);
      const ext = path.extname(resolved).toLowerCase();
      
      const mimeTypes = {
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.gif': 'image/gif',
        '.webp': 'image/webp',
        '.svg': 'image/svg+xml',
        '.json': 'application/json',
        '.txt': 'text/plain',
        '.md': 'text/markdown',
        '.html': 'text/html',
        '.css': 'text/css',
        '.js': 'text/javascript',
        '.pdf': 'application/pdf',
      };
      
      const contentType = mimeTypes[ext] || 'application/octet-stream';
      const filename = path.basename(resolved);
      
      const headers = {
        ...corsHeaders,
        'Content-Type': contentType,
        'Content-Length': stat.size,
      };
      
      if (download) {
        headers['Content-Disposition'] = `attachment; filename="${filename}"`;
      }
      
      res.writeHead(200, headers);
      fs.createReadStream(resolved).pipe(res);
    } catch (err) {
      res.writeHead(500, { ...corsHeaders, 'Content-Type': 'text/plain' });
      res.end(err.message);
    }
    return;
  }

  // Delete output file
  if (url.pathname === '/api/output/delete' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        const { path: filePath } = JSON.parse(body);
        if (!filePath) {
          res.writeHead(400, { ...corsHeaders, 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: false, error: 'Missing path' }));
          return;
        }
        
        const outputDir = path.join(WORKSPACE, 'output');
        const fullPath = path.join(outputDir, filePath);
        const resolved = path.resolve(fullPath);
        
        if (!resolved.startsWith(outputDir)) {
          res.writeHead(403, { ...corsHeaders, 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: false, error: 'Access denied' }));
          return;
        }
        
        if (!fs.existsSync(resolved)) {
          res.writeHead(404, { ...corsHeaders, 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: false, error: 'File not found' }));
          return;
        }
        
        fs.unlinkSync(resolved);
        res.writeHead(200, { ...corsHeaders, 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true }));
      } catch (err) {
        res.writeHead(500, { ...corsHeaders, 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: err.message }));
      }
    });
    return;
  }

  // Projects list
  if (url.pathname === '/api/projects' && req.method === 'GET') {
    try {
      const projects = getProjects();
      res.writeHead(200, { ...corsHeaders, 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, projects }));
    } catch (err) {
      res.writeHead(500, { ...corsHeaders, 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: false, error: err.message }));
    }
    return;
  }

  // Get running status (Docker containers + port listeners)
  if (url.pathname === '/api/projects/running' && req.method === 'GET') {
    try {
      const { execSync } = require('child_process');
      const running = {
        docker: {},
        ports: {},
      };
      
      // Get Docker containers
      try {
        const dockerPs = execSync('docker ps --format "{{.Names}}|{{.Ports}}|{{.Status}}"', { encoding: 'utf-8', timeout: 5000 });
        for (const line of dockerPs.trim().split('\n').filter(l => l)) {
          const [name, ports, status] = line.split('|');
          // Extract port mapping (e.g., "0.0.0.0:3211->80/tcp")
          const portMatch = ports.match(/0\.0\.0\.0:(\d+)/);
          running.docker[name] = {
            status: status.includes('Up') ? 'running' : 'stopped',
            port: portMatch ? portMatch[1] : null,
            raw: ports,
          };
        }
      } catch (e) { /* Docker not running or no containers */ }
      
      // Get listening ports (for dev servers)
      try {
        const lsof = execSync('lsof -iTCP -sTCP:LISTEN -P -n 2>/dev/null | grep -E ":(3000|3001|3211|4000|5000|5173|8000|8080|8888)" || true', { encoding: 'utf-8', timeout: 5000 });
        for (const line of lsof.trim().split('\n').filter(l => l)) {
          const parts = line.split(/\s+/);
          const command = parts[0];
          const pid = parts[1];
          const portPart = parts[8] || '';
          const portMatch = portPart.match(/:(\d+)$/);
          if (portMatch) {
            const port = portMatch[1];
            if (!running.ports[port]) {
              running.ports[port] = { command, pid };
            }
          }
        }
      } catch (e) { /* ignore */ }
      
      res.writeHead(200, { ...corsHeaders, 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, ...running }));
    } catch (err) {
      res.writeHead(500, { ...corsHeaders, 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: false, error: err.message }));
    }
    return;
  }

  // Get/set project favorites
  if (url.pathname === '/api/projects/favorites' && req.method === 'GET') {
    try {
      const favPath = path.join(WORKSPACE, '.project-favorites.json');
      let favorites = [];
      if (fs.existsSync(favPath)) {
        favorites = JSON.parse(fs.readFileSync(favPath, 'utf-8'));
      }
      res.writeHead(200, { ...corsHeaders, 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, favorites }));
    } catch (err) {
      res.writeHead(500, { ...corsHeaders, 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: false, error: err.message }));
    }
    return;
  }

  if (url.pathname === '/api/projects/favorites' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        const { favorites } = JSON.parse(body);
        const favPath = path.join(WORKSPACE, '.project-favorites.json');
        fs.writeFileSync(favPath, JSON.stringify(favorites, null, 2));
        res.writeHead(200, { ...corsHeaders, 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true }));
      } catch (err) {
        res.writeHead(500, { ...corsHeaders, 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: err.message }));
      }
    });
    return;
  }

  // Docker control (start/stop container)
  if (url.pathname === '/api/projects/docker' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        const { action, containerName, projectPath } = JSON.parse(body);
        const { exec } = require('child_process');
        
        let cmd = '';
        if (action === 'start') {
          cmd = `docker start ${containerName}`;
        } else if (action === 'stop') {
          cmd = `docker stop ${containerName}`;
        } else if (action === 'restart') {
          cmd = `docker restart ${containerName}`;
        } else if (action === 'build-start' && projectPath) {
          // Build and start from docker-compose or Dockerfile
          if (fs.existsSync(path.join(projectPath, 'docker-compose.yml')) || fs.existsSync(path.join(projectPath, 'docker-compose.yaml'))) {
            cmd = `cd "${projectPath}" && docker-compose up -d`;
          } else if (fs.existsSync(path.join(projectPath, 'Dockerfile'))) {
            const name = path.basename(projectPath);
            cmd = `cd "${projectPath}" && docker build -t ${name} . && docker run -d --name ${name} ${name}`;
          }
        } else {
          res.writeHead(400, { ...corsHeaders, 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: false, error: 'Invalid action' }));
          return;
        }
        
        exec(cmd, { timeout: 120000 }, (error, stdout, stderr) => {
          res.writeHead(200, { ...corsHeaders, 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: !error, output: stdout, error: error ? stderr : null }));
        });
      } catch (err) {
        res.writeHead(500, { ...corsHeaders, 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: err.message }));
      }
    });
    return;
  }

  // Get detailed project info (README, git status, health)
  if (url.pathname === '/api/projects/details' && req.method === 'GET') {
    try {
      const projectPath = url.searchParams.get('path');
      if (!projectPath) {
        res.writeHead(400, { ...corsHeaders, 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: 'Missing path parameter' }));
        return;
      }
      
      const { execSync } = require('child_process');
      const details = {
        readme: null,
        gitStatus: null,
        recentCommits: [],
        health: { nodeModules: false, lockfileFresh: true, hasUncommitted: false },
      };
      
      // Read README
      const readmePath = path.join(projectPath, 'README.md');
      if (fs.existsSync(readmePath)) {
        details.readme = fs.readFileSync(readmePath, 'utf-8').slice(0, 2000);
      }
      
      // Git status
      if (fs.existsSync(path.join(projectPath, '.git'))) {
        try {
          // Get status
          const status = execSync('git status --porcelain', { cwd: projectPath, encoding: 'utf-8', timeout: 5000 });
          const lines = status.trim().split('\n').filter(l => l);
          details.gitStatus = {
            clean: lines.length === 0,
            modified: lines.filter(l => l.startsWith(' M') || l.startsWith('M ')).length,
            untracked: lines.filter(l => l.startsWith('??')).length,
            staged: lines.filter(l => l.startsWith('A ') || l.startsWith('M ') || l.startsWith('D ')).length,
          };
          details.health.hasUncommitted = !details.gitStatus.clean;
          
          // Get ahead/behind
          try {
            const aheadBehind = execSync('git rev-list --left-right --count HEAD...@{u} 2>/dev/null || echo "0 0"', { cwd: projectPath, encoding: 'utf-8', timeout: 5000 });
            const [ahead, behind] = aheadBehind.trim().split(/\s+/).map(Number);
            details.gitStatus.ahead = ahead || 0;
            details.gitStatus.behind = behind || 0;
          } catch (e) {
            details.gitStatus.ahead = 0;
            details.gitStatus.behind = 0;
          }
          
          // Get branch
          try {
            details.gitStatus.branch = execSync('git branch --show-current', { cwd: projectPath, encoding: 'utf-8', timeout: 3000 }).trim();
          } catch (e) {
            details.gitStatus.branch = 'unknown';
          }
          
          // Recent commits
          try {
            const log = execSync('git log --oneline -5 --format="%h|%s|%ar"', { cwd: projectPath, encoding: 'utf-8', timeout: 5000 });
            details.recentCommits = log.trim().split('\n').filter(l => l).map(line => {
              const [hash, message, time] = line.split('|');
              return { hash, message, time };
            });
          } catch (e) { /* ignore */ }
        } catch (e) {
          details.gitStatus = { error: e.message };
        }
      }
      
      // Health checks
      details.health.nodeModules = fs.existsSync(path.join(projectPath, 'node_modules'));
      
      // Check if lockfile is fresher than node_modules
      const lockPath = path.join(projectPath, 'package-lock.json') || path.join(projectPath, 'pnpm-lock.yaml') || path.join(projectPath, 'yarn.lock');
      const nodeModulesPath = path.join(projectPath, 'node_modules');
      if (fs.existsSync(lockPath) && fs.existsSync(nodeModulesPath)) {
        const lockStat = fs.statSync(lockPath);
        const nmStat = fs.statSync(nodeModulesPath);
        details.health.lockfileFresh = lockStat.mtime <= nmStat.mtime;
      }
      
      // Check for common issues
      details.health.hasTodos = false;
      try {
        const todoCheck = execSync('grep -r "TODO\\|FIXME" --include="*.ts" --include="*.tsx" --include="*.js" -l 2>/dev/null | head -5', { cwd: projectPath, encoding: 'utf-8', timeout: 5000 });
        details.health.hasTodos = todoCheck.trim().length > 0;
      } catch (e) { /* ignore */ }
      
      res.writeHead(200, { ...corsHeaders, 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, ...details }));
    } catch (err) {
      res.writeHead(500, { ...corsHeaders, 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: false, error: err.message }));
    }
    return;
  }

  // Open project in VS Code or Terminal
  if (url.pathname === '/api/projects/open' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        const { projectPath, app } = JSON.parse(body);
        if (!projectPath) {
          res.writeHead(400, { ...corsHeaders, 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: false, error: 'Missing projectPath' }));
          return;
        }
        
        const { exec } = require('child_process');
        let cmd = '';
        if (app === 'vscode') {
          cmd = `code "${projectPath}"`;
        } else if (app === 'terminal') {
          cmd = `open -a Terminal "${projectPath}"`;
        } else if (app === 'finder') {
          cmd = `open "${projectPath}"`;
        } else {
          res.writeHead(400, { ...corsHeaders, 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: false, error: 'Invalid app' }));
          return;
        }
        
        exec(cmd, (error) => {
          if (error) {
            res.writeHead(500, { ...corsHeaders, 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ ok: false, error: error.message }));
            return;
          }
          res.writeHead(200, { ...corsHeaders, 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: true }));
        });
      } catch (err) {
        res.writeHead(500, { ...corsHeaders, 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: err.message }));
      }
    });
    return;
  }

  // Execute project action (git pull, npm install, etc.)
  if (url.pathname === '/api/projects/action' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        const { projectPath, action } = JSON.parse(body);
        if (!projectPath || !action) {
          res.writeHead(400, { ...corsHeaders, 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: false, error: 'Missing projectPath or action' }));
          return;
        }
        
        const { exec } = require('child_process');
        let cmd = '';
        
        switch (action) {
          case 'git-pull':
            cmd = 'git pull';
            break;
          case 'npm-install':
            cmd = fs.existsSync(path.join(projectPath, 'pnpm-lock.yaml')) ? 'pnpm install' : 
                  fs.existsSync(path.join(projectPath, 'yarn.lock')) ? 'yarn install' : 'npm install';
            break;
          case 'npm-build':
            cmd = 'npm run build';
            break;
          case 'npm-dev':
            cmd = 'npm run dev &';
            break;
          default:
            res.writeHead(400, { ...corsHeaders, 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ ok: false, error: 'Invalid action' }));
            return;
        }
        
        exec(cmd, { cwd: projectPath, timeout: 120000 }, (error, stdout, stderr) => {
          res.writeHead(200, { ...corsHeaders, 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ 
            ok: !error, 
            output: stdout,
            error: error ? (stderr || error.message) : null
          }));
        });
      } catch (err) {
        res.writeHead(500, { ...corsHeaders, 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: err.message }));
      }
    });
    return;
  }

  // Batch project actions
  if (url.pathname === '/api/projects/batch' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        const { paths, action } = JSON.parse(body);
        if (!paths || !Array.isArray(paths) || !action) {
          res.writeHead(400, { ...corsHeaders, 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: false, error: 'Missing paths or action' }));
          return;
        }
        
        const { exec } = require('child_process');
        const results = [];
        
        for (const projectPath of paths) {
          let cmd = '';
          switch (action) {
            case 'git-pull':
              if (fs.existsSync(path.join(projectPath, '.git'))) {
                cmd = 'git pull';
              }
              break;
            case 'npm-install':
              if (fs.existsSync(path.join(projectPath, 'package.json'))) {
                cmd = fs.existsSync(path.join(projectPath, 'pnpm-lock.yaml')) ? 'pnpm install' : 
                      fs.existsSync(path.join(projectPath, 'yarn.lock')) ? 'yarn install' : 'npm install';
              }
              break;
          }
          
          if (cmd) {
            try {
              const { execSync } = require('child_process');
              const output = execSync(cmd, { cwd: projectPath, encoding: 'utf-8', timeout: 60000 });
              results.push({ path: projectPath, ok: true, output: output.slice(0, 500) });
            } catch (e) {
              results.push({ path: projectPath, ok: false, error: e.message });
            }
          }
        }
        
        res.writeHead(200, { ...corsHeaders, 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true, results }));
      } catch (err) {
        res.writeHead(500, { ...corsHeaders, 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: err.message }));
      }
    });
    return;
  }

  // Delete project
  if (url.pathname === '/api/projects/delete' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        const { projectPath } = JSON.parse(body);
        if (!projectPath) {
          res.writeHead(400, { ...corsHeaders, 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: false, error: 'Missing projectPath' }));
          return;
        }
        
        // Security: only allow deleting from workspace projects directory
        const projectsDir = path.join(WORKSPACE, 'projects');
        const resolved = path.resolve(projectPath);
        
        if (!resolved.startsWith(projectsDir)) {
          res.writeHead(403, { ...corsHeaders, 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: false, error: '只能删除工作区的项目' }));
          return;
        }
        
        if (!fs.existsSync(resolved)) {
          res.writeHead(404, { ...corsHeaders, 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: false, error: '项目不存在' }));
          return;
        }
        
        const projectName = path.basename(resolved);
        fs.rmSync(resolved, { recursive: true, force: true });
        
        res.writeHead(200, { ...corsHeaders, 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true, deleted: projectName }));
      } catch (err) {
        res.writeHead(500, { ...corsHeaders, 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: err.message }));
      }
    });
    return;
  }

  // Cron jobs list (with caching for fast response)
  if (url.pathname === '/api/cron' && req.method === 'GET') {
    // Check cache first
    const cached = cache.get('cron-jobs');
    if (cached) {
      res.writeHead(200, { ...corsHeaders, 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, jobs: cached, cached: true }));
      return;
    }
    
    // Fetch from CLI (Gateway WebSocket is also slow)
    try {
      const { execSync } = require('child_process');
      const output = execSync('openclaw cron list --json 2>/dev/null || echo "[]"', { encoding: 'utf-8', timeout: 15000 });
      let jobs = [];
      const parsed = JSON.parse(output);
      jobs = Array.isArray(parsed) ? parsed : (parsed.jobs || []);
      
      // Cache for 30 seconds
      cache.set('cron-jobs', jobs, 30000);
      
      res.writeHead(200, { ...corsHeaders, 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, jobs }));
    } catch (err) {
      res.writeHead(500, { ...corsHeaders, 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: false, error: err.message }));
    }
    return;
  }

  // Cron job actions (run/toggle/remove) via Gateway API
  if (url.pathname === '/api/cron/action' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        const { action, jobId, enabled } = JSON.parse(body);
        if (!action || !jobId) {
          res.writeHead(400, { ...corsHeaders, 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: false, error: 'Missing action or jobId' }));
          return;
        }
        
        let method = '';
        let params = { jobId };
        if (action === 'run') {
          method = 'cron.run';
          params.runMode = 'force';
        } else if (action === 'remove') {
          method = 'cron.remove';
        } else if (action === 'toggle') {
          method = 'cron.update';
          params.patch = { enabled };
        } else {
          res.writeHead(400, { ...corsHeaders, 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: false, error: 'Invalid action' }));
          return;
        }
        
        await gatewayRpc('insecure', method, params);
        // Clear cache so next fetch gets fresh data
        cache.data['cron-jobs'] = null;
        res.writeHead(200, { ...corsHeaders, 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true }));
      } catch (err) {
        res.writeHead(500, { ...corsHeaders, 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: err.message }));
      }
    });
    return;
  }

  // Create cron job
  if (url.pathname === '/api/cron/create' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        const { job } = JSON.parse(body);
        if (!job) {
          res.writeHead(400, { ...corsHeaders, 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: false, error: 'Missing job' }));
          return;
        }
        
        const result = await gatewayRpc('insecure', 'cron.add', { job });
        cache.data['cron-jobs'] = null; // Clear cache
        res.writeHead(200, { ...corsHeaders, 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true, jobId: result.jobId }));
      } catch (err) {
        res.writeHead(500, { ...corsHeaders, 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: err.message }));
      }
    });
    return;
  }

  // Cron job runs history
  if (url.pathname === '/api/cron/runs' && req.method === 'GET') {
    const token = url.searchParams.get('token');
    const jobId = url.searchParams.get('jobId');
    if (!token || !jobId) {
      res.writeHead(400, { ...corsHeaders, 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: false, error: 'Missing token or jobId' }));
      return;
    }
    try {
      const result = await gatewayRpc(token, 'cron.runs', { jobId });
      res.writeHead(200, { ...corsHeaders, 'Content-Type': 'application/json' });
      // Gateway API 返回 entries，统一返回为 entries
      res.end(JSON.stringify({ ok: true, entries: result.entries || result.runs || [] }));
    } catch (err) {
      res.writeHead(500, { ...corsHeaders, 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: false, error: err.message }));
    }
    return;
  }

  // Sync Discord structure
  if (url.pathname === '/api/sync-discord' && req.method === 'POST') {
    try {
      const { main } = require('./scripts/sync-discord-structure.js');
      const result = await main();
      res.writeHead(200, { ...corsHeaders, 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ 
        ok: true, 
        message: 'Discord structure synced',
        stats: {
          categories: Object.keys(result.categories).length,
          forums: Object.keys(result.forums).length,
          threads: Object.keys(result.threads).length,
          channels: Object.keys(result.channels).length,
        },
        lastUpdated: result.lastUpdated
      }));
    } catch (err) {
      res.writeHead(500, { ...corsHeaders, 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: false, error: err.message }));
    }
    return;
  }

  // Sessions list
  if (url.pathname === '/api/sessions' && req.method === 'GET') {
    try {
      const { execSync } = require('child_process');
      const sessions = [];
      
      // Get sessions from openclaw CLI
      try {
        const output = execSync('openclaw sessions list --json 2>/dev/null || echo "[]"', { encoding: 'utf-8', timeout: 10000 });
        const parsed = JSON.parse(output);
        const sessionList = Array.isArray(parsed) ? parsed : (parsed.sessions || []);
        
        for (const s of sessionList) {
          sessions.push({
            key: s.key || s.sessionKey || '',
            kind: s.kind || 'main',
            agentId: s.agentId || 'claude-main',
            channelId: s.channelId,
            channelName: s.channelName,
            displayName: s.displayName || s.label,
            lastActiveAt: s.lastActiveAt || s.updatedAt,
            lastMessage: s.lastMessage,
            messageCount: s.messageCount || 0,
            totalTokens: s.totalTokens || 0,
          });
        }
      } catch (e) {
        // Fallback: scan session files
        const agentsBase = process.env.HOME + '/.openclaw/agents';
        const agentDirs = ['claude-main', 'main'];
        
        for (const agentDir of agentDirs) {
          const sessionsDir = path.join(agentsBase, agentDir, 'sessions');
          if (!fs.existsSync(sessionsDir)) continue;
          
          const files = fs.readdirSync(sessionsDir).filter(f => f.endsWith('.jsonl'));
          for (const file of files.slice(-20)) {
            const sessionKey = file.replace('.jsonl', '');
            const filePath = path.join(sessionsDir, file);
            const stat = fs.statSync(filePath);
            
            // Read last few lines for last message
            let lastMessage = '';
            let messageCount = 0;
            try {
              const content = fs.readFileSync(filePath, 'utf-8');
              const lines = content.trim().split('\n').filter(l => l);
              messageCount = lines.length;
              if (lines.length > 0) {
                const lastEntry = JSON.parse(lines[lines.length - 1]);
                if (lastEntry.message?.content) {
                  const c = lastEntry.message.content;
                  lastMessage = typeof c === 'string' ? c : (c[0]?.text || '');
                }
              }
            } catch {}
            
            sessions.push({
              key: sessionKey,
              kind: sessionKey.includes('channel:') ? 'channel' : sessionKey.includes('isolated:') ? 'isolated' : 'main',
              agentId: agentDir,
              lastActiveAt: stat.mtime.toISOString(),
              lastMessage: lastMessage.slice(0, 100),
              messageCount,
            });
          }
        }
      }
      
      // Sort by last active
      sessions.sort((a, b) => (b.lastActiveAt || '').localeCompare(a.lastActiveAt || ''));
      
      res.writeHead(200, { ...corsHeaders, 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, sessions }));
    } catch (err) {
      res.writeHead(500, { ...corsHeaders, 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: false, error: err.message }));
    }
    return;
  }

  // Session history
  if (url.pathname === '/api/sessions/history' && req.method === 'GET') {
    try {
      const sessionKey = url.searchParams.get('key');
      if (!sessionKey) {
        res.writeHead(400, { ...corsHeaders, 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: 'Missing key' }));
        return;
      }
      
      const history = [];
      const agentsBase = process.env.HOME + '/.openclaw/agents';
      const agentDirs = ['claude-main', 'main'];
      
      for (const agentDir of agentDirs) {
        const sessionFile = path.join(agentsBase, agentDir, 'sessions', `${sessionKey}.jsonl`);
        if (fs.existsSync(sessionFile)) {
          const content = fs.readFileSync(sessionFile, 'utf-8');
          const lines = content.trim().split('\n').filter(l => l);
          
          for (const line of lines.slice(-50)) { // Last 50 messages
            try {
              const entry = JSON.parse(line);
              if (entry.message) {
                let content = entry.message.content;
                if (Array.isArray(content)) {
                  content = content.map(c => c.text || c.content || '').join('\n');
                }
                history.push({
                  role: entry.message.role || 'assistant',
                  content,
                  timestamp: entry.timestamp,
                });
              }
            } catch {}
          }
          break;
        }
      }
      
      res.writeHead(200, { ...corsHeaders, 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, history }));
    } catch (err) {
      res.writeHead(500, { ...corsHeaders, 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: false, error: err.message }));
    }
    return;
  }

  // Dashboard status (aggregated data)
  if (url.pathname === '/api/status' && req.method === 'GET') {
    try {
      const memoryFiles = getMemoryFiles();
      const skills = getSkillsList();
      const projects = getProjects();
      
      // Read openclaw config for channels
      let channels = [];
      const configPath = path.join(process.env.HOME || '', '.openclaw/openclaw.json');
      if (fs.existsSync(configPath)) {
        try {
          const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
          if (config.channels) {
            channels = Object.entries(config.channels).map(([id, cfg]) => ({
              id,
              name: id,
              configured: true
            }));
          }
        } catch (e) { /* ignore */ }
      }
      
      res.writeHead(200, { ...corsHeaders, 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        ok: true,
        status: {
          memoryFiles: memoryFiles.length,
          skills: skills.length,
          projects: projects.length,
          channels: channels.length,
          workspace: WORKSPACE
        },
        channels,
        skills: skills.slice(0, 10).map(s => ({ ...s, location: s.path })),
        projects: projects.slice(0, 10),
        memoryFiles: memoryFiles.slice(0, 5)
      }));
    } catch (err) {
      res.writeHead(500, { ...corsHeaders, 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: false, error: err.message }));
    }
    return;
  }

  // Health check endpoint
  if (url.pathname === '/api/health' && req.method === 'GET') {
    try {
      const health = {
        gateway: 'ok',
        cron: 'ok',
        memory: 'ok',
        hippocampus: 'ok',
        timestamp: new Date().toISOString(),
      };
      
      // Check Gateway connectivity
      try {
        const ws = new WebSocket(GATEWAY_URL);
        await new Promise((resolve, reject) => {
          const timeout = setTimeout(() => { ws.close(); reject(new Error('Gateway timeout')); }, 3000);
          ws.on('open', () => { clearTimeout(timeout); ws.close(); resolve(); });
          ws.on('error', (err) => { clearTimeout(timeout); reject(err); });
        });
      } catch (e) {
        health.gateway = 'error';
      }
      
      // Check cron jobs (via RPC if possible)
      // For now just check if cron skill exists
      const cronSkillPath = path.join(WORKSPACE, 'skills/remind-me');
      if (!fs.existsSync(cronSkillPath)) {
        health.cron = 'warning';
      }
      
      // Check memory directory
      const memoryDir = path.join(WORKSPACE, 'memory');
      if (!fs.existsSync(memoryDir)) {
        health.memory = 'warning';
      } else {
        const dailyFiles = fs.readdirSync(memoryDir).filter(f => /^\d{4}-\d{2}-\d{2}\.md$/.test(f));
        const today = new Date().toISOString().slice(0, 10);
        const hasToday = dailyFiles.some(f => f.startsWith(today));
        if (!hasToday && dailyFiles.length > 0) {
          // Check how old the latest daily file is
          const latest = dailyFiles.sort().reverse()[0];
          const latestDate = new Date(latest.replace('.md', ''));
          const daysSince = Math.floor((Date.now() - latestDate.getTime()) / 86400000);
          if (daysSince > 3) health.memory = 'warning';
        }
      }
      
      // Check hippocampus index
      const hippoIndex = path.join(WORKSPACE, 'memory/index.json');
      if (!fs.existsSync(hippoIndex)) {
        health.hippocampus = 'warning';
      } else {
        try {
          const index = JSON.parse(fs.readFileSync(hippoIndex, 'utf-8'));
          if (!index.memories || index.memories.length === 0) {
            health.hippocampus = 'warning';
          }
        } catch (e) {
          health.hippocampus = 'error';
        }
      }
      
      res.writeHead(200, { ...corsHeaders, 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, ...health }));
    } catch (err) {
      res.writeHead(500, { ...corsHeaders, 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: false, error: err.message }));
    }
    return;
  }

  // RPC endpoint
  if (url.pathname === '/rpc' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        const { token, method, params } = JSON.parse(body);
        if (!token) {
          res.writeHead(401, { ...corsHeaders, 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: false, error: 'Missing token' }));
          return;
        }
        const result = await gatewayRpc(token, method, params);
        res.writeHead(200, { ...corsHeaders, 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true, payload: result }));
      } catch (err) {
        res.writeHead(500, { ...corsHeaders, 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: err.message }));
      }
    });
    return;
  }

  // Claude Code usage (OAuth quota)
  if (url.pathname === '/api/claude-usage' && req.method === 'GET') {
    try {
      const { execSync } = require('child_process');
      const scriptPath = path.join(WORKSPACE, 'skills/claude-code-usage/scripts/claude-usage.sh');
      const output = execSync(`${scriptPath} --json`, { encoding: 'utf-8', timeout: 10000 });
      const usage = JSON.parse(output);
      res.writeHead(200, { ...corsHeaders, 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, ...usage }));
    } catch (err) {
      res.writeHead(500, { ...corsHeaders, 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: false, error: err.message }));
    }
    return;
  }

  // Token usage statistics (from Supabase)
  if (url.pathname === '/api/token-usage' && req.method === 'GET') {
    try {
      const supabaseUrl = 'http://127.0.0.1:54321';
      const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';
      
      // Parse query params for filtering
      const days = parseInt(url.searchParams.get('days')) || 30;
      const fromDate = url.searchParams.get('from');
      const toDate = url.searchParams.get('to');
      
      // Calculate date range
      const endDate = toDate || new Date().toISOString().split('T')[0];
      const startDate = fromDate || new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      
      const response = await fetch(
        `${supabaseUrl}/rest/v1/token_usage?select=*&date=gte.${startDate}&date=lte.${endDate}&order=date.desc`,
        {
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
          }
        }
      );
      
      if (!response.ok) throw new Error('Failed to fetch from Supabase');
      const usage = await response.json();
      
      // Calculate totals
      const today = new Date().toISOString().split('T')[0];
      const todayUsage = usage.filter(u => u.date === today);
      const todayTokens = todayUsage.reduce((sum, u) => sum + (u.tokens_total || 0), 0);
      const todayCost = todayUsage.reduce((sum, u) => sum + parseFloat(u.cost_usd || 0), 0);
      
      // All time totals (within range)
      const allTokens = usage.reduce((sum, u) => sum + (u.tokens_total || 0), 0);
      const allCost = usage.reduce((sum, u) => sum + parseFloat(u.cost_usd || 0), 0);
      const allCacheRead = usage.reduce((sum, u) => sum + (u.tokens_cache_read || 0), 0);
      const allMessages = usage.reduce((sum, u) => sum + (u.message_count || 0), 0);
      
      // Last 7 days totals
      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const weekUsage = usage.filter(u => u.date >= weekAgo);
      const weekTokens = weekUsage.reduce((sum, u) => sum + (u.tokens_total || 0), 0);
      const weekCost = weekUsage.reduce((sum, u) => sum + parseFloat(u.cost_usd || 0), 0);
      
      // Aggregate by agent
      const byAgent = {};
      for (const u of usage) {
        const agent = u.agent || 'unknown';
        if (!byAgent[agent]) {
          byAgent[agent] = { tokens: 0, cost: 0, cacheRead: 0, messages: 0 };
        }
        byAgent[agent].tokens += u.tokens_total || 0;
        byAgent[agent].cost += parseFloat(u.cost_usd || 0);
        byAgent[agent].cacheRead += u.tokens_cache_read || 0;
        byAgent[agent].messages += u.message_count || 0;
      }
      
      // Calculate cache efficiency
      const cacheRate = allTokens > 0 ? (allCacheRead / allTokens) * 100 : 0;
      
      // Cost projection (based on daily average)
      const uniqueDates = [...new Set(usage.map(u => u.date))];
      const numDays = uniqueDates.length || 1;
      const dailyAvgCost = allCost / numDays;
      const monthProjection = dailyAvgCost * 30;
      const weekProjection = dailyAvgCost * 7;
      
      // Aggregate by date for trends
      const byDate = {};
      for (const u of usage) {
        if (!byDate[u.date]) {
          byDate[u.date] = { tokens: 0, cost: 0, messages: 0, cacheRead: 0 };
        }
        byDate[u.date].tokens += u.tokens_total || 0;
        byDate[u.date].cost += parseFloat(u.cost_usd || 0);
        byDate[u.date].messages += u.message_count || 0;
        byDate[u.date].cacheRead += u.tokens_cache_read || 0;
      }
      
      // Load channel labels for Forum mapping
      let channelLabels = { categories: {}, forums: {}, threads: {}, labels: {} };
      try {
        const labelsPath = path.join(__dirname, 'channel-labels.json');
        channelLabels = JSON.parse(fs.readFileSync(labelsPath, 'utf-8'));
      } catch (e) { /* ignore */ }
      
      // Helper to get forum name from thread/channel ID
      function getForumInfo(channelId) {
        // Check if it's a known thread
        const thread = channelLabels.threads?.[channelId];
        if (thread?.forum) {
          const forum = channelLabels.forums?.[thread.forum];
          if (forum) {
            const category = channelLabels.categories?.[forum.category];
            return { 
              name: `${forum.icon || '📁'} ${forum.name}`,
              forum: forum.name,
              category: category?.name || 'Other',
              thread: thread.name
            };
          }
        }
        // Check if it's a forum directly
        const forum = channelLabels.forums?.[channelId];
        if (forum) {
          const category = channelLabels.categories?.[forum.category];
          return {
            name: `${forum.icon || '📁'} ${forum.name}`,
            forum: forum.name,
            category: category?.name || 'Other',
            thread: null
          };
        }
        return null;
      }
      
      // Aggregate by channel (legacy)
      const byChannel = {};
      // Aggregate by forum (new)
      const byForum = {};
      const byCategory = {};
      
      for (const u of usage) {
        const channelId = u.channel_id || '';
        const channelName = u.channel_name || u.channel_id || 'unknown';
        
        // Legacy channel aggregation
        if (!byChannel[channelName]) {
          byChannel[channelName] = { tokens: 0, cost: 0, messages: 0 };
        }
        byChannel[channelName].tokens += u.tokens_total || 0;
        byChannel[channelName].cost += parseFloat(u.cost_usd || 0);
        byChannel[channelName].messages += u.message_count || 0;
        
        // Forum aggregation
        const forumInfo = getForumInfo(channelId);
        if (forumInfo) {
          // By Forum
          if (!byForum[forumInfo.forum]) {
            byForum[forumInfo.forum] = { 
              name: forumInfo.name,
              category: forumInfo.category,
              tokens: 0, cost: 0, messages: 0,
              threads: {}
            };
          }
          byForum[forumInfo.forum].tokens += u.tokens_total || 0;
          byForum[forumInfo.forum].cost += parseFloat(u.cost_usd || 0);
          byForum[forumInfo.forum].messages += u.message_count || 0;
          
          // Thread within forum
          if (forumInfo.thread) {
            if (!byForum[forumInfo.forum].threads[forumInfo.thread]) {
              byForum[forumInfo.forum].threads[forumInfo.thread] = { tokens: 0, cost: 0, messages: 0 };
            }
            byForum[forumInfo.forum].threads[forumInfo.thread].tokens += u.tokens_total || 0;
            byForum[forumInfo.forum].threads[forumInfo.thread].cost += parseFloat(u.cost_usd || 0);
            byForum[forumInfo.forum].threads[forumInfo.thread].messages += u.message_count || 0;
          }
          
          // By Category
          if (!byCategory[forumInfo.category]) {
            byCategory[forumInfo.category] = { tokens: 0, cost: 0, messages: 0 };
          }
          byCategory[forumInfo.category].tokens += u.tokens_total || 0;
          byCategory[forumInfo.category].cost += parseFloat(u.cost_usd || 0);
          byCategory[forumInfo.category].messages += u.message_count || 0;
        }
      }
      
      res.writeHead(200, { ...corsHeaders, 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ 
        ok: true,
        dateRange: { from: startDate, to: endDate, days: numDays },
        today: { tokens: todayTokens, cost: todayCost },
        week: { tokens: weekTokens, cost: weekCost },
        all: { tokens: allTokens, cost: allCost, messages: allMessages },
        cache: { 
          totalRead: allCacheRead, 
          rate: cacheRate.toFixed(1),
          saved: allCacheRead * 0.000015  // Approximate savings at $15/1M tokens
        },
        projection: {
          daily: dailyAvgCost,
          weekly: weekProjection,
          monthly: monthProjection,
        },
        byAgent: Object.entries(byAgent)
          .map(([name, data]) => ({ 
            name, 
            ...data, 
            cacheRate: data.tokens > 0 ? ((data.cacheRead / data.tokens) * 100).toFixed(1) : '0'
          }))
          .sort((a, b) => b.cost - a.cost),
        byDate: Object.entries(byDate)
          .map(([date, data]) => ({ date, ...data }))
          .sort((a, b) => a.date.localeCompare(b.date)),
        byChannel: Object.entries(byChannel)
          .filter(([name]) => name !== 'Unknown' && !/^\d+$/.test(name))
          .map(([name, data]) => ({ name, ...data }))
          .sort((a, b) => b.tokens - a.tokens)
          .slice(0, 10),
        byForum: Object.entries(byForum)
          .map(([key, data]) => ({
            forum: key,
            ...data,
            threads: Object.entries(data.threads || {})
              .map(([name, t]) => ({ name, ...t }))
              .sort((a, b) => b.cost - a.cost)
          }))
          .sort((a, b) => b.cost - a.cost),
        byCategory: Object.entries(byCategory)
          .map(([name, data]) => ({ name, ...data }))
          .sort((a, b) => b.cost - a.cost),
        usage 
      }));
    } catch (err) {
      res.writeHead(500, { ...corsHeaders, 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: false, error: err.message }));
    }
    return;
  }

  // Not found
  res.writeHead(404, { ...corsHeaders, 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ ok: false, error: 'Not found' }));
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[Proxy] OpenClaw HTTP Proxy running on http://0.0.0.0:${PORT}`);
  console.log(`[Proxy] Gateway: ${GATEWAY_URL}`);
  console.log(`[Proxy] Workspace: ${WORKSPACE}`);
});
