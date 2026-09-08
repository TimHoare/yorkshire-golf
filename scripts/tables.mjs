// Shared by backup.mjs and restore.mjs: where the database is and what's in it.
import { readFileSync } from 'node:fs';

const cfg = readFileSync(new URL('../src/config.ts', import.meta.url), 'utf8');
export const url = process.env.SUPABASE_URL || /supabaseUrl:\s*'([^']*)'/.exec(cfg)[1];
export const key = process.env.SUPABASE_KEY || /supabaseAnonKey:\s*'([^']*)'/.exec(cfg)[1];
export const headers = { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' };

// key = primary key columns (rows are ordered by them so diffs stay stable, and
// restore upserts on them). history is read-only: backed up, never restored.
export const TABLES = [
  { name: 'hole_scores', key: ['round_id', 'player_id', 'hole'] },
  { name: 'team_scores', key: ['round_id', 'team', 'hole'] },
  { name: 'team_drives', key: ['round_id', 'team', 'hole'] },
  { name: 'pair_draws',  key: ['round_id'] },
  { name: 'group_draws', key: ['round_id'] },
  { name: 'bit_events',  key: ['round_id', 'grp', 'kind', 'hole'] },
  { name: 'stakes',      key: ['id'] },
  { name: 'bonus_balls', key: ['player_id'] },
  { name: 'tee_choices', key: ['round_id'] },
  { name: 'history',     key: ['id'], restore: false },
];
