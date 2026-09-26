/* Minimal scientific plotting: log/linear axes, reversible x, bands, reference
 * lines, hover readout, legend toggles, CSV export. No dependencies. */
(function () {
'use strict';
const SUP = { '-': '⁻', '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹' };
const sup = s => String(s).split('').map(c => SUP[c] || c).join('');
function fmtNum(v, digits) {
  if (v === null || v === undefined || !isFinite(v)) return '—';
  if (v === 0) return '0';
  const a = Math.abs(v), d = digits || 3;
  if (a >= 1e-3 && a < 1e5) {
    const s = v.toPrecision(d);
    return String(parseFloat(s));
  }
  const e = Math.floor(Math.log10(a)), m = v / Math.pow(10, e);
  const ms = parseFloat(m.toPrecision(d));
  if (Math.abs(ms) === 10) return (ms > 0 ? '' : '−') + '10' + sup(e + 1);
  return (ms === 1 ? '' : String(ms).replace('-', '−') + '×') + '10' + sup(e);
}
function tickLog(e) { return e === 0 ? '1' : e === 1 ? '10' : '10' + sup(e); }
function niceStep(range, n) {
  const raw = range / n, p = Math.pow(10, Math.floor(Math.log10(raw))), f = raw / p;
  return (f < 1.5 ? 1 : f < 3 ? 2 : f < 7 ? 5 : 10) * p;
}
function css(name) { return getComputedStyle(document.documentElement).getPropertyValue(name).trim(); }

class Plot {
  constructor(el, opt) {
    this.el = el; this.opt = opt || {};
    el.classList.add('plot');
    this.box = document.createElement('div'); this.box.className = 'plot-box';
    this.cv = document.createElement('canvas');
    this.tip = document.createElement('div'); this.tip.className = 'plot-tip';
    this.leg = document.createElement('div'); this.leg.className = 'plot-legend';
    this.box.append(this.cv, this.tip);
    el.append(this.box, this.leg);
    this.hidden = new Set();
    this.hover = null;
    new ResizeObserver(() => this.draw()).observe(this.box);
    this.cv.addEventListener('pointermove', e => { const r = this.cv.getBoundingClientRect(); this.hover = [e.clientX - r.left, e.clientY - r.top]; this.draw(); });
    this.cv.addEventListener('pointerleave', () => { this.hover = null; this.tip.style.display = 'none'; this.draw(); });
  }
  set(d) { this.d = d; this.legend(); this.draw(); }
  legend() {
    const d = this.d; this.leg.innerHTML = '';
    if (!d || d.noLegend) return;
    for (const s of d.series) {
      if (!s.name) continue;
      const b = document.createElement('button');
      b.className = 'lg' + (this.hidden.has(s.name) ? ' off' : '');
      b.innerHTML = `<i style="background:${s.color};${s.dash ? 'background:repeating-linear-gradient(90deg,' + s.color + ' 0 4px,transparent 4px 7px)' : ''}"></i>${s.name}`;
      b.onclick = () => { this.hidden.has(s.name) ? this.hidden.delete(s.name) : this.hidden.add(s.name); this.legend(); this.draw(); };
      this.leg.append(b);
    }
  }
  range(ax, key) {
    const d = this.d;
    if (ax.min !== undefined && ax.max !== undefined) return [ax.min, ax.max];
    let lo = Infinity, hi = -Infinity;
    for (const s of d.series) {
      if (this.hidden.has(s.name)) continue;
      const arr = s[key];
      for (let i = 0; i < arr.length; i++) { const v = arr[i]; if (!isFinite(v) || (ax.log && v <= 0)) continue; if (v < lo) lo = v; if (v > hi) hi = v; }
    }
    if (!isFinite(lo)) { lo = ax.log ? 1 : 0; hi = ax.log ? 10 : 1; }
    if (ax.log) { if (ax.floor && lo < hi / ax.floor) lo = hi / ax.floor; lo = Math.pow(10, Math.floor(Math.log10(lo))); hi = Math.pow(10, Math.ceil(Math.log10(hi))); if (lo === hi) hi *= 10; }
    else { const pad = (hi - lo) * 0.06 || Math.abs(hi) * 0.1 || 1; lo -= pad; hi += pad; if (ax.zero && lo > 0) lo = 0; }
    return [ax.min !== undefined ? ax.min : lo, ax.max !== undefined ? ax.max : hi];
  }
  draw() {
    const d = this.d; if (!d) return;
    const W = this.box.clientWidth, H = this.box.clientHeight; if (!W || !H) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    if (this.cv.width !== Math.round(W * dpr) || this.cv.height !== Math.round(H * dpr)) { this.cv.width = Math.round(W * dpr); this.cv.height = Math.round(H * dpr); }
    const c = this.cv.getContext('2d'); c.setTransform(dpr, 0, 0, dpr, 0, 0); c.clearRect(0, 0, W, H);
    const col = { grid: css('--grid'), axis: css('--muted'), text: css('--text'), bg: css('--panel') };
    const X = d.x, Y = d.y;
    const [x0, x1] = this.range(X, 'x'), [y0, y1] = this.range(Y, 'y');
    const L = 58, R = 14, T = d.title ? 26 : 12, B = 40;
    const pw = W - L - R, ph = H - T - B;
    const fx = v => { let u = X.log ? (Math.log10(v) - Math.log10(x0)) / (Math.log10(x1) - Math.log10(x0)) : (v - x0) / (x1 - x0); if (X.rev) u = 1 - u; return L + u * pw; };
    const fy = v => { const u = Y.log ? (Math.log10(v) - Math.log10(y0)) / (Math.log10(y1) - Math.log10(y0)) : (v - y0) / (y1 - y0); return T + (1 - u) * ph; };
    const ix = px => { let u = (px - L) / pw; if (X.rev) u = 1 - u; return X.log ? Math.pow(10, Math.log10(x0) + u * (Math.log10(x1) - Math.log10(x0))) : x0 + u * (x1 - x0); };
    this.fx = fx; this.fy = fy;
    c.font = '11px Inter, system-ui, sans-serif';
    if (d.title) { c.fillStyle = col.text; c.font = '600 12px Inter, system-ui, sans-serif'; c.fillText(d.title, L, 16); c.font = '11px Inter, system-ui, sans-serif'; }
    c.save(); c.beginPath(); c.rect(L, T, pw, ph); c.clip();
    for (const b of d.vbands || []) { c.fillStyle = b.color; const a = fx(b.x0), z = fx(b.x1); c.fillRect(Math.min(a, z), T, Math.abs(z - a), ph); if (b.label) { c.fillStyle = col.axis; c.fillText(b.label, Math.min(a, z) + 4, T + 12); } }
    for (const b of d.hbands || []) { c.fillStyle = b.color; const a = fy(b.y0), z = fy(b.y1); c.fillRect(L, Math.min(a, z), pw, Math.abs(z - a)); if (b.label) { c.fillStyle = b.textColor || col.axis; c.fillText(b.label, L + 6, Math.min(a, z) + 11); } }
    for (const b of d.rects || []) { c.fillStyle = b.color; const xa = fx(b.x0), xb = fx(b.x1), ya = fy(b.y0), yb = fy(b.y1); c.fillRect(Math.min(xa, xb), Math.min(ya, yb), Math.abs(xb - xa), Math.abs(yb - ya)); if (b.label) { c.fillStyle = col.axis; c.fillText(b.label, Math.min(xa, xb) + 4, Math.min(ya, yb) + 12); } }
    c.restore();
    // grid + ticks
    c.strokeStyle = col.grid; c.fillStyle = col.axis; c.lineWidth = 1;
    const xt = this.ticks(X, x0, x1), yt = this.ticks(Y, y0, y1);
    c.textAlign = 'center';
    for (const [v, lab, major] of xt) { const p = fx(v); c.globalAlpha = major ? 1 : 0.45; c.beginPath(); c.moveTo(p, T); c.lineTo(p, T + ph); c.stroke(); c.globalAlpha = 1; if (lab) c.fillText(lab, p, T + ph + 15); }
    c.textAlign = 'right';
    for (const [v, lab, major] of yt) { const p = fy(v); c.globalAlpha = major ? 1 : 0.45; c.beginPath(); c.moveTo(L, p); c.lineTo(L + pw, p); c.stroke(); c.globalAlpha = 1; if (lab) c.fillText(lab, L - 6, p + 4); }
    c.textAlign = 'center'; c.fillStyle = col.axis;
    if (X.label) c.fillText(X.label, L + pw / 2, H - 6);
    if (Y.label) { c.save(); c.translate(13, T + ph / 2); c.rotate(-Math.PI / 2); c.fillText(Y.label, 0, 0); c.restore(); }
    c.textAlign = 'left';
    c.save(); c.beginPath(); c.rect(L, T, pw, ph); c.clip();
    for (const l of d.hlines || []) { c.strokeStyle = l.color || col.axis; c.setLineDash(l.dash || [4, 4]); c.beginPath(); c.moveTo(L, fy(l.y)); c.lineTo(L + pw, fy(l.y)); c.stroke(); c.setLineDash([]); if (l.label) { c.fillStyle = l.color || col.axis; c.fillText(l.label, L + pw - c.measureText(l.label).width - 6, fy(l.y) - 4); } }
    for (const l of d.vlines || []) { const p = fx(l.x); c.strokeStyle = l.color || col.axis; c.setLineDash(l.dash || [4, 4]); c.beginPath(); c.moveTo(p, T); c.lineTo(p, T + ph); c.stroke(); c.setLineDash([]); if (l.label) { c.fillStyle = l.color || col.axis; c.save(); c.translate(p + 4, T + 6 + (l.dy || 0)); c.fillText(l.label, 0, 8); c.restore(); } }
    // series
    for (const s of d.series) {
      if (this.hidden.has(s.name)) continue;
      c.strokeStyle = s.color; c.fillStyle = s.color; c.lineWidth = s.width || 1.8; c.setLineDash(s.dash || []);
      if (s.points) { for (let i = 0; i < s.x.length; i++) { const a = s.x[i], b = s.y[i]; if (!isFinite(a) || !isFinite(b) || (Y.log && b <= 0)) continue; c.beginPath(); c.arc(fx(a), fy(b), s.r || 3, 0, 7); c.fill(); } continue; }
      c.beginPath(); let pen = false;
      for (let i = 0; i < s.x.length; i++) {
        const a = s.x[i], b = s.y[i];
        if (!isFinite(a) || !isFinite(b) || (X.log && a <= 0) || (Y.log && b <= 0)) { pen = false; continue; }
        const px = fx(a), py = Math.max(-1e4, Math.min(1e4, fy(b)));
        if (pen) c.lineTo(px, py); else { c.moveTo(px, py); pen = true; }
      }
      c.stroke(); c.setLineDash([]);
      if (s.fill) { c.globalAlpha = 0.12; c.lineTo(fx(s.x[s.x.length - 1]), T + ph); c.lineTo(fx(s.x[0]), T + ph); c.closePath(); c.fill(); c.globalAlpha = 1; }
    }
    for (const p of d.dots || []) { c.fillStyle = p.color; c.beginPath(); c.arc(fx(p.x), fy(p.y), p.r || 4, 0, 7); c.fill(); if (p.ring) { c.strokeStyle = p.color; c.lineWidth = 1.5; c.beginPath(); c.arc(fx(p.x), fy(p.y), (p.r || 4) + 4, 0, 7); c.stroke(); } if (p.label) { c.fillStyle = col.text; c.fillText(p.label, fx(p.x) + 8, fy(p.y) - 6); } }
    c.restore();
    c.strokeStyle = col.grid; c.strokeRect(L + 0.5, T + 0.5, pw, ph);
    // hover readout
    if (this.hover) {
      const [hx, hy] = this.hover;
      if (hx >= L && hx <= L + pw && hy >= T && hy <= T + ph) {
        let best = null;
        for (const s of d.series) {
          if (this.hidden.has(s.name) || !s.name) continue;
          for (let i = 0; i < s.x.length; i++) {
            const a = s.x[i], b = s.y[i];
            if (!isFinite(a) || !isFinite(b) || (X.log && a <= 0) || (Y.log && b <= 0)) continue;
            const dx = fx(a) - hx, dy = fy(b) - hy, dd = dx * dx + dy * dy;
            if (!best || dd < best.dd) best = { dd, a, b, s };
          }
        }
        c.strokeStyle = col.axis; c.globalAlpha = 0.5; c.beginPath(); c.moveTo(hx, T); c.lineTo(hx, T + ph); c.stroke(); c.globalAlpha = 1;
        if (best && best.dd < 900) {
          c.fillStyle = best.s.color; c.beginPath(); c.arc(fx(best.a), fy(best.b), 4.5, 0, 7); c.fill();
          this.tip.style.display = 'block';
          this.tip.innerHTML = `<b style="color:${best.s.color}">${best.s.name}</b><br>${X.short || 'x'} = ${(X.fmt || fmtNum)(best.a)}<br>${Y.short || 'y'} = ${(Y.fmt || fmtNum)(best.b)}`;
        } else {
          this.tip.style.display = 'block';
          this.tip.innerHTML = `${X.short || 'x'} = ${(X.fmt || fmtNum)(ix(hx))}`;
        }
        const tw = this.tip.offsetWidth;
        this.tip.style.left = Math.min(hx + 12, W - tw - 4) + 'px'; this.tip.style.top = Math.max(hy - 50, 2) + 'px';
      } else this.tip.style.display = 'none';
    }
  }
  ticks(ax, lo, hi) {
    const out = [];
    if (ax.log) {
      const a = Math.floor(Math.log10(lo) + 1e-9), b = Math.ceil(Math.log10(hi) - 1e-9), span = b - a;
      const step = Math.max(1, Math.ceil(span / 9));
      for (let e = a; e <= b; e++) {
        const v = Math.pow(10, e);
        if (v >= lo * 0.999 && v <= hi * 1.001) out.push([v, (e - a) % step === 0 ? (ax.tick ? ax.tick(v) : tickLog(e)) : '', (e - a) % step === 0]);
        if (span <= 4) for (let m = 2; m <= 9; m++) { const w = m * v; if (w > lo && w < hi) out.push([w, span <= 1 && (m === 2 || m === 5) ? fmtNum(w) : '', false]); }
      }
    } else {
      const st = niceStep(hi - lo, ax.nticks || 6);
      for (let v = Math.ceil(lo / st) * st; v <= hi + st * 1e-6; v += st) out.push([v, ax.tick ? ax.tick(v) : fmtNum(Math.abs(v) < st * 1e-6 ? 0 : v, 4), true]);
    }
    return out;
  }
  csv() {
    const d = this.d; if (!d) return '';
    const lines = [];
    for (const s of d.series) {
      if (!s.name) continue;
      lines.push(`# ${s.name}`); lines.push(`${d.x.short || 'x'},${d.y.short || 'y'}`);
      for (let i = 0; i < s.x.length; i++) lines.push(`${s.x[i]},${s.y[i]}`);
    }
    return lines.join('\n');
  }
}
window.Plot = Plot; window.fmtNum = fmtNum; window.supStr = sup;
})();
