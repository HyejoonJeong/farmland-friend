import { strict as assert } from 'node:assert';
import {readFile} from 'node:fs/promises';
import {INTENTS,EXTENSION_OFFICES,NAQS_OFFICES,MUNICIPAL_OFFICES,matchContact,type IntentKey} from '../src/lib/data.ts';
import {intentPrompt} from '../supabase/functions/_shared/prompts.ts';
const reference=JSON.parse(await readFile(new URL('./fixtures/contact-reference-20261117.json',import.meta.url),'utf8'));
const sheets=reference.sheets;

Deno.test('every supplied office and business phone resolves to its source worksheet value',()=>{
 const regionByHeader:Record<string,string>={남원:'남원시',순창:'순창군',동진:'김제시',부안:'부안군',군산:'군산시',익산:'익산시',전주완주임실:'전주시',고창:'고창군',정읍:'정읍시',무진장:'무주군',임실:'임실군'};
 let verified=0;
 for(const row of sheets[0].values.slice(1)){
  const item=INTENTS.find(i=>i.business===row[1]);assert.ok(item);
  for(let c=4;c<15;c++)if(row[c]){
   assert.equal(matchContact(item.key,regionByHeader[sheets[0].values[0][c]]).phone,row[c]);verified++;
  }
  // Shared branches and the Im sil lease-trust exception must remain exact.
  for(const region of ['진안군','장수군'])assert.equal(matchContact(item.key,region).phone,row[13]);
  assert.equal(matchContact(item.key,'완주군').phone,row[10]);
  assert.equal(matchContact(item.key,'임실군').phone,row[14]??row[10]);
  if(row[3]!=null)assert.deepEqual(item.examples,String(row[3]).split(/\r?\n|\s+\/\s+/).map((s:string)=>s.trim()).filter(Boolean));
  else {assert.ok(item.examples.length>0);assert.ok(!item.examples.includes('null'));}
 }
 for(const row of sheets[1].values.slice(1)){const actual=matchContact('farming_tech',row[0]);assert.equal(actual.phone,row[4]);assert.equal(actual.duty,row[2]);verified++;}
 for(const row of sheets[2].values.slice(1)){const actual=matchContact('gap_certification',row[1]);assert.equal(actual.phone,row[2]);assert.equal(actual.duty,row[3]);assert.deepEqual(NAQS_OFFICES.find(o=>o.region===row[1])?.keywords,row[4].split(',').map((s:string)=>s.trim()));verified++;}
 for(const row of sheets[3].values.slice(1)){const actual=matchContact('farmland_survey',row[1]);assert.equal(actual.phone,row[2]);assert.equal(actual.duty,row[3]);verified++;}
 assert.equal(verified,244);
 assert.equal(EXTENSION_OFFICES.length,15);assert.equal(NAQS_OFFICES.length,13);assert.equal(MUNICIPAL_OFFICES.length,14);
});

Deno.test('updated institutional keywords are supplied to the AI without changing routing keys',()=>{
 const prompt=intentPrompt({region:'익산시'});
 for(const [sheetIndex,rowIndex,column,key]of [[1,1,3,'farming_tech'],[2,1,4,'gap_certification']] as const){
  const expected=sheets[sheetIndex].values[rowIndex][column].split(',').map((s:string)=>s.trim());
  const item=INTENTS.find(i=>i.key===key);
  // Application routing was corrected by the user: registration/certification remains NAQS,
  // payment applications now belong to municipal 읍·면·동 offices.
  // Geographic keywords belong to the office reference, not the global business classifier.
  const retained=key==='gap_certification'?expected.filter((s:string)=>s!=='전주'):expected;
  assert.deepEqual(item?.keywords,retained);
  for(const keyword of retained)assert.ok(prompt.includes(keyword),keyword);
 }
 assert.equal(INTENTS.length,25);
});
