import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
test('only current approved answers are searchable; private tables, audit and revision protect review workflow',async()=>{
 const db=new PGlite();
 try{
  await db.exec('CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;');
  await db.exec(await readFile(new URL('../supabase/migrations/20261117040000_consultation_answer_reviews.sql',import.meta.url),'utf8'));
  await db.exec('SET ROLE anon');
  await assert.rejects(db.query('SELECT * FROM consultation_answers'),/permission denied/);
  await assert.rejects(db.query('SELECT * FROM consultation_answer_audit'),/permission denied/);
  await assert.rejects(db.query("SELECT * FROM search_approved_answers('농지연금 서류','farmland','v1')"),/permission denied/);
  await assert.rejects(db.query("INSERT INTO consultation_answers DEFAULT VALUES"),/permission denied/);
  await db.exec('RESET ROLE; SET ROLE service_role');
  const {rows:[row]}=await db.query(`INSERT INTO consultation_answers(domain,category,intent,original_question,original_answer,question,answer,knowledge_version)
    VALUES('farmland','농지연금','farmland_pension','농지연금 신청 서류 문의','원본 답변','농지연금 신청 서류','검토 답변','v1') RETURNING id,revision`);
  const search=async(domain='farmland',version='v1')=>(await db.query("SELECT * FROM search_approved_answers('농지연금 서류는 무엇인가요',$1,$2)",[domain,version])).rows;
  assert.equal((await search()).length,0);
  await assert.rejects(db.query("UPDATE consultation_answers SET status='approved' WHERE id=$1",[row.id]),/check constraint/);
  await db.query("UPDATE consultation_answers SET status='approved',source_reference='현행 문서',reviewer='검토 담당',reviewed_at=now(),valid_until=now()+interval '1 day' WHERE id=$1 AND revision=1",[row.id]);
  assert.equal((await search()).length,1);assert.equal((await search('survey')).length,0);assert.equal((await search('farmland','v2')).length,0);
  assert.equal((await db.query("UPDATE consultation_answers SET answer='stale' WHERE id=$1 AND revision=1 RETURNING id",[row.id])).rows.length,0);
  await assert.rejects(db.query("UPDATE consultation_answers SET original_answer='changed' WHERE id=$1",[row.id]),/immutable/);
  assert.equal((await db.query('SELECT count(*)::int AS n FROM consultation_answer_audit')).rows[0].n,2);
  await db.query("UPDATE consultation_answers SET status='retired' WHERE id=$1",[row.id]);assert.equal((await search()).length,0);
  await db.query("UPDATE consultation_answers SET status='approved',reviewed_at=now()-interval '2 days',valid_until=now()-interval '1 day' WHERE id=$1",[row.id]);assert.equal((await search()).length,0);
 }finally{await db.close();}
});
