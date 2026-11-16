import { readFile } from 'node:fs/promises';
import { parseCsv } from './csv.mjs';

const args = process.argv.slice(2);
const option = flag => args[args.indexOf(flag) + 1];
const table = option('--table');
const file = option('--file');
if (!['usage_logs', 'farmer_voices'].includes(table) || !file) throw new Error('Use --table usage_logs|farmer_voices --file export.csv [--apply]');
const rows = parseCsv(await readFile(file, 'utf8'));
const keys = new Set();
for (const row of rows) {
  if (typeof row.id !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(row.id) || keys.has(row.id)) throw new Error('Missing, invalid, or duplicate exported row id');
  keys.add(row.id);
  for (const field of ['clarify_trail', 'candidates']) if (row[field] != null) {
    // Supabase CSV exports array/json values as JSON or PostgreSQL array literals.
    try { row[field] = JSON.parse(row[field]); }
    catch {
      if (field === 'candidates' && /^\{[a-z_0-9,]*\}$/.test(row[field])) row[field] = row[field].slice(1, -1).split(',').filter(Boolean);
      else throw new Error(`Unsupported export format for ${field}; use a JSON-compatible export`);
    }
  }
  if (row.confidence != null) { row.confidence = Number(row.confidence); if (!Number.isFinite(row.confidence)) throw new Error('Invalid confidence value'); }
}
console.log(`${table}: validated ${rows.length} exported rows`);
if (!args.includes('--apply')) { console.log('Dry run only. Add --apply after verifying the destination.'); process.exit(0); }
const url = process.env.TARGET_SUPABASE_URL;
const secret = process.env.TARGET_SUPABASE_SERVICE_ROLE_KEY;
if (url !== 'https://ertujxbknytbyuqgvcuy.supabase.co' || !secret) throw new Error('Set the authorized TARGET_SUPABASE_URL and TARGET_SUPABASE_SERVICE_ROLE_KEY');
const headers = { apikey: secret, Authorization: `Bearer ${secret}`, 'Content-Type': 'application/json' };
for (let offset = 0; offset < rows.length; offset += 100) {
  const batch = rows.slice(offset, offset + 100);
  const response = await fetch(`${url}/rest/v1/${table}?on_conflict=id`, {
    method: 'POST', headers: { ...headers, Prefer: 'resolution=ignore-duplicates' }, body: JSON.stringify(batch), signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) { await response.body?.cancel(); throw new Error(`Import failed: ${table}, batch ${offset / 100 + 1}, HTTP ${response.status}`); }
  // Confirm every exported ID exists, including rows skipped by deduplication.
  const check = await fetch(`${url}/rest/v1/${table}?select=*&id=in.(${batch.map(row => row.id).join(',')})`, { headers, signal: AbortSignal.timeout(30_000) });
  if (!check.ok) throw new Error(`Import verification failed: batch ${offset / 100 + 1}`);
  const imported = await check.json();
  if (imported.length !== batch.length) throw new Error(`Import verification failed: batch ${offset / 100 + 1}`);
  const byId = new Map(imported.map(row => [row.id, row]));
  for (const source of batch) for (const [field, value] of Object.entries(source)) {
    const actual = byId.get(source.id)[field];
    const equal = field === 'created_at' ? new Date(value).getTime() === new Date(actual).getTime() : JSON.stringify(value) === JSON.stringify(actual);
    if (!equal) throw new Error(`Imported values differ: batch ${offset / 100 + 1}, column ${field}`);
  }
}
console.log(`${table}: verified ${rows.length} rows at the destination; source rows were not modified`);
