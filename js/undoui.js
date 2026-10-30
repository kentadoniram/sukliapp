// Undo and Redo for the last changes to your data (this session). Menu items, a Settings box, and the actions.
import { undoInfo, undoLast, redoLast } from './core.js';
import { ACT, toast, esc, ic } from './ui.js';

const ago = (at) => { const m = Math.round((Date.now() - at) / 60000); return m < 1 ? 'just now' : m < 60 ? `${m} min ago` : `${Math.round(m / 60)} h ago`; };

// two menu rows, only when there is something to undo or redo
export function undoMenuHtml() {
  const u = undoInfo(); if (!u.undo && !u.redo) return '';
  return `<ul>${u.undo ? `<li><a href="#" data-act="undo-last">${ic('undo')}<span>Undo: ${esc(u.undo.label)}</span></a></li>` : ''}${u.redo ? `<li><a href="#" data-act="redo-last">${ic('redo')}<span>Redo: ${esc(u.redo.label)}</span></a></li>` : ''}</ul>`;
}
export function undoSection() {
  const u = undoInfo();
  return `<section id="undo-set"><h2>Undo</h2><p class="hint">Takes back your last changes to entries, accounts, categories and budgets, one at a time (up to 10). It is kept when you close the app (see Undo history under the Recycle bin). Entries you added go to the Recycle bin.</p>
    ${u.undo ? `<p class="hint"><b>Last change:</b> ${esc(u.undo.label)} · ${esc(ago(u.undo.at))} · ${u.undo.count} step${u.undo.count === 1 ? '' : 's'} available</p>` : '<p class="hint">Nothing to undo yet.</p>'}
    <div class="btnrow left"><button type="button" class="btn ghost" data-act="undo-last" ${u.undo ? '' : 'disabled'}>Undo</button><button type="button" class="btn ghost" data-act="redo-last" ${u.redo ? '' : 'disabled'}>Redo</button><a class="btn ghost" href="#/bin?v=history">History</a></div></section>`;
}
ACT['undo-last'] = () => { const l = undoLast(); toast(l ? `Undone: ${l}.` : 'Nothing to undo.'); };
ACT['redo-last'] = () => { const l = redoLast(); toast(l ? `Redone: ${l}.` : 'Nothing to redo.'); };
