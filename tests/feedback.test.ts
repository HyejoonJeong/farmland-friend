import assert from 'node:assert/strict';
import { groundedExcerpt, consultationSchema } from '../supabase/functions/_shared/text.ts';
import { makeHandler } from '../supabase/functions/_shared/router.ts';
import { feedbackReceipt, verifyFeedbackReceipt, reusableEligible } from '../supabase/functions/_shared/feedback.ts';
import { KNOWLEDGE_VERSION } from '../supabase/functions/_shared/knowledge/version.ts';
import { buildSourceCatalogue, knowledgeSources, selectedSource } from '../supabase/functions/_shared/knowledge-sources.ts';
import { FBO_KNOWLEDGE } from '../supabase/functions/_shared/knowledge/fbo-knowledge.ts';
import SURVEY_MANUAL from '../supabase/functions/_shared/knowledge/survey-manual.ts';
const settings: Record<string,string>={SUPABASE_URL:'https://example.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'service-secret',SUPABASE_ANON_KEY:'public',ADMIN_ACCESS_KEY:'admin-secret',OPENAI_API_KEY:'provider-secret'};
const env=(name:string)=>settings[name];
const handler=makeHandler(env,()=>{throw new Error('Unexpected audio');},async()=>true);
const id='11111111-1111-4111-8111-111111111111';
const otherId='22222222-2222-4222-8222-222222222222';
const request=(action:string,body:object)=>new Request('https://example.supabase.co/functions/v1/malhaenong-api/'+action,{method:'POST',headers:{apikey:'public','Content-Type':'application/json'},body:JSON.stringify(body)});
const qualified=(overrides:Record<string,unknown>={})=>({id,status:'pending',feedback_contact_completed:true,feedback_satisfaction:4,feedback_accuracy:'accurate',feedback_reuse_consent:true,feedback_submitted_at:new Date().toISOString(),reuse_question:'농지연금 안내',reuse_answer:'현행 자료의 안내',knowledge_version:KNOWLEDGE_VERSION,reuse_valid_until:new Date(Date.now()+86400000).toISOString(),...overrides});
async function mockFetch(mock:typeof fetch,run:()=>Promise<void>){const previous=globalThis.fetch;globalThis.fetch=mock;try{await run();}finally{globalThis.fetch=previous;}}
Deno.test('feedback receipt is bound to one answer, expiry and server secret',async()=>{
 const now=1800000000000;
 const receipt=await feedbackReceipt(env,id,now);
 assert.equal(await verifyFeedbackReceipt(env,id,receipt.token,now),true);
 assert.equal(await verifyFeedbackReceipt(env,otherId,receipt.token,now),false);
 assert.equal(await verifyFeedbackReceipt(env,id,receipt.token.slice(0,-1)+(receipt.token.endsWith('0')?'1':'0'),now),false);
 assert.equal(await verifyFeedbackReceipt(env,id,receipt.token,now+7*86400000),false);
 assert.equal(await verifyFeedbackReceipt(env,id,receipt.token,now-86400000),false);
 assert.equal(await verifyFeedbackReceipt(name=>name==='SUPABASE_SERVICE_ROLE_KEY'?'rotated':settings[name],id,receipt.token,now),false);
});
Deno.test('feedback rejects uncompleted contact and invalid ratings without database access',async()=>{
 const receipt=await feedbackReceipt(env,id);
 const base={...receipt,contactCompleted:true,satisfaction:5,accuracy:'accurate',reuseConsent:true};
 await mockFetch(()=>{throw new Error('Must not touch DB');},async()=>{
  for(const patch of [{contactCompleted:false},{contactCompleted:'true'},{satisfaction:0},{satisfaction:6},{satisfaction:4.5},{satisfaction:'5'},{accuracy:'verified'},{reuseConsent:'true'},{reuseConsent:null}]){
   assert.equal((await handler(request('answer-feedback',{...base,...patch}))).status,400);
  }
  assert.equal((await handler(request('answer-feedback',{...base,answerId:otherId}))).status,401);
 });
});
Deno.test('feedback returns minimal eligibility, handles retries/conflicts and does not expose consultation data',async()=>{
 const receipt=await feedbackReceipt(env,id);
 const body={...receipt,contactCompleted:true,satisfaction:4,accuracy:'accurate',reuseConsent:true};
 await mockFetch(async(url,init)=>{
  assert.match(String(url),/rpc\/submit_answer_feedback$/);
  assert.deepEqual(JSON.parse(String(init?.body)),{answer_id:id,satisfaction:4,accuracy:'accurate',reuse_consent:true});
  assert.equal(new Headers(init?.headers).get('apikey'),'service-secret');
  return Response.json(qualified({original_question:'private name',original_answer:'private address'}));
 },async()=>{for(let n=0;n<2;n++)assert.deepEqual(await (await handler(request('answer-feedback',body))).json(),{ok:true,eligible:true});});
 for(const [error,status] of [['conflict',409],['missing',404]] as const){
  await mockFetch(async()=>Response.json({error}),async()=>assert.equal((await handler(request('answer-feedback',body))).status,status));
 }
});
Deno.test('every eligibility condition fails closed despite a high satisfaction score',()=>{
 assert.equal(reusableEligible(qualified()),true);
 for(const override of [{status:'retired'},{status:'rejected'},{feedback_contact_completed:false},{feedback_satisfaction:3},{feedback_accuracy:'partly'},{feedback_accuracy:'inaccurate'},{feedback_accuracy:'unsure'},{feedback_reuse_consent:false},{feedback_submitted_at:null},{reuse_answer:''},{reuse_question:''},{knowledge_version:'old'},{reuse_valid_until:new Date(Date.now()-1).toISOString()},{reuse_valid_until:null}])assert.equal(reusableEligible(qualified(override)),false,JSON.stringify(override));
 assert.equal(reusableEligible(qualified({status:'approved',feedback_submitted_at:null})),false);
});
Deno.test('admin satisfaction list is authenticated and exclusion uses optimistic revision',async()=>{
 await mockFetch(()=>{throw new Error('Unauthorized read');},async()=>assert.equal((await handler(request('admin-feedback',{key:'wrong',action:'list'}))).status,401));
 await mockFetch(async(url)=>{
  const u=new URL(String(url));assert.equal(u.searchParams.get('feedback_submitted_at'),'not.is.null');assert.equal(u.searchParams.get('limit'),'21');return Response.json([qualified()]);
 },async()=>{
  const res=await handler(request('admin-feedback',{key:'admin-secret',action:'list'}));assert.equal(res.status,200);const body=await res.json();assert.equal(body.rows[0].reusable_eligible,true);assert.equal(body.hasMore,false);
 });
 await mockFetch(async(url,init)=>{
  assert.match(String(url),/revision=eq.3/);assert.deepEqual(JSON.parse(String(init?.body)),{status:'retired'});return Response.json([]);
 },async()=>assert.equal((await handler(request('admin-feedback',{key:'admin-secret',action:'exclude',id,revision:3}))).status,409));
});
Deno.test('reuse resolves selected current source IDs to complete public knowledge without user text',async()=>{
 const source=knowledgeSources('farmland').sources.find(item=>item.text.includes('농지연금'))!;
 assert.ok(source.text.length>=20);
 for(const reuse_source_id of [source.id,'홍길동 고객님의 주소는 전주시 개인 주소입니다.',knowledgeSources('survey').sources[0].id,'',42]){
  let saved:any;
  await mockFetch(async(url,init)=>{
   const target=String(url);
   if(target.endsWith('rpc/search_satisfied_answers'))return Response.json([]);
   if(target.includes('api.openai.com')){
    const body=JSON.parse(String(init?.body));assert.match(body.input[0].content,/만족도는 정확성/);assert.equal(body.text.format.schema.properties.reuse_source_id.type,'string');assert.ok(body.text.format.schema.properties.reuse_source_id.enum.includes(source.id));assert.match(body.input[0].content,new RegExp(source.id));
    return Response.json({status:'completed',output:[{content:[{type:'output_text',text:JSON.stringify({intent:'farmland_pension',answer:'농지연금 일반 안내입니다.',reference_ids:[],reuse_source_id})}]}]});
   }
   saved=JSON.parse(String(init?.body));return new Response(null,{status:201});
  },async()=>{
   const res=await handler(request('consult',{domain:'farmland',question:'홍길동 010-1234-5678 농지연금 문의'}));assert.equal(res.status,200);
   const body=await res.json();assert.equal(await verifyFeedbackReceipt(env,saved.id,body.feedback.token),true);
   assert.equal(saved.reuse_answer,reuse_source_id===source.id?source.text:'');
   assert.doesNotMatch(saved.reuse_question,/홍길동|010/);assert.doesNotMatch(saved.reuse_answer,/홍길동|010/);
   assert.match(saved.original_question,/휴대전화 삭제/);
  });
 }
});

Deno.test('partial source quotations restore the complete line and retain exceptions or negation',()=>{
 const line='- 임대 조건을 충족한 경우에만 청년 농업인에게 지원할 수 있으며, 개별 자격 심사 전에는 지원을 확정하지 않습니다.';
 const source='[사업 안내]\n'+line+'\n다음 업무 자료';
 assert.equal(groundedExcerpt(source,'청년 농업인에게 지원할 수 있으며, 개별 자격 심사'),line);
 assert.equal(groundedExcerpt(source,line),line);
 assert.equal(groundedExcerpt(source,line+'라는 새 문장'), '');
 assert.equal(groundedExcerpt(source,'짧음'),'');
 assert.equal(groundedExcerpt(source,null),'');
 const longLine='- '+ '조건을 확인해 주세요. '.repeat(100);
 assert.equal(groundedExcerpt(longLine,longLine.slice(2,50)), '');
});

Deno.test('source catalogues preserve all knowledge and select complete question sections',()=>{
 for(const [domain,source] of [['farmland',FBO_KNOWLEDGE],['survey',SURVEY_MANUAL]] as const){
  const catalogue=knowledgeSources(domain);
  assert.equal(catalogue.annotated.replace(/\[자료 ID: [^\]\n]+\]\n/g,''),source);
  assert.ok(catalogue.sources.length>5);
  assert.equal(new Set(catalogue.sources.map(s=>s.id)).size,catalogue.sources.length);
  for(const item of catalogue.sources){
   assert.ok(source.includes(item.text));assert.ok(item.text.length>=20 && item.text.length<=1200);
   assert.equal(selectedSource(domain,item.id,item.allowedIntents[0]),item.text);
  }
  const ids=consultationSchema(domain).properties.reuse_source_id.enum;
  assert.deepEqual(ids,['',...catalogue.sources.map(s=>s.id)]);
 }
 const survey=knowledgeSources('survey').sources.find(s=>s.text.includes('**25. 농지 전수조사로'))!;
 assert.match(survey.text,/객관적 증빙/);assert.match(survey.text,/한시적으로 적용/);
 assert.equal(selectedSource('farmland',survey.id,'farmland_survey'),'');
 assert.equal(selectedSource('survey','invented-source-id','farmland_survey'),'');
});
Deno.test('source IDs stay stable after unrelated additions, while overlong sections stay visible but unselectable',()=>{
 const paragraph='[농지연금]\n- 농지를 담보로 노후 생활을 지원하나 개별 자격은 담당자의 확인이 필요합니다.\n';
 const first=buildSourceCatalogue(paragraph,'farmland');
 const second=buildSourceCatalogue('[다른 사업]\n- 다른 농업 지원 사업의 담당자를 찾아 안내합니다.\n\n'+paragraph,'farmland');
 assert.equal(first.sources[0].id,second.sources.find(s=>s.text===first.sources[0].text)?.id);
 const long='[긴 안내]\n'+ '예외 조건까지 모두 확인해야 하며 판단을 단정하지 않습니다. '.repeat(60)+'\n';
 const longCatalogue=buildSourceCatalogue(long,'survey');
 assert.equal(longCatalogue.sources.length,0);assert.equal(longCatalogue.annotated,long);
});

Deno.test('source selection rejects valid source IDs belonging to a different business',()=>{
 const pension=knowledgeSources('farmland').sources.find(s=>s.text.startsWith('[6. 농지연금]'))!;
 assert.equal(selectedSource('farmland',pension.id,'farmland_pension'),pension.text);
 assert.equal(selectedSource('farmland',pension.id,'farmland_trade_buy'),'');
 assert.equal(selectedSource('farmland',pension.id,'farming_tech'),'');
 const lease=knowledgeSources('farmland').sources.find(s=>s.text.startsWith('[2.'))!;
 assert.equal(selectedSource('farmland',lease.id,'farmland_lease_trust_out'),lease.text);
 assert.equal(selectedSource('farmland',lease.id,'long_term_lease_out'),'');
 const survey=knowledgeSources('survey').sources.find(s=>s.text.includes('농지연금'))!;
 assert.equal(selectedSource('survey',survey.id,'farmland_survey'),survey.text);
 assert.equal(selectedSource('survey',survey.id,'farmland_pension'),'');
});
