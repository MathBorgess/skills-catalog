import { readFileSync,writeFileSync,realpathSync,mkdirSync,existsSync } from 'node:fs';
import { resolve,dirname,relative,isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
const args=process.argv.slice(2), keys=['--source','--captures','--out','--grouping','--development-through','--validation-through'];
const option=k=>args[args.indexOf(k)+1],check=(ok,msg)=>{if(!ok)throw new Error(msg);},sha=bytes=>createHash('sha256').update(bytes).digest('hex');
try {
  check(args.length===12 && keys.every(k=>args.includes(k)),'usage: prepare-offline-pr-splits.mjs --source acquisition.json --captures external-directory --out external-file --grouping strict|index-log-excluded --development-through UTC-date --validation-through UTC-date');
  const out=resolve(option('--out')),root=realpathSync(resolve(dirname(fileURLToPath(import.meta.url)),'..'));
  let parent=dirname(out);while(!existsSync(parent))parent=dirname(parent);
  const actual=resolve(realpathSync(parent),relative(parent,out)),inside=relative(root,actual);
  check(inside.startsWith('..'+ '/') || isAbsolute(inside),'private split manifest must remain outside catalog checkout');
  check(!existsSync(out),'split proposals are immutable; choose a new output');
  const bytes=readFileSync(option('--source')),source=JSON.parse(bytes);
  const grouping=option('--grouping');check(['strict','index-log-excluded'].includes(grouping),'unknown grouping');
  const groups=structuredClone(source[grouping==='strict'?'strictSharedFileGrouping':'indexLogExcludedSensitivity'].components);
  const dev=Date.parse(option('--development-through')),val=Date.parse(option('--validation-through'));
  check(Number.isFinite(dev)&&Number.isFinite(val)&&dev<val,'invalid temporal boundaries');
  const captures=resolve(option('--captures')), metadata=new Map(source.metadata.map(m=>[m.number,m]));
  const ids=source.selectedNumbers, snapshots=new Map();
  for(const id of ids) {
    const directory=resolve(captures,`pr-${id}`),snapshot=JSON.parse(readFileSync(resolve(directory,'manifest.json')));
    check(snapshot.candidate_input_eligible===true,'missing fixed-head snapshot');
    for(const [file,expected] of Object.entries(snapshot.artifacts))check(sha(readFileSync(resolve(directory,file)))===expected.sha256,'captured bytes changed');
    snapshots.set(id,{directory,snapshot,diff_hash:snapshot.artifacts['candidate/diff.patch'].sha256});
  }
  // Identical diffs are one family even when no current path overlap reveals them.
  let changed=true;
  while(changed){changed=false;outer:for(let i=0;i<groups.length;i++)for(let j=i+1;j<groups.length;j++){
    if(groups[i].some(a=>groups[j].some(b=>snapshots.get(a).diff_hash===snapshots.get(b).diff_hash))){groups[i].push(...groups[j]);groups.splice(j,1);changed=true;break outer;}
  }}
  const rows=groups.map((numbers,index)=>{
    const dates=numbers.map(n=>Date.parse(metadata.get(n).createdAt)),start=Math.min(...dates),end=Math.max(...dates);
    let proposed_split=end<=dev?'development':start>dev&&end<=val?'validation':start>val?'test_reserved':'quarantined';
    return {family_id:`family-${index+1}`,pr_numbers:numbers,earliest_created:new Date(start).toISOString(),latest_created:new Date(end).toISOString(),proposed_split};
  });
  const familyByPr=new Map(rows.flatMap(f=>f.pr_numbers.map(n=>[n,f])));
  const cases=ids.map((id,index)=>{const s=snapshots.get(id),f=familyByPr.get(id);return {id:`real-${String(index+1).padStart(3,'0')}`,family_id:f.family_id,split:f.proposed_split,provenance:{kind:'private-offline-fixed-head',manifest_path:resolve(s.directory,'manifest.json'),manifest_sha256:sha(readFileSync(resolve(s.directory,'manifest.json')))},input:{metadata_path:resolve(s.directory,'candidate/input.json'),diff_path:resolve(s.directory,'candidate/diff.patch')},oracle:null};});
  const counts=Object.fromEntries(['development','validation','test_reserved','quarantined'].map(k=>[k,{cases:cases.filter(c=>c.split===k).length,families:rows.filter(f=>f.proposed_split===k).length}]));
  const result={version:1,status:'proposed-not-frozen',source_sha256:sha(bytes),grouping,grouping_requires_domain_review:grouping!=='strict',temporal_boundaries:{development_through:new Date(dev).toISOString(),validation_through:new Date(val).toISOString()},counts,families:rows,cases,test_access:'not independently protected; no test execution authorized by this proposal',limitations:['Correlated families spanning a time boundary are quarantined, never divided to force ratios.','A reserved test label is not evidence of independent custody.','All oracles require independent human adjudication.','The sample oversamples slow merged PRs; inclusion probabilities belong to sampling provenance.']};
  mkdirSync(dirname(out),{recursive:true,mode:0o700});writeFileSync(out,JSON.stringify(result,null,2)+'\n',{mode:0o600});
  console.log(JSON.stringify({status:result.status,real_snapshots:cases.length,groups:rows.length,counts,all_oracles_unlabelled:true,manifest_sha256:sha(readFileSync(out))}));
}catch(error){console.error(error.message);process.exitCode=2;}
