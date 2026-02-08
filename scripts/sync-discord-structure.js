#!/usr/bin/env node
/**
 * Sync Discord Forum/Thread structure to channel-labels.json
 * 
 * This script fetches the current Discord server structure and updates
 * channel-labels.json with the latest Forum and Thread names.
 * 
 * Usage: node sync-discord-structure.js
 */

const fs = require('fs');
const path = require('path');

const GUILD_ID = '1465695321425182837';
const LABELS_PATH = path.join(__dirname, '..', 'channel-labels.json');

// Discord Bot Token from OpenClaw config
function getDiscordToken() {
  try {
    const configPath = path.join(process.env.HOME || '', '.openclaw/openclaw.json');
    const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    return config.channels?.discord?.token;
  } catch (e) {
    console.error('Failed to read Discord token from OpenClaw config');
    return null;
  }
}

async function fetchChannels(token) {
  const response = await fetch(`https://discord.com/api/v10/guilds/${GUILD_ID}/channels`, {
    headers: { 'Authorization': `Bot ${token}` }
  });
  if (!response.ok) throw new Error(`Failed to fetch channels: ${response.status}`);
  return response.json();
}

async function fetchThreads(token) {
  const response = await fetch(`https://discord.com/api/v10/guilds/${GUILD_ID}/threads/active`, {
    headers: { 'Authorization': `Bot ${token}` }
  });
  if (!response.ok) throw new Error(`Failed to fetch threads: ${response.status}`);
  return response.json();
}

async function main() {
  const token = getDiscordToken();
  if (!token) {
    console.error('❌ No Discord token found');
    process.exit(1);
  }

  console.log('🔄 Fetching Discord structure...');
  
  const [channels, threadsData] = await Promise.all([
    fetchChannels(token),
    fetchThreads(token),
  ]);
  
  const threads = threadsData.threads || [];
  
  // Build structure
  const categories = {};
  const forums = {};
  const threadMap = {};
  const regularChannels = {};
  
  // Categories (type 4)
  const categoryChannels = channels.filter(c => c.type === 4);
  for (const cat of categoryChannels) {
    categories[cat.id] = { 
      name: cat.name,
      order: cat.position 
    };
  }
  
  // Forums (type 15)
  const forumChannels = channels.filter(c => c.type === 15);
  for (const forum of forumChannels) {
    const categoryId = forum.parent_id;
    const categoryName = categories[categoryId]?.name || 'Other';
    
    // Extract emoji from forum name or use default
    let icon = '📁';
    if (categoryName.includes('WEALTH')) icon = '💰';
    else if (categoryName.includes('BUILD')) icon = '🔨';
    else if (categoryName.includes('LIFE')) icon = '🌏';
    else if (categoryName.includes('GROWTH')) icon = '🧠';
    else if (categoryName.includes('HOME')) icon = '🏠';
    
    forums[forum.id] = {
      name: forum.name,
      category: categoryId,
      icon
    };
  }
  
  // Threads (type 11 = public, type 12 = private)
  for (const thread of threads) {
    const forumId = thread.parent_id;
    if (forums[forumId]) {
      threadMap[thread.id] = {
        name: thread.name,
        forum: forumId
      };
    }
  }
  
  // Regular channels (type 0)
  const textChannels = channels.filter(c => c.type === 0);
  for (const ch of textChannels) {
    regularChannels[ch.id] = {
      name: ch.name,
      category: ch.parent_id,
      icon: '#'
    };
  }
  
  // Build final structure
  const labels = {
    categories,
    forums,
    threads: threadMap,
    channels: regularChannels,
    lastUpdated: new Date().toISOString()
  };
  
  // Write to file
  fs.writeFileSync(LABELS_PATH, JSON.stringify(labels, null, 2));
  
  console.log('✅ Discord structure synced!');
  console.log(`   📁 ${Object.keys(categories).length} categories`);
  console.log(`   📋 ${Object.keys(forums).length} forums`);
  console.log(`   💬 ${Object.keys(threadMap).length} threads`);
  console.log(`   # ${Object.keys(regularChannels).length} channels`);
  console.log(`   📄 Saved to ${LABELS_PATH}`);
  
  return labels;
}

// Export for use as module
module.exports = { main, getDiscordToken, fetchChannels, fetchThreads };

// Run if called directly
if (require.main === module) {
  main().catch(err => {
    console.error('❌ Error:', err.message);
    process.exit(1);
  });
}
