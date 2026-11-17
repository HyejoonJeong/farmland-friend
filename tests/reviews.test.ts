import assert from 'node:assert/strict';
import { makeHandler } from '../supabase/functions/_shared/router.ts';
import { KNOWLEDGE_VERSION } from '../supabase/functions/_shared/knowledge/version.ts';
import { INTENTS } from '../supabase/functions/_shared/knowledge/data.ts';
import { INTENT_META, CATEGORIES } from '../supabase/functions/_shared/knowledge/clarify-flow.ts';
const settings: Record<string,string> = { OPENAI_API_KEY:'test', ADMIN_ACCESS_KEY:'admin', SUPABASE_SERVICE_ROLE_KEY:'service', SUPABASE_URL:'https://example.supabase.co',SUPABASE_ANON_KEY:'public' };
const handler=makeHandler(n=>settings[n],()=>{throw new Error('No audio');},async()=>true);
const req=(route:string,body:object)=>new Request('https://example.supabase.co/functions/v1/malhaenong-api/'+route,{method:'POST',headers:{apikey:'public','Content-Type':'application/json'},body:JSON.stringify(body)});
const example={id:'11111111-1111-1111-1111-111111111111',intent:'farmland_pension',category:'농지연금',question:'농지연금 서류',answer:'담당 지사 확인',source_reference:'검토자료'};
const generation=(ids:string[]=[])=>Response.json({status:'completed',output:[{content:[{type:'output_text',text:JSON.stringify({intent:'farmland_pension',answer:'## 농지연금\n- 담당 지사에 확인해 주세요.',reference_ids:ids})}]}]});
async function mocked(mock:typeof fetch,run:()=>Promise<void>){const previous=globalThis.fetch;globalThis.fetch=mock;try{await run();}finally{globalThis.fetch=previous;}}
Deno.test('all 24 intents have one allowed category, with institutional categories and pension separated',()=>{
 assert.equal(CATEGORIES.length,15); assert.equal(Object.keys(INTENT_META).length,24);
 for(const i of INTENTS)assert.ok(CATEGORIES.includes(INTENT_META[i.key].category));
 assert.notEqual(INTENT_META.farmland_pension.category,INTENT_META.retirement_direct_payment.category);
});
Deno.test('consultation retrieves approved references, preserves history, calls AI once and persists pending draft',async()=>{
 const calls:{url:string;body:any}[]=[];
 await mocked(async(url,init)=>{
  const body=JSON.parse(String(init?.body));calls.push({url:String(url),body});
  if(String(url).endsWith('/rpc/search_approved_answers')) {assert.equal(body.current_version,KNOWLEDGE_VERSION);assert.match(body.search_text,/그럼 서류.*농지연금/);return Response.json([example]);}
  if(String(url).includes('api.openai.com')) {assert.equal(body.store,false);assert.ok(body.text.format.schema);assert.equal(body.input.at(-1).content,'그럼 서류는요?');assert.equal(body.input.at(-2).role,'assistant');return generation([example.id]);}
  assert.equal(body.status,'pending');assert.equal(body.category,'농지연금');assert.deepEqual(body.reference_ids,[example.id]);return new Response(null,{status:201});
 },async()=>{
  const res=await handler(req('consult',{domain:'farmland',question:'그럼 서류는요?',history:[{role:'user',content:'농지연금 문의'},{role:'assistant',content:'앞선 답변'}]}));
  assert.equal(res.status,200);assert.equal((await res.json()).category,'농지연금');assert.equal(calls.length,3);
 });
});
Deno.test('unknown reference ids cannot be accepted or saved',async()=>{
 await mocked(async(url)=>{if(String(url).endsWith('/rpc/search_approved_answers'))return Response.json([]);if(String(url).includes('api.openai.com'))return generation([example.id]);throw new Error('Must not persist invalid citation');},async()=>{assert.equal((await handler(req('consult',{domain:'farmland',question:'연금 문의'}))).status,502);});
});
Deno.test('failed persistence never reports an answered consultation as successful',async()=>{
 await mocked(async(url)=>String(url).endsWith('/rpc/search_approved_answers')?Response.json([]):String(url).includes('api.openai.com')?generation():new Response(null,{status:503}),async()=>{assert.equal((await handler(req('consult',{domain:'farmland',question:'연금 문의'}))).status,503);});
});
Deno.test('review endpoints reject unauthorized access, unreviewed approval and private identifiers',async()=>{
 const base={key:'admin',action:'update',id:example.id,revision:1,status:'approved',intent:'farmland_pension',question:'연금 안내',answer:'안내',source_reference:'현행 자료',reviewer:'검토 담당',valid_until:new Date(Date.now()+86400000).toISOString()};
 await mocked(()=>{throw new Error('No DB access allowed');},async()=>{
  assert.equal((await handler(req('admin-reviews',{key:'wrong',action:'list',status:'pending'}))).status,401);
  assert.equal((await handler(req('admin-reviews',base))).status,400);
  assert.equal((await handler(req('admin-reviews',{...base,privacy_checked:true,answer:'연락처 010-1234-5678'}))).status,400);
  assert.equal((await handler(req('admin-reviews',{...base,privacy_checked:true,valid_until:'invalid'}))).status,400);
 });
});
Deno.test('review updates use optimistic revisions and server-owned approval metadata',async()=>{
 await mocked(async(url,init)=>{
  assert.match(String(url),/revision=eq.3/);const body=JSON.parse(String(init?.body));
  assert.equal(body.category,'농지연금');assert.equal(body.knowledge_version,KNOWLEDGE_VERSION);assert.ok(body.reviewed_at);assert.equal(body.original_answer,undefined);return Response.json([]);
 },async()=>{
  const res=await handler(req('admin-reviews',{key:'admin',action:'update',id:example.id,revision:3,status:'approved',intent:'farmland_pension',category:'잘못된값',question:'연금 안내',answer:'담당자 안내',source_reference:'현행 문서',reviewer:'담당자',privacy_checked:true,valid_until:new Date(Date.now()+86400000).toISOString()}));assert.equal(res.status,409);
 });
});
