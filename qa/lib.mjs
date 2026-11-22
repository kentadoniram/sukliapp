// Shared helpers for the node-side QA checks. Prints PASS/FAIL lines the runner can count.
import '../tests/nodeenv.mjs';
import fs from 'node:fs';
export let bad = 0, total = 0;
export const ok = (c, m) => { total++; console.log(c ? 'PASS' : 'FAIL', m); if (!c) bad++; };
export const near = (a, b, eps = 0.005) => Math.abs(a - b) <= eps;
export const csvPath = () => process.argv[2] || process.env.QA_CSV || '/home/claude/Transactions.csv';
export const readCsv = () => fs.readFileSync(csvPath(), 'utf8');
// small seeded random generator so a failing run can be repeated exactly
export const rng = (seed) => () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
export const done = () => { console.log(`SUMMARY ${total - bad}/${total}`); process.exit(bad ? 1 : 0); };
