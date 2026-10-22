import { mkdtempSync,writeFileSync,mkdirSync,readFileSync,existsSync,rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join,resolve,dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const temp=mkdtempSync(join(tmpdir(),'pr-capture-test-')),bin=join(temp,'bin');mkdirSync(bin);
const mock=`#!/usr/bin/env node
const a=process.argv.slice(2), mode=process.env.PR_CAPTURE_FIXTURE_MODE;
const head='a'.repeat(40),base='b'.repeat(40),merge='c'.repeat(40),old='d'.repeat(40);
const p={merged:true,merged_at:'2026-01-03T00:00:00Z',created_at:'2026-01-01T00:00:00Z',commits:1,changed_files:1,head:{sha:head},base:{sha:old},merge_commit_sha:merge,body:'CANARY_FUTURE_DESCRIPTION',title:'CANARY_PRIVATE_TITLE'};
let out;
if(a[0]==='repo')out={isPrivate:true};
else if(a.includes('Accept: application/vnd.github.diff')){process.stdout.write('diff --git a/demo.txt b/demo.txt\\n@@ -1 +1 @@\\n-old\\n+new\\n');process.exit(0);}
else {const path=a.at(-1);
if(path.includes('/pulls/')&&path.includes('/commits?'))out=[[{sha:mode==='mishead'?old:head}]];
else if(path.includes('/pulls/'))out=p;
else if(path.endsWith('/git/commits/'+merge))out={parents:[{sha:base}]};
else if(path.includes('/git/commits/'))out={committer:{date:mode==='future'?'2026-01-04T00:00:00Z':'2026-01-02T00:00:00Z'}};
else if(path.includes('/compare/'))out={status:'ahead',merge_base_commit:{sha:old},files:mode==='fallback'&&path.includes(base+'...'+head)?[]:[{filename:'demo.txt',status:'modified',sha:head}]};
else throw new Error('unexpected fixture route');}
console.log(JSON.stringify(out));
`;
writeFileSync(join(bin,'gh'),mock,{mode:0o755});
let tests=0;
const test=(name,fn)=>{fn();tests++;console.log(`ok: ${name}`);};
const run=(out,mode='clean')=>spawnSync(process.execPath,[join(root,'scripts/capture-pr-review-offline.mjs'),'--repo','fixture/private','--pr','1','--out',out],{encoding:'utf8',env:{...process.env,PATH:bin+':'+process.env.PATH,PR_CAPTURE_FIXTURE_MODE:mode}});
try {
  test('private capture cannot write into public checkout',()=>{
    const dest=join(root,'private-capture-forbidden-test');const r=run(dest);assert.equal(r.status,2);assert.equal(existsSync(dest),false);
  });
  test('fixed offline capture excludes future body, title, and outcome from candidate inputs',()=>{
    const dest=join(temp,'clean'),r=run(dest);assert.equal(r.status,0,r.stderr);
    const input=readFileSync(join(dest,'candidate/input.json'),'utf8');assert.ok(!input.includes('CANARY'));
    assert.ok(!input.includes('merged_at'));assert.equal(JSON.parse(input).historical_first_review,false);
    assert.equal(JSON.parse(input).description,null);assert.ok(existsSync(join(dest,'adjudication/outcome.json')));
  });
  test('post-merge head timestamp and mismatched final head reject capture',()=>{
    for(const mode of ['future','mishead']){const dest=join(temp,mode),r=run(dest,mode);assert.equal(r.status,2);assert.equal(existsSync(dest),false);}
  });
  test('recorded-base fallback has explicit provenance, not current main',()=>{
    const dest=join(temp,'fallback'),r=run(dest,'fallback');assert.equal(r.status,0,r.stderr);
    assert.equal(JSON.parse(readFileSync(join(dest,'manifest.json'))).base_strategy,'recorded-pr-base-ancestor-of-integration-parent');
  });
  test('immutable capture refuses to overwrite prior evidence',()=>{
    const dest=join(temp,'clean'),before=readFileSync(join(dest,'manifest.json'));assert.equal(run(dest).status,2);
    assert.ok(before.equals(readFileSync(join(dest,'manifest.json'))));
  });
  console.log(`${tests} collector checks passed; synthetic GitHub responses only.`);
}finally{rmSync(temp,{recursive:true,force:true});}
