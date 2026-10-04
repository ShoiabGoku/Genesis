/* GENESIS — Universe simulator: two universes animated side by side on the same cosmic clock.
 * Everything drawn comes from each universe's own solution: a(t) and H(t) (Friedmann, past + integrated
 * future), temperature T = T0/a, the growth factor D(a), last scattering z*, first-star/galaxy epochs,
 * the energy budget and the fate. The cosmic web is one Zel'dovich displacement field (same seed for
 * both), scaled by each universe's σ8·D(a)/D(today). */
(function () {
'use strict';
const G = window.GEN, GP = window.GP;
if (!G) return;
const { $, $$, fmt, fmtT, fmtTime, stat, plot, clamp } = G;
const L10 = Math.log10, GYR = 3.15576e16, T_MIN = 3e11, KB = 8.617333262e-14;
let T_MAX = 60 * GYR;   // extended in renderSim so that Rips and Crunches fit on the clock
const N = 128, BOX = 120, GRID = 168;
const S = { lt: L10(T_MIN), playing: false, raf: null, field: null, last: 0, lastCharts: 0 };
const cacheU = new WeakMap();

/* ------------------------------------------------ a universe as functions of cosmic time */
function U(R) {
  if (!R) return null;
  if (cacheU.has(R)) return cacheU.get(R);
  const age = R.tl.age * GYR, lt = [], la = [], lH = [], lT = [];
  for (let i = 0; i < R.tl.t.length; i++) { const t = R.tl.t[i]; if (t < 1e6) continue; lt.push(Math.log(t)); la.push(Math.log(R.tl.a[i])); lH.push(Math.log(R.tl.H[i])); lT.push(Math.log(R.tl.T[i] / KB)); }
  const ft = R.ft, fts = ft.ts.map(t => t * GYR);
  for (let j = 1; j < fts.length; j++) {
    if (fts[j] <= Math.exp(lt[lt.length - 1]) * 1.000001) continue;
    const j0 = Math.max(0, j - 1), j1 = Math.min(fts.length - 1, j + 1);
    const H = (Math.log(ft.as[j1]) - Math.log(ft.as[j0])) / (fts[j1] - fts[j0] || 1);
    lt.push(Math.log(fts[j])); la.push(Math.log(Math.max(ft.as[j], 1e-30))); lH.push(Math.log(Math.max(Math.abs(H), 1e-40))); lT.push(Math.log(R.cp.T0K / Math.max(ft.as[j], 1e-30)));
    if (fts[j] > 300 * GYR) break;
  }
  const tEnd = ft.tEnd ? ft.tEnd * GYR : null;
  let iMax = 0; ft.as.forEach((v, i) => { if (v > ft.as[iMax]) iMax = i; });
  const tTurn = ft.turned ? fts[iMax] : null;
  const gr = R.st.gr, D1 = gr.D0;
  const u = {
    R, age, tEnd, tTurn, outcome: ft.outcome,
    contracting: t => tTurn !== null && t > tTurn,
    a: t => Math.exp(GP.lerp(lt, la, Math.log(Math.min(t, tEnd || Infinity)))),
    H: t => (tTurn !== null && t > tTurn ? -1 : 1) * Math.exp(GP.lerp(lt, lH, Math.log(Math.min(t, tEnd || Infinity)))),
    T: t => Math.exp(GP.lerp(lt, lT, Math.log(Math.min(t, tEnd || Infinity)))),
    D: a => (a < 1e-3 ? a / 1e-3 * gr.D[0] : gr.Dat(Math.min(a, Math.exp(gr.LA[gr.LA.length - 1])))) / D1,
    // structure keeps growing after turnaround: a collapsing matter universe amplifies δ roughly ∝ a^(−3/2)
    Dt: t => { const a = u.a(t); if (tTurn === null || t <= tTurn) return u.D(a); const am = u.a(tTurn); return u.D(am) * Math.pow(am / a, 1.5); },
    zstar: isFinite(R.rec.zstar) ? R.rec.zstar : null, zfs: R.st.zFirstStars, zfg: R.st.zFirstGal, zML: R.ft.zML, sigma8: R.st.sigma8,
    frac: a => {
      const cp = R.cp, r = cp.Or / a ** 4, m = cp.Om / a ** 3, l = Math.abs(cp.OL * GP.deF(a, cp.w0, cp.wa)), e = cp.Oede ? cp.Oede(a) : 0, s = r + m + l + e || 1;
      return { r: r / s, m: m / s, l: l / s, e: e / s };
    },
  };
  cacheU.set(R, u);
  return u;
}

/* ------------------------------------------------ one Zel'dovich displacement field (standard P(k)) */
function fft1(re, im, inv) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) { let bit = n >> 1; for (; j & bit; bit >>= 1) j ^= bit; j ^= bit; if (i < j) { let t = re[i]; re[i] = re[j]; re[j] = t; t = im[i]; im[i] = im[j]; im[j] = t; } }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = 2 * Math.PI / len * (inv ? 1 : -1), wr = Math.cos(ang), wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) { let cr = 1, ci = 0; for (let j = 0; j < len / 2; j++) { const a = i + j, b = a + len / 2, xr = re[b] * cr - im[b] * ci, xi = re[b] * ci + im[b] * cr; re[b] = re[a] - xr; im[b] = im[a] - xi; re[a] += xr; im[a] += xi; const t = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = t; } }
  }
  if (inv) for (let i = 0; i < n; i++) { re[i] /= n; im[i] /= n; }
}
function fft2(re, im, inv) {
  const r = new Float64Array(N), q = new Float64Array(N);
  for (let y = 0; y < N; y++) { for (let x = 0; x < N; x++) { r[x] = re[y * N + x]; q[x] = im[y * N + x]; } fft1(r, q, inv); for (let x = 0; x < N; x++) { re[y * N + x] = r[x]; im[y * N + x] = q[x]; } }
  for (let x = 0; x < N; x++) { for (let y = 0; y < N; y++) { r[y] = re[y * N + x]; q[y] = im[y * N + x]; } fft1(r, q, inv); for (let y = 0; y < N; y++) { re[y * N + x] = r[y]; im[y * N + x] = q[y]; } }
}
function buildField() {
  const st = G.BASE.st;
  let seed = 271828; const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return (seed + 0.5) / 4294967296; };
  const nr = new Float64Array(N * N), ni = new Float64Array(N * N);
  for (let i = 0; i < N * N; i++) nr[i] = Math.sqrt(-2 * Math.log(rnd())) * Math.cos(2 * Math.PI * rnd());
  fft2(nr, ni, false);
  const xr = new Float64Array(N * N), xi = new Float64Array(N * N), yr = new Float64Array(N * N), yi = new Float64Array(N * N), kf = 2 * Math.PI / BOX;
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const kx = (i <= N / 2 ? i : i - N) * kf, ky = (j <= N / 2 ? j : j - N) * kf, k2 = kx * kx + ky * ky, id = j * N + i;
    if (!k2) continue;
    const k = Math.sqrt(k2), amp = Math.sqrt(Math.max(k * st.Pk(k, 1), 0)) * Math.exp(-0.5 * k2 * (BOX / N) ** 2);
    const a = nr[id] * amp, b = ni[id] * amp;
    xr[id] = -b * kx / k2; xi[id] = a * kx / k2; yr[id] = -b * ky / k2; yi[id] = a * ky / k2;
  }
  fft2(xr, xi, true); fft2(yr, yi, true);
  let s2 = 0; for (let i = 0; i < N * N; i++) s2 += 0.5 * (xr[i] * xr[i] + yr[i] * yr[i]);
  let t2 = 0; const kmin = 2 * Math.PI / BOX, kmax = Math.PI * N / BOX;
  for (let i = 1; i < st.ks.length; i++) { const k = st.ks[i]; if (k >= kmin && k <= kmax) t2 += st.D2[i] / (k * k) * Math.log(st.ks[i] / st.ks[i - 1]); }
  const sc = Math.sqrt(t2 / 3) / Math.sqrt(s2 / (N * N)) * N / BOX;
  const px = new Float32Array(N * N), py = new Float32Array(N * N);
  for (let i = 0; i < N * N; i++) { px[i] = xr[i] * sc; py[i] = yr[i] * sc; }
  return { px, py };
}

/* ------------------------------------------------ rendering one universe */
const MAG = (() => { const st = [[0, [0, 0, 4]], [0.2, [40, 11, 84]], [0.4, [101, 21, 110]], [0.6, [183, 55, 121]], [0.75, [241, 96, 93]], [0.88, [254, 176, 120]], [1, [252, 253, 191]]]; const l = new Uint8ClampedArray(768); for (let i = 0; i < 256; i++) { const u = i / 255; let k = 0; while (k < st.length - 2 && u > st[k + 1][0]) k++; const [u0, c0] = st[k], [u1, c1] = st[k + 1], w = (u - u0) / (u1 - u0); for (let q = 0; q < 3; q++) l[i * 3 + q] = c0[q] + w * (c1[q] - c0[q]); } return l; })();
const off = document.createElement('canvas'); off.width = off.height = GRID;
const rho = new Float32Array(GRID * GRID), tmp = new Float32Array(GRID * GRID);
function densityImage(amp, mode, bright, TK) {
  rho.fill(0);
  const px = S.field.px, py = S.field.py, f = GRID / N;
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const i1 = (i + 1) % N, j1 = (j + 1) % N, a00 = j * N + i, a10 = j * N + i1, a01 = j1 * N + i, a11 = j1 * N + i1;
    for (let sj = 0; sj < 2; sj++) for (let si = 0; si < 2; si++) {
      const u = si * 0.5, v = sj * 0.5, w00 = (1 - u) * (1 - v), w10 = u * (1 - v), w01 = (1 - u) * v, w11 = u * v;
      let x = (i + u + amp * (w00 * px[a00] + w10 * px[a10] + w01 * px[a01] + w11 * px[a11])) * f;
      let y = (j + v + amp * (w00 * py[a00] + w10 * py[a10] + w01 * py[a01] + w11 * py[a11])) * f;
      x = ((x % GRID) + GRID) % GRID; y = ((y % GRID) + GRID) % GRID;
      const x0 = x | 0, y0 = y | 0, wx = x - x0, wy = y - y0, x1 = (x0 + 1) % GRID, y1 = (y0 + 1) % GRID;
      rho[y0 * GRID + x0] += (1 - wx) * (1 - wy); rho[y0 * GRID + x1] += wx * (1 - wy); rho[y1 * GRID + x0] += (1 - wx) * wy; rho[y1 * GRID + x1] += wx * wy;
    }
  }
  const K = [0.0625, 0.25, 0.375, 0.25, 0.0625];
  for (let y = 0; y < GRID; y++) for (let x = 0; x < GRID; x++) { let s = 0; for (let k = -2; k <= 2; k++) s += K[k + 2] * rho[y * GRID + (x + k + GRID) % GRID]; tmp[y * GRID + x] = s; }
  for (let y = 0; y < GRID; y++) for (let x = 0; x < GRID; x++) { let s = 0; for (let k = -2; k <= 2; k++) s += K[k + 2] * tmp[((y + k + GRID) % GRID) * GRID + x]; rho[y * GRID + x] = s; }
  const mean = 4 * N * N / (GRID * GRID), img = new ImageData(GRID, GRID), d = img.data;
  // plasma colour from temperature (blackbody-ish): white-yellow when hot, deep orange near 3000 K
  const tt = clamp((L10(Math.max(TK, 1)) - L10(2800)) / 2, 0, 1), pr = 255, pg = 120 + 125 * tt, pb = 40 + 200 * tt * tt;
  for (let i = 0; i < GRID * GRID; i++) {
    const dl = rho[i] / mean;
    if (mode === 'plasma') { const m = clamp(0.8 + 0.2 * dl, 0.55, 1.15); d[i * 4] = pr * m; d[i * 4 + 1] = pg * m; d[i * 4 + 2] = pb * m; }
    else {
      const u = clamp(Math.log(1 + 2 * dl) / Math.log(26), 0, 1) * (0.45 + 0.55 * bright), c = Math.round(u * 255) * 3;
      d[i * 4] = MAG[c]; d[i * 4 + 1] = MAG[c + 1]; d[i * 4 + 2] = MAG[c + 2];
    }
    d[i * 4 + 3] = 255;
  }
  off.getContext('2d').putImageData(img, 0, 0);
  return off;
}
function epochOf(u, t, a, TK) {
  const z = 1 / a - 1;
  if (u.tEnd && t >= u.tEnd) return u.outcome === 'rip' ? 'BIG RIP — spacetime torn apart' : 'BIG CRUNCH — everything collapsed';
  if (TK > 3000) return 'hot opaque plasma — light cannot travel';
  if (u.zstar && z > u.zstar - 150 && z <= u.zstar + 50) return 'recombination — the universe turns transparent';
  if (u.zfs === null || z > u.zfs) return 'dark ages — no stars yet';
  if (u.zfg === null || z > u.zfg) return 'first stars ignite';
  if (u.contracting(t)) return TK > 3000 ? 'collapsing — the plasma reignites' : 'contracting — galaxies rush together';
  if (u.R.cp.OL < 0 && t > u.age) return 'attractive vacuum energy is halting the expansion';
  if (u.tEnd && u.outcome === 'rip' && t > u.tEnd - 3 * GYR) return 'phantom energy is tearing structures apart';
  if (u.R.cp.OL > 0 && u.zML !== null && z < u.zML) return a > 1.02 ? 'dark energy rules — galaxies drift apart' : 'dark energy takes over';
  return 'galaxies form and merge';
}
function drawPanel(cv, u, t, scale, label) {
  const W = cv.width, H = cv.height, c = cv.getContext('2d');
  c.fillStyle = '#03040a'; c.fillRect(0, 0, W, H);
  const a = u.a(t), TK = u.T(t), ended = u.tEnd && t >= u.tEnd, z = 1 / a - 1;
  const size = Math.max(2, a * scale);
  const mode = TK > 3000 ? 'plasma' : 'web';
  const tear = u.tEnd && u.outcome === 'rip' ? clamp((t - (u.tEnd - 3 * GYR)) / (3 * GYR), 0, 1) : 0;
  const ampRaw = (u.sigma8 / G.BASE.st.sigma8) * u.Dt(t), amp = Math.min(ampRaw, 3.2) * (1 - 0.9 * tear) + (tear > 0 ? 6 * tear * tear : 0);
  const bright = u.zfs === null ? 0 : clamp((u.zfs - z) / Math.max(u.zfs - (u.zfg || 0) + 1, 1), 0, 1);
  if (!ended) {
    const img = densityImage(mode === 'plasma' ? 0.35 : amp, mode, bright, TK);
    c.imageSmoothingEnabled = true;
    const x0 = (W - size) / 2, y0 = 78 + (H - 112 - size) / 2;
    if (mode === 'plasma') { c.shadowColor = `rgba(255,170,90,${clamp((L10(TK) - 3.4) / 1.5, 0.2, 0.9)})`; c.shadowBlur = 40; }
    c.drawImage(img, x0, y0, size, size); c.shadowBlur = 0;
    c.strokeStyle = 'rgba(255,255,255,.18)'; c.strokeRect(x0, y0, size, size);
    if (size < W * 0.15) {   // too small to read at the shared scale: magnified inset (labelled)
      const isz = W * 0.42, ix = W - isz - 12, iy = 82, zoom = isz / size;
      c.drawImage(img, ix, iy, isz, isz);
      c.strokeStyle = '#ffd66b'; c.strokeRect(ix, iy, isz, isz);
      c.beginPath(); c.moveTo(x0 + size, y0); c.lineTo(ix, iy + isz); c.stroke();
      c.fillStyle = '#ffd66b'; c.font = '11px Inter'; c.fillText(`magnified ×${fmt(zoom, 2)}`, ix + 4, iy + isz + 14);
    }
    if (mode === 'web' && u.zstar && z > u.zstar - 300) { c.fillStyle = `rgba(255,150,80,${clamp((z - (u.zstar - 300)) / 300, 0, 1) * 0.35})`; c.fillRect(x0, y0, size, size); }
    if (ampRaw > 3.2) { c.fillStyle = '#ffd66b'; c.font = '11px Inter'; c.fillText('beyond linear theory: matter has collapsed into dense halos', 10, H - 40); }
    if (mode === 'plasma') { c.fillStyle = 'rgba(255,255,255,.75)'; c.font = '10.5px Inter'; c.fillText('density ripples exaggerated ~10⁴× (real: 1 part in 10⁵)', 10, H - 40); }
  } else {
    const g = c.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, W / 2);
    if (u.outcome === 'crunch') { g.addColorStop(0, '#fff6d5'); g.addColorStop(0.2, '#ff8a3c'); g.addColorStop(1, '#03040a'); }
    else { g.addColorStop(0, '#03040a'); g.addColorStop(1, '#2a0d1a'); }
    c.fillStyle = g; c.fillRect(0, 0, W, H);
  }
  // HUD
  c.fillStyle = '#e8eaf8'; c.font = '600 13px Inter, sans-serif';
  c.fillText(`t = ${fmtTime(t)}`, 10, 18);
  c.font = '11.5px Inter, sans-serif'; c.fillStyle = '#c9cdea';
  c.fillText(a < 0.999 ? `z = ${fmt(z, 3)} · a = ${fmt(a, 3)}` : `a = ${fmt(a, 3)} (${a > 1.001 ? 'larger than today' : 'today’s size'})`, 10, 34);
  c.fillText(`T = ${fmt(TK, 3)} K · H = ${u.H(t) < 0 ? '−' : ''}${fmt(Math.abs(u.H(t)) * 3.0857e19, 3)} km/s/Mpc`, 10, 50);
  c.fillStyle = '#ffd66b'; c.font = 'italic 12px Georgia, serif'; c.fillText(epochOf(u, t, a, TK), 10, 68);
  // energy budget bar
  const fr = u.frac(a), bw = W - 20; let x = 10;
  [['r', '#ffd66b'], ['m', '#8ea2ff'], ['l', '#5ef0a8'], ['e', '#ff79c6']].forEach(([k, col]) => { const w = fr[k] * bw; c.fillStyle = col; c.fillRect(x, H - 18, w, 8); x += w; });
  c.fillStyle = '#8990b9'; c.font = '10px Inter'; c.fillText('radiation · matter · dark energy · early DE', 10, H - 24);
  // scale bar: the patch is 120 comoving Mpc → physical size a·120 Mpc
  const pxPerMpc = size / (a * BOX), nice = [0.01, 0.03, 0.1, 0.3, 1, 3, 10, 30, 100, 300, 1000, 3000, 1e4].find(v => v * pxPerMpc > W * 0.15) || 1e4;
  c.strokeStyle = '#fff'; c.lineWidth = 2; c.beginPath(); c.moveTo(W - 14 - nice * pxPerMpc, H - 40); c.lineTo(W - 14, H - 40); c.stroke(); c.lineWidth = 1;
  c.fillStyle = '#fff'; c.font = '10.5px Inter'; c.textAlign = 'right'; c.fillText((nice < 1 ? fmt(nice * 1000) + ' kpc' : fmt(nice) + ' Mpc'), W - 14, H - 46); c.textAlign = 'left';
  if (ended) { c.fillStyle = '#fff'; c.font = '700 20px Space Grotesk, Inter'; c.textAlign = 'center'; c.fillText(u.outcome === 'rip' ? 'BIG RIP' : 'BIG CRUNCH', W / 2, H / 2); c.font = '12px Inter'; c.fillText(`at t = ${fmtTime(u.tEnd)}`, W / 2, H / 2 + 20); c.textAlign = 'left'; }
}
function refR() { return $('#sim-ref').value === 'pin' && G.PIN ? G.PIN : G.BASE; }
function frame() {
  const ca = $('#sim-a'), cb = $('#sim-b'); if (!ca || !ca.clientWidth) return;
  for (const cv of [ca, cb]) { const w = Math.round(cv.clientWidth * Math.min(devicePixelRatio || 1, 2)); if (cv.width !== w) { cv.width = w; cv.height = w; } }
  if (!S.field) S.field = buildField();
  const t = Math.pow(10, S.lt), A = U(refR()), B = U(G.R);
  const aA = A.tEnd && t >= A.tEnd ? 0 : A.a(t), aB = B.tEnd && t >= B.tEnd ? 0 : B.a(t);
  const scale = (ca.width - 112) / Math.max(aA, aB, 1e-30);
  drawPanel(ca, A, t, scale); drawPanel(cb, B, t, scale);
  $('#sim-tlab').textContent = fmtTime(t);
  $('#sim-t').value = (S.lt - L10(T_MIN)) / (L10(T_MAX) - L10(T_MIN)) * 1000; G.paintRange($('#sim-t'));
  const ratio = aA && aB ? aB / aA : null;
  $('#sim-cap').innerHTML = ratio ? `At this moment your universe is <b>${fmt(ratio, 3)}×</b> ${ratio >= 1 ? 'larger' : 'the size of'} the standard one (same comoving patch, both drawn to the same physical scale; the view zooms so the larger fills the frame). Structure amplitude: standard ${fmt((A.sigma8 / G.BASE.st.sigma8) * A.Dt(t), 2)}, yours ${fmt((B.sigma8 / G.BASE.st.sigma8) * B.Dt(t), 2)} (today’s standard = 1).` : 'One of the universes has ended.';
  if (performance.now() - S.lastCharts > 250) { S.lastCharts = performance.now(); markCharts(t); }
}
function loop(now) {
  if (!S.playing || G.tab !== 'sim') { S.playing = false; $('#sim-play').textContent = '▶ Play'; return; }
  const dt = Math.min(0.1, (now - (S.last || now)) / 1000); S.last = now;
  S.lt += dt * (L10(T_MAX) - L10(T_MIN)) / +$('#sim-speed').value;
  if (S.lt >= L10(T_MAX)) { S.lt = L10(T_MAX); S.playing = false; }
  frame();
  S.raf = requestAnimationFrame(loop);
}
function play() {
  if (S.playing) { S.playing = false; return; }
  if (S.lt >= L10(T_MAX) - 0.01) S.lt = L10(T_MIN);
  S.playing = true; S.last = 0; $('#sim-play').textContent = '❚❚ Pause'; S.raf = requestAnimationFrame(loop);
}

/* ------------------------------------------------ charts and numbers */
let chartBase = null;
function curves(u, name, col, dash) {
  const ts = [], a = [], h = [], d = [];
  for (let l = L10(T_MIN); l <= L10(T_MAX) + 1e-9; l += 0.03) { const t = Math.pow(10, l); if (u.tEnd && t > u.tEnd) break; const aa = u.a(t); ts.push(t); a.push(aa); h.push(Math.abs(u.H(t)) * 3.0857e19); d.push((u.sigma8 / G.BASE.st.sigma8) * u.Dt(t)); }
  return { a: { name, x: ts, y: a, color: col, width: 2, dash }, h: { name, x: ts, y: h, color: col, width: 2, dash }, d: { name, x: ts, y: d, color: col, width: 2, dash } };
}
function markCharts(t) {
  if (!chartBase) return;
  const v = [{ x: t, label: 'now', color: '#fff' }];
  plot('c-sima', 'short').set(Object.assign({}, chartBase.a, { vlines: v }));
  plot('c-simd', 'short').set(Object.assign({}, chartBase.d, { vlines: v }));
  plot('c-simh', 'short').set(Object.assign({}, chartBase.h, { vlines: v }));
  plot('c-sime', 'short').set(Object.assign({}, chartBase.e, { vlines: v }));
}
function renderSim() {
  const A0 = U(refR()), B0 = U(G.R), ends = [A0.tEnd, B0.tEnd].filter(Boolean);
  T_MAX = Math.min(250 * GYR, Math.max(60 * GYR, ...ends.map(e => e * 1.12)));
  S.lt = Math.min(S.lt, L10(T_MAX));
  const A = A0, B = B0, refName = $('#sim-ref').value === 'pin' && G.PIN ? 'pinned' : 'standard';
  $('#sim-tl').textContent = refName === 'pinned' ? 'Pinned universe' : 'Standard universe';
  const ca = curves(A, refName, '#6d74a8', [4, 4]), cb = curves(B, 'yours', '#ff7a8c');
  const X = { log: 1, min: T_MIN, max: T_MAX, label: 'cosmic time', short: 't', fmt: fmtTime };
  const ts = [], fr = { r: [], m: [], l: [], e: [] };
  for (let l = L10(T_MIN); l <= L10(T_MAX) + 1e-9; l += 0.03) { const t = Math.pow(10, l); if (B.tEnd && t > B.tEnd) break; const f = B.frac(B.a(t)); ts.push(t); ['r', 'm', 'l', 'e'].forEach(k => fr[k].push(f[k])); }
  chartBase = {
    a: { x: X, y: { log: 1, label: 'scale factor a', short: 'a', floor: 1e5 }, series: [ca.a, cb.a] },
    d: { x: X, y: { log: 1, label: 'structure amplitude (today’s standard = 1)', short: 'D', floor: 1e5 }, series: [ca.d, cb.d] },
    h: { x: X, y: { log: 1, label: 'H [km/s/Mpc]', short: 'H' }, series: [ca.h, cb.h] },
    e: { x: X, y: { min: 0, max: 1, label: 'share of the energy', short: 'Ω' }, series: [{ name: 'radiation', x: ts, y: fr.r, color: '#ffd66b', width: 2 }, { name: 'matter', x: ts, y: fr.m, color: '#8ea2ff', width: 2 }, { name: 'dark energy', x: ts, y: fr.l, color: '#5ef0a8', width: 2 }, { name: 'early dark energy', x: ts, y: fr.e, color: '#ff79c6', width: 2 }] },
  };
  markCharts(Math.pow(10, S.lt));
  const Rr = A.R, R = G.R, n = (v, d) => typeof v === 'number' && isFinite(v) ? fmt(v, d) : (v === null ? 'never' : v);
  $('#s-sim').innerHTML = [
    stat('Age when it cools to 2.7 K', R.tl.age, { u: ' Gyr', d: 4, note: `${refName}: ${n(Rr.tl.age, 4)} Gyr`, hl: 1 }),
    stat('Expansion rate then (H₀)', R.cp.H0, { u: ' km/s/Mpc', d: 4, note: `${refName}: ${n(Rr.cp.H0, 4)}` }),
    stat('Helium made in 3 minutes', R.nuc.Yp, { d: 4, note: `${refName}: ${n(Rr.nuc.Yp, 4)}` }),
    stat('Dark matter surviving freeze-out', R.omega_c, { d: 4, note: `${refName}: ${n(Rr.omega_c, 4)} (Ω_c h²)` }),
    stat('CMB released at', R.rec.zstar, { d: 4, note: `${refName}: z* = ${n(Rr.rec.zstar, 4)}` }),
    stat('Clumpiness today σ₈', R.st.sigma8, { d: 3, note: `${refName}: ${n(Rr.st.sigma8, 3)}`, hl: 1 }),
    stat('First galaxies', R.st.zFirstGal !== null ? 'z ≈ ' + fmt(R.st.zFirstGal, 3) : 'never', { note: `${refName}: ${Rr.st.zFirstGal !== null ? 'z ≈ ' + fmt(Rr.st.zFirstGal, 3) : 'never'}` }),
    stat('Fate', G.fateTxt(R) + (R.ft.tEnd ? ' at ' + fmt(R.ft.tEnd, 3) + ' Gyr' : ''), { note: `${refName}: ${G.fateTxt(Rr)}` }),
  ].join('');
  frame();
}
const PRESETS = [
  ['Faster expansion ×1.3', { xi: 1.3 }], ['Slower expansion ×0.7', { xi: 0.7 }],
  ['Early dark energy before the CMB', { f_ede: 0.12, z_ede: 3500 }], ['Early dark energy during BBN', { f_ede: 0.3, z_ede: 1e9 }],
  ['Huge early dark energy (30%) at z = 20', { f_ede: 0.3, z_ede: 20 }],
  ['3× more dark matter', { link_dm: false, omega_c: 0.36 }], ['No dark matter', { link_dm: false, omega_c: 0.001 }],
  ['Extra radiation (N_eff = 7)', { Neff: 7 }], ['Λ ×10', { omega_L: 3.1 }], ['Phantom w = −1.5', { w0: -1.5 }], ['Negative Λ', { omega_L: -0.05 }],
];
let built = false;
G.EXT.render.sim = () => {
  if (!built) {
    built = true;
    $('#sim-play').onclick = play;
    $('#sim-t').oninput = () => { S.lt = L10(T_MIN) + $('#sim-t').value / 1000 * (L10(T_MAX) - L10(T_MIN)); frame(); };
    $('#sim-ref').onchange = () => renderSim();
    $('#sim-presets').innerHTML = PRESETS.map((p, i) => `<button class="btn tiny" data-sp="${i}">${p[0]}</button>`).join('') + '<button class="btn tiny" data-sp="-1">Back to standard</button>';
    $$('[data-sp]').forEach(b => b.onclick = () => { const i = +b.dataset.sp; G.setP(Object.assign(G.clone(GP.DEFAULTS), i >= 0 ? G.clone(PRESETS[i][1]) : {})); G.showTab('sim'); S.lt = L10(T_MIN); if (!S.playing) play(); if (i >= 0) G.nbAdd('run', 'Simulator: ' + PRESETS[i][0]); });
    new ResizeObserver(() => { if (G.tab === 'sim') frame(); }).observe($('#sim-a'));
  }
  renderSim();
};
window.__SIM = { S, frame, setT: t => { S.lt = L10(t); frame(); }, U };
})();
