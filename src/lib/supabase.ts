import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54321';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH';

export const supabase = createClient(supabaseUrl, supabaseKey);

// Types
export interface Metric {
  id: number;
  ts: string;
  tokens_input: number;
  tokens_output: number;
  cost_usd: number;
  active_sessions: number;
  memory_files: number;
  skills_count: number;
  projects_count: number;
}

export interface CronRun {
  id: number;
  ts: string;
  job_id: string;
  job_name: string;
  status: 'ok' | 'error';
  duration_ms: number;
  error_message?: string;
}
