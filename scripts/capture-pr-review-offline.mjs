// Build a new offline task from immutable SHAs of a merged PR, never a first-review reconstruction.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, realpathSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { dirname, resolve, relative, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';

const args=process.argv.slice(2), option=k=>args[args.indexOf(k)+1];
const check=(ok,msg)=>{if(!ok)throw new Error(msg);};
const hash=data=>createHash('sha256').update(data).digest('hex');
const gh=a=>execFileSync('gh',a,{encoding:'utf8',maxBuffer:64*1024*1024,stdio:['ignore','pipe','pipe']});
try {
  check(args.length===6 && ['--repo','--pr','--out'].every(k=>args.includes(k)),'usage: capture-pr-review-offline.mjs --repo owner/name --pr number --out external-directory');
  const repo=option('--repo'), id=option('--pr'), destination=resolve(option('--out'));
  check(/^[\w.-]+\/[\w.-]+$/.test(repo) && /^\d+$/.test(id),'invalid repository or PR');
  let ancestor=destination;while(!existsSync(ancestor))ancestor=dirname(ancestor);
  const actual=resolve(realpathSync(ancestor),relative(ancestor,destination));
  const root=realpathSync(resolve(dirname(fileURLToPath(import.meta.url)),'..')), inside=relative(root,actual);
  const repoMetadata=JSON.parse(gh(['repo','view',repo,'--json','isPrivate']));
  check(!repoMetadata.isPrivate || inside.startsWith('..'+ '/') || isAbsolute(inside),'private data must stay outside catalog checkout');
  check(!existsSync(destination),'output exists; preserve immutable captures');
  const started=new Date().toISOString(), endpoint=`repos/${repo}`;
  const p=JSON.parse(gh(['api',`${endpoint}/pulls/${id}`]));
  check(p.merged===true && p.merged_at,'merged PR required for offline final-head task');
  check(p.commits<=250 && p.changed_files<300,'large PR needs a Git-based collector; API completeness not assured');
  const pages=JSON.parse(gh(['api','--paginate','--slurp',`${endpoint}/pulls/${id}/commits?per_page=100`]));
  const commits=pages.flat();
  check(commits.length===p.commits && commits.at(-1)?.sha===p.head.sha,'PR commit list does not establish the returned final head');
  const head=p.head.sha;
  const headCommit=JSON.parse(gh(['api',`${endpoint}/git/commits/${head}`]));
  check(Date.parse(headCommit.committer.date)<=Date.parse(p.merged_at),'head timestamp is later than merge; investigate instead of claiming pre-merge provenance');
  // The merge's first parent is a recorded pre-integration base, not today's main.
  const integration=JSON.parse(gh(['api',`${endpoint}/git/commits/${p.merge_commit_sha}`]));
  check(integration.parents.length>0,'integration commit has no parent');
  const integrationParent=integration.parents[0].sha;
  let base=integrationParent, baseStrategy='integration-first-parent';
  check(base!==head,'base equals head; this merge strategy needs a dedicated historical collector');
  let comparison=JSON.parse(gh(['api',`${endpoint}/compare/${base}...${head}`]));
  if(comparison.files?.length!==p.changed_files) {
    const recordedBase=JSON.parse(gh(['api',`${endpoint}/git/commits/${p.base.sha}`]));
    check(Date.parse(recordedBase.committer.date)<=Date.parse(p.merged_at),'recorded PR base is later than merge');
    const ancestry=JSON.parse(gh(['api',`${endpoint}/compare/${p.base.sha}...${integrationParent}`]));
    check(['ahead','identical'].includes(ancestry.status),'recorded PR base is not an ancestor of integration parent');
    base=p.base.sha; baseStrategy='recorded-pr-base-ancestor-of-integration-parent';
    comparison=JSON.parse(gh(['api',`${endpoint}/compare/${base}...${head}`]));
  }
  check(comparison.files?.length===p.changed_files && comparison.files.length<300,'fixed comparison differs from PR file count; reject uncertain merge provenance');
  const mergeBase=comparison.merge_base_commit.sha;
  const diff=gh(['api','-H','Accept: application/vnd.github.diff',`${endpoint}/compare/${base}...${head}`]);
  check(diff.startsWith('diff --git ') && diff.includes('@@'),'empty or unsupported diff');
  const after=JSON.parse(gh(['api',`${endpoint}/pulls/${id}`]));
  check(after.head.sha===head && after.merge_commit_sha===p.merge_commit_sha,'PR references changed during capture');
  mkdirSync(resolve(destination,'candidate'),{recursive:true,mode:0o700});
  mkdirSync(resolve(destination,'adjudication'),{recursive:true,mode:0o700});
  const artifacts={};
  const save=(name,bytes)=>{writeFileSync(resolve(destination,name),bytes,{mode:0o600});artifacts[name]={sha256:hash(bytes),bytes:Buffer.byteLength(bytes)};};
  save('candidate/input.json',JSON.stringify({version:1,task:'offline-fixed-final-head-review-presentation',request:'Prepare a human review packet for the fixed diff. Preserve material risks and uncertainty.',base_revision:mergeBase,head_revision:head,description:null,description_omission:'Historical description not verified; do not substitute the latest body.',check_evidence:null,check_limit:'Historical raw checks unavailable; future checks and outcomes withheld.',head_commit_timestamp:headCommit.committer.date,historical_first_review:false},null,2)+'\n');
  save('candidate/diff.patch',diff);
  save('adjudication/outcome.json',JSON.stringify({pr_number:Number(id),created_at:p.created_at,merged_at:p.merged_at,elapsed_seconds:(Date.parse(p.merged_at)-Date.parse(p.created_at))/1000,merge_commit:p.merge_commit_sha,original_base:p.base.sha,integration_parent:integrationParent,comparison_base:base,base_strategy:baseStrategy,head,comparison_merge_base:mergeBase,raw_checks:'unavailable',oracle:'requires independent human adjudication; merge is not a correctness label'},null,2)+'\n');
  save('adjudication/commit-provenance.json',JSON.stringify({head:headCommit,integration,pr_commits:commits,comparison_files:comparison.files.map(f=>({filename:f.filename,status:f.status,sha:f.sha})),comparison_total_commits:comparison.total_commits},null,2)+'\n');
  const manifest={version:1,kind:'offline-fixed-final-head',private:repoMetadata.isPrivate,repository:repo,pr_number:Number(id),collected_start:started,collected_end:new Date().toISOString(),candidate_input_eligible:true,phase:'unassigned',base_strategy:baseStrategy,source_provenance:'GitHub merged PR head equals final PR commit; integration parent or verified recorded PR base supplies comparison origin; compare derives immutable merge-base-to-head diff.',artifacts,limitations:['This is a new offline review task, not a reproduction of first review.','Commit timestamps are metadata; no exact historical review instant is claimed.','No body, future comments, merge result, or post-merge checks enter candidate inputs.','Merged status is not evidence of correctness.','Candidate source files must resolve at head or merge-base SHAs, never current main.','Independent labels and final-test custody remain pending.']};
  save('manifest.json',JSON.stringify(manifest,null,2)+'\n');
  console.log(JSON.stringify({captured:true,kind:manifest.kind,candidate_input_eligible:true,description_included:false,phase:'unassigned',changed_files:comparison.files.length,manifest_sha256:hash(readFileSync(resolve(destination,'manifest.json')))}));
}catch(error){console.error(error.status!==undefined?'GitHub capture failed; private response withheld.':error.message);process.exitCode=2;}
