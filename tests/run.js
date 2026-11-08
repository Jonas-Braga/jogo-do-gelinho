// Executor no Node:  npm test            (roda tudo)
//                    npm test -- urso    (filtra pelo nome)
//                    npm run test:baseline  (promove os testes novos a regressivos)
import './env.js';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { tests, runAll, compareBaseline } from './harness.js';
import { SPEC_FILES } from './specs/index.js';

const args = process.argv.slice(2);
const update = args.includes('--update-baseline');
const filter = args.find((a) => !a.startsWith('--'));
const baselineUrl = new URL('./baseline.json', import.meta.url);

for (const f of SPEC_FILES) await import(`./specs/${f}`);
const results = await runAll({ filter });

const color = (c, s) => (process.stdout.isTTY ? `\x1b[${c}m${s}\x1b[0m` : s);
const icon = { pass: color(32, '✓'), fail: color(31, '✗'), todo: color(33, '○') };

let suiteName = null;
for (const r of results) {
  if (r.suite !== suiteName) {
    suiteName = r.suite;
    console.log(`\n${color(1, suiteName)}`);
  }
  console.log(`  ${icon[r.status]} ${r.name}${r.status === 'todo' ? color(33, ' (pendente)') : ''}`);
  if (r.status === 'fail') console.log(color(31, `      ${r.error.split('\n').join('\n      ')}`));
}

const baseline = existsSync(baselineUrl) ? JSON.parse(readFileSync(baselineUrl, 'utf8')) : [];
const { missing, progressive } = filter ? { missing: [], progressive: [] } : compareBaseline(results, baseline);

const count = (s) => results.filter((r) => r.status === s).length;
const failed = count('fail');
console.log(`\n${count('pass')} passaram · ${failed} falharam · ${count('todo')} pendentes · ${tests.length} no total`);
console.log(`${baseline.length - missing.length} regressivos (baseline) · ${progressive.length} progressivos (novos)`);

if (progressive.length && !update) {
  console.log(color(36, '\nTestes progressivos (ainda não estão na baseline):'));
  for (const id of progressive) console.log(color(36, `  + ${id}`));
}
if (missing.length) {
  console.log(color(31, '\nTESTES DA BASELINE QUE SUMIRAM (removidos ou renomeados):'));
  for (const id of missing) console.log(color(31, `  - ${id}`));
}

if (update) {
  if (failed) {
    console.log(color(31, '\nBaseline NÃO atualizada: corrija as falhas primeiro.'));
    process.exit(1);
  }
  const next = [...new Set([...baseline.filter((id) => !missing.includes(id)), ...progressive])];
  writeFileSync(baselineUrl, JSON.stringify(next, null, 2) + '\n');
  console.log(color(32, `\nBaseline atualizada: ${next.length} testes regressivos.`));
  if (missing.length) console.log(color(33, `Removidos da baseline: ${missing.length} (confirme que foi intencional).`));
  process.exit(0);
}

process.exit(failed || missing.length ? 1 : 0);
