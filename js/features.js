// Features that are hidden from the screens for now (code kept). See docs/REMOVED-FEATURES.md.
// To bring them back while testing: localStorage.setItem('sukli.legacy','1') then reload.
export const REMOVED_UI = (() => { try { return localStorage.getItem('sukli.legacy') === '1'; } catch { return false; } })();
