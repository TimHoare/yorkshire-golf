// Put a backup back into the database. Rows are upserted on their primary key,
// so anything newer than the backup that's still there is overwritten and
// anything the backup lacks is left alone (the app can't delete scores anyway).
//
//   git fetch origin backups && git worktree add /tmp/yg-backups backups
//   node scripts/restore.mjs /tmp/yg-backups              # every table
//   node scripts/restore.mjs /tmp/yg-backups hole_scores  # just one
//
// For a snapshot from earlier than the latest backup, check out that commit of
// the backups branch first (git log there is one commit per change).
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { TABLES, url, headers } from './tables.mjs';

const [dir, ...only] = process.argv.slice(2);
if (!dir || !existsSync(dir)) {
  console.error('usage: node scripts/restore.mjs <backup-dir> [table ...]');
  process.exit(1);
}
const CHUNK = 500;

for (const t of TABLES) {
  if (t.restore === false || (only.length && !only.includes(t.name))) continue;
  const file = join(dir, `${t.name}.json`);
  if (!existsSync(file)) { console.log(`${t.name}: no file, skipped`); continue; }
  const rows = JSON.parse(readFileSync(file, 'utf8'));
  for (let i = 0; i < rows.length; i += CHUNK) {
    const r = await fetch(`${url}/rest/v1/${t.name}?on_conflict=${t.key.join(',')}`, {
      method: 'POST',
      headers: { ...headers, Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify(rows.slice(i, i + CHUNK)),
    });
    if (!r.ok) throw new Error(`${t.name}: HTTP ${r.status} ${await r.text()}`);
  }
  console.log(`${t.name}: ${rows.length} rows restored`);
}
