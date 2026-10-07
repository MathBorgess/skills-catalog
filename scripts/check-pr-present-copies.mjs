import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const files=['references/ste-lite.md','references/profile-en.md','references/profile-pt-br.md','scripts/ste-lint.mjs','scripts/profiles/en.mjs','scripts/profiles/pt-br.mjs'];
for(const file of files) {
  const canonical=readFileSync(resolve(root,'skills/easy-to-read',file));
  const copy=readFileSync(resolve(root,'skills/pr-present',file));
  if(!canonical.equals(copy)) throw new Error(`PR Present differs from Easy to Read: ${file}`);
}
console.log(`ok: ${files.length} PR Present writing files equal the canonical Easy to Read files`);
