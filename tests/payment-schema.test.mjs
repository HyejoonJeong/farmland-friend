import {test}from'node:test';import assert from'node:assert/strict';import{readFile}from'node:fs/promises';import{PGlite}from'@electric-sql/pglite';
test('new payment intent is admitted while wrong category, unknown intents and public access remain blocked',async()=>{
 const db=new PGlite();try{
 await db.exec('CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE service_role BYPASSRLS;');
 await db.exec(await readFile(new URL('../supabase/migrations/20261117040000_consultation_answer_reviews.sql',import.meta.url),'utf8'));
 const insert=(intent,category)=>db.query("INSERT INTO consultation_answers(domain,intent,category,original_question,original_answer,question,answer,knowledge_version) VALUES('farmland',$1,$2,'질문','답변','질문','답변','v1') RETURNING id",[intent,category]);
 await assert.rejects(insert('direct_payment_application','농업경영체·직불제·인증'),/check constraint/);
 await insert('farmland_pension','농지연금');
 await db.exec(await readFile(new URL('../supabase/migrations/20261117090000_add_payment_application_intent.sql',import.meta.url),'utf8'));
 await insert('direct_payment_application','농업경영체·직불제·인증');
 await assert.rejects(insert('direct_payment_application','농지연금'),/check constraint/);
 await assert.rejects(insert('invented','농지연금'),/check constraint/);
 assert.equal((await db.query('SELECT count(*)::int AS n FROM consultation_answers')).rows[0].n,2);
 await db.exec('SET ROLE anon');await assert.rejects(db.query('SELECT * FROM consultation_answers'),/permission denied/);
 }finally{await db.close();}
});
