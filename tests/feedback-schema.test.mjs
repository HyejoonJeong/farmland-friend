import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
const migration=await readFile(new URL('../supabase/migrations/20261117060000_consultation_satisfaction.sql',import.meta.url),'utf8');
async function setup(){
 const db=new PGlite();
 await db.exec('CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;');
 await db.exec(await readFile(new URL('../supabase/migrations/20261117040000_consultation_answer_reviews.sql',import.meta.url),'utf8'));
 await db.exec(migration);return db;
}
async function insert(db,extra={}){
 const {rows:[row]}=await db.query(`INSERT INTO consultation_answers(domain,category,intent,original_question,original_answer,question,answer,knowledge_version,reuse_question,reuse_answer,reuse_valid_until)
 VALUES('farmland','농지연금','farmland_pension','개인 이름과 주소를 포함한 원 질문','개인 상황 원 답변','원 질문','원 답변','v1','농지연금 신청 서류','농지연금 신청 서류의 일반 안내',now()+interval '90 days') RETURNING *`);
 for(const [name,value] of Object.entries(extra)){
  assert.match(name,/^[a-z_]+$/);await db.query(`UPDATE consultation_answers SET ${name}=$1 WHERE id=$2`,[value,row.id]);
 }
 return row.id;
}
const feedback=async(db,id,score=4,accuracy='accurate',consent=true)=>(await db.query('SELECT submit_answer_feedback($1,$2,$3,$4) AS result',[id,score,accuracy,consent])).rows[0].result;
const search=async(db,domain='farmland',version='v1',fn='search_satisfied_answers')=>(await db.query(`SELECT * FROM ${fn}('농지연금 신청 서류', $1,$2)`,[domain,version])).rows;

test('feedback RPC is server-only; first feedback is atomic, duplicate-safe and audited',async()=>{
 const db=await setup();try{
  for(const role of ['anon','authenticated']){
   await db.exec('SET ROLE '+role);
   await assert.rejects(db.query('SELECT * FROM consultation_answers'),/permission denied/);
   await assert.rejects(db.query('SELECT * FROM consultation_answer_audit'),/permission denied/);
   await assert.rejects(feedback(db,'11111111-1111-1111-1111-111111111111'),/permission denied/);
   await assert.rejects(search(db),/permission denied/);
   await assert.rejects(search(db,'farmland','v1','search_approved_answers'),/permission denied/);
   await db.exec('RESET ROLE');
  }
  await db.exec('SET ROLE service_role');
  const id=await insert(db);
  const results=await Promise.all([feedback(db,id,5),feedback(db,id,5),feedback(db,id,1)]);
  assert.equal(results[0].feedback_satisfaction,5);assert.equal(results[1].feedback_satisfaction,5);assert.equal(results[2].error,'conflict');
  assert.equal(results[0].revision,2);assert.equal(results[1].revision,2);
  const audit=(await db.query('SELECT snapshot FROM consultation_answer_audit WHERE answer_id=$1 ORDER BY id',[id])).rows;
  assert.equal(audit.length,2);assert.equal(audit[0].snapshot.feedback_submitted_at,null);assert.equal(audit[1].snapshot.feedback_satisfaction,5);
  assert.equal((await feedback(db,'11111111-1111-1111-1111-111111111111')).error,'missing');
  for(const args of [[0,'accurate',true],[6,'accurate',true],[4,'false',true],[4,'accurate',null]])await assert.rejects(feedback(db,id,...args),/Invalid feedback/);
  await assert.rejects(db.query("UPDATE consultation_answers SET original_answer='changed' WHERE id=$1",[id]),/immutable/);
 }finally{await db.close();}
});

test('only consented accurate high scores with current unexpired source excerpts can be reused',async()=>{
 const db=await setup();try{
  await db.exec('SET ROLE service_role');
  const originalApproved=await insert(db);
  await db.query("UPDATE consultation_answers SET status='approved',source_reference='legacy source',reviewer='legacy reviewer',reviewed_at=now(),valid_until=now()+interval '90 days' WHERE id=$1",[originalApproved]);
  assert.equal((await search(db)).length,0);assert.equal((await search(db,'farmland','v1','search_approved_answers')).length,0);
  const good=await insert(db);await feedback(db,good);
  const rows=await search(db);assert.equal(rows.length,1);assert.equal(rows[0].id,good);
  assert.equal(rows[0].question,'농지연금 신청 서류');assert.equal(rows[0].answer,'농지연금 신청 서류의 일반 안내');
  assert.doesNotMatch(JSON.stringify(rows),/개인|원 질문|원 답변/);
  assert.deepEqual(await search(db,'farmland','v1','search_approved_answers'),rows);
  assert.equal((await search(db,'survey')).length,0);assert.equal((await search(db,'farmland','v2')).length,0);
  await db.query("UPDATE consultation_answers SET status='retired' WHERE id=$1",[good]);assert.equal((await search(db)).length,0);
  for(const patch of [
   {feedback_satisfaction:3},{feedback_accuracy:'partly'},{feedback_accuracy:'inaccurate'},{feedback_accuracy:'unsure'},
   {feedback_reuse_consent:false},{feedback_contact_completed:false},{status:'rejected'},
   {reuse_valid_until:'2000-01-01T00:00:00Z'},{knowledge_version:'old'},{reuse_answer:''},{reuse_question:''},{feedback_submitted_at:null}
  ]){
   const id=await insert(db);await feedback(db,id);
   for(const [key,value] of Object.entries(patch))await db.query(`UPDATE consultation_answers SET ${key}=$1 WHERE id=$2`,[value,id]);
   assert.equal((await search(db)).length,0,JSON.stringify(patch));
   await db.query("UPDATE consultation_answers SET status='retired' WHERE id=$1",[id]);
  }
 }finally{await db.close();}
});

test('retrieval deduplicates identical excerpts, limits to three and blocks stale admin exclusion',async()=>{
 const db=await setup();try{
  await db.exec('SET ROLE service_role');
  const first=await insert(db);await feedback(db,first,4);
  const duplicate=await insert(db);await feedback(db,duplicate,5);
  let rows=await search(db);assert.equal(rows.length,1);assert.equal(rows[0].id,duplicate);
  for(let i=0;i<5;i++){const id=await insert(db,{reuse_answer:'농지연금 신청 서류의 서로 다른 일반 안내 '+i});await feedback(db,id,4);}
  rows=await search(db);assert.equal(rows.length,3);assert.equal(new Set(rows.map(r=>r.answer)).size,3);
  const stale=await db.query("UPDATE consultation_answers SET status='retired' WHERE id=$1 AND revision=1 RETURNING id",[duplicate]);assert.equal(stale.rows.length,0);
  const current=await db.query("UPDATE consultation_answers SET status='retired' WHERE id=$1 AND revision=2 RETURNING id",[duplicate]);assert.equal(current.rows.length,1);
 }finally{await db.close();}
});
