/* GENESIS — extended laboratory UI: CMB power spectrum, inflaton dynamics, beyond-WIMP dark matter,
 * the lithium problem, neutrinos, relics (phase transitions, defects, primordial black holes), data fits
 * and the Hubble tension, research tools (compare, sensitivity, fine-tuning, exports), lectures,
 * challenges, narration and the AI physicist. Physics lives in physics.js / physics-ext.js. */
(function () {
'use strict';
const G = window.GEN, GP = window.GP, GX = window.GX;
if (!G || !GX) { console.warn('GENESIS extensions unavailable'); return; }
const { $, $$, fmt, fmtT, fmtK, fmtTime, fmtLen, fmtIn, stat, plot, clamp, toast, nbAdd, texN } = G;
const L10 = Math.log10, EXT = G.EXT;
const cacheMap = new WeakMap();
const cached = (R, key, fn) => { if (!R) return null; let m = cacheMap.get(R); if (!m) { m = {}; cacheMap.set(R, m); } if (!(key in m)) { try { m[key] = fn(R); } catch (e) { console.warn(key, e); m[key] = null; } } return m[key]; };
const cmbOf = R => cached(R, 'cmb', r => GX.cmbSpectrum(r));
const infOf = R => cached(R, 'inf', r => GX.inflatonRun(r));
const tick = () => new Promise(r => setTimeout(r, 0));
const esc = s => String(s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]);
function download(name, text, type) { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type: type || 'text/plain' })); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1500); }
function csv(id) { const p = G.plots[id]; if (p) download('genesis-' + id.replace('c-', '') + '.csv', p.csv(), 'text/csv'); }

// a slider bound to local state (for tools whose inputs are not cosmological parameters)
function slider(parent, o) {
  const d = document.createElement('div'); d.className = 'ctl';
  d.innerHTML = `<div class="row1"><label>${o.label}${o.unit ? `<span class="unit">${o.unit}</span>` : ''}</label><input type="text" spellcheck="false"></div><input type="range" min="0" max="1000">${o.help ? `<div class="help">${o.help}</div>` : ''}`;
  const num = d.querySelector('input[type=text]'), rng = d.querySelector('input[type=range]');
  const toP = v => o.log ? (L10(Math.max(v, o.min)) - L10(o.min)) / (L10(o.max) - L10(o.min)) * 1000 : (v - o.min) / (o.max - o.min) * 1000;
  const fromP = p => o.log ? Math.pow(10, L10(o.min) + p / 1000 * (L10(o.max) - L10(o.min))) : o.min + p / 1000 * (o.max - o.min);
  const set = (v, fire) => { o.value = v; if (document.activeElement !== num) num.value = fmtIn(v); rng.value = clamp(toP(v), 0, 1000); G.paintRange(rng); if (fire) o.onInput(v); };
  rng.oninput = () => set(parseFloat(fromP(+rng.value).toPrecision(4)), true);
  num.onchange = () => { const v = parseFloat(num.value); if (isFinite(v) && (!o.log || v > 0)) set(v, true); else set(o.value); };
  set(o.value); parent.append(d);
  return { set, get: () => o.value, el: d };
}
function addPanel(sectionTab, html, pos, id) {
  if (id && document.getElementById(id)) return document.getElementById(id);
  const stack = $(`section[data-tab="${sectionTab}"] .stack`) || $(`section[data-tab="${sectionTab}"]`);
  const p = document.createElement('div'); p.className = 'panel'; if (id) p.id = id; p.innerHTML = html;
  const ref = pos === undefined ? null : stack.children[pos] || null;
  stack.insertBefore(p, ref);
  return p;
}
const refCurves = { // approximate detector sensitivities, Ω_GW h²
  LISA: { f0: 3e-3, O0: 2e-13, lo: 2e-5, hi: 0.5, a1: 3.5, a2: 2 }, 'BBO/DECIGO': { f0: 0.3, O0: 2e-17, lo: 1e-3, hi: 20, a1: 4, a2: 2 },
  'Einstein Tel./Cosmic Expl.': { f0: 20, O0: 2e-12, lo: 3, hi: 3000, a1: 4, a2: 2 }, 'LIGO-Virgo O3 limit': { f0: 25, O0: 1.2e-8, lo: 12, hi: 1500, a1: 3, a2: 2.5 },
};
const detAt = (c, f) => (f < c.lo || f > c.hi) ? Infinity : c.O0 * 0.5 * (Math.pow(f / c.f0, -c.a1) + Math.pow(f / c.f0, c.a2));
function detSeries() {
  const cols = { LISA: '#7cc4ff', 'BBO/DECIGO': '#5ef0a8', 'Einstein Tel./Cosmic Expl.': '#ffb86b', 'LIGO-Virgo O3 limit': '#ff9aa6' };
  return Object.entries(refCurves).map(([n, c]) => { const X = [], Y = []; for (let l = L10(c.lo); l <= L10(c.hi) + 1e-9; l += 0.05) { const f = Math.pow(10, l); X.push(f); Y.push(detAt(c, f)); } return { name: n + ' (approx.)', x: X, y: Y, color: cols[n], dash: [4, 4], width: 1.2 }; });
}

/* ============================================================ 1 · CMB power spectrum */
EXT.after.cmb = () => {
  const pnl = addPanel('cmb', `<div class="ph"><h3>CMB temperature power spectrum D<sub>ℓ</sub> = ℓ(ℓ+1)C<sub>ℓ</sub>/2π</h3><div class="tools"><button class="btn tiny" id="cl-csv">CSV</button></div></div><div class="chart tall" id="c-cl"></div><div id="cl-peaks" style="margin-top:8px"></div>
    <p class="muted" style="font-size:12px;margin-bottom:0">Semi-analytic acoustic model — radiation driving, baryon loading R, Silk damping integrated through this universe’s recombination, projection onto the sky and lensing smoothing — calibrated once so standard ΛCDM matches Planck (peak positions ≲2%, heights ≲15%). Every change from there is physical. Omits the integrated Sachs–Wolfe effect (low-ℓ plateau is low) and polarisation. Orange dots: approximate Planck 2018 best-fit peaks and troughs.</p>`, 2, 'cl-panel');
  $('#cl-csv', pnl).onclick = () => csv('c-cl');
  const c = cmbOf(G.R), b = cmbOf(G.BASE), pin = G.PIN ? cmbOf(G.PIN) : null;
  if (!c) { $('#cl-peaks').innerHTML = '<p class="muted">No last-scattering surface in this universe — there are no acoustic peaks to show.</p>'; plot('c-cl', 'tall').set({ x: { min: 2, max: 2500, label: 'multipole ℓ' }, y: { min: 0, max: 7000, label: 'D_ℓ [μK²]' }, series: [] }); return; }
  const ser = [{ name: 'this universe', x: c.ells, y: c.Dl, color: '#ff7a8c', width: 2.4 }, { name: 'standard ΛCDM', x: b.ells, y: b.Dl, color: '#6d74a8', dash: [4, 4], width: 1.3 }];
  if (pin) ser.push({ name: 'pinned universe', x: pin.ells, y: pin.Dl, color: '#ffd66b', dash: [2, 3], width: 1.3 });
  const ymax = Math.max(6500, ...c.Dl) * 1.05;
  plot('c-cl', 'tall').set({ x: { min: 2, max: 2500, label: 'multipole ℓ  (angular scale ≈ 180°/ℓ)', short: 'ℓ' }, y: { min: 0, max: ymax, label: 'D_ℓ [μK²]', short: 'D_ℓ' }, series: ser,
    dots: GX.PLANCK_TT.map(([l, D]) => ({ x: l, y: D, color: '#ffb86b', r: 3.5 })), vlines: [{ x: c.ellA, label: 'ℓ_A = πD/r_s', color: '#5a6190' }, { x: c.lD, label: 'damping ℓ_D', color: '#5a6190', dy: 14 }] });
  const rows = c.peaks.slice(0, 5).map((p, i) => { const q = b.peaks[i]; return `<tr><td>peak ${i + 1}</td><td class="n">${p.l}</td><td class="n">${fmt(p.D, 4)}</td><td class="n muted">${q ? q.l : '—'}</td><td class="n muted">${q ? fmt(q.D, 4) : '—'}</td></tr>`; }).join('');
  $('#cl-peaks').innerHTML = `<div class="grid2"><table class="t"><tr><th></th><th>ℓ</th><th>D<sub>ℓ</sub> [μK²]</th><th>ΛCDM ℓ</th><th>ΛCDM D<sub>ℓ</sub></th></tr>${rows}</table>
    <div class="stats">${stat('Odd/even contrast D₁/D₂', c.peaks[1] ? c.peaks[0].D / c.peaks[1].D : NaN, { key: r => { const s = cmbOf(r); return s && s.peaks[1] ? s.peaks[0].D / s.peaks[1].D : NaN; }, note: 'baryon loading R* = ' + fmt(c.Rs, 3) })}
    ${stat('Acoustic multipole ℓ_A', c.ellA, { d: 4, note: 'πD_M/r_s' })}${stat('Damping multipole ℓ_D', c.lD, { d: 4, note: 'k_D D_M (Silk)' })}${stat('Damping/sound ratio', c.lD / c.ellA, { d: 3, note: 'the N_eff probe' })}</div></div>`;
};

/* ============================================================ 3 · inflaton dynamics */
let infAnim = null;
EXT.after.inflation = () => {
  const pnl = addPanel('inflation', `<div class="ph"><h3>Watch the inflaton roll</h3><div class="tools"><button class="btn tiny primary" id="inf-play">▶ Inflate</button></div></div>
    <div class="grid2"><canvas id="inf-anim" style="width:100%;height:260px;display:block;border-radius:10px;background:#05060d"></canvas><div class="stats" id="s-inf2"></div></div>`, 1, 'inf-panel');
  addPanel('inflation', `<div class="ph"><h3>The comoving Hubble radius — how modes leave and re-enter the horizon</h3><div class="tools"><button class="btn tiny" id="hor-csv">CSV</button></div></div><div class="chart tall" id="c-hor"></div>
    <p class="muted" style="font-size:12px;margin-bottom:0">log₁₀ of 1/(aH) in comoving Mpc against the scale factor. During inflation the comoving Hubble radius <b>shrinks</b>, so fixed comoving scales (horizontal lines) cross outside and freeze; after inflation it grows again and they re-enter — first small scales, the largest last. Reheating (matter-like, a ∝ H<sup>−2/3</sup>) joins inflation to the hot Big Bang at T<sub>rh</sub>, so the reheating temperature shifts how many e-folds before the end the CMB scale left the horizon.</p>`, 3, 'hor-panel');
  $('#hor-csv').onclick = () => csv('c-hor');
  $('#inf-play').onclick = () => playInflaton();
  const I = infOf(G.R), inf = G.R.inf;
  if (!I) return;
  $('#s-inf2').innerHTML = [
    stat('Numerical n<sub>s</sub> (exact background)', I.nsNum, { d: 4, note: 'slow-roll formula ' + fmt(inf.ns, 4) }),
    stat('Numerical r', I.rNum, { d: 3, note: 'slow-roll formula ' + fmt(inf.r, 3) }),
    stat('Pivot scale left the horizon', I.NexitPivot !== null ? fmt(I.NexitPivot, 3) + ' e-folds before the end' : '—', { hl: 1, note: `slider assumes N* = ${fmt(G.P.Ne, 3)} — self-consistent with T_rh = ${fmtT(G.P.T_rh)}` }),
    stat('Today’s horizon scale left at', I.NexitHorizon !== null ? fmt(I.NexitHorizon, 3) + ' e-folds' : '—', { note: 'minimum inflation needed' }),
    stat('H at the pivot / at the end', `${fmt(I.Hst, 2)} / ${fmt(I.Hend, 2)} GeV`, {}),
    stat('Inflaton decay rate Γ ≈ H(T_rh)', fmt(I.Gamma, 2) + ' GeV', { note: I.reheatOK ? 'lifetime ' + fmtTime(6.582e-25 / I.Gamma) : 'T_rh too high for this model!' }),
  ].join('');
  // comoving Hubble radius diagram
  const cv = I.curve, ph = [[], [], []];
  cv.lnA.forEach((la, i) => ph[cv.phase[i]].push([la / Math.LN10, cv.lrH[i]]));
  const ser = [['inflation', '#c792ea'], ['reheating', '#ffb86b'], ['hot Big Bang (radiation → matter → Λ)', '#7cc4ff']].map(([n, col], i) => ({ name: n, x: ph[i].map(p => p[0]), y: ph[i].map(p => p[1]), color: col, width: 2.4 }));
  const la0 = Math.min(...cv.lnA) / Math.LN10;
  plot('c-hor', 'tall').set({ x: { min: la0, max: 0.3, label: 'log₁₀ a  (today = 0)', short: 'log a' }, y: { label: 'log₁₀ [1/(aH)]  (comoving Mpc)', short: 'log r_H' }, series: ser,
    hlines: [{ y: L10(1 / 0.05), label: 'CMB pivot scale (20 Mpc)', color: '#ff7a8c' }, { y: 0, label: 'galaxy scale (1 Mpc)', color: '#5ef0a8' }, { y: L10(GP.U.cH100 / G.R.cp.h), label: 'today’s Hubble radius', color: '#ffd66b' }] });
  drawInflaton(I, null);
};
function drawInflaton(I, prog) {
  const cv = $('#inf-anim'); if (!cv || !cv.clientWidth) return;
  const W = cv.clientWidth, H = cv.clientHeight, dpr = Math.min(window.devicePixelRatio || 1, 2);
  cv.width = W * dpr; cv.height = H * dpr; const c = cv.getContext('2d'); c.setTransform(dpr, 0, 0, dpr, 0, 0);
  c.fillStyle = '#05060d'; c.fillRect(0, 0, W, H);
  const phis = I.phi, pmin = Math.min(...phis, 0), pmax = Math.max(...phis);
  const lo = G.P.inf_model === 'hilltop' ? pmin - 0.5 : -0.25 * pmax, hi = G.P.inf_model === 'hilltop' ? pmax + 1.2 : pmax * 1.05;
  const Vs = []; for (let i = 0; i <= 200; i++) { const p = lo + (hi - lo) * i / 200; Vs.push([p, I.V(p)]); }
  const vmax = Math.max(...Vs.map(v => v[1]).filter(isFinite)), vmin = Math.min(0, ...Vs.map(v => v[1]).filter(isFinite));
  const X = p => 20 + (p - lo) / (hi - lo) * (W - 40), Y = v => H - 34 - (v - vmin) / (vmax - vmin) * (H - 70);
  c.strokeStyle = '#c792ea'; c.lineWidth = 2; c.beginPath(); Vs.forEach(([p, v], i) => { const y = Y(clamp(v, vmin, vmax)); i ? c.lineTo(X(p), y) : c.moveTo(X(p), y); }); c.stroke();
  c.fillStyle = '#8990b9'; c.font = '11px Inter'; c.fillText('V(φ) = ' + I.label, 20, 16); c.fillText('φ / M_Pl →', W - 80, H - 10);
  // mark pivot and end
  const pe = phis[phis.length - 1];
  [[I.pst, '#ff7a8c', 'CMB scales exit'], [pe, '#ffb86b', 'inflation ends (ε = 1)']].forEach(([p, col, t], j) => { c.fillStyle = col; c.beginPath(); c.arc(X(p), Y(I.V(p)), 3.5, 0, 7); c.fill(); c.fillText(t, X(p) + 6, Y(I.V(p)) - 6 - 12 * j); });
  if (prog) {
    let p, v, lbl;
    if (prog.phase === 'inflate') { p = GP.lerp(I.N, phis, prog.N); v = I.V(p); lbl = `N = ${prog.N.toFixed(1)} e-folds · ε = ${fmt(GP.lerp(I.N, I.eps, prog.N), 2)} · universe ×e^${prog.N.toFixed(0)}`; }
    else { const amp = Math.abs(pe) * Math.exp(-prog.t * 0.6); p = (G.P.inf_model === 'hilltop' ? 10 : 0) + amp * Math.cos(prog.t * 6); v = I.V(p); lbl = 'reheating: the inflaton oscillates and decays into the hot plasma'; }
    const g = c.createRadialGradient(X(p), Y(v) - 8, 0, X(p), Y(v) - 8, 16); g.addColorStop(0, '#fff6d5'); g.addColorStop(1, 'rgba(255,184,107,0)');
    c.fillStyle = g; c.beginPath(); c.arc(X(p), Y(v) - 8, 16, 0, 7); c.fill();
    c.fillStyle = '#fff'; c.font = '600 12px Inter'; c.fillText(lbl, 20, 34);
    if (prog.phase === 'reheat') { c.fillStyle = `rgba(255,140,60,${Math.min(0.35, prog.t * 0.08)})`; c.fillRect(0, 0, W, H); }
  }
}
function playInflaton() {
  const I = infOf(G.R); if (!I) return;
  if (infAnim) { cancelAnimationFrame(infAnim); infAnim = null; }
  const t0 = performance.now(), T1 = 6000, T2 = 3500;
  const step = now => {
    const t = now - t0;
    if (t < T1) drawInflaton(I, { phase: 'inflate', N: I.Nend * (t / T1) });
    else if (t < T1 + T2) drawInflaton(I, { phase: 'reheat', t: (t - T1) / 1000 });
    else { drawInflaton(I, null); infAnim = null; return; }
    infAnim = requestAnimationFrame(step);
  };
  infAnim = requestAnimationFrame(step);
}

/* ============================================================ 7 · beyond-WIMP dark matter */
Object.assign(G.C, {
  dm_mode: { l: 'Dark-matter candidate', sel: [['wimp', 'WIMP — thermal freeze-out'], ['freezein', 'Feebly coupled — freeze-in'], ['axion', 'QCD axion — misalignment'], ['adm', 'Asymmetric DM — shares the baryon asymmetry']] },
  fi_m: { l: 'Freeze-in DM mass m<sub>χ</sub>', u: 'GeV', min: 1e-6, max: 1e3, log: 1 },
  fi_mB: { l: 'Parent (bath) particle mass m<sub>B</sub>', u: 'GeV', min: 1, max: 1e6, log: 1 },
  fi_lambda: { l: 'Feeble coupling λ', min: 1e-14, max: 1e-5, log: 1, h: 'B → χ + SM with Γ = λ² m_B / 8π' },
  ax_fa: { l: 'Axion decay constant f<sub>a</sub>', u: 'GeV', min: 1e9, max: 1e17, log: 1 },
  ax_theta: { l: 'Initial misalignment angle θ<sub>i</sub>', min: 1e-3, max: 3.1, log: 1, h: 'Only matters if the PQ symmetry broke before inflation' },
  adm_m: { l: 'ADM particle mass', u: 'GeV', min: 0.1, max: 100, log: 1 },
  adm_ratio: { l: 'Asymmetry ratio η<sub>χ</sub>/η<sub>b</sub>', min: 0.01, max: 100, log: 1 },
  li_depl: { l: 'Stellar lithium depletion factor', min: 1, max: 10, log: 1, h: 'Astrophysical explanation: stars destroyed primordial ⁷Li' },
});
const DM_KEYS = { wimp: ['m_dm', 'sv', 'sv_b', 'g_dm'], freezein: ['fi_m', 'fi_mB', 'fi_lambda'], axion: ['ax_fa', 'ax_theta'], adm: ['adm_m', 'adm_ratio'] };
EXT.after.dm = () => {
  const cp = $('section[data-tab="dm"] .ctrlpanel');
  if (!$('#dm-mode-box')) {
    const box = document.createElement('div'); box.id = 'dm-mode-box';
    box.innerHTML = '<h3>Candidate</h3>';
    box.append(G.buildCtl('dm_mode'));
    ['fi_m', 'fi_mB', 'fi_lambda', 'ax_fa', 'ax_theta', 'adm_m', 'adm_ratio'].forEach(k => { const el = G.buildCtl(k); el.dataset.dmk = k; box.append(el); });
    cp.insertBefore(box, cp.firstChild);
    G.render();
    return;
  }
  const mode = G.P.dm_mode;
  $$('[data-dmk]').forEach(el => { el.style.display = DM_KEYS[mode].includes(el.dataset.dmk) ? '' : 'none'; });
  $$('.ctrls[data-c="m_dm,sv,sv_b,g_dm,T_rh"] .ctl', $('section[data-tab="dm"]')).forEach((el, i) => { if (i < 4) el.style.display = mode === 'wimp' ? '' : 'none'; });
  const alt = G.R.dmAlt;
  const pnl = addPanel('dm', '<h3 id="alt-h"></h3><div class="stats" id="s-dmalt"></div>', 1, 'dmalt-panel');
  if (!alt) return;
  let h = '', s = '';
  if (mode === 'wimp') { h = 'The WIMP (charts below)'; s = [stat('Freeze-in alternative gives', alt.fi.omegah2, { note: 'with its current settings' }), stat('Axion alternative gives', alt.ax.omegah2, {}), stat('ADM alternative gives', alt.adm.omegah2, {})].join(''); }
  if (mode === 'freezein') { h = 'Freeze-in: never in equilibrium, slowly produced by decays of a bath particle'; s = [stat('Relic density Ω<sub>χ</sub>h²', alt.fi.omegah2, { obs: G.OBS.omega_c, hl: 1, key: r => r.dmAlt ? r.dmAlt.fi.omegah2 : NaN }), stat('Decay width Γ<sub>B→χ</sub>', fmt(alt.fi.Gamma, 2) + ' GeV', {}), stat('Coupling for Ωh² = 0.12', alt.fi.lambdaNeeded, { note: 'freeze-in needs λ ~ 10⁻¹²–10⁻⁸: "feebly" coupled' }), stat('Produced mostly at', fmtT(G.P.fi_mB / 3), { note: 'T ≈ m_B/3, IR-dominated' })].join(''); }
  if (mode === 'axion') { h = 'QCD axion: a coherent field frozen until H ≈ m_a, then oscillating as cold matter'; s = [stat('Relic density Ω<sub>a</sub>h²', alt.ax.omegah2, { obs: G.OBS.omega_c, hl: 1 }), stat('Axion mass', fmt(alt.ax.ma_ueV, 3) + ' μeV', { note: 'm_a ≈ 5.7 μeV (10¹² GeV/f_a)' }), stat('PQ symmetry broken', alt.ax.pre ? 'before inflation' : 'after inflation', { note: alt.ax.pre ? 'one θ_i for the whole universe' : '⟨θ²⟩ = π²/3 averaged over patches (+ strings, not modelled)' }), stat('Isocurvature β<sub>iso</sub>', alt.ax.pre ? alt.ax.betaIso : 0, { note: alt.ax.isoOK ? 'within Planck bound 0.038' : 'EXCLUDED by Planck (β < 0.038): inflation too energetic', hl: !alt.ax.isoOK })].join(''); }
  if (mode === 'adm') { h = 'Asymmetric DM: the same asymmetry that made baryons made dark matter'; s = [stat('Relic density Ω<sub>χ</sub>h²', alt.adm.omegah2, { obs: G.OBS.omega_c, hl: 1 }), stat('Mass needed for Ω<sub>c</sub>/Ω<sub>b</sub> = 5.4', fmt(alt.adm.mNeeded, 3) + ' GeV', { note: 'explains why Ω_c and Ω_b are comparable' })].join(''); }
  $('#alt-h', pnl).textContent = h; $('#s-dmalt', pnl).innerHTML = s;
};

/* ============================================================ 10 · the lithium problem */
const LI_RATES = [[9, '⁷Be(n,p)⁷Li', 'destroys ⁷Be (most ⁷Li is made as ⁷Be)'], [8, '³He(α,γ)⁷Be', 'makes ⁷Be'], [10, '⁷Li(p,α)α', 'destroys ⁷Li'], [1, 'D(p,γ)³He', 'burns deuterium'], [2, 'D(d,n)³He', 'burns deuterium']];
EXT.after.bbn = () => {
  const pnl = addPanel('bbn', `<div class="ph"><h3>The lithium problem</h3><button class="btn tiny" id="li-reset">Reset rates</button></div>
    <p class="muted" style="font-size:12.5px">BBN predicts ⁷Li/H ≈ 5×10⁻¹⁰, but old halo stars show ≈ 1.6×10⁻¹⁰ — a factor ~3. Try a nuclear fix (a missed resonance changing a rate), an astrophysical fix (stars depleted lithium) or new physics (η, N<sub>eff</sub>, varying constants) — without spoiling deuterium, which agrees beautifully.</p>
    <div class="grid2"><div id="li-ctrls"></div><div><div class="stats" id="s-li"></div><ul class="notes" id="li-verdict" style="margin-top:8px"></ul></div></div>`, undefined, 'li-panel');
  if (!pnl.dataset.built) {
    pnl.dataset.built = 1;
    const box = $('#li-ctrls', pnl);
    LI_RATES.forEach(([r, name, what]) => slider(box, { label: name + ' rate ×', min: 0.1, max: 30, log: 1, value: (G.P.bbn_mul && G.P.bbn_mul[r]) || 1, help: what, onInput: v => { G.P.bbn_mul = Object.assign({}, G.P.bbn_mul, { [r]: Math.abs(v - 1) < 0.01 ? 1 : v }); G.changed(); } }).el.dataset.rate = r);
    box.append(G.buildCtl('li_depl'));
    $('#li-reset', pnl).onclick = () => { G.P.bbn_mul = {}; G.P.li_depl = 1; pnl.dataset.built = ''; pnl.remove(); G.compute(); };
  }
  const nb = G.R.nuc, liSeen = nb.Li7H / G.P.li_depl, dh = nb.DH / G.BASE.nuc.DH * 2.51e-5;
  $('#s-li', pnl).innerHTML = [stat('Primordial ⁷Li/H', nb.Li7H, { key: r => r.nuc.Li7H }), stat('What stars should show today', liSeen, { obs: G.OBS.Li7H, hl: 1 }), stat('D/H (calibrated)', dh, { obs: [2.527e-5, 0.075e-5] }), stat('Y<sub>p</sub>', nb.Yp, { obs: G.OBS.Yp, d: 4 })].join('');
  const liOK = Math.abs(liSeen - 1.6e-10) < 2 * 0.3e-10, dOK = Math.abs(dh - 2.527e-5) < 2 * 0.075e-5, yOK = Math.abs(nb.Yp - 0.245) < 0.006;
  $('#li-verdict', pnl).innerHTML = `<li class="${liOK ? 'good' : 'bad'}">Lithium ${liOK ? 'matches' : 'does not match'} the halo-star plateau.</li><li class="${dOK ? 'good' : 'bad'}">Deuterium ${dOK ? 'still agrees' : 'is spoiled'} (the precision test of BBN).</li><li class="${yOK ? 'good' : 'warn'}">Helium ${yOK ? 'fine' : 'off'}.</li>` + (liOK && dOK && yOK ? `<li class="good"><b>Solved in this universe.</b> ${G.P.li_depl > 1.01 ? 'Stellar depletion by ×' + fmt(G.P.li_depl, 3) + ' — plausible but hard to make uniform across stars.' : 'A nuclear fix — dedicated experiments have searched for such resonances and so far excluded them.'}</li>` : '');
};

/* ============================================================ 2 · neutrinos */
const NU = { hier: 'normal', ml: 0.0, ms: 7.1, s2: 3e-11, scanKey: null, scan: null };
let nuBuilt = false;
EXT.render.nu = () => {
  if (!nuBuilt) {
    nuBuilt = true;
    const mlR = $('#nu-ml'), mlN = $('#nu-ml-num');
    const toP = v => v <= 1e-4 ? 0 : (L10(v) + 4) / (L10(0.3) + 4) * 1000, fromP = p => p <= 0 ? 0 : Math.pow(10, -4 + p / 1000 * (L10(0.3) + 4));
    const setMl = v => { NU.ml = v; mlR.value = toP(v); G.paintRange(mlR); mlN.value = fmtIn(v); applyNu(); };
    mlR.oninput = () => setMl(parseFloat(fromP(+mlR.value).toPrecision(3)));
    mlN.onchange = () => { const v = parseFloat(mlN.value); if (isFinite(v) && v >= 0) setMl(v); };
    $('#nu-hier').onchange = e => { NU.hier = e.target.value; applyNu(); };
    const sterBox = (idR, idN, lo, hi, key) => { const r = $(idR), n = $(idN); const toQ = v => (L10(v) - L10(lo)) / (L10(hi) - L10(lo)) * 1000, fromQ = q => Math.pow(10, L10(lo) + q / 1000 * (L10(hi) - L10(lo))); const set = v => { NU[key] = v; r.value = toQ(v); G.paintRange(r); n.value = fmtIn(v); renderNu(); }; r.oninput = () => set(parseFloat(fromQ(+r.value).toPrecision(3))); n.onchange = () => { const v = parseFloat(n.value); if (v > 0) set(v); }; set(NU[key]); };
    sterBox('#st-ms', '#st-ms-num', 1, 100, 'ms'); sterBox('#st-s2', '#st-s2-num', 1e-14, 1e-6, 's2');
    $('#st-use').onclick = () => { const O = GX.dodelsonWidrow(NU.ms, NU.s2), mth = Math.pow(NU.ms / 4.43, 0.75); G.set({ link_dm: false, omega_c: O, m_wdm: parseFloat(mth.toPrecision(3)) }); toast(`Sterile ν (m = ${fmt(NU.ms, 3)} keV) is now the dark matter: Ω_c h² = ${fmt(O, 3)}, warm as a ${fmt(mth, 2)} keV thermal relic`); nbAdd('run', 'Sterile neutrino as dark matter', `m_s = ${fmt(NU.ms, 3)} keV, sin²2θ = ${fmt(NU.s2, 2)}`); };
    // adopt the current universe instead of imposing defaults: visiting a tab never changes the physics
    const nm = G.P.nu_masses || [];
    if (nm.length === 3) { NU.hier = nm[2] < nm[0] ? 'inverted' : 'normal'; NU.ml = Math.min(...nm); } else NU.hier = 'degenerate';
    $('#nu-hier').value = NU.hier; mlR.value = toP(NU.ml); G.paintRange(mlR); mlN.value = fmtIn(NU.ml);
    $('#nu-ml').closest('.ctl').classList.toggle('dis', NU.hier === 'degenerate');
  }
  renderNu();
};
function applyNu() {
  $('#nu-ml').closest('.ctl').classList.toggle('dis', NU.hier === 'degenerate');
  if (NU.hier === 'degenerate') { if ((G.P.nu_masses || []).length) G.set({ nu_masses: [] }); else renderNu(); return; }
  const m = GX.nuMasses(NU.hier, NU.ml), sum = m.reduce((a, b) => a + b);
  G.set({ nu_masses: m, mnu: parseFloat(sum.toPrecision(4)) });
}
function renderNu() {
  const R = G.R, nu = GX.neutrinos(R), heavy = nu.per.reduce((a, b) => (a.m > b.m ? a : b));
  const O = GX.dodelsonWidrow(NU.ms, NU.s2);
  $('#s-nu').innerHTML = [
    stat('Cosmic neutrino background T<sub>ν</sub>', fmt(nu.TnuK, 4) + ' K', { hl: 1, note: '(4/11)^⅓ T_γ — cooler, e⁺e⁻ heated only photons' }),
    stat('Relic neutrinos', fmt(nu.nTotal, 3) + ' cm⁻³', { note: fmt(nu.nPerFlavour, 3) + ' per flavour (ν+ν̄)' }),
    stat('Σm<sub>ν</sub>', fmt(G.P.mnu, 3) + ' eV', { note: `min ${fmt(nu.minNO, 3)} (NO) / ${fmt(nu.minIO, 3)} (IO) · Planck+BAO < 0.12`, hl: G.P.mnu > 0.12 }),
    stat('Masses m₁, m₂, m₃', nu.per.map(p => fmt(p.m, 2)).join(', ') + ' eV', {}),
    stat('Heaviest becomes non-relativistic at', heavy.znr > 0 ? 'z ≈ ' + fmt(heavy.znr, 3) : 'never', { note: heavy.m > 0 ? 'typical speed today ' + fmt(heavy.v, 3) + ' km/s' : '' }),
    stat('Neutrino fraction of matter f<sub>ν</sub>', nu.fnu, { note: 'small-scale power cut ≈ 8f_ν = ' + fmt(8 * nu.fnu * 100, 2) + '%' }),
    stat('Sterile ν as DM (Dodelson–Widrow)', O, { note: `m_s = ${fmt(NU.ms, 3)} keV · needs 0.12 · X-ray lines exclude most of this plane`, hl: 1 }),
  ].join('');
  const mls = []; for (let l = -4; l <= 0.001; l += 0.05) mls.push(Math.pow(10, l));
  const ser = [];
  ['normal', 'inverted'].forEach((h, hi) => [0, 1, 2].forEach(i => ser.push({ name: i === 0 ? (h === 'normal' ? 'normal ordering' : 'inverted ordering') : '', x: mls, y: mls.map(m => GX.nuMasses(h, m)[i]), color: hi ? '#ff9aa6' : '#7cc4ff', width: 1.6, dash: hi ? [5, 4] : [] })));
  plot('c-numass', 'short').set({ x: { log: 1, min: 1e-4, max: 1, label: 'lightest mass [eV]', short: 'm_light' }, y: { log: 1, min: 1e-3, max: 1, label: 'masses [eV]', short: 'm' }, series: ser, vlines: NU.hier === 'degenerate' ? [] : [{ x: Math.max(NU.ml, 1.1e-4), label: 'this universe', color: '#fff' }], hlines: [{ y: 0.45, label: 'KATRIN m_β < 0.45 eV', color: '#5a6190' }] });
  // P(k) suppression relative to massless neutrinos
  const R0 = cached(R, 'nu0', r => GP.run(Object.assign(G.clone(r.P), { mnu: 0, nu_masses: [] })));
  const ks = []; for (let l = -3.5; l <= 1.001; l += 0.05) ks.push(Math.pow(10, l));
  plot('c-nupk', 'short').set({ x: { log: 1, label: 'k [Mpc⁻¹]', short: 'k' }, y: { min: 0.5, max: 1.05, label: 'P(k) / P(k; Σmν = 0)', short: 'ratio' }, series: [{ name: `Σmν = ${fmt(G.P.mnu, 3)} eV`, x: ks, y: ks.map(k => R.st.Pk(k, 1) / R0.st.Pk(k, 1)), color: '#b6f09c', width: 2.2 }], hlines: [{ y: 1 - 8 * nu.fnu, label: '1 − 8f_ν', color: '#5a6190' }] });
  // N_eff seen by BBN (Y_p) and by the CMB (damping/sound ratio)
  const key = JSON.stringify([G.P.omega_L, G.P.mnu, G.P.tau_n, G.P.me_s]);
  if (NU.scanKey !== key) {
    NU.scanKey = key; NU.scan = null; const ns = [1.5, 2, 2.5, 3.044, 3.5, 4, 4.5, 5], acc = { N: [], Yp: [], ratio: [] }; let i = 0;
    const next = () => {
      if (NU.scanKey !== key) return;
      if (i >= ns.length) { NU.scan = acc; $('#nu-scan-status').textContent = ''; if (G.tab === 'nu') drawNeff(); return; }
      $('#nu-scan-status').textContent = `scanning N_eff ${i + 1}/${ns.length}…`;
      const r = GP.run(Object.assign(G.clone(G.P), { Neff: ns[i] })), c = GX.cmbSpectrum(r);
      acc.N.push(ns[i]); acc.Yp.push(r.nuc.Yp); acc.ratio.push(c ? c.lD / c.ellA : NaN); i++; setTimeout(next, 0);
    };
    setTimeout(next, 20);
  } else drawNeff();
}
function drawNeff() {
  const s = NU.scan; if (!s) return;
  const b = cmbOf(G.BASE), r0 = b.lD / b.ellA;
  plot('c-neffY', 'short').set({ x: { min: 1.4, max: 5.1, label: 'N_eff', short: 'N_eff' }, y: { label: 'Y_p (BBN, t ≈ 3 min)', short: 'Y_p' }, series: [{ name: 'helium from BBN', x: s.N, y: s.Yp, color: '#5ef0a8', width: 2.2 }, { name: '', x: s.N, y: s.Yp, color: '#5ef0a8', points: 1 }], hbands: [{ y0: 0.242, y1: 0.248, color: '#5ef0a833', label: 'observed Y_p' }], vlines: [{ x: G.P.Neff, label: 'now', color: '#fff' }] });
  plot('c-neffT', 'short').set({ x: { min: 1.4, max: 5.1, label: 'N_eff', short: 'N_eff' }, y: { label: 'ℓ_D / ℓ_A (CMB damping tail, t ≈ 380 kyr)', short: 'ℓ_D/ℓ_A' }, series: [{ name: 'CMB damping / acoustic scale', x: s.N, y: s.ratio, color: '#ff7a8c', width: 2.2 }, { name: '', x: s.N, y: s.ratio, color: '#ff7a8c', points: 1 }], hbands: [{ y0: r0 * (1 - 0.006), y1: r0 * (1 + 0.006), color: '#ff7a8c33', label: 'Planck (N_eff = 2.99 ± 0.17)' }], vlines: [{ x: G.P.Neff, label: 'now', color: '#fff' }] });
}

/* ============================================================ 4, 5 · relics & primordial black holes */
const REL = { pt: { alpha: 0.3, betaH: 100, vw: 0.9, Tstar: 200 }, df: { Tc: 1e16, mMono: 1e17, etaString: 1e15, etaWall: 1 }, pbh: { M: 1e20, f: 1 } };
let relBuilt = false;
EXT.render.relics = () => {
  if (!relBuilt) {
    relBuilt = true;
    const pc = $('#pt-ctrls'), dc = $('#df-ctrls'), bc = $('#pbh-ctrls'), re = () => renderRelics();
    slider(pc, { label: 'Strength α (latent heat / radiation)', min: 1e-3, max: 10, log: 1, value: REL.pt.alpha, onInput: v => { REL.pt.alpha = v; re(); } });
    slider(pc, { label: 'Inverse duration β/H', min: 1, max: 1e5, log: 1, value: REL.pt.betaH, onInput: v => { REL.pt.betaH = v; re(); } });
    slider(pc, { label: 'Bubble-wall speed v<sub>w</sub>', min: 0.1, max: 1, value: REL.pt.vw, onInput: v => { REL.pt.vw = v; re(); } });
    slider(pc, { label: 'Temperature T<sub>*</sub>', unit: 'GeV', min: 1e-3, max: 1e8, log: 1, value: REL.pt.Tstar, help: '100 GeV electroweak · 0.15 GeV QCD · higher: dark sectors, GUTs', onInput: v => { REL.pt.Tstar = v; re(); } });
    slider(dc, { label: 'Symmetry-breaking temperature T<sub>c</sub> (monopoles)', unit: 'GeV', min: 1e3, max: 1e18, log: 1, value: REL.df.Tc, help: 'GUT ≈ 10¹⁶ GeV. Compare with the reheating temperature!', onInput: v => { REL.df.Tc = v; re(); } });
    slider(dc, { label: 'Monopole mass', unit: 'GeV', min: 1e4, max: 1e19, log: 1, value: REL.df.mMono, onInput: v => { REL.df.mMono = v; re(); } });
    slider(dc, { label: 'String-forming scale η', unit: 'GeV', min: 1e6, max: 1e18, log: 1, value: REL.df.etaString, onInput: v => { REL.df.etaString = v; re(); } });
    slider(dc, { label: 'Domain-wall scale η<sub>w</sub>', unit: 'GeV', min: 1e-5, max: 1e8, log: 1, value: REL.df.etaWall, onInput: v => { REL.df.etaWall = v; re(); } });
    slider(bc, { label: 'PBH mass', unit: 'g', min: 1e10, max: 1e40, log: 1, value: REL.pbh.M, help: '10³³ g = 1 M☉ · 5×10¹⁴ g evaporates today', onInput: v => { REL.pbh.M = v; re(); } });
    slider(bc, { label: 'Fraction of dark matter f<sub>PBH</sub>', min: 1e-10, max: 1, log: 1, value: REL.pbh.f, onInput: v => { REL.pbh.f = v; re(); } });
  }
  renderRelics();
};
function renderRelics() {
  const R = G.R, pt = GX.ptGW(REL.pt);
  const det = Object.entries(refCurves).filter(([n]) => !n.startsWith('LIGO')).filter(([, c]) => pt.f.some((f, i) => pt.tot[i] > detAt(c, f))).map(([n]) => n);
  $('#s-pt').innerHTML = [stat('Peak Ω<sub>GW</sub>h²', pt.peak, { hl: 1 }), stat('Peak frequency today', fmt(pt.fpeak, 3) + ' Hz', {}), stat('Kinetic efficiency κ', pt.kv, { d: 3 }), stat('Detectable by', det.length ? det.join(', ') : 'none planned', { note: 'signal above the (approximate) sensitivity curve' })].join('');
  const infl = R.sp.gw;
  plot('c-pt').set({ x: { log: 1, min: 1e-10, max: 1e4, label: 'frequency today [Hz]', short: 'f' }, y: { log: 1, min: 1e-20, max: 1e-5, label: 'Ω_GW h²', short: 'Ω h²' },
    series: [{ name: 'sound waves + turbulence', x: pt.f, y: pt.tot, color: '#ffd66b', width: 2.6 }, { name: 'sound waves', x: pt.f, y: pt.sw, color: '#ffd66b', dash: [2, 3], width: 1 }, { name: 'inflation (this universe)', x: infl.f, y: infl.O, color: '#c792ea', width: 1.4 }].concat(detSeries()) });
  const d = GX.defects(REL.df, R), notes = [];
  notes.push([d.diluted ? 'good' : (d.monoOmega > 0.12 ? 'bad' : 'good'), d.diluted ? `<b>Monopoles:</b> T<sub>c</sub> = ${fmtT(REL.df.Tc)} is above the reheating temperature (${fmtT(G.P.T_rh)}) — any monopoles formed before or during inflation were diluted away. <i>This is one of the original reasons for inflation.</i>` : `<b>Monopoles:</b> Kibble gives ~1 per Hubble volume at T<sub>c</sub>, Ωh² ≈ <b>${fmt(d.monoOmega, 2)}</b>${d.monoOmega > 0.12 ? ' — the universe would be ruled by monopoles (the monopole problem). Lower T_rh below T_c to let inflation fix it.' : ' — harmless.'}`]);
  notes.push([d.Gmu > d.cmbGmu ? 'bad' : d.Gmu > d.ptaGmu ? 'warn' : 'good', `<b>Cosmic strings:</b> Gμ ≈ (η/M<sub>Pl</sub>)² = <b>${fmt(d.Gmu, 2)}</b>. ${d.Gmu > d.cmbGmu ? 'Excluded — the CMB would show string-induced line discontinuities (Planck: Gμ < 1.5×10⁻⁷).' : d.Gmu > d.ptaGmu ? 'Allowed by the CMB but in tension with pulsar-timing GW limits (Gμ ≲ 10⁻¹⁰ for stable strings).' : 'Allowed: too light to see yet.'}`]);
  notes.push([d.wallsBad ? 'bad' : 'good', `<b>Domain walls:</b> energy ∝ a⁻¹ dilutes slower than matter; walls with η<sub>w</sub> = ${fmtT(REL.df.etaWall)} would dominate at T ≈ <b>${fmtT(d.Tdom)}</b>. ${d.wallsBad ? 'That happens before today — the Zel’dovich–Kobzarev–Okun problem: stable walls are excluded (η_w ≲ MeV) unless they decay.' : 'Only after today — harmless.'}`]);
  $('#df-notes').innerHTML = notes.map(([c, t]) => `<li class="${c}">${t}</li>`).join('');
  const b = GX.pbh(R, REL.pbh.M, REL.pbh.f);
  $('#s-pbh').innerHTML = [
    stat('Formed at', fmtTime(b.tf), { note: b.Tf ? 'T ≈ ' + fmtT(b.Tf) + ' · M ≈ 0.2 × horizon mass' : 'before the Planck time?!' }),
    stat('Mass', fmt(b.Msun, 3) + ' M☉', { note: fmt(REL.pbh.M, 3) + ' g' }),
    stat('Hawking temperature', fmtK(b.TH * 8.617333e-14), {}),
    stat('Evaporation time', b.evaporated ? fmtTime(b.tauGyr * GP.U.Gyr) : fmt(b.tauGyr, 2) + ' Gyr', { note: b.evaporated ? 'already evaporated — cannot be dark matter today' : 'survives to today', hl: b.evaporated }),
    stat('Observational limit on f', b.fmax === null ? 'evaporated' : fmt(b.fmax, 2), { note: b.allowed === null ? '' : b.allowed ? '✓ allowed' : '✗ excluded', hl: 1 }),
    stat('Needed fluctuation amplitude', 'σ ≈ ' + fmt(b.sigma, 3), { note: `P_ζ ≈ ${fmt(b.Pz, 2)} at k ≈ ${fmt(b.k, 2)} Mpc⁻¹ — ${fmt(b.boost, 2)}× the CMB amplitude` }),
  ].join('');
  const L = GX.PBH_LIMITS;
  plot('c-pbh').set({ x: { log: 1, min: 1e10, max: 1e40, label: 'PBH mass [g]  (10³³ g ≈ 1 M☉)', short: 'M [g]' }, y: { log: 1, min: 1e-11, max: 10, label: 'fraction of dark matter f_PBH', short: 'f' },
    series: [{ name: 'upper limit (approx. composite, Carr+ 2021)', x: L.map(p => Math.pow(10, p[0])), y: L.map(p => Math.pow(10, p[1])), color: '#ff6b81', width: 2.2 }],
    vbands: [{ x0: 1e10, x1: 5.1e14, color: '#ff6b8118', label: 'evaporated' }, { x0: 2e17, x1: 1e22, color: '#5ef0a818', label: 'open window' }], hlines: [{ y: 1, label: 'all of the dark matter', color: '#5ef0a8' }],
    dots: [{ x: REL.pbh.M, y: REL.pbh.f, color: b.allowed ? '#5ef0a8' : '#ff6b81', r: 5, ring: 1, label: 'this choice' }] });
}

/* ============================================================ 8, 9 · fitting real data & the Hubble tension */
const FREE = [['omega_b', 'ω_b', 0.0005], ['omega_c', 'ω_c', 0.003], ['omega_L', 'ω_Λ', 0.02], ['Neff', 'N_eff', 0.3], ['me_s', 'm_e/m_e,0', 0.01], ['alpha_s', 'α/α₀', 0.004], ['w0', 'w₀', 0.08], ['mnu', 'Σm_ν [eV]', 0.05], ['As', 'A_s', 1e-10]];
const FIT = { running: false, stop: false, last: null };
let dataBuilt = false;
EXT.render.data = () => {
  if (dataBuilt) return;
  dataBuilt = true;
  $('#fit-data').innerHTML = Object.entries(GX.DATA).map(([k, d]) => `<label class="chk"><input type="checkbox" data-dk="${k}" ${['theta', 'omb', 'omc', 'DH', 'Yp'].includes(k) ? 'checked' : ''}><span>${d.name}<div class="help">${fmt(d.val, 5)} ± ${fmt(d.err, 2)} · ${d.src}</div></span></label>`).join('');
  $('#fit-free').innerHTML = FREE.map(([k, n], i) => `<label class="chk"><input type="checkbox" data-fk="${k}" ${i < 3 ? 'checked' : ''}><span>${n}</span></label>`).join('');
  $('#fit-go').onclick = () => runFit();
  $('#fit-stop').onclick = () => { FIT.stop = true; };
  $('#ht-go').onclick = () => tensionStudy();
};
function fitProblem(freeKeys, Pstart) {
  const base = G.clone(Pstart || G.P), R = Pstart ? GP.run(Pstart) : G.R;
  // the fitted densities are the physical parameters: decouple them from the upstream mechanisms
  base.link_eta = false; base.link_dm = false; base.omega_b = R.omega_b; base.omega_c = R.omega_c;
  const mk = x => { const P = G.clone(base); freeKeys.forEach((k, i) => { P[k] = x[i]; }); return P; };
  return { base, mk, x0: freeKeys.map(k => base[k]), steps: freeKeys.map(k => FREE.find(f => f[0] === k)[2]) };
}
async function driveFit(freeKeys, dataKeys, Pstart, onProgress) {
  const pr = fitProblem(freeKeys, Pstart), BASE = G.BASE;
  const f = x => { try { const r = GP.run(pr.mk(x)); return GX.chi2(r, dataKeys, BASE).chi2; } catch (e) { return 1e9; } };
  const gen = GX.nelderMead(f, pr.x0, pr.steps, { maxIt: 300, tol: 1e-6 }); let r, n = 0, last = performance.now();
  const hist = [];
  while (!(r = gen.next()).done) {
    n++; if (r.value.best !== undefined) hist.push(r.value.best);
    if (FIT.stop) throw new Error('stopped');
    if (performance.now() - last > 60) { onProgress && onProgress('optimising', n, hist); await tick(); last = performance.now(); }
  }
  const best = r.value;
  onProgress && onProgress('uncertainties', n, hist); await tick();
  const hg = GX.hessian(f, best.x, pr.steps.map(s => s * 0.3)); let h;
  while (!(h = hg.next()).done) { if (FIT.stop) throw new Error('stopped'); await tick(); }
  const cov = GX.invert(h.value), C2 = cov ? cov.map(row => row.map(v => 2 * v)) : null;
  const err = C2 ? C2.map((row, i) => Math.sqrt(Math.max(row[i], 0))) : null;
  const Pbest = pr.mk(best.x), Rbest = GP.run(Pbest);
  // propagate to derived H0 via a numerical gradient
  let sH0 = null;
  if (C2) {
    const g = best.x.map((v, i) => { const y = best.x.slice(); y[i] += pr.steps[i] * 0.3; return (GP.run(pr.mk(y)).cp.H0 - Rbest.cp.H0) / (pr.steps[i] * 0.3); });
    let s = 0; for (let i = 0; i < g.length; i++) for (let j = 0; j < g.length; j++) s += g[i] * C2[i][j] * g[j];
    sH0 = Math.sqrt(Math.max(s, 0));
  }
  return { x: best.x, chi2: best.fx, err, Pbest, Rbest, sH0, hist, parts: GX.chi2(Rbest, dataKeys, BASE).parts, freeKeys, dataKeys };
}
async function runFit() {
  if (FIT.running) return;
  const dataKeys = $$('#fit-data input:checked').map(i => i.dataset.dk), freeKeys = $$('#fit-free input:checked').map(i => i.dataset.fk);
  if (!dataKeys.length || !freeKeys.length) { toast('Choose at least one data set and one free parameter'); return; }
  FIT.running = true; FIT.stop = false; $('#fit-go').disabled = true; $('#fit-stop').disabled = false;
  const t0 = performance.now();
  try {
    const res = await driveFit(freeKeys, dataKeys, null, (phase, n, hist) => {
      $('#fit-status').textContent = `${phase}… ${n} evaluations · χ² = ${fmt(hist[hist.length - 1], 4)} · ${((performance.now() - t0) / 1000).toFixed(0)} s`;
      plot('c-fitconv', 'short').set({ x: { label: 'evaluation', short: 'n' }, y: { log: 1, label: 'best χ²', short: 'χ²' }, series: [{ name: 'best χ² so far', x: hist.map((_, i) => i), y: hist.map(v => Math.max(v, 1e-3)), color: '#ffd66b', width: 2 }] });
    });
    FIT.last = res;
    const dof = Math.max(dataKeys.length - freeKeys.length, 1);
    $('#fit-status').textContent = `done in ${((performance.now() - t0) / 1000).toFixed(0)} s`;
    $('#fit-out').innerHTML = `<div class="grid2"><div><table class="t"><tr><th>parameter</th><th>best fit</th><th>± 1σ</th></tr>${res.freeKeys.map((k, i) => `<tr><td>${FREE.find(f => f[0] === k)[1]}</td><td class="n">${fmtIn(res.x[i])}</td><td class="n">${res.err ? fmt(res.err[i], 2) : '—'}</td></tr>`).join('')}
      <tr><td><i>derived</i> H₀</td><td class="n">${fmt(res.Rbest.cp.H0, 4)}</td><td class="n">${res.sH0 ? fmt(res.sH0, 2) : '—'}</td></tr><tr><td><i>derived</i> age</td><td class="n">${fmt(res.Rbest.tl.age, 4)} Gyr</td><td></td></tr><tr><td><i>derived</i> S₈</td><td class="n">${fmt(res.Rbest.st.S8, 3)}</td><td></td></tr></table>
      <p style="margin-top:8px">χ² = <b>${fmt(res.chi2, 3)}</b> for ${dataKeys.length} data − ${freeKeys.length} parameters (χ²/dof = ${fmt(res.chi2 / dof, 3)})</p><button class="btn tiny primary" id="fit-apply">Apply the best fit to the laboratory</button></div>
      <div><table class="t"><tr><th>data</th><th>model</th><th>measured</th><th>pull</th></tr>${Object.entries(res.parts).map(([k, p]) => `<tr><td>${GX.DATA[k].name}</td><td class="n">${fmt(p.pred, 5)}</td><td class="n">${fmt(GX.DATA[k].val, 5)}</td><td class="n" style="color:${Math.abs(p.pull) < 2 ? 'var(--good)' : Math.abs(p.pull) < 3 ? 'var(--warn)' : 'var(--bad)'}">${p.pull >= 0 ? '+' : '−'}${fmt(Math.abs(p.pull), 2)}σ</td></tr>`).join('')}</table></div></div>`;
    $('#fit-apply').onclick = () => { G.setP(res.Pbest); toast('Best-fit universe applied'); };
    nbAdd('run', `Fit: ${freeKeys.join(', ')} to ${dataKeys.join(', ')}`, `χ² = ${fmt(res.chi2, 3)}; ` + freeKeys.map((k, i) => `${k} = ${fmtIn(res.x[i])} ± ${res.err ? fmt(res.err[i], 2) : '?'}`).join(', ') + `; H₀ = ${fmt(res.Rbest.cp.H0, 4)}`);
  } catch (e) { $('#fit-status').textContent = e.message === 'stopped' ? 'stopped' : 'failed: ' + e.message; }
  FIT.running = false; $('#fit-go').disabled = false; $('#fit-stop').disabled = true;
}
async function tensionStudy() {
  if (FIT.running) return;
  FIT.running = true; FIT.stop = false; $('#ht-go').disabled = true; $('#fit-stop').disabled = false;
  const early = ['theta', 'omb', 'omc', 'DH', 'Yp'], base3 = ['omega_b', 'omega_c', 'omega_L'];
  const models = [['ΛCDM', base3], ['ΛCDM + N_eff', base3.concat('Neff')], ['ΛCDM + varying m_e', base3.concat('me_s')], ['ΛCDM + N_eff + m_e', base3.concat('Neff', 'me_s')]];
  const Pstd = G.clone(GP.DEFAULTS), out = [];
  const show = () => {
    $('#ht-out').innerHTML = '<table class="t"><tr><th>model (fit to CMB + BBN only)</th><th>H₀ [km/s/Mpc]</th><th>tension with SH0ES</th><th>χ² (early data)</th></tr>' + out.map(o => `<tr><td>${o.name}</td><td class="n">${fmt(o.H0, 4)} ± ${o.sH0 ? fmt(o.sH0, 2) : '?'}</td><td class="n" style="color:${o.T < 2 ? 'var(--good)' : o.T < 3.5 ? 'var(--warn)' : 'var(--bad)'}">${fmt(o.T, 2)}σ</td><td class="n">${fmt(o.chi2, 3)}</td></tr>`).join('') + '</table>';
    plot('c-ht', 'short').set({ x: { min: 60, max: 80, label: 'H₀ [km/s/Mpc]', short: 'H₀' }, y: { min: -0.5, max: models.length - 0.5, label: '', tick: v => '' }, noLegend: true,
      series: out.map((o, i) => ({ name: o.name, x: [o.H0 - (o.sH0 || 0), o.H0 + (o.sH0 || 0)], y: [models.length - 1 - i, models.length - 1 - i], color: '#7cc4ff', width: 6 })),
      dots: out.map((o, i) => ({ x: o.H0, y: models.length - 1 - i, color: '#fff', r: 4, label: o.name })), vbands: [{ x0: 73.04 - 1.04, x1: 73.04 + 1.04, color: '#ff7a8c33', label: 'SH0ES' }, { x0: 67.36 - 0.54, x1: 67.36 + 0.54, color: '#7cc4ff22', label: 'Planck ΛCDM' }] });
  };
  try {
    for (const [name, free] of models) {
      $('#ht-out').insertAdjacentHTML('beforeend', `<p class="muted" id="ht-prog" style="font-size:12px">fitting ${name}…</p>`);
      const res = await driveFit(free, early, Pstd, (ph, n, hist) => { const e = $('#ht-prog'); if (e) e.textContent = `fitting ${name}: ${ph}, ${n} evaluations, χ² = ${fmt(hist[hist.length - 1], 3)}`; });
      const H0 = res.Rbest.cp.H0, sH0 = res.sH0 || 0;
      out.push({ name, H0, sH0, chi2: res.chi2, T: Math.abs(H0 - 73.04) / Math.hypot(sH0, 1.04) });
      show();
    }
    nbAdd('run', 'Hubble-tension study', out.map(o => `${o.name}: H₀ = ${fmt(o.H0, 4)} ± ${fmt(o.sH0, 2)} (${fmt(o.T, 2)}σ)`).join('; '));
  } catch (e) { const p = $('#ht-prog'); if (p) p.textContent = e.message === 'stopped' ? 'stopped' : 'failed: ' + e.message; }
  FIT.running = false; $('#ht-go').disabled = false; $('#fit-stop').disabled = true;
}

/* ============================================================ 11–14 · research tools */
const SLOTS = { A: null, B: null, C: null }, SLOT_COL = { now: '#ff7a8c', A: '#7cc4ff', B: '#5ef0a8', C: '#ffd66b' };
try { Object.assign(SLOTS, JSON.parse(localStorage.getItem('genesis-slots') || '{}')); } catch (e) { /* storage unavailable */ }
const slotR = s => s ? cached(s, 'R', x => GP.run(x.P)) : null;
const CMP_Q = [['η', r => r.eta, 3], ['Ω_b h²', r => r.omega_b, 4], ['Ω_c h²', r => r.omega_c, 4], ['H₀', r => r.cp.H0, 4], ['age [Gyr]', r => r.tl.age, 4], ['Y_p', r => r.nuc.Yp, 4], ['D/H', r => r.nuc.DH, 3], ['⁷Li/H', r => r.nuc.Li7H, 3], ['z*', r => r.rec.zstar, 5], ['100θ*', r => r.rec.theta100, 5], ['1st CMB peak ℓ', r => { const c = cmbOf(r); return c && c.peaks[0] ? c.peaks[0].l : NaN; }, 4], ['σ₈', r => r.st.sigma8, 3], ['first galaxies z', r => r.st.zFirstGal, 3], ['fate', r => G.fateTxt(r)]];
let resBuilt = false;
EXT.render.research = () => {
  if (!resBuilt) {
    resBuilt = true;
    $('#slot-btns').innerHTML = ['A', 'B', 'C'].map(k => `<button class="btn tiny" data-slot="${k}">Store current in ${k}</button>`).join('') + '<button class="btn tiny" id="slot-clear">Clear</button>';
    $$('[data-slot]').forEach(b => b.onclick = () => { const k = b.dataset.slot, name = prompt(`Name for universe ${k}:`, G.R.notes.length ? 'variant ' + k : 'ΛCDM'); if (name === null) return; SLOTS[k] = { name, P: G.clone(G.P) }; try { localStorage.setItem('genesis-slots', JSON.stringify(SLOTS)); } catch (e) { /* ignore */ } nbAdd('run', `Stored universe ${k}: ${name}`); renderResearch(); });
    $('#slot-clear').onclick = () => { SLOTS.A = SLOTS.B = SLOTS.C = null; try { localStorage.removeItem('genesis-slots'); } catch (e) { /* ignore */ } renderResearch(); };
    $('#cmp-what').onchange = () => renderResearch();
    $('#sens-go').onclick = () => sensitivity();
    buildFT();
    $('#ex-ipynb').onclick = exportNotebook; $('#ex-camb').onclick = exportCAMB; $('#ex-report').onclick = exportReport; $('#btn-export2').onclick = () => $('#btn-export').click();
  }
  renderResearch();
};
function renderResearch() {
  const cols = [['now', { name: 'current', P: G.P }, G.R]].concat(['A', 'B', 'C'].filter(k => SLOTS[k]).map(k => [k, SLOTS[k], slotR(SLOTS[k])]));
  $('#cmp-table').innerHTML = `<table class="t"><tr><th></th>${cols.map(([k, s]) => `<th style="color:${SLOT_COL[k]}">${k === 'now' ? 'current' : k + ': ' + esc(s.name)}</th>`).join('')}</tr>` +
    CMP_Q.map(([n, f, d]) => `<tr><td>${n}</td>${cols.map(([, , r]) => { const v = f(r); return `<td class="n">${typeof v === 'number' ? fmt(v, d) : v}</td>`; }).join('')}</tr>`).join('') + '</table>' +
    (cols.length === 1 ? '<p class="muted" style="font-size:12px">Store universes in slots A–C to compare them here and in the overlay.</p>' : '');
  const what = $('#cmp-what').value, ser = [];
  let X = {}, Y = {};
  cols.forEach(([k, s, r]) => {
    const col = SLOT_COL[k], nm = k === 'now' ? 'current' : k + ': ' + s.name;
    if (what === 'cmb') { const c = cmbOf(r); if (c) ser.push({ name: nm, x: c.ells, y: c.Dl, color: col, width: 2 }); X = { min: 2, max: 2500, label: 'ℓ' }; Y = { min: 0, label: 'D_ℓ [μK²]' }; }
    if (what === 'xe') { ser.push({ name: nm, x: r.rec.z, y: r.rec.xe, color: col, width: 2 }); X = { min: 0, max: 2500, rev: 1, label: 'z' }; Y = { log: 1, min: 1e-4, max: 1.4, label: 'x_e' }; }
    if (what === 'at') { const t = [], a = []; for (let i = 0; i < r.tl.t.length; i += 4) if (r.tl.a[i] > 1e-3) { t.push(r.tl.t[i] / GP.U.Gyr); a.push(r.tl.a[i]); } ser.push({ name: nm, x: t.concat(r.ft.ts), y: a.concat(r.ft.as), color: col, width: 2 }); X = { min: 0, max: 60, label: 't [Gyr]' }; Y = { log: 1, min: 1e-3, max: 100, label: 'a' }; }
    if (what === 'pk') { const ks = r.st.ks.filter((k2, i) => i % 4 === 0); ser.push({ name: nm, x: ks, y: ks.map(k2 => r.st.Pk(k2, 1)), color: col, width: 2 }); X = { log: 1, min: 1e-4, max: 50, label: 'k [Mpc⁻¹]' }; Y = { log: 1, label: 'P(k) [Mpc³]', floor: 1e10 }; }
    if (what === 'hmf') { const h = r.st.hmfs[0]; ser.push({ name: nm, x: h.lM.map(l => Math.pow(10, l)), y: h.dndlnM, color: col, width: 2 }); X = { log: 1, min: 1e6, max: 1e16, label: 'M [M☉]' }; Y = { log: 1, min: 1e-10, max: 1e3, label: 'dn/dlnM [Mpc⁻³]' }; }
    if (what === 'bbn') { ser.push({ name: nm, x: [1, 2, 3, 4], y: [r.nuc.Yp, r.nuc.DH * 1e4, r.nuc.He3H * 1e4, r.nuc.Li7H * 1e9], color: col, width: 2, points: 1, r: 5 }); X = { min: 0.5, max: 4.5, label: 'Y_p · D/H×10⁴ · ³He/H×10⁴ · ⁷Li/H×10⁹', tick: v => ['', 'Y_p', 'D/H', '³He/H', '⁷Li/H'][Math.round(v)] || '' }; Y = { log: 1, label: 'abundance (scaled)' }; }
  });
  plot('c-cmp').set({ x: X, y: Y, series: ser });
}
const SENS_IN = [['omega_b', 0.01, 'ω_b'], ['omega_c', 0.01, 'ω_c'], ['omega_L', 0.01, 'ω_Λ'], ['Neff', 0.01, 'N_eff'], ['tau_n', 0.01, 'τ_n'], ['me_s', 0.01, 'm_e'], ['alpha_s', 0.01, 'α'], ['G_s', 0.01, 'G_BBN'], ['As', 0.01, 'A_s'], ['w0', -0.01, 'w₀']];
const SENS_OUT = [['Y_p', r => r.nuc.Yp], ['D/H', r => r.nuc.DH], ['⁷Li/H', r => r.nuc.Li7H], ['z*', r => r.rec.zstar], ['θ*', r => r.rec.theta100], ['r_s', r => r.rec.rs], ['H₀', r => r.cp.H0], ['age', r => r.tl.age], ['σ₈', r => r.st.sigma8], ['ℓ₁', r => { const c = cmbOf(r); return c ? c.peaks[0].l : NaN; }]];
async function sensitivity() {
  const btn = $('#sens-go'); btn.disabled = true;
  const P0 = G.clone(G.P); P0.link_eta = false; P0.link_dm = false; P0.omega_b = G.R.omega_b; P0.omega_c = G.R.omega_c;
  const M = [];
  for (let i = 0; i < SENS_IN.length; i++) {
    const [k, h] = SENS_IN[i], isW = k === 'w0';
    $('#sens-out').innerHTML = `<p class="muted">computing ${i + 1}/${SENS_IN.length}…</p>`; await tick();
    const up = G.clone(P0), dn = G.clone(P0);
    if (isW) { up[k] = P0[k] + 0.01; dn[k] = P0[k] - 0.01; } else { up[k] = P0[k] * (1 + h); dn[k] = P0[k] * (1 - h); }
    const ru = GP.run(up), rd = GP.run(dn);
    M.push(SENS_OUT.map(([, f]) => { const a = f(ru), b = f(rd); return (Math.log(Math.abs(a)) - Math.log(Math.abs(b))) / (isW ? 0.02 : 2 * h); }));
  }
  const cell = v => { const a = clamp(Math.abs(v) / 2, 0, 1), col = v > 0 ? `rgba(255,107,129,${a})` : `rgba(124,196,255,${a})`; return `<td class="n" style="background:${col};text-align:center">${Math.abs(v) < 0.005 ? '·' : (v > 0 ? '+' : '−') + fmt(Math.abs(v), 2)}</td>`; };
  $('#sens-out').innerHTML = `<div style="overflow-x:auto"><table class="t sens"><tr><th>input ↓ / output →</th>${SENS_OUT.map(o => `<th>${o[0]}</th>`).join('')}</tr>${SENS_IN.map((s, i) => `<tr><td>${s[2]}</td>${M[i].map(cell).join('')}</tr>`).join('')}</table></div><p class="muted" style="font-size:12px">Reading example: the Y_p entry for N_eff is ∂ln Y_p/∂ln N_eff. A 1% change in the input changes the output by (entry)%.</p>`;
  nbAdd('run', 'Sensitivity matrix computed');
  btn.disabled = false;
}
const FT_PAR = { alpha_s: ['α/α₀', 0.9, 1.1, 0], me_s: ['m_e/m_e,0', 0.5, 2, 1], Q_s: ['(m_n−m_p)/1.29 MeV', 0.5, 1.6, 0], BD_s: ['B_D/2.22 MeV', 0.05, 2, 0], G_s: ['G_BBN/G', 0.3, 3, 1], omega_L: ['ω_Λ', 0.01, 100, 1], omega_b: ['ω_b', 0.002, 0.2, 1], omega_c: ['ω_c', 0.005, 2, 1], As: ['A_s', 1e-10, 1e-7, 1], Neff: ['N_eff', 1, 7, 0], tau_n: ['τ_n [s]', 30, 1e4, 1], w0: ['w₀', -2, -0.4, 0] };
const FT_OUT = { habit: ['“habitability” score (0–4)', r => (r.st.galaxiesEver ? 1 : 0) + (r.nuc.Yp > 0.05 && r.nuc.Yp < 0.6 ? 1 : 0) + (r.tl.age > 3 ? 1 : 0) + (!r.rec.transparent && r.ft.outcome === 'expand' ? 1 : 0), 0, 4], chi: ['log₁₀ χ² vs data (θ*, D/H, Y_p, S₈)', r => L10(Math.max(GX.chi2(r, ['theta', 'DH', 'Yp', 'S8'], G.BASE).chi2, 0.1)), -1, 5], Yp: ['helium Y_p', r => r.nuc.Yp, 0, 0.6], zstar: ['last scattering z*', r => r.rec.zstar, 600, 2500], sigma8: ['σ₈', r => r.st.sigma8, 0, 2], age: ['age [Gyr]', r => r.tl.age, 0, 30] };
function buildFT() {
  const opts = o => Object.entries(o).map(([k, v]) => `<option value="${k}">${v[0]}</option>`).join('');
  $('#ft-ctrls').innerHTML = `<div class="grid2"><div class="ctl"><div class="row1"><label>x axis</label></div><select id="ft-x">${opts(FT_PAR)}</select></div><div class="ctl"><div class="row1"><label>y axis</label></div><select id="ft-y">${opts(FT_PAR)}</select></div><div class="ctl"><div class="row1"><label>colour</label></div><select id="ft-o">${opts(FT_OUT)}</select></div><div class="ctl"><div class="row1"><label>resolution</label></div><select id="ft-n"><option value="10">10 × 10 (fast)</option><option value="14" selected>14 × 14</option><option value="20">20 × 20 (slow)</option></select></div></div>`;
  $('#ft-x').value = 'alpha_s'; $('#ft-y').value = 'omega_L';
  $('#ft-go').onclick = () => fineTune();
}
let ftJob = 0;
async function fineTune() {
  const job = ++ftJob, kx = $('#ft-x').value, ky = $('#ft-y').value, ko = $('#ft-o').value, n = +$('#ft-n').value;
  if (kx === ky) { toast('Pick two different parameters'); return; }
  const [nx, x0, x1, lx] = FT_PAR[kx], [ny, y0, y1, ly] = FT_PAR[ky], [no, fo, o0, o1] = FT_OUT[ko];
  const val = (a, b, l, t) => l ? Math.pow(10, L10(a) + t * (L10(b) - L10(a))) : a + t * (b - a);
  const P0 = G.clone(G.P); if (kx === 'omega_b' || ky === 'omega_b') { P0.link_eta = false; } if (kx === 'omega_c' || ky === 'omega_c') { P0.link_dm = false; }
  const grid = [];
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    if (job !== ftJob) return;
    const P = G.clone(P0); P[kx] = val(x0, x1, lx, i / (n - 1)); P[ky] = val(y0, y1, ly, j / (n - 1));
    let v = NaN; try { v = fo(GP.run(P)); } catch (e) { /* invalid universe */ }
    grid.push(v);
    if ((j * n + i) % 3 === 0) { $('#ft-cap').textContent = `computing ${j * n + i + 1}/${n * n}…`; drawFT(grid, n, [nx, x0, x1, lx], [ny, y0, y1, ly], [no, o0, o1], kx, ky); await tick(); }
  }
  drawFT(grid, n, [nx, x0, x1, lx], [ny, y0, y1, ly], [no, o0, o1], kx, ky);
  $('#ft-cap').innerHTML = `${no} over ${nx} × ${ny}. White cross: this universe. Every cell is a complete universe — baryogenesis to fate.`;
  nbAdd('run', `Fine-tuning map: ${no} over ${nx} × ${ny}`);
}
function drawFT(grid, n, X, Y, O, kx, ky) {
  const cv = $('#ft-canvas'), W = cv.clientWidth || 400, H = cv.clientHeight || 320, dpr = Math.min(window.devicePixelRatio || 1, 2);
  cv.width = W * dpr; cv.height = H * dpr; const c = cv.getContext('2d'); c.setTransform(dpr, 0, 0, dpr, 0, 0);
  c.fillStyle = '#05060d'; c.fillRect(0, 0, W, H);
  const L = 56, B = 40, T = 10, Rr = 70, pw = W - L - Rr, ph = H - T - B;
  const cmap = t => { const s = [[68, 1, 84], [59, 82, 139], [33, 145, 140], [94, 201, 98], [253, 231, 37]]; t = clamp(t, 0, 1) * 4; const i = Math.min(3, Math.floor(t)), f = t - i; return `rgb(${s[i].map((v, q) => Math.round(v + f * (s[i + 1][q] - v))).join(',')})`; };
  grid.forEach((v, idx) => { const i = idx % n, j = Math.floor(idx / n); c.fillStyle = isFinite(v) ? cmap((v - O[1]) / (O[2] - O[1])) : '#333'; c.fillRect(L + i * pw / n, T + ph - (j + 1) * ph / n, pw / n + 0.5, ph / n + 0.5); });
  const pos = (A, v) => A[3] ? (L10(v) - L10(A[1])) / (L10(A[2]) - L10(A[1])) : (v - A[1]) / (A[2] - A[1]);
  const cx = L + pos(X, G.P[kx]) * pw * (n - 1) / n + pw / (2 * n), cy = T + ph - (pos(Y, G.P[ky]) * ph * (n - 1) / n + ph / (2 * n));
  c.strokeStyle = '#fff'; c.lineWidth = 2; c.beginPath(); c.moveTo(cx - 7, cy); c.lineTo(cx + 7, cy); c.moveTo(cx, cy - 7); c.lineTo(cx, cy + 7); c.stroke();
  c.fillStyle = '#c9cdea'; c.font = '11px Inter'; c.textAlign = 'center';
  c.fillText(X[0], L + pw / 2, H - 8); c.fillText(fmt(X[1], 2), L, H - 24); c.fillText(fmt(X[2], 2), L + pw, H - 24);
  c.save(); c.translate(14, T + ph / 2); c.rotate(-Math.PI / 2); c.fillText(Y[0], 0, 0); c.restore();
  c.textAlign = 'right'; c.fillText(fmt(Y[2], 2), L - 4, T + 10); c.fillText(fmt(Y[1], 2), L - 4, T + ph);
  for (let q = 0; q <= 20; q++) { c.fillStyle = cmap(q / 20); c.fillRect(W - Rr + 18, T + ph - (q + 1) * ph / 21, 14, ph / 21 + 1); }
  c.textAlign = 'left'; c.fillStyle = '#c9cdea'; c.fillText(fmt(O[2], 2), W - Rr + 36, T + 10); c.fillText(fmt(O[1], 2), W - Rr + 36, T + ph);
}
function exportNotebook() {
  const R = G.R, c = cmbOf(R), ds = (arr, k) => arr.filter((_, i) => i % k === 0);
  const data = { parameters: G.diffs(), results: { eta: R.eta, omega_b: R.omega_b, omega_c: R.omega_c, H0: R.cp.H0, age_Gyr: R.tl.age, Yp: R.nuc.Yp, DH: R.nuc.DH, He3H: R.nuc.He3H, Li7H: R.nuc.Li7H, zstar: R.rec.zstar, theta100: R.rec.theta100, rs_Mpc: R.rec.rs, sigma8: R.st.sigma8, fate: G.fateTxt(R) },
    bbn: { T_MeV: ds(R.nuc.hist.T, 4), t_s: ds(R.nuc.hist.t, 4), X: ds(R.nuc.hist.X, 4), species: GP.BBN_NAMES }, recombination: { z: ds(R.rec.z, 6), xe: ds(R.rec.xe, 6) },
    cmb: c ? { ell: c.ells, Dl_uK2: c.Dl } : null, expansion: { t_Gyr: ds(Array.from(R.tl.t), 10).map(t => t / GP.U.Gyr), a: ds(Array.from(R.tl.a), 10) }, pk: { k: ds(R.st.ks, 6), P: ds(R.st.ks, 6).map(k => R.st.Pk(k, 1)) } };
  const md = s => ({ cell_type: 'markdown', metadata: {}, source: s });
  const code = s => ({ cell_type: 'code', metadata: {}, execution_count: null, outputs: [], source: s });
  const cp = R.cp, nb = {
    nbformat: 4, nbformat_minor: 5, metadata: { kernelspec: { name: 'python3', display_name: 'Python 3', language: 'python' } },
    cells: [
      md(`# GENESIS universe — exported ${new Date().toISOString().slice(0, 10)}\n\nParameters changed from standard ΛCDM: \`${JSON.stringify(G.diffs())}\`\n\nThe data below were computed in the browser by GENESIS (reduced-order models; see its Methods tab).`),
      code(`import json, numpy as np, matplotlib.pyplot as plt\ndata = json.loads(r'''${JSON.stringify(data)}''')\ndata['results']`),
      code(`# light-element synthesis\nX = np.array(data['bbn']['X'])\nfor i, s in enumerate(data['bbn']['species']):\n    plt.loglog(data['bbn']['T_MeV'], X[:, i], label=s)\nplt.gca().invert_xaxis(); plt.ylim(1e-12, 2); plt.xlabel('T [MeV]'); plt.ylabel('mass fraction'); plt.legend(); plt.show()`),
      code(`# ionisation history and CMB spectrum\nfig, ax = plt.subplots(1, 2, figsize=(11, 4))\nax[0].semilogy(data['recombination']['z'], data['recombination']['xe']); ax[0].set_xlim(2500, 0); ax[0].set_xlabel('z'); ax[0].set_ylabel('x_e')\nif data['cmb']:\n    ax[1].plot(data['cmb']['ell'], data['cmb']['Dl_uK2']); ax[1].set_xlabel('ell'); ax[1].set_ylabel('D_ell [muK^2]')\nplt.show()`),
      md('## Independent cross-check with CAMB\n`pip install camb` — the same cosmology in a Boltzmann code.'),
      code(`import camb\npars = camb.set_params(H0=${cp.H0.toFixed(4)}, ombh2=${cp.omega_b.toFixed(6)}, omch2=${cp.omega_c.toFixed(6)}, mnu=${G.P.mnu}, nnu=${G.P.Neff}, YHe=${R.Yp.toFixed(5)}, As=${G.P.As}, ns=${R.ns.toFixed(5)}, tau=${R.rec.tauReion.toFixed(4)}, omk=${cp.Ok.toFixed(5)}, w=${cp.w0}, wa=${cp.wa}, dark_energy_model='ppf', lmax=2600)\nres = camb.get_results(pars)\ncl = res.get_cmb_power_spectra(pars, CMB_unit='muK')['total'][:, 0]\nplt.plot(np.arange(len(cl)), cl, label='CAMB')\nif data['cmb']: plt.plot(data['cmb']['ell'], data['cmb']['Dl_uK2'], '--', label='GENESIS')\nplt.xlim(2, 2500); plt.legend(); plt.show()\nprint('sigma8 CAMB', res.get_sigma8_0(), ' GENESIS', data['results']['sigma8'])`),
    ],
  };
  download('genesis-universe.ipynb', JSON.stringify(nb, null, 1), 'application/json');
  nbAdd('run', 'Exported Jupyter notebook');
}
function cambText() {
  const R = G.R, cp = R.cp;
  return `# ---- CAMB (python) ----
import camb
pars = camb.set_params(H0=${cp.H0.toFixed(4)}, ombh2=${cp.omega_b.toFixed(6)}, omch2=${cp.omega_c.toFixed(6)}, mnu=${G.P.mnu}, nnu=${G.P.Neff},
                       YHe=${R.Yp.toFixed(5)}, As=${G.P.As}, ns=${R.ns.toFixed(5)}, tau=${R.rec.tauReion.toFixed(4)}, omk=${cp.Ok.toFixed(5)},
                       w=${cp.w0}, wa=${cp.wa}, dark_energy_model='ppf')

# ---- CLASS (.ini) ----
h = ${cp.h.toFixed(6)}
omega_b = ${cp.omega_b.toFixed(6)}
omega_cdm = ${cp.omega_c.toFixed(6)}
N_ur = ${(G.P.Neff - 1.0132).toFixed(4)}
N_ncdm = 1
m_ncdm = ${G.P.mnu}
YHe = ${R.Yp.toFixed(5)}
A_s = ${G.P.As}
n_s = ${R.ns.toFixed(5)}
tau_reio = ${R.rec.tauReion.toFixed(4)}
Omega_k = ${cp.Ok.toFixed(5)}
${cp.w0 !== -1 || cp.wa !== 0 ? `Omega_Lambda = 0\nw0_fld = ${cp.w0}\nwa_fld = ${cp.wa}` : ''}
output = tCl,pCl,lCl,mPk
# Not representable in CAMB/CLASS: varying alpha/m_e (except CAMB's recombination module), baryogenesis, freeze-out, rate multipliers.`;
}
function exportCAMB() { download('genesis-camb-class.txt', cambText()); nbAdd('run', 'Exported CAMB/CLASS inputs'); }
function exportReport() {
  const R = G.R, imgs = ['c-cl', 'c-bbn', 'c-xe', 'c-hmf', 'c-at', 'c-dm', 'c-bg'].map(id => { const p = G.plots[id]; return p && p.cv.width ? [id, p.cv.toDataURL('image/png')] : null; }).filter(Boolean);
  const row = (k, v) => `<tr><td>${k}</td><td>${v}</td></tr>`;
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>GENESIS report</title><link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css"><script src="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.js"><\/script>
<style>body{font:14px/1.5 Georgia,serif;max-width:860px;margin:30px auto;color:#111;padding:0 16px}h1{font-family:Inter,Arial;letter-spacing:.1em}table{border-collapse:collapse;width:100%;margin:8px 0}td,th{border-bottom:1px solid #ccc;padding:4px 6px;text-align:left}img{width:100%;border:1px solid #ddd;margin:6px 0;background:#0e1124}.eq{margin:10px 0}@media print{button{display:none}}</style></head><body>
<button onclick="print()">Print / save as PDF</button>
<h1>GENESIS — universe report</h1><p>${new Date().toLocaleString()} · reduced-order early-universe models, validated against published ΛCDM results (see Methods).</p>
<h2>1. The universe</h2><table>${Object.entries(G.diffs()).map(([k, v]) => row(k, JSON.stringify(v))).join('') || row('parameters', 'standard ΛCDM (Planck 2018)')}</table>
<h2>2. Governing equations</h2>${['H^2 = \\frac{8\\pi G}{3}\\rho - \\frac{kc^2}{a^2}', '\\frac{dN_{B-L}}{dz} = \\varepsilon D (N_X - N_X^{\\rm eq}) - W N_{B-L}', '\\frac{dY}{dx} = -\\frac{s\\langle\\sigma v\\rangle}{Hx}(Y^2 - Y_{\\rm eq}^2)', '\\frac{dx_e}{dz} = \\frac{C\\,[\\alpha_B n_H x_e^2 - \\beta_B (1-x_e) e^{-h\\nu_\\alpha/kT}]}{H(1+z)}', '\\ddot\\delta + 2H\\dot\\delta = 4\\pi G\\bar\\rho\\,\\delta'].map(t => `<div class="eq" data-tex="${t.replace(/"/g, '&quot;')}"></div>`).join('')}
<h2>3. Results</h2><table><tr><th>quantity</th><th>this universe</th><th>standard ΛCDM</th></tr>${CMP_Q.map(([n, f, d]) => { const v = f(R), b = f(G.BASE); return `<tr><td>${n}</td><td>${typeof v === 'number' ? fmt(v, d) : v}</td><td>${typeof b === 'number' ? fmt(b, d) : b}</td></tr>`; }).join('')}</table>
<h2>4. Physics notes</h2><ul>${(R.notes.length ? R.notes : [{ txt: 'Consistent with our universe.' }]).map(n => `<li>${n.txt}</li>`).join('')}</ul>
<h2>5. Figures</h2>${imgs.map(([id, src]) => `<p><b>${id.replace('c-', '')}</b></p><img src="${src}">`).join('') || '<p>(Open the relevant tabs before exporting to include their figures.)</p>'}
<h2>6. Lab notebook</h2><ul>${G.$$('.nb-entry').slice(0, 30).map(e => `<li>${e.innerText.replace(/\n/g, ' — ')}</li>`).join('')}</ul>
<h2>References</h2><p>Planck Collaboration 2020 (A&amp;A 641, A6); Buchmüller, Di Bari &amp; Plümacher 2005; Gondolo &amp; Gelmini 1991; Smith, Kawano &amp; Malaney 1993; Pitrou et al. 2018; Seager, Sasselov &amp; Scott 1999; Hu &amp; Sugiyama 1995; Eisenstein &amp; Hu 1998; Sheth &amp; Tormen 1999; Caprini et al. 2016; Carr et al. 2021; Caldwell, Kamionkowski &amp; Weinberg 2003.</p>
<script>addEventListener('load',()=>document.querySelectorAll('[data-tex]').forEach(e=>{try{katex.render(e.dataset.tex,e,{displayMode:true})}catch(x){e.textContent=e.dataset.tex}}))<\/script></body></html>`;
  const w = window.open(URL.createObjectURL(new Blob([html], { type: 'text/html' })), '_blank');
  if (!w) download('genesis-report.html', html, 'text/html');
  nbAdd('run', 'Generated printable report');
}

/* ============================================================ 15, 16 · lectures & narration */
const D0 = () => G.clone(GP.DEFAULTS);
const LECTURES = [
  { title: 'Where did the antimatter go?', tag: 'Baryogenesis · 6 steps', steps: [
    { tab: 'seq', text: 'We begin in our own universe. For every <b>1.6 billion</b> antiquarks there were 1.6 billion <i>and one</i> quarks. Everything you see is made of that one-in-a-billion surplus. Where did it come from?', inspect: 300 },
    { tab: 'bary', text: 'Sakharov (1967): you need <b>baryon-number violation</b>, <b>C and CP violation</b>, and a <b>departure from equilibrium</b>. Here a heavy particle X decays slightly more often into matter than antimatter while the expanding universe is too fast for inverse decays.', focus: '#sakharov' },
    { tab: 'bary', set: { eps: 0 }, text: 'Switch off CP violation (ε = 0). X and anti-X now decay identically — η collapses, the matter annihilates, and nucleosynthesis has nothing to fuse.', focus: '#annih' },
    { tab: 'bary', set: { M_X: 20, K: 1, eps: 1e-7 }, text: 'Now keep CP violation but make X light (20 GeV): the lepton asymmetry is created <b>after</b> the electroweak transition, when sphalerons are already frozen. Leptons can no longer become baryons.', focus: '#c-bgscan' },
    { tab: 'bary', set: { M_X: 20, K: 1, eps: 1e-7, T_sph: 1 }, text: 'Same particle — but delay the electroweak transition to 1 GeV. The order of events is restored and the matter survives. <b>In cosmology, timing is physics.</b>' },
    { tab: 'seq', reset: 1, text: 'Back to our universe. The timeline shows the window baryogenesis must fit in: after reheating, before sphalerons freeze out. Drag the markers yourself to explore it.' },
  ] },
  { title: 'The first three minutes', tag: 'Nucleosynthesis · 6 steps', steps: [
    { tab: 'thermal', reset: 1, text: 'At 1 MeV the universe is 0.7 s old. How fast it expands is set by how many species are relativistic — g*(T). Each annihilation (quarks, muons, electrons) is a step in this curve.', focus: '#c-g' },
    { tab: 'bbn', text: 'Neutrons and protons interconvert through weak interactions until ~0.8 MeV; then n/p freezes at ≈ 1/6 and free neutrons begin to decay. The blackboard does the estimate in three lines.', focus: '.board-panel' },
    { tab: 'bbn', text: 'Deuterium is fragile: 10⁹ photons per baryon break it apart until T ≈ 0.07 MeV — the <b>deuterium bottleneck</b>. When it opens, almost every neutron ends up in ⁴He within minutes.', focus: '#c-bbn' },
    { tab: 'bbn', set: { Neff: 4.044 }, text: 'Add a fourth neutrino: faster expansion → earlier freeze-out → more neutrons → more helium. This is how BBN counted neutrino species before LEP did.' },
    { tab: 'bbn', set: { tau_n: 100 }, text: 'Make the neutron short-lived (100 s): neutrons decay before the bottleneck opens, and helium almost disappears.' },
    { tab: 'bbn', reset: 1, text: 'In our universe the predictions match observations — except lithium, the one stubborn discrepancy. Try to fix it in the lithium panel below.', focus: '#li-panel' },
  ] },
  { title: 'Why is the sky so uniform?', tag: 'Horizons & inflation · 5 steps', steps: [
    { tab: 'spacetime', reset: 1, text: 'Light cones in an expanding universe. At recombination, regions that could have exchanged signals span only about a degree of today’s sky — yet the CMB has the same temperature everywhere to 1 part in 100 000.', focus: '#c-cone' },
    { tab: 'inflation', text: 'Inflation solves this: the comoving Hubble radius <b>shrinks</b>. Regions in causal contact are stretched far beyond today’s horizon, then re-enter later.', focus: '#c-hor' },
    { tab: 'inflation', text: 'Press “Inflate”: the field rolls down its potential for ~115 e-folds; the CMB scales exit about 54 e-folds before the end, then the inflaton oscillates and reheats the universe.', focus: '#inf-panel' },
    { tab: 'inflation', set: { inf_model: 'quadratic' }, text: 'The simplest potential, m²φ², predicts gravitational waves with r ≈ 0.14 — excluded by BICEP/Keck. Physicists can now rule out models of the first 10⁻³⁵ s.', focus: '#c-nsr' },
    { tab: 'relics', reset: 1, text: 'Inflation also removed any magnetic monopoles from grand unification — set the monopole T_c below the reheating temperature and watch them come back.', focus: '#df-notes' },
  ] },
  { title: 'Reading the CMB', tag: 'Acoustic peaks · 5 steps', steps: [
    { tab: 'cmb', reset: 1, text: 'The CMB power spectrum records sound waves in the photon–baryon plasma frozen at last scattering. The first peak at ℓ ≈ 220 is the fundamental mode — its angle measures the geometry of the universe.', focus: '#cl-panel' },
    { tab: 'cmb', set: { link_eta: false, omega_b: 0.029 }, text: 'Add baryons: they load the plasma, making compressions (odd peaks) stronger than rarefactions (even peaks). The odd/even contrast weighs the baryons — independently of BBN!', focus: '#cl-panel' },
    { tab: 'cmb', set: { link_dm: false, omega_c: 0.16 }, text: 'More dark matter: earlier matter–radiation equality, less radiation driving, lower peaks — and a shifted acoustic scale.', focus: '#cl-panel' },
    { tab: 'cmb', set: { Neff: 5 }, text: 'Extra radiation (N_eff = 5) increases the damping of small scales relative to the acoustic scale — the damping tail is how Planck counts neutrinos.', focus: '#cl-panel' },
    { tab: 'cmb', set: { me_s: 1.05 }, text: 'A 5% heavier electron: recombination happens earlier, the sound horizon shrinks, every peak moves right. This is one of the leading ideas for the Hubble tension — test it in “Fit the data”.' },
  ] },
  { title: 'Dark matter and the cosmic web', tag: 'Structure · 5 steps', steps: [
    { tab: 'dm', reset: 1, text: 'A weakly interacting particle freezes out when annihilation can no longer keep up with expansion. A weak-scale ⟨σv⟩ gives exactly the observed abundance — the “WIMP miracle”.', focus: '#c-dm' },
    { tab: 'lss', text: 'Dark matter starts clumping at matter–radiation equality. The Zel’dovich web shows today’s filaments and voids, grown from inflation’s fluctuations.', focus: '#web' },
    { tab: 'lss', set: { link_dm: false, omega_c: 0 }, text: 'Remove dark matter: baryons are locked to photons until recombination and Silk damping erases small scales. σ₈ collapses — no galaxies.' },
    { tab: 'lss', set: { m_wdm: 1 }, text: 'Make dark matter warm (1 keV): free streaming erases small halos. Switch the web to 20 Mpc to see smooth sheets instead of clumps.' },
    { tab: 'dm', set: { dm_mode: 'axion' }, text: 'Dark matter need not be a WIMP. An axion field frozen by Hubble friction then oscillating behaves as cold matter; its abundance depends on f_a and whether the PQ symmetry broke before inflation.' },
  ] },
  { title: 'The fate of everything', tag: 'Dark energy · 4 steps', steps: [
    { tab: 'de', reset: 1, text: 'Dark energy with w = −1 never dilutes: the expansion accelerates forever toward a cold, empty de Sitter state.', focus: '#c-at' },
    { tab: 'spacetime', set: { w0: -1.5 }, text: 'Phantom dark energy (w = −1.5) grows as space expands. Run cosmic history: clusters, then galaxies, then the Solar System (46 years before the end) are torn apart.', focus: '#bound-tab' },
    { tab: 'de', set: { omega_L: -0.05 }, text: 'A small negative cosmological constant pulls instead: expansion halts, reverses, and ends in a Big Crunch.' },
    { tab: 'lss', set: { omega_L: 93.2 }, text: 'Make Λ 300× larger: acceleration starts before galaxies can collapse. Weinberg used this to predict (in 1987) that Λ should be small but non-zero.' },
  ] },
];
let lect = null;
const synth = window.speechSynthesis;
function say(html) { if (!synth) return; synth.cancel(); const u = new SpeechSynthesisUtterance(html.replace(/<[^>]+>/g, '').replace(/≈/g, 'about ').replace(/×/g, ' times ')); u.rate = 1.02; synth.speak(u); }
const narrateOn = () => $('#narrate') && $('#narrate').checked;
function lectureStep() {
  const L = LECTURES[lect.i], s = L.steps[lect.j];
  if (s.reset || s.set) G.setP(Object.assign(D0(), s.set || {}));
  G.showTab(s.tab);
  if (s.inspect && window.__GENESIS) window.__GENESIS.inspect(s.inspect);
  $('#prof').hidden = false; $('#prof-title').textContent = L.title; $('#prof-step').textContent = `${lect.j + 1}/${L.steps.length}`;
  $('#prof-body').innerHTML = s.text; $('#prof-prev').disabled = lect.j === 0; $('#prof-next').textContent = lect.j === L.steps.length - 1 ? 'Finish ✓' : 'Next →';
  if (s.focus) setTimeout(() => { const el = $(s.focus); if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); el.classList.add('flash'); setTimeout(() => el.classList.remove('flash'), 2200); } }, 350);
  if (narrateOn()) say(s.text);
}
function startLecture(i) { lect = { i, j: 0 }; lectureStep(); nbAdd('note', 'Lecture: ' + LECTURES[i].title); }
function endLecture() { lect = null; $('#prof').hidden = true; if (synth) synth.cancel(); }
// narration of “Play the Big Bang”: speak each new epoch as the cursor reaches it
let lastSaid = '';
const happen = $('#insp-happen');
if (happen) new MutationObserver(() => {
  if (!narrateOn() || !/Pause/.test(($('#btn-play') || {}).textContent || '')) return;
  const first = (happen.querySelector('b') || {}).textContent || '';
  if (first && first !== lastSaid) { lastSaid = first; say(happen.innerHTML.split('<br>')[0]); }
}).observe(happen, { childList: true, subtree: true });

/* ============================================================ 18 · challenges */
const CHALLENGES = [
  { title: 'Helium world, dark sky', goal: 'Make a universe with Y<sub>p</sub> &gt; 0.30 in which Milky-Way-mass galaxies <b>never</b> form.', hint: 'Helium likes a small n–p mass difference or strong gravity at BBN; galaxies hate a large Λ.', check: r => [r.nuc.Yp > 0.3 && !r.st.galaxiesEver, `Y_p = ${fmt(r.nuc.Yp, 3)}, galaxies ever: ${r.st.galaxiesEver ? 'yes' : 'no'}`] },
  { title: 'Matter from the TeV scale', goal: 'Produce the observed η = (6.1 ± 0.6)×10⁻¹⁰ from a decaying particle lighter than 10 TeV.', hint: 'Lower M_X; mind the sphaleron freeze-out and the washout K.', check: r => [r.P.M_X < 1e4 && Math.abs(r.eta / 6.1e-10 - 1) < 0.1 && r.P.link_eta, `M_X = ${fmtT(r.P.M_X)}, η = ${fmt(r.eta, 3)}`] },
  { title: 'Early light', goal: 'Release the CMB before z = 1400 while keeping Y<sub>p</sub> within 0.24–0.25.', hint: 'Recombination depends on atomic physics: B ∝ α² m_e.', check: r => [r.rec.zstar > 1400 && r.nuc.Yp > 0.24 && r.nuc.Yp < 0.25, `z* = ${fmt(r.rec.zstar, 4)}, Y_p = ${fmt(r.nuc.Yp, 4)}`] },
  { title: 'Beyond the WIMP', goal: 'Get Ω<sub>c</sub>h² = 0.120 ± 0.005 from a non-WIMP candidate (link to the computed value).', hint: 'Dark-matter tab → Candidate. Axion: tune f_a; freeze-in: tune λ.', check: r => [r.P.dm_mode !== 'wimp' && r.P.link_dm && Math.abs(r.omega_c - 0.12) < 0.005, `mode ${r.P.dm_mode}, Ω_c h² = ${fmt(r.omega_c, 3)}`] },
  { title: 'Fix lithium, keep deuterium', goal: 'Bring primordial ⁷Li/H below 2.2×10⁻¹⁰ with D/H within 3% of standard — no stellar depletion allowed.', hint: 'Nucleosynthesis → the lithium problem → nuclear rates.', check: r => [r.P.li_depl <= 1.01 && r.nuc.Li7H < 2.2e-10 && Math.abs(r.nuc.DH / G.BASE.nuc.DH - 1) < 0.03, `⁷Li/H = ${fmt(r.nuc.Li7H, 3)}, D/H ratio to standard = ${fmt(r.nuc.DH / G.BASE.nuc.DH, 3)}`] },
  { title: 'Hubble-tension killer', goal: 'H₀ &gt; 71 km/s/Mpc while 100θ* stays within 0.002 of standard and Y<sub>p</sub> within 0.24–0.255.', hint: 'Physics before recombination: N_eff, m_e… then rebalance ω_Λ.', check: r => [r.cp.H0 > 71 && Math.abs(r.rec.theta100 - G.BASE.rec.theta100) < 0.002 && r.nuc.Yp > 0.24 && r.nuc.Yp < 0.255, `H₀ = ${fmt(r.cp.H0, 4)}, Δ100θ* = ${fmt(r.rec.theta100 - G.BASE.rec.theta100, 2)}, Y_p = ${fmt(r.nuc.Yp, 4)}`] },
  { title: 'The last galaxy', goal: 'A universe that ends (Rip or Crunch) within 40 Gyr from now, yet has σ₈ within 0.75–0.9 today.', hint: 'Dark-energy tab.', check: r => [r.ft.tEnd !== null && r.ft.tEnd - r.tl.age < 40 && r.st.sigma8 > 0.75 && r.st.sigma8 < 0.9, `${G.fateTxt(r)}${r.ft.tEnd ? ' in ' + fmt(r.ft.tEnd - r.tl.age, 3) + ' Gyr' : ''}, σ₈ = ${fmt(r.st.sigma8, 3)}`] },
  { title: 'Cosmic dawn at z = 25', goal: 'First galaxies (10⁸ M☉, 3σ) before z = 25 in a universe at least 10 Gyr old.', hint: 'Primordial amplitude A_s, tilt n_s…', check: r => [r.st.zFirstGal !== null && r.st.zFirstGal > 25 && r.tl.age > 10, `first galaxies z ≈ ${r.st.zFirstGal ? fmt(r.st.zFirstGal, 3) : 'never'}, age ${fmt(r.tl.age, 3)} Gyr`] },
];
let CH = {}; try { CH = JSON.parse(localStorage.getItem('genesis-ch') || '{}'); } catch (e) { /* ignore */ }
let learnBuilt = false;
EXT.render.learn = () => {
  if (!learnBuilt) {
    learnBuilt = true;
    $('#lectures').innerHTML = LECTURES.map((L, i) => `<div class="card"><span class="tag">${L.tag}</span><h4>${L.title}</h4><p>${L.steps[0].text.replace(/<[^>]+>/g, '').slice(0, 150)}…</p><button class="go" data-lec="${i}">Start the lecture →</button></div>`).join('');
    $$('[data-lec]').forEach(b => b.onclick = () => startLecture(+b.dataset.lec));
    $('#prof-next').onclick = () => { const L = LECTURES[lect.i]; if (lect.j < L.steps.length - 1) { lect.j++; lectureStep(); } else { endLecture(); toast('Lecture complete'); } };
    $('#prof-prev').onclick = () => { if (lect.j > 0) { lect.j--; lectureStep(); } };
    $('#prof-x').onclick = endLecture; $('#prof-say').onclick = () => say($('#prof-body').innerHTML);
  }
  $('#challenges').innerHTML = CHALLENGES.map((c, i) => `<div class="card${CH[c.title] ? ' done-ok' : ''}"><span class="tag">Challenge ${i + 1}${CH[c.title] ? ' · solved ✓' : ''}</span><h4>${c.title}</h4><p>${c.goal}</p><div class="verdict" id="ch-v${i}"></div><div style="display:flex;gap:8px"><button class="go" data-ch="${i}">Check my universe →</button><button class="go muted" data-hint="${i}">hint</button></div></div>`).join('');
  $$('[data-ch]').forEach(b => b.onclick = () => { const c = CHALLENGES[+b.dataset.ch], [ok, det] = c.check(G.R); $('#ch-v' + b.dataset.ch).innerHTML = `<span class="${ok ? 'ok' : 'no'}">${ok ? 'Solved ✓' : 'Not yet ✗'}</span> — ${det}`; if (ok && !CH[c.title]) { CH[c.title] = new Date().toISOString(); try { localStorage.setItem('genesis-ch', JSON.stringify(CH)); } catch (e) { /* ignore */ } nbAdd('gedanken', 'Challenge solved: ' + c.title, det); setTimeout(() => EXT.render.learn(), 1500); } });
  $$('[data-hint]').forEach(b => b.onclick = () => { $('#ch-v' + b.dataset.hint).innerHTML = `<span class="muted">Hint: ${CHALLENGES[+b.dataset.hint].hint}</span>`; });
};

/* ============================================================ 17 · the AI physicist */
const AI = { key: null, msgs: [], busy: false };
try { AI.key = localStorage.getItem('genesis-ai-key'); } catch (e) { /* ignore */ }
function universeBrief() {
  const R = G.R, B = G.BASE, d = G.diffs(), c = cmbOf(R);
  const q = [['η', R.eta, B.eta], ['Ω_b h²', R.omega_b, B.omega_b], ['Ω_c h²', R.omega_c, B.omega_c], ['H0', R.cp.H0, B.cp.H0], ['age Gyr', R.tl.age, B.tl.age], ['Y_p', R.nuc.Yp, B.nuc.Yp], ['D/H', R.nuc.DH, B.nuc.DH], ['Li7/H', R.nuc.Li7H, B.nuc.Li7H], ['z*', R.rec.zstar, B.rec.zstar], ['100θ*', R.rec.theta100, B.rec.theta100], ['σ8', R.st.sigma8, B.st.sigma8], ['first CMB peak ℓ', c && c.peaks[0] ? c.peaks[0].l : NaN, cmbOf(B).peaks[0].l], ['first galaxies z', R.st.zFirstGal, B.st.zFirstGal], ['q0', R.ft.q0, B.ft.q0]];
  return `Current tab: ${G.tab}.\nParameters changed from standard ΛCDM (Planck 2018 defaults): ${Object.keys(d).length ? JSON.stringify(d) : 'none — this is standard ΛCDM'}.\n` +
    `Key results (this universe vs standard ΛCDM, same code):\n${q.map(([n, v, b]) => `- ${n}: ${fmtIn(+v)} (ΛCDM ${fmtIn(+b)})`).join('\n')}\n- fate: ${G.fateTxt(R)}${R.ft.tEnd ? ' in ' + (R.ft.tEnd - R.tl.age).toFixed(1) + ' Gyr' : ''}\n` +
    `Diagnostics raised by the code: ${R.notes.length ? R.notes.map(n => n.txt.replace(/<[^>]+>/g, '')).join(' | ') : 'none'}\n` +
    `Epoch temperatures (GeV): ${R.epochs.map(e => `${e.name} ${fmtIn(e.T)}`).join('; ')}`;
}
const SYSTEM = `You are a senior theoretical cosmologist embedded in GENESIS, an interactive early-universe laboratory. The user is exploring alternative universes. Each question comes with a machine-generated brief of the universe currently loaded (parameters changed from ΛCDM, computed results, and the code's own diagnostics).

Explain the physics behind the numbers the way a great professor at a blackboard would: start from the causal mechanism, use the actual numbers from the brief, give order-of-magnitude reasoning, and name the governing equation when it helps (plain-text or light LaTeX is fine). Be concise — a few short paragraphs — unless asked for depth. Distinguish clearly between what the lab computed and general knowledge. The lab uses reduced-order models (validated to roughly 0.5–10% depending on the observable); if a question depends on physics the lab does not model, say so. Suggest one concrete next experiment the user could run in the lab when it would help.`;
function offlineAnswer(qs) {
  const R = G.R, d = G.diffs(), notes = R.notes.map(n => n.txt.replace(/<[^>]+>/g, ''));
  const changed = Object.keys(d);
  let s = `<p><i>Offline explainer (add an API key for a full answer).</i></p>`;
  s += changed.length ? `<p>This universe differs from ΛCDM in: <b>${changed.join(', ')}</b>.</p>` : '<p>This is standard ΛCDM — every observable agrees with data within this code’s accuracy.</p>';
  const B = G.BASE, big = [['baryon asymmetry η', R.eta, B.eta], ['helium Y_p', R.nuc.Yp, B.nuc.Yp], ['deuterium D/H', R.nuc.DH, B.nuc.DH], ['last scattering z*', R.rec.zstar, B.rec.zstar], ['H₀', R.cp.H0, B.cp.H0], ['σ₈', R.st.sigma8, B.st.sigma8], ['dark matter Ω_c h²', R.omega_c, B.omega_c]]
    .map(([n, v, b]) => [n, v, b, isFinite(v) && isFinite(b) && b !== 0 ? Math.abs(v / b - 1) : 0]).filter(x => x[3] > 0.005).sort((a, b) => b[3] - a[3]).slice(0, 4);
  if (big.length) s += '<p>Largest consequences: ' + big.map(([n, v, b]) => `${n} ${fmt(b, 3)} → <b>${fmt(v, 3)}</b>`).join('; ') + '.</p>';
  if (notes.length) s += '<ul>' + notes.slice(0, 4).map(n => `<li>${n}</li>`).join('') + '</ul>';
  s += `<p class="muted">The chalkboard on the ${G.tab} tab shows the governing equations with these numbers substituted.</p>`;
  return s;
}
function aiLog(role, html) { const el = document.createElement('div'); el.className = 'ai-msg ' + role; el.innerHTML = html; $('#ai-log').append(el); $('#ai-log').scrollTop = $('#ai-log').scrollHeight; return el; }
function mdLite(t) { return esc(t).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/`([^`]+)`/g, '<code>$1</code>').replace(/\n{2,}/g, '</p><p>').replace(/\n/g, '<br>'); }
let SDK = null;
async function ask(q) {
  if (AI.busy || !q.trim()) return;
  aiLog('user', esc(q));
  if (!AI.key) { aiLog('bot', offlineAnswer(q)); return; }
  AI.busy = true; $('#ai-send').disabled = true;
  const out = aiLog('bot', '<span class="muted">thinking…</span>');
  AI.msgs.push({ role: 'user', content: `<universe_brief>\n${universeBrief()}\n</universe_brief>\n\n${q}` });
  try {
    if (!SDK) SDK = (await import('https://cdn.jsdelivr.net/npm/@anthropic-ai/sdk/+esm')).default;
    const client = new SDK({ apiKey: AI.key, dangerouslyAllowBrowser: true });
    const stream = client.beta.messages.stream({
      model: 'claude-opus-5', max_tokens: 16000,
      betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default',
      system: SYSTEM, messages: AI.msgs.slice(-12),
    });
    let text = '';
    for await (const ev of stream) {
      if (ev.type === 'content_block_delta' && ev.delta.type === 'text_delta') { text += ev.delta.text; out.innerHTML = '<p>' + mdLite(text) + '</p>'; $('#ai-log').scrollTop = $('#ai-log').scrollHeight; }
    }
    const msg = await stream.finalMessage();
    if (msg.stop_reason === 'refusal') { out.innerHTML = '<p class="muted">The model declined this request.</p>'; AI.msgs.pop(); }
    else { const full = msg.content.filter(b => b.type === 'text').map(b => b.text).join(''); AI.msgs.push({ role: 'assistant', content: full || text }); out.innerHTML = '<p>' + mdLite(full || text) + '</p>'; nbAdd('note', 'Asked the physicist', q); }
  } catch (e) {
    AI.msgs.pop();
    const st = e && e.status;
    out.innerHTML = `<p class="no">${st === 401 ? 'The API key was rejected (401). Check it and try again.' : st === 429 ? 'Rate-limited (429) — wait a moment and retry.' : st >= 500 ? 'The API is temporarily unavailable (' + st + ').' : 'Request failed: ' + esc(e.message || String(e))}</p>` + offlineAnswer(q);
  }
  AI.busy = false; $('#ai-send').disabled = false;
}
function aiToggle(open) {
  const d = $('#ai'), on = open === undefined ? !d.classList.contains('on') : open;
  d.classList.toggle('on', on);
  $('#ai-keybox').classList.toggle('has', !!AI.key);
  if (on && !$('#ai-log').children.length) aiLog('bot', `<p>Ask me why anything in this universe came out the way it did. I see the parameters you changed, the computed results and the lab’s diagnostics.${AI.key ? '' : ' <i>(No API key yet — you’ll get the offline explainer.)</i>'}</p>`);
  if (on) setTimeout(() => $('#ai-q').focus(), 50);
}
$('#ai-fab').onclick = () => aiToggle(); $('#ai-close').onclick = () => aiToggle(false);
$('#ai-savekey').onclick = () => { const k = $('#ai-key').value.trim(); if (!/^sk-ant-/.test(k)) { toast('That does not look like an Anthropic API key'); return; } AI.key = k; $('#ai-key').value = ''; if ($('#ai-remember').checked) { try { localStorage.setItem('genesis-ai-key', k); } catch (e) { /* ignore */ } } $('#ai-keybox').classList.add('has'); toast('Key set' + ($('#ai-remember').checked ? ' and remembered on this device' : ' for this session')); };
$('#ai-send').onclick = () => { const q = $('#ai-q').value; $('#ai-q').value = ''; ask(q); };
$('#ai-q').addEventListener('keydown', e => { if (e.key === 'Enter') $('#ai-send').click(); });
$('#ai-quick').innerHTML = ['Why did the numbers change in this universe?', 'Explain the blackboard on this tab', 'Is this universe consistent with observations?', 'What experiment should I run next?'].map(q => `<button class="opt">${q}</button>`).join('');
$$('#ai-quick .opt').forEach(b => b.onclick = () => ask(b.textContent));
const forget = document.createElement('button'); forget.className = 'btn tiny'; forget.textContent = 'Forget key'; forget.onclick = () => { AI.key = null; try { localStorage.removeItem('genesis-ai-key'); } catch (e) { /* ignore */ } $('#ai-keybox').classList.remove('has'); toast('Key forgotten'); };
$('#ai-keybox').append(forget);

G.render();
})();
