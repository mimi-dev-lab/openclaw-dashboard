#!/usr/bin/env node
/**
 * Scan session JSONL files and aggregate token usage by date and channel
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');

// Scan multiple agent directories
const AGENTS_BASE = process.env.AGENTS_BASE || '/Users/lifan/.openclaw/agents';
const AGENT_DIRS = ['main', 'claude-main', 'claude-haiku', 'claude-sonnet', 'gemini-pro', 'gemini-flash'];
const CONFIG_PATH = process.env.CONFIG_PATH || '/Users/lifan/.openclaw/openclaw.json';

// Load channel labels from config
function loadChannelLabels() {
  try {
    const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
    return config.channelLabels || {};
  } catch (e) {
    return {};
  }
}

// Extract channel ID from session key
// Format: agent:main:discord:channel:1234567890
function extractChannelId(sessionKey) {
  if (!sessionKey) return null;
  const match = sessionKey.match(/channel:(\d+)/);
  return match ? match[1] : null;
}

// Parse a single JSONL file and extract usage data
async function parseSessionFile(filePath, sessionKey) {
  const results = [];
  
  const fileStream = fs.createReadStream(filePath);
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  for await (const line of rl) {
    try {
      const entry = JSON.parse(line);
      
      // Only process assistant messages with usage data
      if (entry.type === 'message' && 
          entry.message?.role === 'assistant' && 
          entry.message?.usage) {
        
        const usage = entry.message.usage;
        const timestamp = entry.timestamp || entry.message?.timestamp;
        const date = timestamp ? new Date(timestamp).toISOString().split('T')[0] : null;
        
        if (date) {
          results.push({
            date,
            sessionKey,
            channelId: extractChannelId(sessionKey),
            input: usage.input || 0,
            output: usage.output || 0,
            cacheRead: usage.cacheRead || 0,
            cacheWrite: usage.cacheWrite || 0,
            totalTokens: usage.totalTokens || 0,
            cost: usage.cost?.total || 0,
          });
        }
      }
    } catch (e) {
      // Skip invalid JSON lines
    }
  }
  
  return results;
}

// Load sessions.json from all agent directories to get session key -> file mapping
function loadSessionsMap() {
  const map = {};
  for (const agentDir of AGENT_DIRS) {
    const sessionsPath = path.join(AGENTS_BASE, agentDir, 'sessions', 'sessions.json');
    try {
      const data = JSON.parse(fs.readFileSync(sessionsPath, 'utf-8'));
      for (const [key, session] of Object.entries(data)) {
        if (session.sessionFile) {
          const filename = path.basename(session.sessionFile);
          map[filename] = key;
        }
      }
    } catch (e) {
      // Directory might not exist
    }
  }
  return map;
}

// Aggregate usage by date and channel
function aggregateUsage(allUsage, channelLabels) {
  const aggregated = {};
  
  for (const usage of allUsage) {
    const key = `${usage.date}:${usage.channelId || 'unknown'}`;
    
    if (!aggregated[key]) {
      aggregated[key] = {
        date: usage.date,
        channel_id: usage.channelId || 'unknown',
        channel_name: channelLabels[usage.channelId] || usage.channelId || 'Unknown',
        tokens_input: 0,
        tokens_output: 0,
        tokens_cache: 0,
        tokens_total: 0,
        cost_usd: 0,
        message_count: 0,
      };
    }
    
    aggregated[key].tokens_input += usage.input;
    aggregated[key].tokens_output += usage.output;
    aggregated[key].tokens_cache += usage.cacheRead + usage.cacheWrite;
    aggregated[key].tokens_total += usage.totalTokens;
    aggregated[key].cost_usd += usage.cost;
    aggregated[key].message_count += 1;
  }
  
  return Object.values(aggregated);
}

// Main function
async function main() {
  const args = process.argv.slice(2);
  const dateFilter = args.find(a => a.match(/^\d{4}-\d{2}-\d{2}$/));
  const jsonOutput = args.includes('--json');
  
  const channelLabels = loadChannelLabels();
  const sessionsMap = loadSessionsMap();
  
  // Find all JSONL files from all agent directories
  const files = [];
  for (const agentDir of AGENT_DIRS) {
    const sessionsDir = path.join(AGENTS_BASE, agentDir, 'sessions');
    try {
      const dirFiles = fs.readdirSync(sessionsDir)
        .filter(f => f.endsWith('.jsonl') && !f.includes('.deleted'))
        .map(f => ({
          path: path.join(sessionsDir, f),
          sessionKey: sessionsMap[f] || null,
          agent: agentDir
        }));
      files.push(...dirFiles);
    } catch (e) {
      // Directory might not exist
    }
  }
  
  if (!jsonOutput) {
    console.log(`Found ${files.length} session files across ${AGENT_DIRS.length} agent directories`);
  }
  
  // Parse all files
  const allUsage = [];
  for (const file of files) {
    const usage = await parseSessionFile(file.path, file.sessionKey);
    allUsage.push(...usage);
  }
  
  // Filter by date if specified
  const filtered = dateFilter 
    ? allUsage.filter(u => u.date === dateFilter)
    : allUsage;
  
  // Aggregate
  const aggregated = aggregateUsage(filtered, channelLabels);
  
  // Sort by date desc, then by tokens desc
  aggregated.sort((a, b) => {
    if (a.date !== b.date) return b.date.localeCompare(a.date);
    return b.tokens_total - a.tokens_total;
  });
  
  if (jsonOutput) {
    console.log(JSON.stringify(aggregated, null, 2));
  } else {
    // Pretty print
    console.log('\n📊 Token Usage Summary\n');
    
    let currentDate = null;
    let dailyTotal = { tokens: 0, cost: 0 };
    
    for (const row of aggregated) {
      if (row.date !== currentDate) {
        if (currentDate) {
          console.log(`   ─────────────────────────────────────`);
          console.log(`   Daily Total: ${dailyTotal.tokens.toLocaleString()} tokens ($${dailyTotal.cost.toFixed(4)})\n`);
        }
        currentDate = row.date;
        dailyTotal = { tokens: 0, cost: 0 };
        console.log(`📅 ${row.date}`);
      }
      
      dailyTotal.tokens += row.tokens_total;
      dailyTotal.cost += row.cost_usd;
      
      const channelName = (row.channel_name || 'Unknown').slice(0, 25).padEnd(25);
      console.log(`   ${channelName} │ ${row.tokens_total.toLocaleString().padStart(10)} │ $${row.cost_usd.toFixed(4).padStart(8)} │ ${row.message_count} msgs`);
    }
    
    if (currentDate) {
      console.log(`   ─────────────────────────────────────`);
      console.log(`   Daily Total: ${dailyTotal.tokens.toLocaleString()} tokens ($${dailyTotal.cost.toFixed(4)})\n`);
    }
  }
}

main().catch(console.error);
