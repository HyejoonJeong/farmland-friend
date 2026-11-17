import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
test('reference import preserves all source rows and allows public read without public writes',async()=>{
 const db=new PGlite();
 try{
  await db.exec('CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;');
  await db.exec(await readFile(new URL('../supabase/migrations/20261117020000_update_contact_reference.sql',import.meta.url),'utf8'));
  await db.exec(await readFile(new URL('../supabase/migrations/20261117023000_normalize_reference_examples.sql',import.meta.url),'utf8'));
  await db.exec('SET ROLE anon');
  assert.equal((await db.query('SELECT count(*)::int AS n FROM service_contact_reference')).rows[0].n,244);
  assert.equal((await db.query('SELECT count(*)::int AS n FROM service_intent_reference')).rows[0].n,20);
  assert.equal((await db.query("SELECT phone FROM service_contact_reference WHERE intent_key='farmland_lease_trust_out' AND service_area='임실'")).rows[0].phone,'063-270-0587');
  await assert.rejects(db.exec("DELETE FROM service_contact_reference"),/permission denied/);
  await assert.rejects(db.exec("UPDATE service_contact_reference SET phone='000'"),/permission denied/);
  const n=(await db.query("SELECT count(*)::int AS n FROM service_contact_reference WHERE source_sha256 !~ '^[a-f0-9]{64}$' OR array_length(keywords,1)=0 AND organization_type IN ('extension','naqs')")).rows[0].n;
  assert.equal(n,0);
  const examples=(await db.query("SELECT examples FROM service_intent_reference WHERE intent_key='damaged_farmland'")).rows[0].examples;
  assert.deepEqual(examples,[]);
 }finally{await db.close();}
});
