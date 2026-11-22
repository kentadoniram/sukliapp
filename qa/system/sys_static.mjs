// SYSTEM: the shipped files hang together. Every import resolves, the offline cache lists every module, versions agree, no stray debug.
import fs from 'node:fs'; import path from 'node:path';
import { ok, done } from '../lib.mjs';
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const jsFiles = fs.readdirSync(path.join(root, 'js')).filter((f) => f.endsWith('.js'));
// 1. every relative import points at a file that exists
const missing = [];
for (const f of jsFiles) { const s = fs.readFileSync(path.join(root, 'js', f), 'utf8');
  for (const m of s.matchAll(/(?:import|export)[^'"`;]*?from\s*['"](\.[^'"]+)['"]|import\(\s*['"](\.[^'"]+)['"]\s*\)|^import\s+['"](\.[^'"]+)['"]/gm)) { const rel = m[1] || m[2] || m[3]; if (!fs.existsSync(path.join(root, 'js', rel))) missing.push(`${f} -> ${rel}`); } }
ok(missing.length === 0, `every import in js/ points at a file that exists (${jsFiles.length} files; missing: ${missing.slice(0, 4)})`);
// 2. named imports exist as exports in the target
const bad = [];
const exportsOf = (file) => { const s = fs.readFileSync(file, 'utf8'); const set = new Set();
  for (const m of s.matchAll(/export\s+(?:async\s+)?(?:function\*?|const|let|var|class)\s+([A-Za-z0-9_$]+)/g)) set.add(m[1]);
  for (const m of s.matchAll(/^export\s+(?:const|let|var)\s+([^\n;]*)/gm)) for (const n of m[1].matchAll(/(?:^|,)\s*([A-Za-z_$][\w$]*)\s*=/g)) set.add(n[1]);
  for (const m of s.matchAll(/export\s*\{([^}]*)\}/g)) for (const n of m[1].split(',')) { const t = n.trim().split(/\s+as\s+/).pop().trim(); if (t) set.add(t); }
  if (/export\s+default/.test(s)) set.add('default'); if (/export\s*\*\s*from/.test(s)) set.add('*'); return set; };
const cache = {};
for (const f of jsFiles) { const s = fs.readFileSync(path.join(root, 'js', f), 'utf8');
  for (const m of s.matchAll(/import\s*\{([^}]*)\}\s*from\s*['"](\.[^'"]+)['"]/g)) { const tgt = path.join(root, 'js', m[2]); if (!fs.existsSync(tgt)) continue; const ex = (cache[tgt] ||= exportsOf(tgt)); if (ex.has('*')) continue;
    for (const n of m[1].split(',')) { const name = n.trim().split(/\s+as\s+/)[0].trim(); if (name && !ex.has(name)) bad.push(`${f}: ${name} not exported by ${m[2]}`); } } }
ok(bad.length === 0, `every named import is really exported by its module (${bad.length} broken ${bad.slice(0, 3)})`);
// 3. the offline cache lists every module the app loads
const sw = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
const notCached = jsFiles.filter((f) => !sw.includes(`js/${f}`) && !sw.includes(`'./js/${f}'`) && !sw.includes(`"/js/${f}"`));
ok(notCached.length === 0, `sw.js caches every js module so the app works offline (${notCached.length} missing ${notCached.slice(0, 5)})`);
const swNames = [...sw.matchAll(/['"]\.?\/?(js\/[A-Za-z0-9_.-]+\.js)['"]/g)].map((m) => m[1]).filter((p) => !fs.existsSync(path.join(root, p)));
ok(swNames.length === 0, `sw.js lists no file that is gone (${swNames})`);
// 4. cache name and version stay in step
const ver = fs.readFileSync(path.join(root, 'js/version.js'), 'utf8'); const cacheName = (sw.match(/sukli-v([0-9.]+)/) || [])[1];
const major = (ver.match(/major\s*[:=]\s*(\d+)/) || [])[1], change = (ver.match(/change\s*[:=]\s*(\d+)/) || [])[1];
ok(cacheName && major && change && cacheName === `${major}.${change}`, `service-worker cache name (v${cacheName}) matches the version file (${major}.${change})`);
// 5. no leftover debugging in the shipped code
const dbg = []; for (const f of jsFiles) { const s = fs.readFileSync(path.join(root, 'js', f), 'utf8'); if (/^\s*debugger\s*;?\s*$/m.test(s)) dbg.push(f + ' debugger'); }
ok(dbg.length === 0, `no debugger statements (${dbg})`);
// 6. every page the manifest/HTML names exists
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8'); const refs = [...html.matchAll(/(?:src|href)="(?!https?:|#|data:)([^"?#]+)/g)].map((m) => m[1]).filter((p) => !fs.existsSync(path.join(root, p)));
ok(refs.length === 0, `index.html references only files that exist (${refs})`);
done();
