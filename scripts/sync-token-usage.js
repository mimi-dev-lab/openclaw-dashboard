#!/usr/bin/env node
/**
 * Sync token usage data to Supabase
 * Tracks: agent, channel, date, tokens, cache, cost
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const AGENTS_BASE = process.env.AGENTS_BASE || '/Users/lifan/.openclaw/agents';
const AGENT_DIRS = ['main', 'claude-main', 'claude-haiku', 'claude-sonnet', 'gemini-pro', 'gemini-flash', 'gemini-image'];
const SUPABASE_URL = process.env.SUPABASE_URL || 'http://127.0.0.1:54321';
const SUPABASE_KEY = process.env.SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';

// Load channel labels
const CHANNEL_LABELS_PATH = path.join(__dirname, '..', 'channel-labels.json');
let CHANNEL_LABELS = {};
try {
  CHANNEL_LABELS = JSON.parse(fs.readFileSync(CHANNEL_LABELS_PATH, 'utf-8'));
} catch (e) {}

function extractChannelId(sessionKey) {
  if (!sessionKey) return null;
  const match = sessionKey.match(/channel:(\d+)/);
  return match ? match[1] : null;
}

async function parseSessionFile(filePath, sessionKey, agent) {
  const results = [];
  const fileStream = fs.createReadStream(filePath);
  const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

  for await (const line of rl) {
    try {
      const entry = JSON.parse(line);
      if (entry.type === 'message' && entry.message?.role === 'assistant' && entry.message?.usage) {
        const usage = entry.message.usage;
        const timestamp = entry.timestamp || entry.message?.timestamp;
        const date = timestamp ? new Date(timestamp).toISOString().split('T')[0] : null;
        
        // Extract model/provider info
        const provider = entry.message.provider || 'unknown';
        const model = entry.message.model || 'unknown';
        
        if (date) {
          results.push({
            date,
            channelId: extractChannelId(sessionKey),
            agent: agent,  // Track which agent directory
            provider,
            model,
            input: usage.input || 0,
            output: usage.output || 0,
            cacheRead: usage.cacheRead || 0,
            cacheWrite: usage.cacheWrite || 0,
            totalTokens: usage.totalTokens || 0,
            cost: usage.cost?.total || 0,
          });
        }
      }
    } catch (e) {}
  }
  return results;
}

// Load sessions.json from all agent directories
function loadSessionsMap() {
  const map = {};
  for (const agentDir of AGENT_DIRS) {
    const sessionsPath = path.join(AGENTS_BASE, agentDir, 'sessions', 'sessions.json');
    try {
      const data = JSON.parse(fs.readFileSync(sessionsPath, 'utf-8'));
      for (const [key, session] of Object.entries(data)) {
        if (session.sessionFile) {
          const filename = path.basename(session.sessionFile);
          map[filename] = { key, agent: agentDir };
        }
      }
    } catch (e) {}
  }
  return map;
}

function aggregateUsage(allUsage) {
  const aggregated = {};
  
  for (const usage of allUsage) {
    // Key by date + channel + agent for granular tracking
    const key = `${usage.date}:${usage.channelId || 'unknown'}:${usage.agent || 'unknown'}`;
    
    if (!aggregated[key]) {
      aggregated[key] = {
        date: usage.date,
        channel_id: usage.channelId || 'unknown',
        channel_name: CHANNEL_LABELS[usage.channelId] || usage.channelId || 'Unknown',
        agent: usage.agent || 'unknown',
        tokens_input: 0,
        tokens_output: 0,
        tokens_cache: 0,
        tokens_cache_read: 0,
        tokens_cache_write: 0,
        tokens_total: 0,
        cost_usd: 0,
        message_count: 0,
      };
    }
    
    aggregated[key].tokens_input += usage.input;
    aggregated[key].tokens_output += usage.output;
    aggregated[key].tokens_cache += usage.cacheRead + usage.cacheWrite;
    aggregated[key].tokens_cache_read += usage.cacheRead;
    aggregated[key].tokens_cache_write += usage.cacheWrite;
    aggregated[key].tokens_total += usage.totalTokens;
    aggregated[key].cost_usd += usage.cost;
    aggregated[key].message_count += 1;
  }
  
  return Object.values(aggregated);
}

async function upsertToSupabase(rows) {
  let success = 0;
  let failed = 0;
  
  for (const row of rows) {
    try {
      const response = await fetch(`${SUPABASE_URL}/rest/v1/token_usage`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`,
          'Prefer': 'resolution=merge-duplicates',
        },
        body: JSON.stringify(row)
      });
      
      if (response.ok || response.status === 201) {
        success++;
      } else {
        failed++;
        const err = await response.text();
        if (!err.includes('duplicate')) {
          console.error(`Failed: ${row.date} ${row.channel_id} ${row.agent}:`, err);
        }
      }
    } catch (err) {
      failed++;
    }
  }
  
  return { success, failed };
}

async function main() {
  console.log('🔄 Syncing token usage to Supabase...\n');
  
  const sessionsMap = loadSessionsMap();
  
  // Find all JSONL files
  const files = [];
  for (const agentDir of AGENT_DIRS) {
    const sessionsDir = path.join(AGENTS_BASE, agentDir, 'sessions');
    try {
      const dirFiles = fs.readdirSync(sessionsDir)
        .filter(f => f.endsWith('.jsonl') && !f.includes('.deleted'))
        .map(f => {
          const sessionInfo = sessionsMap[f] || { key: null, agent: agentDir };
          return {
            path: path.join(sessionsDir, f),
            sessionKey: sessionInfo.key,
            agent: agentDir,  // Always use directory name as agent
          };
        });
      files.push(...dirFiles);
    } catch (e) {}
  }
  
  console.log(`📂 Found ${files.length} session files`);
  
  // Parse all files
  const allUsage = [];
  let processed = 0;
  for (const file of files) {
    const usage = await parseSessionFile(file.path, file.sessionKey, file.agent);
    allUsage.push(...usage);
    processed++;
    if (processed % 20 === 0) process.stdout.write('.');
  }
  console.log(`\n📊 Parsed ${allUsage.length} messages`);
  
  // Aggregate
  const aggregated = aggregateUsage(allUsage);
  console.log(`📈 Aggregated into ${aggregated.length} rows`);
  
  // Upsert to Supabase
  const { success, failed } = await upsertToSupabase(aggregated);
  console.log(`\n✅ Synced: ${success} rows`);
  if (failed > 0) console.log(`⚠️ Skipped: ${failed} rows (duplicates or errors)`);
  
  // Summary by agent
  const agentSummary = {};
  for (const row of aggregated) {
    if (!agentSummary[row.agent]) {
      agentSummary[row.agent] = { tokens: 0, cost: 0, cacheRead: 0 };
    }
    agentSummary[row.agent].tokens += row.tokens_total;
    agentSummary[row.agent].cost += row.cost_usd;
    agentSummary[row.agent].cacheRead += row.tokens_cache_read;
  }
  
  console.log('\n📊 By Agent:');
  for (const [agent, data] of Object.entries(agentSummary).sort((a, b) => b[1].cost - a[1].cost)) {
    const cacheRate = data.tokens > 0 ? ((data.cacheRead / data.tokens) * 100).toFixed(1) : '0';
    console.log(`   ${agent.padEnd(15)} | ${(data.tokens / 1e6).toFixed(2)}M tokens | $${data.cost.toFixed(2)} | Cache: ${cacheRate}%`);
  }
  
  const totalTokens = aggregated.reduce((sum, r) => sum + r.tokens_total, 0);
  const totalCost = aggregated.reduce((sum, r) => sum + r.cost_usd, 0);
  const totalCacheRead = aggregated.reduce((sum, r) => sum + r.tokens_cache_read, 0);
  const cacheRate = totalTokens > 0 ? ((totalCacheRead / totalTokens) * 100).toFixed(1) : '0';
  
  console.log(`\n💰 Total: ${(totalTokens / 1e6).toFixed(2)}M tokens ($${totalCost.toFixed(2)}) | Cache Hit: ${cacheRate}%`);
}

main().catch(console.error);
