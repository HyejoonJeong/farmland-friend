import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { parseCsv } from '../scripts/csv.mjs';

test('schema migrations enforce insert-only public access and server-only atomic request limits', async () => {
  const db = new PGlite();
  try {
    await db.exec('CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;');
    for (const name of [
      '20260906054058_38163cef-76f9-40e9-8fea-f0424afb7ac0.sql',
      '20260906055632_346cb94d-8e52-490b-ad59-0a340fd9a8e7.sql',
      '20261116060000_complete_app_schema.sql',
    ]) await db.exec(await readFile(new URL('../supabase/migrations/' + name, import.meta.url), 'utf8'));
    await db.exec('SET ROLE anon');
    await db.exec("INSERT INTO usage_logs(transcript,category,candidates,clarify_trail) VALUES ('테스트','분류',ARRAY['general_consult'],'[]')");
    await db.exec("INSERT INTO farmer_voices(content) VALUES ('테스트 의견')");
    await assert.rejects(db.query('SELECT * FROM usage_logs'), /permission denied/);
    await assert.rejects(db.query('SELECT * FROM farmer_voices'), /permission denied/);
    await assert.rejects(db.query("SELECT consume_ai_request(repeat('a',64),1,2)"), /permission denied/);
    await db.exec('RESET ROLE; SET ROLE service_role');
    const call = async hash => (await db.query(`SELECT consume_ai_request($1,1,2) AS allowed`, [hash.repeat(64)])).rows[0].allowed;
    assert.equal(await call('a'), true); assert.equal(await call('a'), false);
    assert.equal(await call('b'), true); assert.equal(await call('c'), false);
    const results = await db.query('SELECT count(*)::int AS count FROM usage_logs');
    assert.equal(results.rows[0].count, 1);
  } finally { await db.close(); }
});

test('CSV export preserves Korean text, quoted newlines, escaped quotes and nullable fields', () => {
  const rows = parseCsv('\uFEFFid,content,region\r\n1,"첫 줄\n둘째 줄 ""문의""",전주\r\n2,의견,\r\n');
  assert.deepEqual(rows, [{ id: '1', content: '첫 줄\n둘째 줄 "문의"', region: '전주' }, { id: '2', content: '의견', region: null }]);
  assert.throws(() => parseCsv('id,content\n1,"broken'), /Unterminated/);
  assert.deepEqual(parseCsv('id,content,region\n1,"",\n'), [{ id: '1', content: '', region: null }]);
  assert.deepEqual(parseCsv('id;content;region\n1;"농지, 상담";\n'), [{ id: '1', content: '농지, 상담', region: null }]);
});
