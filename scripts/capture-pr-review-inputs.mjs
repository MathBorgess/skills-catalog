// Prospective capture only. Closed PRs require independently verified historical snapshots.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, realpathSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { dirname, resolve, relative, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';

const args = process.argv.slice(2);
const option = key => args[args.indexOf(key) + 1];
const repo = option('--repo'), id = option('--pr'), destination = option('--out');
const check = (ok, message) => { if (!ok) throw new Error(message); };
const sha = data => createHash('sha256').update(data).digest('hex');
const gh = values => execFileSync('gh', values, { encoding:'utf8', maxBuffer:64*1024*1024, stdio:['ignore','pipe','pipe'] });

try {
  check(args.length === 6 && ['--repo','--pr','--out'].every(k => args.includes(k)), 'usage: capture-pr-review-inputs.mjs --repo owner/name --pr number --out external-directory');
  check(/^[\w.-]+\/[\w.-]+$/.test(repo) && /^\d+$/.test(id), 'invalid repo or PR identifier');
  const root = realpathSync(resolve(dirname(fileURLToPath(import.meta.url)), '..'));
  const metadata = JSON.parse(gh(['repo','view',repo,'--json','isPrivate']));
  // Check nearest existing ancestor before creation to prevent symlink escapes into the public checkout.
  const proposed = resolve(destination);
  let ancestor = proposed; while (!existsSync(ancestor)) ancestor = dirname(ancestor);
  const actualProposed = resolve(realpathSync(ancestor), relative(ancestor,proposed));
  const within = relative(root,actualProposed);
  check(!metadata.isPrivate || (within.startsWith('..' + '/') || isAbsolute(within)), 'private capture must be outside the catalog checkout');
  check(!existsSync(proposed), 'output already exists; keep captures immutable');
  const fields = 'number,state,createdAt,updatedAt,body,title,baseRefOid,headRefOid,baseRefName,headRefName,commits';
  const read = () => JSON.parse(gh(['pr','view',id,'--repo',repo,'--json',fields]));
  const capturedStart = new Date().toISOString(), before = read();
  check(before.state === 'OPEN', 'only an open PR can receive a prospective current snapshot');
  const diff = gh(['pr','diff',id,'--repo',repo,'--patch']);
  const checkJson = gh(['api',`repos/${repo}/commits/${before.headRefOid}/check-runs`]);
  const statusJson = gh(['api',`repos/${repo}/commits/${before.headRefOid}/status`]);
  const after = read(), capturedEnd = new Date().toISOString();
  check(sha(JSON.stringify(before)) === sha(JSON.stringify(after)), 'PR changed during capture; discard this attempt and capture again');
  check(before.baseRefOid && before.headRefOid && before.createdAt <= capturedEnd, 'missing revision evidence');
  mkdirSync(proposed,{recursive:true,mode:0o700});
  const artifacts = {};
  const save = (name, bytes) => { writeFileSync(resolve(proposed,name),bytes,{mode:0o600}); artifacts[name]={sha256:sha(bytes),bytes:Buffer.byteLength(bytes)}; };
  // Outcome state, future reviews, merge data, and comments never enter the candidate inputs.
  save('input.json',JSON.stringify({title:before.title,body:before.body,base_revision:before.baseRefOid,head_revision:before.headRefOid,review_cutoff:capturedEnd,check_scope:'GitHub status metadata only; raw test logs are unavailable'},null,2)+'\n');
  save('diff.patch',diff);
  save('checks.json',checkJson); save('statuses.json',statusJson);
  const manifest = {version:1,repository:repo,private:metadata.isPrivate,pr_number:Number(id),kind:'prospective-current-snapshot',phase:'development',captured_start:capturedStart,captured_end:capturedEnd,api_atomic_snapshot:false,consistency_check:'same PR fields and revisions before and after retrieval; check status timestamps can vary',base_revision:before.baseRefOid,head_revision:before.headRefOid,artifacts,historical_review_claim:false,oracle_status:'unlabelled',human_review_duration:null,limitations:['No retrospective opening or first-review snapshot is claimed.','No raw test-log evidence or independent human oracle exists yet.','Current checks may change during retrieval; preserve their timestamps.','PR metadata equality cannot rule out every concurrent edit or ABA change.']};
  save('capture.json',JSON.stringify(manifest,null,2)+'\n');
  console.log(JSON.stringify({captured:true,private:metadata.isPrivate,phase:'development',oracle_status:'unlabelled',artifact_count:Object.keys(artifacts).length,manifest_sha256:sha(readFileSync(resolve(proposed,'capture.json')))}));
} catch (error) {
  // Avoid printing command stderr: repository responses may contain private data.
  console.error(error.status !== undefined ? 'GitHub capture failed; no private response printed.' : error.message);
  process.exitCode=2;
}
