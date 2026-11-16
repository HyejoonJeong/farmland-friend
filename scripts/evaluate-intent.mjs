import { readFile } from 'node:fs/promises';
const root = process.env.TARGET_SUPABASE_URL;
const key = process.env.TARGET_SUPABASE_PUBLISHABLE_KEY;
if (root !== 'https://ertujxbknytbyuqgvcuy.supabase.co' || !key) throw new Error('Set the target Supabase URL and publishable key');
const cases = JSON.parse(await readFile(new URL('../tests/intent-cases.json', import.meta.url), 'utf8'));
let failed = 0;
for (let index = 0; index < cases.length; index++) {
  const item = cases[index];
  const response = await fetch(`${root}/functions/v1/malhaenong-api/intent`, {
    method: 'POST', headers: { apikey: key, 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: item.text, region: '임실군' }), signal: AbortSignal.timeout(60_000),
  });
  const actual = await response.json();
  const passed = response.ok && ['intent', 'level', 'needsClarification'].every(field => !(field in item) || actual[field] === item[field]);
  if (!passed) failed++;
  console.log(`Case ${index + 1}: ${passed ? 'PASS' : 'FAIL'}`);
}
console.log(`${cases.length - failed}/${cases.length} classification cases passed`);
console.log('Small regression sample only; validate the full user test set and representative recordings before cutover.');
if (failed) process.exitCode = 1;
