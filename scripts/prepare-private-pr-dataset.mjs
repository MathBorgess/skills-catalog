import { readFileSync, writeFileSync, mkdirSync, realpathSync, existsSync } from 'node:fs';
import { resolve, dirname, relative, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const args=process.argv.slice(2), option=k=>args[args.indexOf(k)+1];
const check=(ok,msg)=>{if(!ok)throw new Error(msg);};
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
try {
  check(args.length===4 && args.includes('--inventory') && args.includes('--out'),'usage: prepare-private-pr-dataset.mjs --inventory external-inventory-directory --out external-file.json');
  const source=realpathSync(resolve(option('--inventory'))), out=resolve(option('--out'));
  const root=realpathSync(resolve(dirname(fileURLToPath(import.meta.url)),'..'));
  let ancestor=dirname(out);while(!existsSync(ancestor))ancestor=dirname(ancestor);
  const actual=resolve(realpathSync(ancestor),relative(ancestor,out)), inside=relative(root,actual);
  check(inside.startsWith('..'+ '/') || isAbsolute(inside),'private output must stay outside catalog checkout');
  check(!existsSync(out),'output already exists; acquisition manifests are immutable');
  const bytes=readFileSync(resolve(source,'analysis-summary.json')), summary=JSON.parse(bytes);
  check(String(summary.repositoryVisibility).toLowerCase()==='private' && Array.isArray(summary.cases),'unsupported inventory format');
  const manifest={version:1,status:'acquisition-only',source_sha256:sha(bytes),source_directory:source,
    collected_at:summary.collectedAtUtc,window:summary.createdAtWindow,denominator:summary.allOutcomeCount,
    outcome_counts:summary.allOutcomeStateCounts,merged_ranking_denominator:summary.eligibleMergedCount,
    metric:summary.metric,selection:summary.caseSelection,groups:summary.correlationGroups,
    partitions:{development:[],validation:[],test:[],status:'unassigned: historical snapshots unavailable; fewer than three conservative groups'},
    cases:summary.cases.map(c=>({pr_number:c.number,acquisition_metadata:true,
      candidate_input_eligible:c.historicalCandidateInputEligible,inputs:null,oracle:null,split:null,
      review_count:c.reviewCount,first_review_at:c.firstSubmittedReviewAt,
      missing_reason:c.unavailableReason,body_snapshot:c.firstReviewBodySnapshot,diff_snapshot:c.firstReviewDiffSnapshot})),
    limitations:['Elapsed merge time is not human review labor or evidence of bad prose.',
      'Open and closed-unmerged outcomes are not zero-duration merged cases.',
      'Current file overlap is a conservative grouping sensitivity check, not a validated causal family definition.',
      'Slow-PR selection and four duration-rank comparisons are purposive, not representative random sampling.',
      'Outcome and acquisition data cannot become candidate inputs.']};
  check(manifest.cases.every(c=>c.candidate_input_eligible===false),'eligible cases need a verified snapshot loader; do not fabricate inputs');
  mkdirSync(dirname(out),{recursive:true,mode:0o700});writeFileSync(out,JSON.stringify(manifest,null,2)+'\n',{mode:0o600});
  console.log(JSON.stringify({status:manifest.status,denominator:manifest.denominator,selected_cases:manifest.cases.length,eligible_historical_inputs:0,partitions_assigned:false,manifest_sha256:sha(readFileSync(out))}));
}catch(error){console.error(error.message);process.exitCode=2;}
