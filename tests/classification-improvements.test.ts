import assert from 'node:assert/strict';
import { CLASSIFICATION_PATHS, classificationMetrics, classificationPath } from '../src/lib/classification-metrics.ts';
import { BUSINESS_DISTINCTIONS, CLARIFY_CASES, MAX_CLARIFY_ROUNDS, CATEGORY_DEFAULT_CASE } from '../supabase/functions/_shared/knowledge/clarify-flow.ts';
import { INTENTS, matchContact } from '../src/lib/data.ts';
import { normalizeIntent } from '../supabase/functions/_shared/text.ts';
import { intentPrompt } from '../supabase/functions/_shared/prompts.ts';
import { makeHandler } from '../supabase/functions/_shared/router.ts';

Deno.test('admin separates final routing from initial score without upgrading legacy or clarified records',()=>{
 const rows=[{classification_status:'AI_DIRECT',confidence:.9},{classification_status:'CLARIFIED',confidence:.35},{classification_status:'FALLBACK',confidence:.8},{classification_status:'SUCCESS',confidence:.99},{intent:'general_consult',classification_status:null}];
 assert.deepEqual(classificationMetrics(rows),{AI_DIRECT:1,CLARIFIED:1,GENERAL:2,UNKNOWN:1});
 assert.equal(classificationPath({classification_status:'SUCCESS',confidence:1}),'UNKNOWN');
 assert.equal(rows[1].confidence,.35);assert.equal(Object.keys(CLASSIFICATION_PATHS).length,4);
});
Deno.test('clarification targets and distinction table are valid, with uncertainty exits and two-question cap',()=>{
 assert.equal(MAX_CLARIFY_ROUNDS,2);
 const keys=new Set(INTENTS.map(i=>i.key));
 for(const rule of BUSINESS_DISTINCTIONS){assert.ok(rule.businesses.every(i=>keys.has(i)));assert.ok(CLARIFY_CASES[rule.clarify]);}
 for(const item of Object.values(CLARIFY_CASES))for(const option of item.options){if('intent'in option.target)assert.ok(keys.has(option.target.intent));if('next'in option.target)assert.ok(CLARIFY_CASES[option.target.next]);}
 assert.ok(CLARIFY_CASES.lease_in.options.some(o=>'fallback'in o.target));
 assert.ok(!CLARIFY_CASES.lease_in.options.some(o=>/5年|5년/.test(o.label)));
 assert.equal(CATEGORY_DEFAULT_CASE['농지연금'],'income');
 assert.equal(CATEGORY_DEFAULT_CASE['스마트팜'],'smartfarm');
});
Deno.test('classification preserves original self-score and labels only new direct classifications explicitly',()=>{
 const raw={intent:'farmland_pension',category:'농지연금',candidates:['farmland_pension'],level:'HIGH',confidence:.83,summary:'연금 문의',caseId:null};
 const direct=normalizeIntent(raw,'농지연금 문의','');assert.equal(direct.status,'AI_DIRECT');assert.equal(direct.confidence,.83);
 const unclear=normalizeIntent({...raw,level:'LOW'},'매월 받을 지원금','');assert.equal(unclear.status,'NEEDS_CLARIFICATION');assert.equal(unclear.caseId,'income');assert.equal(unclear.needsClarification,true);assert.equal(unclear.confidence,.83);
});
Deno.test('payment application has municipal destination without invented phone and preserves pension/registration contacts',()=>{
 for(const region of ['전주시','임실군','기타 지역']){const contact=matchContact('direct_payment_application',region);assert.match(contact.orgName,/읍·면·동/);assert.equal(contact.phone,'');assert.match(contact.duty,/농어촌공사가 아닌/);}
 assert.match(matchContact('gap_certification','임실군').orgName,/품질관리원/);
 assert.match(matchContact('retirement_direct_payment','임실군').orgName,/농어촌공사/);
 assert.match(intentPrompt({}),/사업명을 구체적으로 밝히지 않은 '직불금 신청'/);
});
Deno.test('payment answer enforces municipal application guidance and never reuses unrelated business source',async()=>{
 const env:Record<string,string>={OPENAI_API_KEY:'test',SUPABASE_URL:'https://example.test',SUPABASE_SERVICE_ROLE_KEY:'test',SUPABASE_ANON_KEY:'public'};
 const previous=globalThis.fetch;let saved:any;
 globalThis.fetch=async(url,init)=>{if(String(url).includes('/rest/v1/')){if(String(url).includes('consultation_answers')&&init?.method==='POST')saved=JSON.parse(String(init?.body));return Response.json([]);}return Response.json({status:'completed',output:[{content:[{type:'output_text',text:JSON.stringify({intent:'direct_payment_application',answer:'농어촌공사에 전화',reference_ids:[],reuse_source_id:'farmland_190dce15'})}]}]});};
 try{const handler=makeHandler(n=>env[n],()=>{throw Error()},async()=>true);const response=await handler(new Request('https://example.test/functions/v1/malhaenong-api/consult',{method:'POST',headers:{apikey:'public','Content-Type':'application/json'},body:JSON.stringify({domain:'farmland',question:'직불금 신청은 어디서 하나요?'})}));assert.equal(response.status,200);const body=await response.json();assert.match(body.answer,/관할 지자체의 읍·면·동/);assert.equal(saved.reuse_answer,'');assert.equal(body.intent,'direct_payment_application');}finally{globalThis.fetch=previous;}
});
