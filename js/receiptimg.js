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
  const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' }).catch(() => createImageBitmap(file));
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
  return { axis: rr >= rc ? 'h' : 'v', rows: rr, cols: rc };
}
export async function prepareReceipt(file, { target = 1500, k = 0.86, crop = true, binarise: bin = true, rot = 0 } = {}) {
  const bmp0 = await createImageBitmap(file, { imageOrientation: 'from-image' }).catch(() => createImageBitmap(file));
  const bmp = turn(bmp0, rot);
  const s0 = Math.min(1, 1100 / Math.max(bmp.width, bmp.height)), aw = Math.round(bmp.width * s0), ah = Math.round(bmp.height * s0);
  const a = document.createElement('canvas'); a.width = aw; a.height = ah; const ag = a.getContext('2d', { willReadFrequently: true }); ag.drawImage(bmp, 0, 0, aw, ah);
  const ad = ag.getImageData(0, 0, aw, ah).data, lum = new Uint8Array(aw * ah);
  for (let i = 0; i < lum.length; i++) lum[i] = (ad[i * 4] * 0.299 + ad[i * 4 + 1] * 0.587 + ad[i * 4 + 2] * 0.114) | 0;
  const box = crop ? paperBox(lum, aw, ah) : { x: 0, y: 0, w: aw, h: ah, found: false };
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
  c.paperFound = box.found; return c;
}
