// Gets a phone photo of a receipt ready for the reader: find the paper, crop to it, remove the table and shadows, sharpen to black on white.
// The old step only stretched contrast, so a wood-grain table or a crumpled receipt confused the reader.
function otsu(hist, total) {
  let sum = 0; for (let i = 0; i < 256; i++) sum += i * hist[i];
  let wB = 0, sB = 0, best = 0, th = 128;
  for (let t = 0; t < 256; t++) { wB += hist[t]; if (!wB) continue; const wF = total - wB; if (!wF) break; sB += t * hist[t]; const d = (sB / wB - (sum - sB) / wF) ** 2 * wB * wF; if (d > best) { best = d; th = t; } }
  return th;
}
// bounding box of the largest bright blob (the paper), found on a coarse grid
function paperBox(lum, w, h) {
  const hist = new Uint32Array(256); for (let i = 0; i < lum.length; i++) hist[lum[i]]++;
  const th = Math.max(otsu(hist, lum.length), 140), cell = Math.max(6, Math.round(Math.max(w, h) / 120)), cw = Math.ceil(w / cell), ch = Math.ceil(h / cell), on = new Uint8Array(cw * ch);
  for (let cy = 0; cy < ch; cy++) for (let cx = 0; cx < cw; cx++) { let n = 0, t = 0; for (let y = cy * cell; y < Math.min(h, (cy + 1) * cell); y += 2) for (let x = cx * cell; x < Math.min(w, (cx + 1) * cell); x += 2) { t++; if (lum[y * w + x] > th) n++; } on[cy * cw + cx] = n > t * 0.5 ? 1 : 0; }
  const seen = new Uint8Array(cw * ch); let best = null;
  for (let s = 0; s < on.length; s++) {
    if (!on[s] || seen[s]) continue;
    const q = [s]; seen[s] = 1; let n = 0, x0 = cw, y0 = ch, x1 = 0, y1 = 0;
    while (q.length) { const c = q.pop(), x = c % cw, y = (c / cw) | 0; n++; x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); for (const nb of [c - 1, c + 1, c - cw, c + cw]) if (nb >= 0 && nb < on.length && on[nb] && !seen[nb] && Math.abs((nb % cw) - x) <= 1) { seen[nb] = 1; q.push(nb); } }
    if (!best || n > best.n) best = { n, x0, y0, x1, y1 };
  }
  if (!best || best.n < cw * ch * 0.02) return { x: 0, y: 0, w, h, found: false };         // no clear paper: keep everything
  const pad = cell * 0.4, x = Math.max(0, best.x0 * cell - pad), y = Math.max(0, best.y0 * cell - pad);
  return { x, y, w: Math.min(w - x, (best.x1 + 1) * cell - x + pad), h: Math.min(h - y, (best.y1 + 1) * cell - y + pad), found: true };
}
// adaptive threshold: a pixel is ink when clearly darker than the paper around it
function binarise(g, w, h, win, k) {
  const I = new Float64Array((w + 1) * (h + 1));
  for (let y = 0; y < h; y++) { let row = 0; for (let x = 0; x < w; x++) { row += g[y * w + x]; I[(y + 1) * (w + 1) + x + 1] = I[y * (w + 1) + x + 1] + row; } }
  const out = new Uint8ClampedArray(w * h), r = win >> 1;
  for (let y = 0; y < h; y++) { const y0 = Math.max(0, y - r), y1 = Math.min(h, y + r + 1); for (let x = 0; x < w; x++) { const x0 = Math.max(0, x - r), x1 = Math.min(w, x + r + 1), n = (x1 - x0) * (y1 - y0), m = (I[y1 * (w + 1) + x1] - I[y0 * (w + 1) + x1] - I[y1 * (w + 1) + x0] + I[y0 * (w + 1) + x0]) / n; out[y * w + x] = g[y * w + x] < m * k ? 0 : 255; } }
  return out;
}
// ---- loading a phone photo without filling the phone's memory ----
// A 12 to 50 megapixel photo decoded whole needs 50 to 200 MB, and the old steps decoded it again for every try. Now the picture is decoded once, already
// scaled down (the paper only needs about 1500 px across), and every step works from that one copy.
export const SOURCE_CAP = 3200, SMALL_CAP = 1800;
// width, height and EXIF turn of a JPEG, read from its first bytes only (null for other formats)
export async function jpegInfo(file) {
  try {
    const d = new DataView(await file.slice(0, 131072).arrayBuffer()); if (d.getUint16(0) !== 0xFFD8) return null;
    let i = 2, ori = 1, w = 0, h = 0;
    while (i + 4 < d.byteLength) {
      if (d.getUint8(i) !== 0xFF) break; const m = d.getUint8(i + 1), len = d.getUint16(i + 2);
      if (m === 0xE1 && d.getUint32(i + 4) === 0x45786966) {                                  // "Exif"
        const t = i + 10, le = d.getUint16(t) === 0x4949, off = d.getUint32(t + 4, le), n = d.getUint16(t + off, le);
        for (let k = 0; k < n; k++) { const e = t + off + 2 + 12 * k; if (e + 12 <= d.byteLength && d.getUint16(e, le) === 0x0112) ori = d.getUint16(e + 8, le); }
      }
      if (m >= 0xC0 && m <= 0xCF && m !== 0xC4 && m !== 0xC8 && m !== 0xCC) { h = d.getUint16(i + 5); w = d.getUint16(i + 7); break; }
      i += 2 + len;
    }
    return w && h ? { w, h, ori, ow: ori >= 5 ? h : w, oh: ori >= 5 ? w : h } : null;
  } catch { return null; }
}
const plainBitmap = (file) => createImageBitmap(file, { imageOrientation: 'from-image' }).catch(() => createImageBitmap(file));
// the photo, upright, no bigger than `cap` pixels on its long side. Returns a bitmap or canvas; give it back with releaseSource().
export async function loadSource(file, { cap = SOURCE_CAP } = {}) {
  if (!(file instanceof Blob)) return file;                                                 // already a decoded picture
  const info = await jpegInfo(file), k = info ? Math.min(1, cap / Math.max(info.ow, info.oh)) : 1;
  if (info && k < 1) {
    const w = Math.round(info.ow * k), h = Math.round(info.oh * k);
    try {
      const b = await createImageBitmap(file, { imageOrientation: 'from-image', resizeWidth: w, resizeHeight: h, resizeQuality: 'medium' });
      if (Math.abs(b.width - w) <= 2 && Math.abs(b.height - h) <= 2) return b;
      b.close();                                                                            // this browser applied the turn and the size in another order: do it by hand
    } catch { /* no resize support: do it by hand */ }
  }
  const b = await plainBitmap(file), f = Math.min(1, cap / Math.max(b.width, b.height));
  if (f >= 1) return b;
  const c = document.createElement('canvas'); c.width = Math.round(b.width * f); c.height = Math.round(b.height * f);
  c.getContext('2d').drawImage(b, 0, 0, c.width, c.height); b.close(); return c;
}
export function releaseSource(src) { try { if (src && src.close) src.close(); else if (src && src.getContext) { src.width = 0; src.height = 0; } } catch { /* already gone */ } }
// a smaller copy for quick looks (which way up, which tilt)
export function shrinkTo(src, side) {
  const f = Math.min(1, side / Math.max(src.width, src.height)), c = document.createElement('canvas'); c.width = Math.max(1, Math.round(src.width * f)); c.height = Math.max(1, Math.round(src.height * f));
  c.getContext('2d').drawImage(src, 0, 0, c.width, c.height); return c;
}
// How far the text lines lean, in degrees (positive = lines run downhill to the right), from the ink of the paper area. Text rows put the ink into
// a few tall bands when the lines are level; the best angle is the one where those bands are sharpest. Returns 0 when nothing clear is found.
export function skewAngle(lum, w, h, box) {
  const x0 = Math.floor(box.x), y0 = Math.floor(box.y), bw = Math.floor(box.w), bh = Math.floor(box.h), step = Math.max(1, Math.round(Math.max(bw, bh) / 420));
  const sw = Math.max(1, Math.floor(bw / step)), sh = Math.max(1, Math.floor(bh / step)), g = new Uint8Array(sw * sh);
  for (let y = 0; y < sh; y++) for (let x = 0; x < sw; x++) g[y * sw + x] = lum[(y0 + y * step) * w + x0 + x * step];
  const ink = binarise(g, sw, sh, Math.max(11, Math.round(sw / 20)) | 1, 0.8), px = [];
  for (let y = 0; y < sh; y++) for (let x = 0; x < sw; x++) if (ink[y * sw + x] === 0) px.push(x - sw / 2, y - sh / 2);
  if (px.length < 600 || px.length > 400000) return 0;
  const score = (deg) => { const t = (deg * Math.PI) / 180, sn = Math.sin(t), cs = Math.cos(t), bins = new Float64Array(sh * 2 + 8); for (let i = 0; i < px.length; i += 2) bins[Math.round(px[i + 1] * cs - px[i] * sn + sh)]++; let q = 0; for (const v of bins) q += v * v; return q; };
  const base = score(0); let best = 0, bs = base;
  for (let a = -8; a <= 8; a += 1) { const q = score(a); if (q > bs) { bs = q; best = a; } }
  for (const a of [best - 0.5, best + 0.5, best - 0.25, best + 0.25]) { const q = score(a); if (q > bs) { bs = q; best = a; } }
  return Math.abs(best) >= 3 && bs > base * 1.06 ? best : 0;
}
// turn a bitmap by 0 / 90 / 180 / 270 degrees clockwise
function turn(bmp, deg) {
  if (!deg) return bmp;
  const c = document.createElement('canvas'), q = deg === 90 || deg === 270;
  c.width = q ? bmp.height : bmp.width; c.height = q ? bmp.width : bmp.height;
  const g = c.getContext('2d'); g.translate(c.width / 2, c.height / 2); g.rotate((deg * Math.PI) / 180); g.drawImage(bmp, -bmp.width / 2, -bmp.height / 2);
  return c;
}
// do the text lines run across the picture ('h', upright or upside down) or up and down ('v', a sideways photo)? Lines of text make the ink
// bunch up in rows; the direction with the stronger bunching is the direction of the lines.
export async function textAxis(file) {
  const bmp = await loadSource(file, { cap: 1000 });
  const s0 = Math.min(1, 700 / Math.max(bmp.width, bmp.height)), w = Math.round(bmp.width * s0), h = Math.round(bmp.height * s0);
  const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(bmp, 0, 0, w, h);
  const d = g.getImageData(0, 0, w, h).data, lum = new Uint8Array(w * h);
  for (let i = 0; i < lum.length; i++) lum[i] = (d[i * 4] * 0.299 + d[i * 4 + 1] * 0.587 + d[i * 4 + 2] * 0.114) | 0;
  const box = paperBox(lum, w, h), x0 = Math.floor(box.x), y0 = Math.floor(box.y), bw = Math.floor(box.w), bh = Math.floor(box.h);
  const ink = binarise(lum, w, h, Math.max(15, Math.round(w / 25)) | 1, 0.8);
  const rows = new Float64Array(bh), cols = new Float64Array(bw);
  for (let y = 0; y < bh; y++) for (let x = 0; x < bw; x++) if (ink[(y0 + y) * w + x0 + x] === 0) { rows[y]++; cols[x]++; }
  // strength = how much neighbouring lines differ (text rows alternate ink and gap), normalised by the mean
  const rough = (a) => { let m = 0, v = 0; for (const x of a) m += x; m /= a.length || 1; for (let i = 1; i < a.length; i++) v += Math.abs(a[i] - a[i - 1]); return m ? v / a.length / m : 0; };
  const rr = rough(rows), rc = rough(cols);
  releaseSource(bmp); c.width = 0; c.height = 0;
  return { axis: rr >= rc ? 'h' : 'v', rows: rr, cols: rc };
}
// `file` may be a photo file or a picture already loaded with loadSource() (then it is left open for the next step).
export async function prepareReceipt(file, { target = 1500, k = 0.86, crop = true, binarise: bin = true, rot = 0, deskew = (typeof window === 'undefined' || window.__deskew !== false) } = {}) {
  const own = file instanceof Blob, bmp0 = await loadSource(file), turned = turn(bmp0, rot), mine = [];
  if (own) mine.push(bmp0); if (turned !== bmp0) mine.push(turned);
  let bmp = turned;
  const look = (b) => { const s0 = Math.min(1, 1100 / Math.max(b.width, b.height)), aw = Math.round(b.width * s0), ah = Math.round(b.height * s0);
    const a = document.createElement('canvas'); a.width = aw; a.height = ah; const ag = a.getContext('2d', { willReadFrequently: true }); ag.drawImage(b, 0, 0, aw, ah);
    const ad = ag.getImageData(0, 0, aw, ah).data, lum = new Uint8Array(aw * ah);
    for (let i = 0; i < lum.length; i++) lum[i] = (ad[i * 4] * 0.299 + ad[i * 4 + 1] * 0.587 + ad[i * 4 + 2] * 0.114) | 0;
    a.width = 0; a.height = 0; return { aw, ah, lum }; };
  let { aw, ah, lum } = look(bmp), box = crop ? paperBox(lum, aw, ah) : { x: 0, y: 0, w: aw, h: ah, found: false }, tilt = 0;
  if (deskew && crop && box.found) {                                                         // a tilted receipt reads worse: straighten it first
    tilt = skewAngle(lum, aw, ah, box);
    if (tilt) {
      const r = document.createElement('canvas'); r.width = bmp.width; r.height = bmp.height; const rg = r.getContext('2d');
      rg.fillStyle = '#777'; rg.fillRect(0, 0, r.width, r.height); rg.translate(r.width / 2, r.height / 2); rg.rotate((-tilt * Math.PI) / 180); rg.drawImage(bmp, -bmp.width / 2, -bmp.height / 2);
      mine.push(r); bmp = r; ({ aw, ah, lum } = look(bmp)); box = paperBox(lum, aw, ah);
    }
  }
  const sx = bmp.width / aw, sw = box.w * sx, sh = box.h * sx, k2 = Math.min(4, target / sw);
  const W = Math.round(sw * k2), H = Math.round(sh * k2), c = document.createElement('canvas'); c.width = W + 40; c.height = H + 40;
  const g = c.getContext('2d', { willReadFrequently: true }); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height);
  g.drawImage(bmp, box.x * sx, box.y * sx, sw, sh, 20, 20, W, H);
  const im = g.getImageData(0, 0, c.width, c.height), d = im.data, gray = new Uint8Array(c.width * c.height);
  for (let i = 0; i < gray.length; i++) gray[i] = (d[i * 4] * 0.299 + d[i * 4 + 1] * 0.587 + d[i * 4 + 2] * 0.114) | 0;
  let bw;
  if (bin) bw = binarise(gray, c.width, c.height, Math.max(25, Math.round(c.width / 18)) | 1, k);
  else {                                                   // soft grey: stretch the contrast but keep the strokes smooth
    bw = new Uint8ClampedArray(gray.length); const hist = new Uint32Array(256); for (const v of gray) hist[v]++;
    let a = 0, lo = 0; for (; lo < 255; lo++) { a += hist[lo]; if (a > gray.length * 0.01) break; }
    a = 0; let hi = 255; for (; hi > 0; hi--) { a += hist[hi]; if (a > gray.length * 0.35) break; }
    const span = Math.max(40, hi - lo); for (let i = 0; i < gray.length; i++) bw[i] = Math.max(0, Math.min(255, ((gray[i] - lo) * 255) / span));
  }
  for (let i = 0; i < bw.length; i++) d[i * 4] = d[i * 4 + 1] = d[i * 4 + 2] = bw[i];
  g.putImageData(im, 0, 0);
  if (box.found) { g.fillStyle = '#fff'; const m = Math.round(Math.min(W, H) * 0.02) + 20; g.fillRect(0, 0, c.width, m); g.fillRect(0, c.height - m, c.width, m); g.fillRect(0, 0, m, c.height); g.fillRect(c.width - m, 0, m, c.height); }   // table showing at the edge
  for (const m of mine) releaseSource(m);
  c.paperFound = box.found; c.tilt = tilt; return c;
}
