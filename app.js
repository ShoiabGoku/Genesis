/* GENESIS — user interface. All physics lives in physics.js (window.GP). */
(function () {
'use strict';
const GP = window.GP, OBS = GP.OBS, fmt = window.fmtNum, sup = window.supStr;
const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const clone = o => JSON.parse(JSON.stringify(o));
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const L10 = Math.log10, KB = 8.617333262e-14, ZETA3 = 1.2020569031595942;
let P = clone(GP.DEFAULTS), R = null, BASE = null, PIN = null, tab = 'seq';
const plots = {};
const COL = { n: '#9aa3d6', p: '#ff7a8c', D: '#ffd66b', T: '#f7a35c', He3: '#6ee7ff', He4: '#5ef0a8', Li7: '#c792ea', Be7: '#ff9ad5', rad: '#ffd66b', mat: '#8ea2ff', de: '#5ef0a8', dm: '#b392ff', curv: '#ff9aa6', base: '#6d74a8' };

/* ------------------------------------------------------------ formatting */
let UNITS = 'natural';
const T_PLANCK = 1.220890e19, T_PLANCK_S = 5.391247e-44, L_PLANCK = 1.616255e-35;
function fmtT(T) {
  if (!isFinite(T)) return '—';
  if (UNITS === 'SI') return fmt(T / KB) + ' K';
  if (UNITS === 'planck') return fmt(T / T_PLANCK) + ' T_P';
  if (T >= 1) return fmt(T) + ' GeV';
  if (T >= 1e-3) return fmt(T * 1e3) + ' MeV';
  if (T >= 1e-6) return fmt(T * 1e6) + ' keV';
  return fmt(T * 1e9) + ' eV';
}
const fmtK = T => fmt(T / KB) + ' K';
function fmtTime(s) {
  if (!isFinite(s)) return '—';
  if (UNITS === 'planck') return fmt(s / T_PLANCK_S) + ' t_P';
  const yr = 3.15576e7;
  if (s < 120) return fmt(s) + ' s';
  if (s < 7200) return fmt(s / 60) + ' min';
  if (s < 2 * 86400) return fmt(s / 3600) + ' h';
  if (s < yr) return fmt(s / 86400) + ' days';
  if (s < 1e3 * yr) return fmt(s / yr) + ' yr';
  if (s < 1e6 * yr) return fmt(s / yr / 1e3) + ' kyr';
  if (s < 1e9 * yr) return fmt(s / yr / 1e6) + ' Myr';
  return fmt(s / yr / 1e9, 4) + ' Gyr';
}
function fmtLen(m) {
  const ly = 9.4607e15;
  if (UNITS === 'planck') return fmt(m / L_PLANCK) + ' ℓ_P';
  if (m < 1e3) return fmt(m) + ' m';
  if (m < 1e9) return fmt(m / 1e3) + ' km';
  if (m < 0.1 * ly) return fmt(m / 1.496e11) + ' AU';
  if (m < 1e5 * ly) return fmt(m / ly) + ' ly';
  if (m < 1e9 * ly) return fmt(m / 3.0857e22) + ' Mpc';
  return fmt(m / ly / 1e9) + ' Gly';
}
function fmtIn(v) { if (v === 0) return '0'; const a = Math.abs(v); if (a >= 1e-3 && a < 1e5) return String(parseFloat(v.toPrecision(4))); return v.toExponential(2).replace('e+', 'e'); }
function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('on'); clearTimeout(toast.h); toast.h = setTimeout(() => t.classList.remove('on'), 2200); }

/* ------------------------------------------------------------ controls */
const C = {
  xi: { l: 'Expansion speed ξ (H → ξ·H at all times)', min: 0.3, max: 3, log: 1, h: 'Phenomenological: the universe stretches ξ× faster than its contents dictate, while gravity’s pull on matter is unchanged.' },
  f_ede: { l: 'Early dark energy: share of total energy f<sub>EDE</sub>', min: 0, max: 0.9, h: 'Acts like a cosmological constant until z_c, then dilutes as a⁻⁶.' },
  z_ede: { l: '…peaking at redshift z<sub>c</sub>', min: 3, max: 1e14, log: 1, h: '~3500: before recombination · ~10⁹: during BBN · ~10¹³: during dark-matter freeze-out' },
  T_rh: { l: 'Reheating temperature T<sub>rh</sub>', u: 'GeV', min: 1e-3, max: 1e16, log: 1, h: 'Hottest temperature of the plasma after inflation.' },
  M_X: { l: 'Mass of decaying particle M<sub>X</sub>', u: 'GeV', min: 1, max: 1e16, log: 1, h: 'Sets WHEN the asymmetry is made: T ≈ M<sub>X</sub>/few.' },
  K: { l: 'Decay parameter K = Γ<sub>X</sub>/H(M<sub>X</sub>)', min: 1e-3, max: 1e4, log: 1, h: 'K ≪ 1: slow, far out of equilibrium. K ≫ 1: inverse decays wash the asymmetry out.' },
  eps: { l: 'CP asymmetry per decay ε', min: 1e-10, max: 1e-2, log: 1, zeroMin: 1, h: 'Slide fully left for ε = 0 (no CP violation).' },
  T_sph: { l: 'Sphaleron freeze-out T<sub>sph</sub>', u: 'GeV', min: 1, max: 1e5, log: 1, h: 'Standard Model: 131.7 GeV. Moves the electroweak transition.' },
  bg_mode: { l: 'Baryogenesis mechanism', sel: [['lepto', 'Leptogenesis — L-violating decays + sphalerons'], ['gut', 'SU(5)-type GUT decays — B−L conserved'], ['so10', 'SO(10)-type — B and B−L violated']] },
  bg_init: { l: 'Initial abundance of X', sel: [['thermal', 'Thermal (when T_rh ≫ M_X)'], ['zero', 'Zero — produced only by inverse decays']] },
  m_dm: { l: 'Dark-matter mass m<sub>χ</sub>', u: 'GeV', min: 1, max: 1e5, log: 1 },
  sv: { l: 'Annihilation ⟨σv⟩ (s-wave a)', u: 'cm³/s', min: 1e-30, max: 1e-21, log: 1, h: 'Thermal WIMP ≈ 2×10⁻²⁶ cm³/s.' },
  sv_b: { l: 'p-wave b (σv = a + 6b/x)', u: 'cm³/s', min: 1e-30, max: 1e-22, log: 1, zeroMin: 1 },
  g_dm: { l: 'Internal degrees of freedom g<sub>χ</sub>', min: 1, max: 8, step: 1 },
  m_wdm: { l: 'Warm-DM particle mass', u: 'keV', min: 0.2, max: 100, log: 1, coldMax: 1, h: 'Slide fully right for cold dark matter (default).' },
  Neff: { l: 'Neutrino species N<sub>eff</sub>', min: 1, max: 7, h: 'Standard 3.044. Extra light species speed up expansion.' },
  dN_inj: { l: 'Dark radiation ΔN<sub>eff</sub>', min: 0, max: 3 },
  T_inj: { l: '…created below T<sub>inj</sub>', u: 'GeV', min: 1e-7, max: 1, log: 1, h: 'A new relativistic species appearing late (e.g. from a decay).' },
  tau_n: { l: 'Neutron lifetime τ<sub>n</sub>', u: 's', min: 10, max: 1e4, log: 1 },
  Q_s: { l: 'n–p mass difference ×', min: 0.5, max: 1.6, h: 'Measured: 1.2933 MeV.' },
  BD_s: { l: 'Deuteron binding energy ×', min: 0, max: 2, h: 'Measured 2.2246 MeV. At 0 the deuteron is unbound.' },
  G_s: { l: 'Newton’s G during BBN ×', min: 0.3, max: 3, log: 1 },
  me_s: { l: 'Electron mass ×', min: 0.5, max: 2, log: 1, h: 'Moves e⁺e⁻ annihilation, weak rates and atomic binding (∝ m<sub>e</sub>).' },
  alpha_s: { l: 'Fine-structure constant α ×', min: 0.9, max: 1.1, h: 'Atomic binding ∝ α² m<sub>e</sub>.' },
  T0: { l: 'CMB temperature “today” T<sub>0</sub>', u: 'K', min: 1, max: 10, h: 'Defines the moment we call today.' },
  omega_b: { l: 'Baryon density ω<sub>b</sub> = Ω<sub>b</sub>h²', min: 1e-3, max: 0.1, log: 1, linked: 'link_eta', lv: r => r.omega_b },
  omega_c: { l: 'Dark-matter density ω<sub>c</sub> = Ω<sub>c</sub>h²', min: 0, max: 0.6, linked: 'link_dm', lv: r => r.omega_c },
  omega_L: { l: 'Dark-energy density ω<sub>Λ</sub> = Ω<sub>Λ</sub>h²', min: -0.3, max: 1.5, h: 'Type any value in the box, e.g. 93 for Λ × 300.' },
  w0: { l: 'Equation of state w<sub>0</sub>', min: -2.5, max: -0.3 },
  wa: { l: 'Evolution w<sub>a</sub>', min: -3, max: 2 },
  closure: { l: 'Geometry', sel: [['flat', 'Flat (from inflation) — H₀ derived'], ['fixedH', 'Fixed H₀ — curvature derived']] },
  H0: { l: 'Hubble constant H<sub>0</sub>', u: 'km/s/Mpc', min: 40, max: 100, dis: () => P.closure !== 'fixedH', lv: r => r.cp.H0 },
  mnu: { l: 'Neutrino mass sum Σm<sub>ν</sub>', u: 'eV', min: 0, max: 1 },
  As: { l: 'Primordial amplitude A<sub>s</sub>', min: 1e-10, max: 1e-7, log: 1 },
  ns: { l: 'Spectral index n<sub>s</sub>', min: 0.85, max: 1.1, linked: 'link_inf', lv: r => r.ns },
  z_re: { l: 'Reionisation redshift z<sub>re</sub>', min: 3, max: 20 },
  T_qcd: { l: 'QCD confinement T<sub>c</sub>', u: 'GeV', min: 0.03, max: 3, log: 1 },
  T_dnu: { l: 'Neutrino decoupling T<sub>dec</sub>', u: 'GeV', min: 3e-4, max: 1e-2, log: 1 },
  inf_model: { l: 'Inflaton potential', sel: [['starobinsky', 'Starobinsky R² (α-attractor)'], ['quadratic', 'Chaotic m²φ²'], ['quartic', 'Chaotic λφ⁴'], ['hilltop', 'Hilltop (small field)'], ['custom', 'Custom n_s and r']] },
  Ne: { l: 'e-folds after CMB scales exit N<sub>*</sub>', min: 40, max: 75, step: 0.5 },
  ns_custom: { l: 'Custom n<sub>s</sub>', min: 0.9, max: 1.05, dis: () => P.inf_model !== 'custom' },
  r_custom: { l: 'Custom r', min: 1e-5, max: 1, log: 1, dis: () => P.inf_model !== 'custom' },
  link_eta: { chk: 'Use η computed by baryogenesis', h: 'Off: set Ω<sub>b</sub>h² by hand.' },
  link_dm: { chk: 'Use Ωh² computed by freeze-out', h: 'Off: set Ω<sub>c</sub>h² by hand.' },
  link_yp: { chk: 'Feed BBN helium into recombination' },
  link_inf: { chk: 'Take n<sub>s</sub> from the inflation model' },
};
const rows = [];
function toPos(s, v) {
  if (s.log) {
    if (v <= 0) return s.coldMax ? 1000 : 0;
    return clamp((L10(v) - L10(s.min)) / (L10(s.max) - L10(s.min)) * 1000, 0, 1000);
  }
  return clamp((v - s.min) / (s.max - s.min) * 1000, 0, 1000);
}
function fromPos(s, p) {
  if (s.log) {
    if (s.zeroMin && p <= 0) return 0;
    if (s.coldMax && p >= 1000) return 0;
    return Math.pow(10, L10(s.min) + p / 1000 * (L10(s.max) - L10(s.min)));
  }
  let v = s.min + p / 1000 * (s.max - s.min);
  if (s.step) v = Math.round(v / s.step) * s.step;
  return parseFloat(v.toPrecision(5));
}
function dispVal(s, v) { if (s.coldMax && v === 0) return 'cold'; return fmtIn(v); }
function buildCtl(key) {
  const s = C[key], d = document.createElement('div'); d.className = 'ctl';
  if (!s) { d.textContent = key; return d; }
  if (s.chk) {
    d.innerHTML = `<label class="chk"><input type="checkbox"><span>${s.chk}${s.h ? `<div class="help">${s.h}</div>` : ''}</span></label>`;
    const inp = $('input', d); inp.onchange = () => { P[key] = inp.checked; changed(); };
    rows.push({ key, s, el: d, chk: inp }); return d;
  }
  if (s.sel) {
    d.innerHTML = `<div class="row1"><label>${s.l}</label></div><select>${s.sel.map(([v, t]) => `<option value="${v}">${t}</option>`).join('')}</select>`;
    const sel = $('select', d); sel.onchange = () => { P[key] = sel.value; changed(); };
    rows.push({ key, s, el: d, sel }); return d;
  }
  d.innerHTML = `<div class="row1"><label>${s.l}${s.u ? `<span class="unit">${s.u}</span>` : ''}</label><input type="text" spellcheck="false" inputmode="decimal"></div><input type="range" min="0" max="1000" step="1">${s.h ? `<div class="help">${s.h}</div>` : ''}`;
  const num = $('input[type=text]', d), rng = $('input[type=range]', d);
  rng.oninput = () => { const v = fromPos(s, +rng.value); P[key] = v; num.value = dispVal(s, v); paintRange(rng); changed(); };
  num.onchange = () => {
    const txt = num.value.trim().toLowerCase().replace('−', '-').replace('×10^', 'e').replace('x10^', 'e');
    let v = txt === 'cold' ? 0 : parseFloat(txt);
    if (!isFinite(v)) { num.value = dispVal(s, P[key]); return; }
    if (s.log && v <= 0 && !s.zeroMin && !s.coldMax) { num.value = dispVal(s, P[key]); toast('This quantity must be positive'); return; }
    P[key] = v; changed();
  };
  rows.push({ key, s, el: d, num, rng }); return d;
}
function paintRange(r) { r.style.setProperty('--p', (r.value / 10) + '%'); }
function syncControls() {
  for (const row of rows) {
    const { key, s } = row;
    if (row.chk) { row.chk.checked = !!P[key]; continue; }
    if (row.sel) { row.sel.value = P[key]; continue; }
    const linked = (s.linked && P[s.linked]) || (s.dis && s.dis());
    row.el.classList.toggle('dis', !!linked);
    const v = linked && s.lv && R ? s.lv(R) : P[key];
    if (document.activeElement !== row.num) row.num.value = dispVal(s, v);
    row.rng.value = toPos(s, v); paintRange(row.rng);
  }
}
let pending = false;
function changed() { if (pending) return; pending = true; requestAnimationFrame(() => { pending = false; compute(); }); }
function compute() {
  try { R = GP.run(P); }
  catch (e) { console.error(e); toast('Computation failed: ' + e.message); return; }
  R._lnT = Array.from(R.tl.T, Math.log);
  syncControls(); renderReadout(); render(); saveHash();
  EXT.onCompute.forEach(fn => { try { fn(); } catch (e) { console.warn(e); } });
}

/* ------------------------------------------------------------ readout */
const CHIPS = [
  { k: 'η<sub>10</sub>', v: r => r.eta * 1e10, o: OBS.eta10, t: 'bary', d: 4 },
  { k: 'Ω<sub>b</sub>h²', v: r => r.omega_b, o: OBS.omega_b, t: 'bary', d: 4 },
  { k: 'Ω<sub>c</sub>h²', v: r => r.omega_c, o: OBS.omega_c, t: 'dm', d: 4 },
  { k: 'Y<sub>p</sub> (He)', v: r => r.nuc.Yp, o: OBS.Yp, t: 'bbn', d: 4 },
  { k: 'D/H', v: r => r.nuc.DH, o: OBS.DH, t: 'bbn', d: 3 },
  { k: 'H<sub>0</sub>', v: r => r.cp.H0, o: OBS.H0, t: 'de', d: 4 },
  { k: 'Age', v: r => r.tl.age, o: OBS.age, t: 'de', d: 4, u: ' Gyr' },
  { k: 'z<sub>*</sub> (CMB)', v: r => r.rec.zstar, o: OBS.zstar, t: 'cmb', d: 5 },
  { k: '100θ<sub>*</sub>', v: r => r.rec.theta100, o: OBS.theta100, t: 'cmb', d: 5 },
  { k: 'σ<sub>8</sub>', v: r => r.st.sigma8, o: OBS.sigma8, t: 'lss', d: 3 },
];
// tension with data, inflating the error by this code's own offset from data in standard ΛCDM
function pull(v, o, b) { const s = Math.hypot(o[1], b - o[0]); return Math.abs(v - o[0]) / s; }
function dotClass(p) { return !isFinite(p) ? '' : p < 2 ? 'g' : p < 5 ? 'w' : 'b'; }
function delta(v, ref, d) {
  if (!isFinite(v) || !isFinite(ref)) return '';
  if (ref !== 0 && Math.abs(ref) > 1e-30) { const rel = (v - ref) / Math.abs(ref) * 100; if (Math.abs(rel) < 0.005) return 'Δ 0'; return 'Δ ' + (rel > 0 ? '+' : '−') + fmt(Math.abs(rel), 2) + '%'; }
  return 'Δ ' + fmt(v - ref, d);
}
function renderReadout() {
  const ref = PIN || BASE;
  const html = CHIPS.map((c, i) => {
    const v = c.v(R), b = c.v(BASE), p = pull(v, c.o, b);
    return `<div class="chip" data-go="${c.t}" title="Observed ${fmt(c.o[0], 4)} ± ${fmt(c.o[1], 2)}${c.u || ''} · ${PIN ? 'Δ vs pinned universe' : 'Δ vs standard ΛCDM'}"><div class="k"><span class="dot ${dotClass(p)}"></span>${c.k}</div><div class="v">${fmt(v, c.d)}${c.u || ''}</div><div class="d">${delta(v, c.v(ref), c.d)}</div></div>`;
  }).join('') + `<div class="chip" data-go="de" title="Computed by integrating the acceleration equation forward"><div class="k"><span class="dot"></span>Fate</div><div class="v">${fateTxt(R)}</div><div class="d">${R.ft.tEnd ? 'in ' + fmt(R.ft.tEnd - R.tl.age, 3) + ' Gyr' : 'heat death'}</div></div>`;
  $('#readout').innerHTML = html;
  $$('#readout .chip').forEach(c => c.onclick = () => showTab(c.dataset.go));
}
const fateTxt = r => r.ft.outcome === 'rip' ? 'Big Rip' : r.ft.outcome === 'crunch' ? 'Big Crunch' : 'Expand forever';
function stat(label, v, o) {
  o = o || {};
  const ref = PIN || BASE;
  let obs = '';
  if (o.obs) obs = `obs ${fmt(o.obs[0], 4)} ± ${fmt(o.obs[1], 2)}`;
  else if (o.note) obs = o.note;
  let dl = '';
  if (o.key && ref) { const rv = o.key(ref); if (typeof v === 'number' && typeof rv === 'number') dl = delta(v, rv, o.d || 3); }
  const cls = o.obs && typeof v === 'number' && o.key ? dotClass(pull(v, o.obs, o.key(BASE))) : '';
  const vs = typeof v === 'number' ? fmt(v, o.d || 3) + (o.u || '') : v;
  return `<div class="stat${o.hl ? ' hl' : ''}"><div class="k">${cls ? `<span class="dot ${cls}"></span> ` : ''}${label}</div><div class="v">${vs}</div><div class="o">${[obs, dl].filter(Boolean).join(' · ')}</div></div>`;
}

/* ------------------------------------------------------------ tabs */
function showTab(t) {
  tab = t;
  $$('#tabs button').forEach(b => b.classList.toggle('on', b.dataset.t === t));
  $$('section[data-tab]').forEach(s => s.classList.toggle('on', s.dataset.tab === t));
  render();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
function render() {
  if (!R) return;
  const f = { seq: renderSeq, spacetime: renderSpacetime, thermal: renderThermal, inflation: renderInflation, bary: renderBary, dm: renderDM, bbn: renderBBN, cmb: renderCMB, lss: renderLSS, de: renderDE, whatif: () => {}, methods: renderMethods }[tab];
  if (f) f(); else if (EXT.render[tab]) EXT.render[tab]();
  if (EXT.after[tab]) EXT.after[tab]();
  if (tab !== 'spacetime') renderBoard(tab);
  if (tab === 'seq') renderHero();
}
const EXT = { render: {}, after: {}, onCompute: [] };   // lab2.js registers extra tabs / panels here
function plot(id, cls) {
  if (!plots[id]) { const el = document.getElementById(id); if (cls) el.classList.add(cls); plots[id] = new Plot(el); }
  return plots[id];
}
const pick = (xs, ys, f) => { const X = [], Y = []; for (let i = 0; i < xs.length; i++) if (f(xs[i], ys[i])) { X.push(xs[i]); Y.push(ys[i]); } return [X, Y]; };
const lnInterp = (arrLnT, arr, T) => GP.lerp(arrLnT, arr, Math.log(T));

/* ============================================================ SEQUENCER */
const SEQ = { lT: L10(3), drag: null, scrub: false, hover: null, playing: false, labels: [] };
const LT_MAX = 19.3;
const ltMin = () => L10(R.cp.T0) - 0.15;
function dragDefs() {
  return [
    { id: 'reheat', label: 'Reheating', col: '#c792ea', T: P.T_rh, set: T => { P.T_rh = clamp(T, 1e-3, 1e16); }, desc: 'End of inflation: the inflaton decays and heats the plasma to T_rh. Nothing heavier than ~T_rh is ever made thermally.' },
    { id: 'bgen', label: 'Baryogenesis', col: '#ff7a8c', T: R.bg.Tgen, ratio: () => P.M_X / R.bg.Tgen, set: (T, st) => { P.M_X = clamp(T * st.ratio, 1, 1e16); }, desc: 'Epoch when heavy X particles decay and create the matter–antimatter asymmetry (drag = change M_X).' },
    { id: 'ew', label: 'EW transition · sphalerons off', col: '#82aaff', T: P.T_sph, set: T => { P.T_sph = clamp(T, 1, 1e5); }, desc: 'Below T_sph, B+L-violating sphalerons stop: lepton number can no longer become baryon number.' },
    { id: 'dmfo', label: 'Dark-matter freeze-out', col: '#b392ff', T: R.dm.Tf, ratio: () => P.m_dm / R.dm.Tf, set: (T, st) => { P.m_dm = clamp(T * st.ratio, 1, 1e5); }, desc: 'WIMPs stop annihilating (drag = change the dark-matter mass).' },
    { id: 'qcd', label: 'QCD confinement', col: '#ffb86b', T: P.T_qcd, set: T => { P.T_qcd = clamp(T, 0.03, 3); }, desc: 'Quarks and gluons bind into hadrons; g* drops from ~61 to ~17.' },
    { id: 'inj', label: P.dN_inj > 0 ? `Dark radiation (ΔN=${fmt(P.dN_inj, 2)})` : 'Dark radiation (off)', col: '#5ef0a8', T: P.T_inj, dim: !(P.dN_inj > 0), set: T => { P.T_inj = clamp(T, 1e-7, 1); if (!(P.dN_inj > 0)) P.dN_inj = 1; }, desc: 'A new light particle appears at T_inj. Dragging switches it on with ΔN_eff = 1 (set it in Thermal history).' },
  ];
}
function seqCanvas() {
  const cv = $('#seq'), W = cv.clientWidth, H = cv.clientHeight, dpr = Math.min(window.devicePixelRatio || 1, 2);
  if (cv.width !== Math.round(W * dpr) || cv.height !== Math.round(H * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); }
  const c = cv.getContext('2d'); c.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { cv, c, W, H };
}
// warped log-T axis: the crowded late universe (T < 1 eV) gets three times the room per decade
function uOf(lT) { const lm = ltMin(), bk = -9; const tot = (LT_MAX - bk) + 3 * (bk - lm); return lT >= bk ? (LT_MAX - lT) / tot : ((LT_MAX - bk) + 3 * (bk - lT)) / tot; }
function ltOfU(u) { const lm = ltMin(), bk = -9; const tot = (LT_MAX - bk) + 3 * (bk - lm), ub = (LT_MAX - bk) / tot; return u <= ub ? LT_MAX - u * tot : bk - (u * tot - (LT_MAX - bk)) / 3; }
const sxOf = (lT, W) => 24 + uOf(lT) * (W - 48);
const ltOf = (x, W) => ltOfU((x - 24) / (W - 48));
function placeLabels(c, items, rowsY, W) {
  const ends = rowsY.map(() => -1e9);
  for (const it of items.sort((a, b) => a.x - b.x)) {
    const w = c.measureText(it.text).width;
    let left = clamp(it.x - w / 2, 2, W - w - 2), r = ends.findIndex(e => e < left - 6);
    if (r < 0) r = ends.indexOf(Math.min(...ends));
    ends[r] = left + w; it.lx = left; it.ly = rowsY[r]; it.w = w;
  }
  return items;
}
function drawSeq() {
  if (!R) return;
  const { c, W, H } = seqCanvas();
  const X = lT => sxOf(lT, W);
  c.clearRect(0, 0, W, H);
  c.font = '11px Inter, system-ui, sans-serif'; c.textBaseline = 'middle';
  const narrow = W < 700;
  // --- eras
  const Teq = R.tl.TAta(1 / (1 + Math.max(R.rec.zeq, 0.01))), TML = R.ft.zML !== null ? R.tl.TAta(1 / (1 + R.ft.zML)) : R.cp.T0;
  const eras = [
    ['Inflation', L10(P.T_rh), '#2c1f5c'], ['Electroweak plasma', L10(P.T_sph), '#46204a'], ['Quark–gluon plasma', L10(P.T_qcd), '#55222f'],
    ['Hadrons & leptons', L10(0.511e-3 * P.me_s / 3), '#4a3320'], ['Radiation era', L10(Teq), '#474019'], ['Matter era', L10(TML), '#1f2658'], ['Dark energy', ltMin(), '#15392f'],
  ];
  let cur = LT_MAX;
  for (const [name, to0, col] of eras) {
    const to = Math.min(cur, to0);
    if (to < cur) {
      const x0 = X(cur), x1 = X(to);
      c.fillStyle = col; c.fillRect(x0, 6, x1 - x0, 26);
      c.fillStyle = '#e8eaf8cc'; const w = c.measureText(name).width;
      if (x1 - x0 > w + 8) c.fillText(name, (x0 + x1) / 2 - w / 2, 19);
    }
    cur = to;
  }
  // --- mass thresholds
  c.fillStyle = '#8990b9';
  const ticks = R.th.species.filter(s => s.m > 0).map(s => ({ x: X(L10(s.m / 3)), text: s.sym, col: s.col }));
  ticks.push({ x: X(L10(0.938 / 3)), text: 'p,n', col: '#ff7a8c' });
  c.font = '10px Inter, system-ui, sans-serif';
  placeLabels(c, ticks, [50, 60, 70], W);
  for (const t of ticks) { c.strokeStyle = t.col; c.globalAlpha = 0.8; c.beginPath(); c.moveTo(t.x, 34); c.lineTo(t.x, 44); c.stroke(); c.globalAlpha = 1; c.fillStyle = t.col; c.fillText(t.text, t.lx, t.ly); }
  c.font = '11px Inter, system-ui, sans-serif';
  // --- energy budget strip
  const yS = 150, hS = 16;
  for (let x = 24; x < W - 24; x += 2) {
    const T = Math.pow(10, ltOf(x, W));
    const fr = lnInterp(R._lnT, R.tl.fr, T), fm = lnInterp(R._lnT, R.tl.fm, T), fl = Math.max(0, lnInterp(R._lnT, R.tl.fl, T));
    const s = fr + fm + fl || 1;
    let y = yS;
    c.fillStyle = COL.rad; c.fillRect(x, y, 2, hS * fr / s); y += hS * fr / s;
    c.fillStyle = COL.mat; c.fillRect(x, y, 2, hS * fm / s); y += hS * fm / s;
    c.fillStyle = COL.de; c.fillRect(x, y, 2, hS * fl / s);
  }
  c.fillStyle = '#8990b9'; c.fillText('energy budget', 26, yS - 7);
  // --- draggable causes
  const yD = 124;
  const defs = dragDefs().filter(d => isFinite(d.T) && d.T > 0);
  const dl = placeLabels(c, defs.map(d => ({ x: X(L10(d.T)), text: d.label, d })), [80, 94, 108], W);
  SEQ.markers = [];
  for (const it of dl) {
    const d = it.d, x = it.x, hot = SEQ.hover === d.id || (SEQ.drag && SEQ.drag.id === d.id);
    c.globalAlpha = d.dim ? 0.45 : 1;
    c.strokeStyle = d.col + '99'; c.beginPath(); c.moveTo(x, it.ly + 6); c.lineTo(x, yD - 9); c.stroke();
    c.fillStyle = d.col; c.shadowColor = d.col; c.shadowBlur = hot ? 18 : 10;
    c.beginPath(); c.arc(x, yD, hot ? 9 : 7.5, 0, 7); c.fill(); c.shadowBlur = 0;
    c.fillStyle = '#0a0c19'; c.beginPath(); c.arc(x, yD, 2.5, 0, 7); c.fill();
    c.fillStyle = d.col; c.fillText(it.text, it.lx, it.ly);
    c.globalAlpha = 1;
    SEQ.markers.push({ id: d.id, x, y: yD, d });
  }
  // --- computed consequences
  const yC = 196;
  const skip = new Set(['reheat', 'bgen', 'ew', 'dmfo', 'qcd', 'inj']);
  const ev = R.epochs.filter(e => !skip.has(e.id) && e.T > 0);
  const cl = placeLabels(c, ev.map(e => ({ x: X(clamp(L10(e.T), ltMin(), LT_MAX)), text: narrow ? e.name.split(' ')[0] : e.name, e })), [216, 229, 242, 255, 268], W);
  for (const it of cl) {
    const hot = SEQ.hover === 'e:' + it.e.id;
    c.strokeStyle = '#ffffff30'; c.beginPath(); c.moveTo(it.x, yC + 6); c.lineTo(it.x, it.ly - 6); c.stroke();
    c.fillStyle = hot ? '#ffffff' : '#ffd66b'; c.save(); c.translate(it.x, yC); c.rotate(Math.PI / 4); c.fillRect(-4, -4, 8, 8); c.restore();
    c.fillStyle = hot ? '#ffffff' : '#c9cdea'; c.fillText(it.text, it.lx, it.ly);
    SEQ.markers.push({ id: 'e:' + it.e.id, x: it.x, y: yC, e: it.e });
  }
  // --- axes
  const yA = H - 64;
  c.strokeStyle = '#2a3160'; c.beginPath(); c.moveTo(24, yA); c.lineTo(W - 24, yA); c.stroke();
  // label spacing adapts to width: ~100 px per labelled tick
  const pxDec = Math.abs(X(0) - X(1)), nice = v => [1, 2, 3, 4, 6, 8, 12].find(n => n >= v) || 12;
  const step = nice(100 / pxDec), stepLate = nice(100 / Math.abs(X(-10) - X(-11)));
  c.fillStyle = '#8990b9'; c.textAlign = 'center';
  for (let e = 18; e >= ltMin(); e -= 1) {
    const major = e > -9 ? e % step === 0 : e % stepLate === 0;
    const x = X(e); c.strokeStyle = '#2a3160'; c.beginPath(); c.moveTo(x, yA - (major ? 6 : 3)); c.lineTo(x, yA + (major ? 6 : 3)); c.stroke();
    if (major) {
      const T = Math.pow(10, e);
      c.fillStyle = '#c9cdea'; c.fillText(fmtT(T), x, yA + 16);
      c.fillStyle = '#8990b9'; c.fillText(fmtTime(R.tl.tAtT(T)), x, yA + 34);
    }
  }
  c.textAlign = 'left'; c.fillStyle = '#5a6190';
  c.fillText('temperature →', 26, yA + 50); c.textAlign = 'right'; c.fillText('cosmic time after the Big Bang', W - 26, yA + 50); c.textAlign = 'left';
  // --- cursor
  const xc = X(SEQ.lT);
  c.strokeStyle = '#ffffffaa'; c.setLineDash([3, 3]); c.beginPath(); c.moveTo(xc, 36); c.lineTo(xc, yA); c.stroke(); c.setLineDash([]);
  c.fillStyle = '#ffffff'; c.beginPath(); c.moveTo(xc - 5, yA - 1); c.lineTo(xc + 5, yA - 1); c.lineTo(xc, yA - 8); c.fill();
}
function seqPointer() {
  const cv = $('#seq'), tip = $('#seq-tip');
  const pos = e => { const r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  // on narrow screens the timeline is wider than its box: nudge the scroll when a drag nears the visible edge
  const wrap = cv.parentElement;
  const edgeScroll = e => { const r = wrap.getBoundingClientRect(); if (e.clientX < r.left + 40) wrap.scrollLeft -= 14; else if (e.clientX > r.right - 40) wrap.scrollLeft += 14; };
  const hit = (x, y) => { let best = null; for (const m of SEQ.markers || []) { const d = Math.hypot(m.x - x, m.y - y); if (d < 14 && (!best || d < best.d)) best = { d, m }; } return best && best.m; };
  cv.addEventListener('pointerdown', e => {
    const [x, y] = pos(e), m = hit(x, y);
    try { cv.setPointerCapture(e.pointerId); } catch (err) { /* synthetic or already-released pointer */ }
    if (m && m.d) { SEQ.drag = { id: m.id, ratio: m.d.ratio ? m.d.ratio() : 1 }; tip.style.display = 'none'; }
    else { SEQ.scrub = true; SEQ.lT = clamp(ltOf(x, cv.clientWidth), ltMin(), LT_MAX); drawSeq(); renderInspector(); }
  });
  cv.addEventListener('pointermove', e => {
    const [x, y] = pos(e), W = cv.clientWidth;
    if (SEQ.drag) {
      edgeScroll(e);
      const d = dragDefs().find(q => q.id === SEQ.drag.id);
      d.set(Math.pow(10, ltOf(x, W)), SEQ.drag); changed(); return;
    }
    if (SEQ.scrub || SEQ.drag) edgeScroll(e);
    if (SEQ.scrub) { SEQ.lT = clamp(ltOf(x, W), ltMin(), LT_MAX); drawSeq(); renderInspector(); return; }
    const m = hit(x, y), id = m ? m.id : null;
    cv.style.cursor = m && m.d ? 'grab' : 'crosshair';
    if (id !== SEQ.hover) { SEQ.hover = id; drawSeq(); }
    if (m) {
      const info = m.d || m.e, T = m.d ? m.d.T : m.e.T;
      tip.innerHTML = `<b>${m.d ? m.d.label : m.e.name}</b><br>T = ${fmtT(T)} (${fmtK(T)})<br>t = ${fmtTime(T >= 1.2e19 ? 5.4e-44 : R.tl.tAtT(T))}<br><span style="white-space:normal;display:block;max-width:260px;color:#c3c7e6">${m.d ? m.d.desc : m.e.desc}</span>`;
      tip.style.display = 'block'; tip.style.whiteSpace = 'nowrap';
      tip.style.left = clamp(x + 14, 0, W - tip.offsetWidth - 4) + 'px'; tip.style.top = (y + 14) + 'px';
    } else tip.style.display = 'none';
  });
  const end = () => { SEQ.drag = null; SEQ.scrub = false; };
  cv.addEventListener('pointerup', end); cv.addEventListener('pointercancel', end);
  cv.addEventListener('pointerleave', () => { if (!SEQ.drag) { SEQ.hover = null; tip.style.display = 'none'; drawSeq(); } });
  new ResizeObserver(() => { if (tab === 'seq') drawSeq(); }).observe(cv);
}
function renderInspector() {
  const T = Math.pow(10, SEQ.lT), tl = R.tl;
  const t = T >= 1.2e19 ? 5.4e-44 : tl.tAtT(T), a = tl.aAtT(T), z = 1 / a - 1, g = R.th.g(T);
  const H = Math.exp(lnInterp(R._lnT, Array.from(tl.H, Math.log), T));
  const fr = lnInterp(R._lnT, tl.fr, T), fm = lnInterp(R._lnT, tl.fm, T), fl = lnInterp(R._lnT, tl.fl, T);
  $('#insp-now').innerHTML = `t = ${fmtTime(t)} &nbsp;·&nbsp; T = ${fmtT(T)}`;
  const kv = [
    ['Temperature', UNITS === 'SI' ? fmtK(T) : `${fmtT(T)} = ${fmtK(T)}`], ['Time since Big Bang', fmtTime(t)], ['Scale factor a', fmt(a)], ['Redshift z', fmt(z)],
    ['Hubble rate H', fmt(H) + ' s⁻¹'], ['Hubble radius c/H', fmtLen(2.998e8 / H)], ['g<sub>*</sub>, g<sub>*s</sub>', `${fmt(g.gr, 4)}, ${fmt(g.gs, 4)}`],
    ['T<sub>ν</sub>/T<sub>γ</sub>', fmt(g.r, 4)], ['Energy budget', `rad ${fmt(fr * 100, 3)}% · matter ${fmt(fm * 100, 3)}% · DE ${fmt(fl * 100, 2)}%`],
  ];
  $('#insp-kv').innerHTML = kv.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('');
  // what is happening: nearby epochs, else the era
  const near = R.epochs.filter(e => Math.abs(L10(e.T) - SEQ.lT) < 0.45).sort((p, q) => Math.abs(L10(p.T) - SEQ.lT) - Math.abs(L10(q.T) - SEQ.lT));
  let hap = near.length ? near.slice(0, 2).map(e => `<b>${e.name}</b> — ${e.desc}`).join('<br>') : eraText(T);
  $('#insp-happen').innerHTML = hap;
  // composition bars
  const comp = R.th.composition(T), ng = 2 * ZETA3 / (Math.PI * Math.PI) * T ** 3, rowsB = [];
  for (const s of comp) { const v = s.n / ng; if (v > 1e-14) rowsB.push({ name: s.name + (s.anti ? ' (+anti)' : ''), v, col: s.col }); }
  const sOverN = Math.PI ** 4 * g.gs / (45 * ZETA3);
  const dmY = T > P.m_dm ? R.dm.hist.Yeq[0] || 0 : GP.lerp(R.dm.hist.x, R.dm.hist.Y, P.m_dm / T);
  if (dmY > 0) rowsB.push({ name: 'Dark matter χ', v: dmY * sOverN, col: COL.dm });
  const etaT = Math.abs(R.eta) * g.gs / R.cp.gs0;
  if (T < R.bg.Tgen && etaT > 0) rowsB.push({ name: 'Matter excess (net B)', v: etaT, col: '#ff5d73' });
  rowsB.sort((p, q) => q.v - p.v);
  $('#insp-bars').innerHTML = rowsB.slice(0, 16).map(r => `<div class="bar"><span>${r.name}</span><span class="t"><i style="width:${clamp((L10(r.v) + 12) / 13 * 100, 1, 100)}%;background:${r.col}"></i></span><span class="n">${fmt(r.v, 2)}</span></div>`).join('');
  SOUP.target(T, comp, dmY * sOverN, etaT);
}
function eraText(T) {
  if (T > P.T_rh) return '<b>Inflation</b> — before reheating there is no thermal plasma: a scalar field drives exponential expansion and imprints quantum fluctuations.';
  if (T > P.T_sph) return '<b>Unbroken electroweak plasma</b> — all Standard-Model particles are massless and in equilibrium; sphalerons freely violate B+L.';
  if (T > P.T_qcd) return '<b>Quark–gluon plasma</b> — free quarks and gluons; heavy particles annihilate one by one as T drops below their mass.';
  if (T > 0.511e-3 * P.me_s / 3) return '<b>Hadrons and leptons</b> — protons, neutrons, pions, muons, electrons, neutrinos and photons.';
  if (T > 1e-6) return '<b>Nuclear era</b> — photons dominate; light nuclei form in the first minutes.';
  const z = 1 / R.tl.aAtT(T) - 1;
  if (z > R.rec.zstar) return '<b>Photon–baryon fluid</b> — sound waves ring through the plasma until recombination.';
  if (z > P.z_re) return '<b>Dark ages</b> — neutral hydrogen, no stars yet; dark-matter halos grow.';
  return '<b>Age of galaxies</b> — stars, galaxies and clusters form; dark energy eventually takes over.';
}
function renderSeq() {
  drawSeq(); renderInspector();
  const st = R.st, ref = PIN || BASE;
  $('#seq-cmp').textContent = PIN ? 'Δ vs pinned universe' : 'Δ vs standard ΛCDM';
  $('#seq-stats').innerHTML = [
    stat('Baryon asymmetry η', R.eta, { obs: [6.104e-10, 0.058e-10], key: r => r.eta, hl: 1 }),
    stat('Dark matter Ω<sub>c</sub>h²', R.omega_c, { obs: OBS.omega_c, key: r => r.omega_c, d: 4, hl: 1 }),
    stat('Helium Y<sub>p</sub>', R.nuc.Yp, { obs: OBS.Yp, key: r => r.nuc.Yp, d: 4 }),
    stat('Deuterium D/H', R.nuc.DH, { obs: OBS.DH, key: r => r.nuc.DH }),
    stat('CMB released at z<sub>*</sub>', R.rec.zstar, { obs: OBS.zstar, key: r => r.rec.zstar, d: 5 }),
    stat('Age of universe', R.tl.age, { obs: OBS.age, key: r => r.tl.age, d: 4, u: ' Gyr' }),
    stat('Clumpiness σ<sub>8</sub>', R.st.sigma8, { obs: OBS.sigma8, key: r => r.st.sigma8 }),
    stat('First galaxies (10⁸ M☉, 3σ)', st.zFirstGal !== null ? 'z ≈ ' + fmt(st.zFirstGal, 3) : 'never', { note: st.zFirstGal !== null ? fmtTime(R.tl.tAta(1 / (1 + st.zFirstGal))) : 'no collapse' }),
    stat('Milky-Way halos per Gpc³', st.nMW * 1e9, { key: r => r.st.nMW * 1e9 }),
    stat('Fate of the universe', fateTxt(R), { note: R.ft.tEnd ? 'in ' + fmt(R.ft.tEnd - R.tl.age, 3) + ' Gyr' : 'eternal acceleration' }),
  ].join('');
  renderNotes('#seq-notes');
}
function renderNotes(sel) {
  const n = R.notes.length ? R.notes : [{ lvl: 'good', txt: 'This history reproduces our universe: every Sakharov condition is met, light elements, CMB and structure agree with observation.' }];
  $(sel).innerHTML = n.map(x => `<li class="${x.lvl}">${x.txt}</li>`).join('');
}

/* ------------------------------------------------------------ plasma soup */
const SOUP = {
  parts: [], fx: [], want: {}, running: false, last: 0,
  target(T, comp, dmN, eta) {
    const tot = comp.reduce((s, c) => s + c.n, 0) + dmN;
    const N = 240, want = {};
    for (const c of comp) {
      const k = N * c.n / tot;
      if (k < 0.5) continue;
      if (c.anti) { want[c.id + '+'] = { n: Math.round(k / 2), col: c.col, m: c.m, anti: false, sym: c.sym }; want[c.id + '-'] = { n: Math.round(k / 2), col: c.col, m: c.m, anti: true, sym: c.sym }; }
      else want[c.id] = { n: Math.round(k), col: c.col, m: c.m, anti: false, sym: c.sym };
    }
    if (dmN / tot * N >= 0.5) want.dm = { n: Math.round(N * dmN / tot), col: COL.dm, m: P.m_dm, sym: 'χ' };
    else if (R.omega_c > 1e-4 && T < R.dm.Tf) want.dm = { n: 4, col: COL.dm, m: P.m_dm, sym: 'χ', relic: 1 };
    // matter survivors are 1 in ~10^9: shown exaggerated
    if (eta > 1e-14 && T < 0.938 / 25) want.bary = { n: 7, col: '#ff5d73', m: 0.938, sym: 'p', relic: 1 };
    if (eta > 1e-14 && T < 0.511e-3 * P.me_s / 20) want.elec = { n: 7, col: '#8be9fd', m: 5e-4, sym: 'e', relic: 1 };
    this.want = want; this.T = T;
    if (!this.running) { this.running = true; requestAnimationFrame(t => this.frame(t)); }
  },
  frame(t) {
    const cv = $('#soup');
    if (tab !== 'seq' || !cv) { this.running = false; return; }
    const dt = Math.min(50, t - (this.last || t)) / 16.7; this.last = t;
    const W = cv.clientWidth, H = cv.clientHeight, dpr = Math.min(window.devicePixelRatio || 1, 2);
    if (cv.width !== Math.round(W * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); }
    const c = cv.getContext('2d'); c.setTransform(dpr, 0, 0, dpr, 0, 0);
    // reconcile populations: annihilate pairs / create pairs, a few per frame
    const counts = {};
    for (const p of this.parts) counts[p.k] = (counts[p.k] || 0) + 1;
    let budget = 6;
    for (const k of Object.keys(counts)) if (!this.want[k] && budget > 0) { this.kill(k, Math.min(counts[k], 3)); budget--; }
    for (const [k, w] of Object.entries(this.want)) {
      const have = counts[k] || 0;
      if (have > w.n && budget > 0) { this.kill(k, Math.min(have - w.n, 2)); budget--; }
      else if (have < w.n && budget > 0) { for (let i = 0; i < Math.min(w.n - have, 3); i++) this.spawn(k, w, W, H); budget--; }
    }
    c.fillStyle = 'rgba(8,6,18,0.35)'; c.fillRect(0, 0, W, H);
    const T = this.T || 1;
    for (const p of this.parts) {
      const sp = p.m > 0 ? Math.min(2.2, 0.25 + 1.6 * Math.sqrt(T / p.m)) : 2.4;
      p.vx += (Math.random() - 0.5) * 0.5; p.vy += (Math.random() - 0.5) * 0.5;
      const v = Math.hypot(p.vx, p.vy) || 1; p.vx *= sp / v; p.vy *= sp / v;
      p.x = (p.x + p.vx * dt + W) % W; p.y = (p.y + p.vy * dt + H) % H;
      const r = p.m === 0 ? 1.8 : p.relic ? 4.2 : 3;
      c.globalAlpha = p.age < 1 ? p.age : 1; p.age += 0.05 * dt;
      if (p.anti) { c.strokeStyle = p.col; c.lineWidth = 1.4; c.beginPath(); c.arc(p.x, p.y, r, 0, 7); c.stroke(); }
      else { c.fillStyle = p.col; c.beginPath(); c.arc(p.x, p.y, r, 0, 7); c.fill(); }
      if (p.relic) { c.fillStyle = '#fff'; c.font = '9px Inter'; c.fillText(p.sym, p.x + 5, p.y - 4); }
    }
    c.globalAlpha = 1;
    this.fx = this.fx.filter(f => { f.r += 1.6 * dt; f.a -= 0.05 * dt; if (f.a <= 0) return false; c.strokeStyle = `rgba(255,240,200,${f.a})`; c.lineWidth = 1.5; c.beginPath(); c.arc(f.x, f.y, f.r, 0, 7); c.stroke(); return true; });
    c.fillStyle = '#8990b9'; c.font = '10.5px Inter'; c.fillText('filled = particle · ring = antiparticle · flash = pair annihilation/creation', 8, H - 8);
    requestAnimationFrame(tt => this.frame(tt));
  },
  spawn(k, w, W, H) {
    const x = Math.random() * W, y = Math.random() * H;
    this.parts.push({ k, x, y, vx: Math.random() - 0.5, vy: Math.random() - 0.5, col: w.col, m: w.m, anti: w.anti, relic: w.relic, sym: w.sym, age: 0 });
    if (w.m > 0 && !w.relic) this.fx.push({ x, y, r: 2, a: 0.7 });
  },
  kill(k, n) {
    for (let i = 0; i < n; i++) {
      const idx = this.parts.findIndex(p => p.k === k); if (idx < 0) return;
      const p = this.parts[idx]; this.parts.splice(idx, 1);
      if (p.m > 0) this.fx.push({ x: p.x, y: p.y, r: 2, a: 0.9 });
    }
  },
};
function play() {
  const btn = $('#btn-play');
  if (SEQ.playing) { SEQ.playing = false; btn.textContent = '▶ Play the Big Bang'; return; }
  SEQ.playing = true; btn.textContent = '❚❚ Pause';
  if (SEQ.lT <= ltMin() + 0.05) SEQ.lT = LT_MAX;
  let last = performance.now(), lastInsp = 0;
  const step = now => {
    if (!SEQ.playing) return;
    const dt = (now - last) / 1000; last = now;
    SEQ.lT -= dt * (LT_MAX - ltMin()) / 45;
    if (SEQ.lT <= ltMin()) { SEQ.lT = ltMin(); SEQ.playing = false; btn.textContent = '▶ Play the Big Bang'; }
    if (tab === 'seq') { drawSeq(); if (now - lastInsp > 120) { renderInspector(); lastInsp = now; } }
    requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

/* ============================================================ THERMAL */
function buildSpeciesTable() {
  const tb = $('#species-table');
  tb.innerHTML = GP.SPECIES.filter(s => s.m > 0).map(s => `<tr data-id="${s.id}"><td><input type="checkbox" title="include this species"></td><td class="nm" style="color:${s.col}">${s.name}</td><td style="width:40%"><input type="range" min="0" max="1000"></td><td class="mv"></td></tr>`).join('');
  for (const tr of $$('tr', tb)) {
    const id = tr.dataset.id, chk = $('input[type=checkbox]', tr), rng = $('input[type=range]', tr);
    chk.onchange = () => { if (chk.checked) delete P.off[id]; else P.off[id] = true; changed(); };
    rng.oninput = () => { const v = Math.pow(10, -1 + rng.value / 500); const vv = Math.abs(L10(v)) < 0.02 ? 1 : parseFloat(v.toPrecision(3)); if (id === 'e') P.me_s = vv; else P.massScale[id] = vv; paintRange(rng); changed(); };
  }
}
function syncSpecies() {
  for (const tr of $$('#species-table tr')) {
    const id = tr.dataset.id, s = GP.SPECIES.find(q => q.id === id), sc = id === 'e' ? P.me_s : (P.massScale[id] || 1);
    $('input[type=checkbox]', tr).checked = !P.off[id];
    const rng = $('input[type=range]', tr); rng.value = (L10(sc) + 1) * 500; paintRange(rng);
    $('.mv', tr).textContent = fmtT(s.m * sc) + (sc !== 1 ? ` (×${fmt(sc, 3)})` : '');
  }
}
function renderThermal() {
  syncSpecies();
  const tl = R.tl, bt = BASE.tl;
  const [xg, yg] = pick(Array.from(tl.T), Array.from(tl.gr), T => T < 1e5 && T > 1e-9);
  const [, ys] = pick(Array.from(tl.T), Array.from(tl.gs), T => T < 1e5 && T > 1e-9);
  const [bx, by] = pick(Array.from(bt.T), Array.from(bt.gr), T => T < 1e5 && T > 1e-9);
  plot('c-g').set({
    x: { log: 1, rev: 1, label: 'Temperature T [GeV]', short: 'T [GeV]' }, y: { label: 'degrees of freedom', short: 'g', min: 0, max: Math.max(120, ...yg) * 1.02 },
    series: [{ name: 'g* (energy)', x: xg, y: yg, color: COL.rad, width: 2.2 }, { name: 'g*s (entropy)', x: xg, y: ys, color: COL.dm, dash: [5, 4] }, { name: 'Standard Model', x: bx, y: by, color: COL.base, dash: [2, 3], width: 1.2 }],
    vlines: [{ x: P.T_sph, label: 'EW', color: '#82aaff' }, { x: P.T_qcd, label: 'QCD', color: '#ffb86b' }, { x: P.T_dnu, label: 'ν dec', color: '#b6f09c' }, { x: 0.511e-3 * P.me_s / 3, label: 'e±', color: '#8be9fd', dy: 14 }],
  });
  const tt = Array.from(tl.t), TT = Array.from(tl.T);
  plot('c-tT').set({
    x: { log: 1, rev: 1, label: 'Temperature T [GeV]', short: 'T [GeV]' }, y: { log: 1, label: 'time since Big Bang [s]', short: 't [s]', fmt: fmtTime },
    series: [{ name: 'this universe', x: TT, y: tt, color: '#7cc4ff', width: 2 }, { name: 'standard', x: Array.from(bt.T), y: Array.from(bt.t), color: COL.base, dash: [4, 4], width: 1.2 }],
    hlines: [{ y: 1, label: '1 second', color: '#5a6190' }, { y: 3.156e7, label: '1 year', color: '#5a6190' }, { y: 3.156e16, label: '1 Gyr', color: '#5a6190' }],
  });
  plot('c-budget').set({
    x: { log: 1, min: 1, max: 1e18, label: 'time since Big Bang [s] (all radiation before 1 s)', short: 't', fmt: fmtTime }, y: { min: 0, max: 1, label: 'fraction of energy density', short: 'Ω' },
    series: [{ name: 'radiation', x: tt, y: Array.from(tl.fr), color: COL.rad, width: 2 }, { name: 'matter', x: tt, y: Array.from(tl.fm), color: COL.mat, width: 2 }, { name: 'dark energy', x: tt, y: Array.from(tl.fl), color: COL.de, width: 2 }],
  });
  const g1 = R.th.g(1e3), g2 = R.th.g(1e-3), g3 = R.th.g(R.cp.T0);
  $('#s-thermal').innerHTML = [
    stat('g* at 1 TeV', g1.gr, { key: r => r.th.g(1e3).gr, d: 4 }), stat('g* at 1 MeV (BBN)', g2.gr, { key: r => r.th.g(1e-3).gr, d: 4 }),
    stat('g*s today', g3.gs, { key: r => r.th.g(r.cp.T0).gs, d: 4 }), stat('T<sub>ν</sub>/T<sub>γ</sub> today', g3.r, { note: '(4/11)^⅓ = 0.7138', d: 4 }),
    stat('Time at T = 1 MeV', fmtTime(R.tl.tAtT(1e-3)), {}), stat('Time at QCD transition', fmtTime(R.tl.tAtT(P.T_qcd)), {}),
    stat('Time at EW transition', fmtTime(R.tl.tAtT(P.T_sph)), {}), stat('Radiation today ω<sub>r</sub>', R.cp.omega_r, { key: r => r.cp.omega_r }),
  ].join('');
}

/* ============================================================ INFLATION */
function renderInflation() {
  const inf = R.inf;
  $('#s-inf').innerHTML = [
    stat('Spectral index n<sub>s</sub>', inf.ns, { obs: OBS.ns, key: r => r.inf.ns, d: 4, hl: 1 }),
    stat('Tensor-to-scalar r', inf.r, { note: 'BICEP/Keck: r < 0.036', key: r => r.inf.r, hl: 1 }),
    stat('Energy scale V<sup>¼</sup>', fmt(inf.V14) + ' GeV', {}), stat('Hubble rate H<sub>inf</sub>', fmt(inf.Hinf) + ' GeV', {}),
    stat('Max. reheating T (instant)', fmt(inf.Tmax) + ' GeV', {}), stat('Chosen T<sub>rh</sub>', fmt(P.T_rh) + ' GeV', { note: P.T_rh > inf.Tmax ? 'too hot for this model!' : 'allowed' }),
    stat('n<sub>s</sub> used for structure', R.ns, { note: P.link_inf ? 'from this model' : 'set by hand', d: 4 }),
  ].join('');
  const Ns = [], models = { starobinsky: ['Starobinsky R²', '#5ef0a8'], quadratic: ['m²φ²', '#ff7a8c'], quartic: ['λφ⁴', '#ffb86b'], hilltop: ['hilltop', '#7cc4ff'] };
  for (let n = 50; n <= 60.01; n += 1) Ns.push(n);
  const series = Object.entries(models).map(([m, [name, col]]) => {
    const pts = Ns.map(n => GP.inflation(Object.assign({}, P, { inf_model: m, Ne: n })));
    return { name: name + ' (N=50–60)', x: pts.map(p => p.ns), y: pts.map(p => p.r), color: col, width: 3 };
  });
  plot('c-nsr', 'tall').set({
    x: { min: 0.93, max: 1.0, label: 'spectral index n_s', short: 'n_s' }, y: { log: 1, min: 1e-6, max: 1, label: 'tensor-to-scalar ratio r', short: 'r' },
    series,
    rects: [{ x0: 0.9565, x1: 0.9733, y0: 1e-6, y1: 0.036, color: '#5ef0a81a', label: '95% Planck + BICEP/Keck' }, { x0: 0.9607, x1: 0.9691, y0: 1e-6, y1: 0.036, color: '#5ef0a826' }],
    hlines: [{ y: 0.036, label: 'r < 0.036 (95%)', color: '#ff6b81' }],
    dots: [{ x: inf.ns, y: Math.max(inf.r, 1.1e-5), color: '#ffffff', r: 5, ring: 1, label: 'this universe' }],
  });
}

/* ============================================================ BARYOGENESIS */
let bgScanKey = null, bgScan = null;
function renderBary() {
  const bg = R.bg, eta = R.eta;
  $('#s-bary').innerHTML = [
    stat('η = n<sub>B</sub>/n<sub>γ</sub>', bg.eta, { obs: [6.104e-10, 0.058e-10], key: r => r.bg.eta, hl: 1 }),
    stat('Efficiency κ', bg.kappa, { note: 'fraction of max. asymmetry kept', key: r => r.bg.kappa }),
    stat('Asymmetry made at', fmtT(bg.Tgen), { note: 'z ≈ ' + fmt(bg.zGen, 3) + ' · t ≈ ' + fmtTime(R.tl.tAtT(bg.Tgen)) }),
    stat('Sphalerons switch off', fmtT(P.T_sph), { note: 'z = M/T = ' + fmt(bg.zsph, 3) }),
    stat('Ω<sub>b</sub>h² used downstream', R.omega_b, { obs: OBS.omega_b, key: r => r.omega_b, d: 4, note: P.link_eta ? 'linked' : 'manual' }),
    stat('Photon dilution f', bg.f, { note: 'g*s(M)/g*s(0) based', d: 4 }),
  ].join('');
  // Sakharov checklist
  const bv = P.bg_mode === 'lepto' ? (bg.Tgen > P.T_sph ? ['good', 'L is violated by X decays and sphalerons (active above T<sub>sph</sub>) turn it into B.'] : ['bad', 'L is violated, but sphalerons are already off when the asymmetry appears — no B.'])
    : P.bg_mode === 'gut' ? (bg.Tgen > P.T_sph ? ['bad', 'B is violated but B−L = 0: sphalerons, still active, wash out B+L = everything.'] : ['good', 'B violated after sphaleron freeze-out: it survives.']) : ['good', 'Both B and B−L are violated: the B−L part survives sphalerons.'];
  const cp = P.eps !== 0 ? ['good', `C and CP violated: each decay is biased by ε = ${fmt(P.eps)}.`] : ['bad', 'ε = 0: X and anti-X decay identically — no asymmetry.'];
  const noneq = !bg.thermalStart && P.M_X / P.T_rh > 30 ? ['bad', `T<sub>rh</sub> ≪ M<sub>X</sub>: X is barely ever produced (N ~ e^−${fmt(P.M_X / P.T_rh, 2)}).`]
    : P.K > 100 ? ['warn', `Strong washout (K = ${fmt(P.K)}): inverse decays keep X near equilibrium, only κ ≈ ${fmt(bg.kappa, 2)} survives.`] : ['good', `Decays happen out of equilibrium (K = ${fmt(P.K)}).`];
  $('#sakharov').innerHTML = [['1 · Baryon number violation', bv], ['2 · C and CP violation', cp], ['3 · Departure from equilibrium', noneq]].map(([h, [c, t]]) => `<li class="${c}"><b>${h}</b><br>${t}</li>`).join('');
  const ae = Math.abs(eta);
  $('#annih').innerHTML = ae > 1e-15
    ? `<p>For every <b class="mono">${Math.round(1 / ae).toLocaleString('en-US')}</b> antiquarks there were <b class="mono">${Math.round(1 / ae + 1).toLocaleString('en-US')}</b> quarks.</p><p class="muted">They annihilated into photons at T ≈ 40 MeV (baryons) and 20 keV (e⁺e⁻). The one-in-${fmt(1 / ae, 2)} survivors are every atom in the universe — the ratio of photons to baryons we still measure in the CMB.</p>${eta < 0 ? '<p class="muted">η &lt; 0: the survivors are antimatter. Nothing would look different — we would simply call it matter.</p>' : ''}`
    : `<p><b>Perfect annihilation.</b> Matter and antimatter were created equally, so they annihilate almost completely. Symmetric freeze-out leaves n<sub>B</sub>/n<sub>γ</sub> ~ 10⁻¹⁹ — about 10 billion times too few baryons for stars.</p><p class="muted">What remains: photons, neutrinos and dark matter. Dark halos still form (see Galaxies), but no gas cools in them.</p>`;
  // evolution chart
  const h = bg.hist, zc = bg.zsph;
  const Aabs = h.A.map(Math.abs), A2abs = h.A2.map(Math.abs);
  plot('c-bg', 'tall').set({
    x: { log: 1, label: 'z = M_X / T  (time →)', short: 'z' }, y: { log: 1, floor: 1e14, label: 'abundance per photon (comoving)', short: 'N' },
    series: [
      { name: 'N_X (heavy particle)', x: h.z, y: h.Nx, color: '#ffb86b', width: 2.2 },
      { name: 'N_X equilibrium', x: h.z, y: h.Neq, color: '#ffb86b', dash: [4, 4], width: 1.2 },
      { name: P.bg_mode === 'lepto' ? '|N_B−L| before sphaleron freeze-out' : '|asymmetry| before freeze-out', x: h.z, y: Aabs, color: '#ff7a8c', width: 2.2 },
      { name: '|asymmetry| made after freeze-out', x: h.z, y: A2abs, color: '#6ee7ff', width: 2 },
    ],
    vlines: [{ x: zc, label: 'sphalerons off (T_sph)', color: '#82aaff' }].concat(bg.z0 > 0.011 ? [{ x: bg.z0, label: 'reheating', color: '#c792ea', dy: 14 }] : []),
  });
  // scan eta vs M_X
  const key = JSON.stringify([P.K, P.eps, P.T_rh, P.T_sph, P.bg_mode, P.bg_init, P.massScale, P.off, P.me_s, P.T_qcd, P.Neff]);
  if (key !== bgScanKey) {
    bgScanKey = key; const Ms = [], E = [];
    for (let l = 0.3; l <= 16; l += 0.35) { const M = Math.pow(10, l); Ms.push(M); E.push(Math.abs(GP.baryogenesis(Object.assign({}, P, { M_X: M }), R.th).eta)); }
    bgScan = { Ms, E };
  }
  plot('c-bgscan').set({
    x: { log: 1, label: 'M_X [GeV]', short: 'M_X' }, y: { log: 1, min: 1e-16, max: 1e-6, label: '|η| produced', short: 'η' },
    series: [{ name: '|η| with current K, ε, T_rh, T_sph', x: bgScan.Ms, y: bgScan.E.map(v => Math.max(v, 1e-17)), color: '#ff7a8c', width: 2.2 }],
    hbands: [{ y0: 6.0e-10, y1: 6.2e-10, color: '#5ef0a855' }], hlines: [{ y: 6.1e-10, label: 'observed η = 6.1×10⁻¹⁰', color: '#5ef0a8' }],
    vlines: [{ x: P.T_sph, label: 'T_sph', color: '#82aaff' }, { x: P.T_rh, label: 'T_rh', color: '#c792ea', dy: 14 }],
    dots: [{ x: P.M_X, y: Math.max(Math.abs(bg.eta), 1.1e-16), color: '#fff', ring: 1, label: 'now' }],
  });
}

/* ============================================================ DARK MATTER */
let dmScanKey = null, dmScan = null;
function renderDM() {
  const dm = R.dm;
  const tf = R.tl.tAtT(dm.Tf);
  $('#s-dm').innerHTML = [
    stat('Relic density Ω<sub>χ</sub>h²', dm.omegah2, { obs: OBS.omega_c, key: r => r.dm.omegah2, d: 4, hl: 1 }),
    stat('Freeze-out x<sub>f</sub> = m/T<sub>f</sub>', dm.xf, { key: r => r.dm.xf, d: 3 }),
    stat('Freeze-out temperature', fmtT(dm.Tf), { note: 't ≈ ' + fmtTime(tf) }),
    stat('Relic Y<sub>∞</sub> = n/s', dm.Yinf, { key: r => r.dm.Yinf }),
    stat('Needed ⟨σv⟩ for 0.12', fmt(P.sv * dm.omegah2 / 0.12) + ' cm³/s', { note: 'Ω ∝ 1/⟨σv⟩' }),
    stat('Ω<sub>c</sub>h² used downstream', R.omega_c, { note: P.link_dm ? 'linked' : 'manual', d: 4 }),
    stat('Free-streaming', P.m_wdm > 0 ? `warm (${fmt(P.m_wdm)} keV)` : 'cold', { note: P.m_wdm > 0 ? 'cuts halos below ~' + fmt(1e10 * Math.pow(P.m_wdm, -3.33), 2) + ' M☉' : 'all halo masses form' }),
  ].join('');
  const h = dm.hist, Yobs = 0.12 / (2.744e8 * P.m_dm);
  plot('c-dm', 'tall').set({
    x: { log: 1, label: 'x = m/T  (time →)', short: 'x' }, y: { log: 1, floor: 1e20, label: 'Y = n_χ / s', short: 'Y' },
    series: [{ name: 'Y (Boltzmann solution)', x: h.x, y: h.Y, color: COL.dm, width: 2.4 }, { name: 'Y_eq (equilibrium)', x: h.x, y: h.Yeq, color: '#ffd66b', dash: [5, 4] }],
    hlines: [{ y: Yobs, label: 'needed for Ωh² = 0.12', color: '#5ef0a8' }],
    vlines: [{ x: dm.xf, label: 'freeze-out', color: '#b392ff' }].concat(dm.x0 > 1 ? [{ x: dm.x0, label: 'reheating', color: '#c792ea', dy: 14 }] : []),
  });
  const key = JSON.stringify([P.m_dm, P.sv_b, P.g_dm, P.T_rh, P.massScale, P.off, P.me_s, P.T_qcd, P.Neff]);
  if (key !== dmScanKey) {
    dmScanKey = key; const svs = []; for (let l = -28.5; l <= -22; l += 0.25) svs.push(Math.pow(10, l));
    const masses = [[10, '#7cc4ff'], [1000, '#ffb86b'], [P.m_dm, COL.dm]];
    dmScan = { svs, lines: masses.map(([m, col]) => ({ m, col, y: svs.map(sv => GP.darkMatter(Object.assign({}, P, { m_dm: m, sv }), R.th).omegah2) })) };
  }
  plot('c-dmscan').set({
    x: { log: 1, label: '⟨σv⟩ [cm³/s]', short: '⟨σv⟩' }, y: { log: 1, min: 1e-4, max: 1e3, label: 'Ωh²', short: 'Ωh²' },
    series: dmScan.lines.map((l, i) => ({ name: `m = ${fmt(l.m)} GeV${i === 2 ? ' (current)' : ''}`, x: dmScan.svs, y: l.y, color: l.col, width: i === 2 ? 2.6 : 1.6 })),
    hbands: [{ y0: 0.114, y1: 0.126, color: '#5ef0a866' }], hlines: [{ y: 0.12, label: 'observed Ω_c h² = 0.12', color: '#5ef0a8' }],
    vlines: [{ x: 2.2e-26, label: 'weak scale', color: '#5a6190' }],
    dots: [{ x: P.sv, y: clamp(dm.omegah2, 1e-4, 1e3), color: '#fff', ring: 1 }],
  });
}

/* ============================================================ BBN */
let schrammKey = null, schramm = null, schrammJob = 0;
const BBNCOL = [COL.n, COL.p, COL.D, COL.T, COL.He3, COL.He4, COL.Li7, COL.Be7];
function renderBBN() {
  const nb = R.nuc;
  $('#s-bbn').innerHTML = [
    stat('Helium-4 mass fraction Y<sub>p</sub>', nb.Yp, { obs: OBS.Yp, key: r => r.nuc.Yp, d: 4, hl: 1 }),
    stat('Deuterium D/H', nb.DH, { obs: OBS.DH, key: r => r.nuc.DH, hl: 1 }),
    stat('Helium-3 ³He/H', nb.He3H, { obs: OBS.He3H, key: r => r.nuc.He3H }),
    stat('Lithium-7 ⁷Li/H', nb.Li7H, { obs: OBS.Li7H, key: r => r.nuc.Li7H, note: '' }),
    stat('η used', R.eta, { key: r => r.eta, note: P.link_eta ? 'from baryogenesis' : 'from ω_b' }),
    stat('n/p freeze-out', nb.Tfreeze ? fmtT(nb.Tfreeze * 1e-3) : '—', { note: 'weak rate = H' }),
    stat('Deuterium bottleneck breaks', nb.TDmax ? fmtT(nb.TDmax * 1e-3) : '—', { note: nb.TDmax ? 't ≈ ' + fmtTime(GP.lerp(nb.hist.T, nb.hist.t, nb.TDmax)) : '' }),
    stat('Effective τ<sub>n</sub>', nb.tauEff, { u: ' s', note: 'from G_F, m_e, Q', d: 4 }),
  ].join('');
  const vsT = !$('#bbn-vs-t').checked, h = nb.hist, xs = vsT ? h.T : h.t;
  const series = GP.BBN_NAMES.map((nm, i) => ({ name: nm, x: xs, y: h.X.map(v => v[i]), color: BBNCOL[i], width: i === 5 || i === 2 ? 2.4 : 1.6 }));
  series.push({ name: 'n (if weak equilibrium held)', x: xs, y: h.Xn_eq, color: COL.n, dash: [3, 4], width: 1 });
  plot('c-bbn', 'tall').set({
    x: vsT ? { log: 1, rev: 1, min: 0.004, max: 10, label: 'photon temperature T [MeV]', short: 'T [MeV]' } : { log: 1, label: 'time [s]', short: 't [s]' },
    y: { log: 1, min: 1e-12, max: 1.5, label: 'mass fraction X', short: 'X' }, series,
  });
  // Schramm plot, computed asynchronously
  const key = JSON.stringify([P.Neff, P.dN_inj, P.T_inj, P.tau_n, P.Q_s, P.me_s, P.G_s, P.BD_s]);
  const draw = () => {
    if (!schramm) return;
    const ex = schramm.eta;
    plot('c-schramm-y', 'short').set({
      x: { log: 1, min: 3e-11, max: 3e-9, label: 'η', short: 'η' }, y: { min: 0.2, max: 0.28, label: 'Y_p', short: 'Y_p' },
      series: [{ name: '⁴He  Y_p', x: ex, y: schramm.Yp, color: COL.He4, width: 2.2 }],
      hbands: [{ y0: OBS.Yp[0] - OBS.Yp[1], y1: OBS.Yp[0] + OBS.Yp[1], color: '#5ef0a833' }],
      vlines: [{ x: R.eta, label: 'this η', color: '#fff' }], vbands: [{ x0: 6.05e-10, x1: 6.16e-10, color: '#7cc4ff44' }],
    });
    plot('c-schramm', 'short').set({
      x: { log: 1, min: 3e-11, max: 3e-9, label: 'η', short: 'η' }, y: { log: 1, min: 1e-11, max: 1e-3, label: 'number relative to H', short: 'X/H' },
      series: [{ name: 'D/H', x: ex, y: schramm.DH, color: COL.D, width: 2.2 }, { name: '³He/H', x: ex, y: schramm.He3, color: COL.He3, width: 2 }, { name: '⁷Li/H', x: ex, y: schramm.Li, color: COL.Li7, width: 2 }],
      hbands: [{ y0: 2.4e-5, y1: 2.7e-5, color: '#ffd66b66', label: 'observed D/H' }, { y0: 1.3e-10, y1: 1.9e-10, color: '#c792ea44', label: 'observed Li (the lithium problem)' }],
      vlines: [{ x: R.eta, label: 'this η', color: '#fff' }],
    });
  };
  if (key !== schrammKey) {
    schrammKey = key; const job = ++schrammJob;
    const etas = []; for (let l = -10.4; l <= -8.6; l += 0.15) etas.push(Math.pow(10, l));
    const acc = { eta: [], Yp: [], DH: [], He3: [], Li: [] };
    let i = 0;
    const next = () => {
      if (job !== schrammJob) return;
      if (i >= etas.length) { schramm = acc; $('#schramm-status').textContent = ''; if (tab === 'bbn') draw(); return; }
      $('#schramm-status').textContent = `computing ${i + 1}/${etas.length}…`;
      const r = GP.bbn({ eta: etas[i], Neff: P.Neff, dNinj: P.dN_inj, TinjMeV: P.T_inj * 1e3, tau_n: P.tau_n, Q_s: P.Q_s, me_s: P.me_s, G_s: P.G_s, BD_s: P.BD_s });
      acc.eta.push(etas[i]); acc.Yp.push(r.Yp); acc.DH.push(r.DH); acc.He3.push(r.He3H); acc.Li.push(r.Li7H);
      i++; setTimeout(next, 0);
    };
    schramm = null; setTimeout(next, 30);
  } else draw();
}

/* ============================================================ CMB */
function renderCMB() {
  const rc = R.rec, b = BASE.rec;
  $('#s-cmb').innerHTML = [
    rc.transparent ? stat('Last scattering', 'z > 9000', { hl: 1, note: 'too few baryons — nearly transparent' }) : stat('Last scattering z<sub>*</sub>', rc.zstar, { obs: OBS.zstar, key: r => r.rec.zstar, d: 5, hl: 1 }),
    stat('Temperature then', fmt(rc.TstarK, 4) + ' K', { note: 'hydrogen binding ' + fmt(rc.BH_eV, 4) + ' eV' }),
    stat('Age at last scattering', fmtTime(rc.tstar), {}),
    stat('Sound horizon r<sub>s</sub>', rc.rs, { u: ' Mpc', key: r => r.rec.rs, d: 4, note: 'Planck 144.4' }),
    stat('Distance to last scattering', rc.DM, { u: ' Mpc', key: r => r.rec.DM, d: 4 }),
    stat('Acoustic angle 100θ<sub>*</sub>', rc.theta100, { obs: OBS.theta100, key: r => r.rec.theta100, d: 5, hl: 1 }),
    stat('Acoustic multipole ℓ<sub>A</sub> = π/θ<sub>*</sub>', rc.ellA, { key: r => r.rec.ellA, d: 4, note: 'first peak ≈ ' + fmt(rc.ellA * 0.73, 3) }),
    stat('Residual x<sub>e</sub> (z = 200)', rc.xeRes, { key: r => r.rec.xeRes }),
    stat('Reionisation optical depth τ', rc.tauReion, { obs: [0.054, 0.007], key: r => r.rec.tauReion }),
    stat('Matter–radiation equality', rc.zeq, { key: r => r.rec.zeq, d: 4, note: 'z_eq' }),
  ].join('');
  plot('c-xe').set({
    x: { min: 0, max: 2500, rev: 1, label: 'redshift z', short: 'z' }, y: { log: 1, min: 1e-4, max: 1.4, label: 'free electrons per H atom', short: 'x_e' },
    series: [{ name: 'Peebles + RECFAST (this universe)', x: rc.z, y: rc.xe, color: '#7cc4ff', width: 2.2 }, { name: 'Saha equilibrium', x: rc.z, y: rc.xeSaha, color: '#ffd66b', dash: [4, 4], width: 1.2 }, { name: 'standard ΛCDM', x: b.z, y: b.xe, color: COL.base, dash: [2, 3], width: 1.2 }],
    vlines: [{ x: rc.zstar, label: 'z*', color: '#ff7a8c' }],
  });
  const norm = arr => { const m = Math.max(...arr.filter((v, i) => true)); return arr.map(v => v / m); };
  plot('c-vis').set({
    x: { min: 700, max: 1500, rev: 1, label: 'redshift z', short: 'z' }, y: { min: 0, max: 1.08, label: 'visibility g(z) (normalised)', short: 'g' },
    series: [{ name: 'this universe', x: rc.z, y: norm(rc.vis.map((v, i) => rc.z[i] > 200 ? v : 0)), color: '#ff7a8c', width: 2.2, fill: 1 }, { name: 'standard ΛCDM', x: b.z, y: norm(b.vis.map((v, i) => b.z[i] > 200 ? v : 0)), color: COL.base, dash: [4, 4] }],
  });
}

/* ============================================================ STRUCTURE */
function renderLSS() {
  const st = R.st, bs = BASE.st;
  $('#s-lss').innerHTML = [
    stat('σ<sub>8</sub>', st.sigma8, { obs: OBS.sigma8, key: r => r.st.sigma8, hl: 1 }),
    stat('S<sub>8</sub> = σ<sub>8</sub>(Ω<sub>m</sub>/0.3)<sup>½</sup>', st.S8, { key: r => r.st.S8, note: 'weak lensing ≈ 0.78' }),
    stat('Typical collapsed mass M<sub>*</sub> today', st.Mnl ? fmt(st.Mnl, 2) + ' M☉' : '—', { note: 'σ(M) = δ_c' }),
    stat('Largest halo in the observable universe', st.Mbig ? fmt(st.Mbig, 2) + ' M☉' : '—', { note: 'richest cluster' }),
    stat('First stars (10⁶ M☉, 3σ)', st.zFirstStars !== null ? 'z ≈ ' + fmt(st.zFirstStars, 3) : 'never', { note: st.zFirstStars !== null ? fmtTime(R.tl.tAta(1 / (1 + st.zFirstStars))) : '' }),
    stat('First galaxies (10⁸ M☉, 3σ)', st.zFirstGal !== null ? 'z ≈ ' + fmt(st.zFirstGal, 3) : 'never', { note: st.zFirstGal !== null ? fmtTime(R.tl.tAta(1 / (1 + st.zFirstGal))) : '' }),
    stat('Milky-Way halos (>10¹² M☉) / Gpc³', st.nMW * 1e9, { key: r => r.st.nMW * 1e9 }),
    stat('Clusters (>10¹⁴ M☉) / Gpc³', st.nCluster * 1e9, { key: r => r.st.nCluster * 1e9 }),
    stat('Stellar mass of a 10¹² M☉ halo', fmt(st.mstar(1e12, 0), 2) + ' M☉', { note: 'baryon fraction ' + fmt(st.fb, 3) }),
    stat('Galaxies ever form?', st.galaxiesEver ? 'yes' : 'never', { note: 'max growth ' + fmt(st.growthMaxRatio, 3) + '× today' }),
  ].join('');
  const zc = { 0: '#ffffff', 1: '#7cc4ff', 2: '#5ef0a8', 4: '#ffd66b', 6: '#ffb86b', 10: '#ff7a8c' };
  const hs = Object.entries(st.hmfs).map(([z, h]) => ({ name: 'z = ' + z, x: h.lM.map(l => Math.pow(10, l)), y: h.dndlnM, color: zc[z], width: z === '0' ? 2.4 : 1.6 }));
  hs.push({ name: 'ΛCDM z = 0', x: bs.hmfs[0].lM.map(l => Math.pow(10, l)), y: bs.hmfs[0].dndlnM, color: COL.base, dash: [4, 4], width: 1.2 });
  plot('c-hmf').set({ x: { log: 1, min: 1e6, max: 1e16, label: 'halo mass M [M☉]', short: 'M' }, y: { log: 1, min: 1e-10, max: 1e3, label: 'dn/dlnM [Mpc⁻³]', short: 'dn/dlnM' }, series: hs, vlines: [{ x: 1e12, label: 'Milky Way', color: '#5a6190' }] });
  const Mh = []; for (let l = 9; l <= 15.01; l += 0.05) Mh.push(Math.pow(10, l));
  plot('c-smhm', 'short').set({
    x: { log: 1, label: 'halo mass [M☉]', short: 'M_h' }, y: { log: 1, min: 1e7, max: 1e13, label: 'stellar mass [M☉]', short: 'M*' },
    series: [{ name: 'z = 0', x: Mh, y: Mh.map(m => st.mstar(m, 0)), color: '#ffd66b', width: 2.2 }, { name: 'z = 2', x: Mh, y: Mh.map(m => st.mstar(m, 2)), color: '#7cc4ff', width: 1.6 }, { name: 'all baryons → stars', x: Mh, y: Mh.map(m => m * st.fb), color: COL.base, dash: [4, 4], width: 1.2 }],
  });
  const kk = st.ks.filter((k, i) => i % 3 === 0), pk = kk.map(k => st.Pk(k, 1) * R.cp.h ** 3), pkb = kk.map(k => bs.Pk(k, 1) * BASE.cp.h ** 3);
  plot('c-pk').set({
    x: { log: 1, min: 1e-4, max: 100, label: 'wavenumber k [Mpc⁻¹]', short: 'k' }, y: { log: 1, floor: 1e10, label: 'P(k) [(Mpc/h)³]', short: 'P' },
    series: [{ name: 'this universe', x: kk, y: pk, color: '#7cc4ff', width: 2.2 }, { name: 'standard ΛCDM', x: kk, y: pkb, color: COL.base, dash: [4, 4], width: 1.2 }],
    vlines: [{ x: 2 * Math.PI / (8 / R.cp.h), label: '8 h⁻¹Mpc', color: '#5a6190' }],
  });
  webBuild(); webDraw();
}

/* ------------------------------------------------------------ cosmic web */
const WEB = { N: 256, key: null, nre: null, nim: null, px: null, py: null, playing: false };
function mulberry(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function fft1(re, im, inv) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) { let bit = n >> 1; for (; j & bit; bit >>= 1) j ^= bit; j ^= bit; if (i < j) { let t = re[i]; re[i] = re[j]; re[j] = t; t = im[i]; im[i] = im[j]; im[j] = t; } }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = 2 * Math.PI / len * (inv ? 1 : -1), wr = Math.cos(ang), wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cr = 1, ci = 0;
      for (let j = 0; j < len / 2; j++) {
        const a = i + j, b = a + len / 2, xr = re[b] * cr - im[b] * ci, xi = re[b] * ci + im[b] * cr;
        re[b] = re[a] - xr; im[b] = im[a] - xi; re[a] += xr; im[a] += xi;
        const t = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = t;
      }
    }
  }
  if (inv) for (let i = 0; i < n; i++) { re[i] /= n; im[i] /= n; }
}
function fft2(re, im, N, inv) {
  const r = new Float64Array(N), i2 = new Float64Array(N);
  for (let y = 0; y < N; y++) { for (let x = 0; x < N; x++) { r[x] = re[y * N + x]; i2[x] = im[y * N + x]; } fft1(r, i2, inv); for (let x = 0; x < N; x++) { re[y * N + x] = r[x]; im[y * N + x] = i2[x]; } }
  for (let x = 0; x < N; x++) { for (let y = 0; y < N; y++) { r[y] = re[y * N + x]; i2[y] = im[y * N + x]; } fft1(r, i2, inv); for (let y = 0; y < N; y++) { re[y * N + x] = r[y]; im[y * N + x] = i2[y]; } }
}
function webBuild() {
  const N = WEB.N, L = +$('#web-box').value, st = R.st;
  const key = [L, st.sigma8, R.cp.h, R.ns, P.m_wdm, R.omega_c, R.omega_b, P.mnu].join('|');
  if (key === WEB.key) return; WEB.key = key;
  if (!WEB.nre) {
    const rnd = mulberry(20260926), re = new Float64Array(N * N), im = new Float64Array(N * N);
    for (let i = 0; i < N * N; i++) { const u = Math.max(rnd(), 1e-12), v = rnd(); re[i] = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }
    fft2(re, im, N, false); WEB.nre = re; WEB.nim = im;
  }
  const xr = new Float64Array(N * N), xi = new Float64Array(N * N), yr = new Float64Array(N * N), yi = new Float64Array(N * N);
  const kf = 2 * Math.PI / L;
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const kx = (i <= N / 2 ? i : i - N) * kf, ky = (j <= N / 2 ? j : j - N) * kf, k2 = kx * kx + ky * ky, idx = j * N + i;
    if (k2 === 0) continue;
    // 2-D slice with P2D ∝ k·P3D reproduces the 3-D displacement spectrum per ln k
    const k = Math.sqrt(k2), amp = Math.sqrt(Math.max(k * st.Pk(k, 1), 0)) * Math.exp(-k2 * (L / N) ** 2 * 0.5);
    const a = WEB.nre[idx] * amp, b = WEB.nim[idx] * amp;
    xr[idx] = -b * kx / k2; xi[idx] = a * kx / k2;   // psi_k = i k delta_k / k^2
    yr[idx] = -b * ky / k2; yi[idx] = a * ky / k2;
  }
  fft2(xr, xi, N, true); fft2(yr, yi, N, true);
  let s2 = 0; for (let i = 0; i < N * N; i++) s2 += 0.5 * (xr[i] * xr[i] + yr[i] * yr[i]);
  const rms = Math.sqrt(s2 / (N * N)) || 1;
  // target: 3-D linear Zel'dovich displacement per axis, sigma^2 = (1/3) ∫ Delta^2(k)/k^2 dln k, over the modes this box resolves
  const kmin = 2 * Math.PI / L, kmax = Math.PI * N / L;
  let t2 = 0; for (let i = 1; i < st.ks.length; i++) { const k = st.ks[i]; if (k < kmin || k > kmax) continue; t2 += st.D2[i] / (k * k) * Math.log(st.ks[i] / st.ks[i - 1]); }
  const scale = Math.sqrt(t2 / 3) / rms, toGrid = N / L;
  WEB.px = new Float32Array(N * N); WEB.py = new Float32Array(N * N);
  for (let i = 0; i < N * N; i++) { WEB.px[i] = xr[i] * scale * toGrid; WEB.py[i] = yr[i] * scale * toGrid; }
}
const MAGMA = (() => {
  const stops = [[0, [0, 0, 4]], [0.2, [40, 11, 84]], [0.4, [101, 21, 110]], [0.6, [183, 55, 121]], [0.75, [241, 96, 93]], [0.88, [254, 176, 120]], [1, [252, 253, 191]]];
  const lut = new Uint8ClampedArray(256 * 3);
  for (let i = 0; i < 256; i++) { const u = i / 255; let k = 0; while (k < stops.length - 2 && u > stops[k + 1][0]) k++; const [u0, c0] = stops[k], [u1, c1] = stops[k + 1], w = (u - u0) / (u1 - u0); for (let q = 0; q < 3; q++) lut[i * 3 + q] = c0[q] + w * (c1[q] - c0[q]); }
  return lut;
})();
function webA() { const p = +$('#web-a').value; return Math.pow(10, -2 + p / 1000 * (L10(4) + 2)); }
function webDraw() {
  if (!WEB.px) return;
  const cv = $('#web'), M = 384, N = WEB.N, f = M / N;
  cv.width = M; cv.height = M;
  const a = webA(), g = R.st.gr.Dat(a) / R.st.gr.D0;
  const z = 1 / a - 1;
  $('#web-z-lab').textContent = a < 0.99 ? `z = ${fmt(z, 3)} · t = ${fmtTime(R.tl.tAta(a))}` : a < 1.01 ? 'today' : `future: a = ${fmt(a, 3)}`;
  const rho = new Float32Array(M * M), px = WEB.px, py = WEB.py;
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const i1 = (i + 1) % N, j1 = (j + 1) % N, a00 = j * N + i, a10 = j * N + i1, a01 = j1 * N + i, a11 = j1 * N + i1;
    for (let sj = 0; sj < 2; sj++) for (let si = 0; si < 2; si++) {
      const u = si * 0.5, v = sj * 0.5, w00 = (1 - u) * (1 - v), w10 = u * (1 - v), w01 = (1 - u) * v, w11 = u * v;
      const dx = w00 * px[a00] + w10 * px[a10] + w01 * px[a01] + w11 * px[a11], dy = w00 * py[a00] + w10 * py[a10] + w01 * py[a01] + w11 * py[a11];
      let x = (i + u + g * dx) * f, y = (j + v + g * dy) * f;
      x = ((x % M) + M) % M; y = ((y % M) + M) % M;
      const x0 = Math.floor(x), y0 = Math.floor(y), wx = x - x0, wy = y - y0, x1 = (x0 + 1) % M, y1 = (y0 + 1) % M;
      rho[y0 * M + x0] += (1 - wx) * (1 - wy); rho[y0 * M + x1] += wx * (1 - wy); rho[y1 * M + x0] += (1 - wx) * wy; rho[y1 * M + x1] += wx * wy;
    }
  }
  // smooth the particle deposit (two passes of a 5-tap binomial kernel) so shot noise and the initial lattice vanish
  const tmp = new Float32Array(M * M), K5 = [1 / 16, 4 / 16, 6 / 16, 4 / 16, 1 / 16];
  for (let pass = 0; pass < 2; pass++) {
    for (let y = 0; y < M; y++) for (let x = 0; x < M; x++) { let v = 0; for (let k = -2; k <= 2; k++) v += K5[k + 2] * rho[y * M + (x + k + M) % M]; tmp[y * M + x] = v; }
    for (let y = 0; y < M; y++) for (let x = 0; x < M; x++) { let v = 0; for (let k = -2; k <= 2; k++) v += K5[k + 2] * tmp[((y + k + M) % M) * M + x]; rho[y * M + x] = v; }
  }
  const mean = 4 * N * N / (M * M), img = new ImageData(M, M), lmax = Math.log(1 + 25);
  for (let i = 0; i < M * M; i++) {
    const u = clamp(Math.log(1 + 2 * rho[i] / mean) / lmax, 0, 1), c = Math.round(u * 255) * 3;
    img.data[i * 4] = MAGMA[c]; img.data[i * 4 + 1] = MAGMA[c + 1]; img.data[i * 4 + 2] = MAGMA[c + 2]; img.data[i * 4 + 3] = 255;
  }
  cv.getContext('2d').putImageData(img, 0, 0);
}
function webPlay() {
  const btn = $('#web-play'), s = $('#web-a');
  if (WEB.playing) { WEB.playing = false; btn.textContent = '▶ Grow structure'; return; }
  WEB.playing = true; btn.textContent = '❚❚ Pause'; if (+s.value >= 769) s.value = 0;
  const step = () => { if (!WEB.playing || tab !== 'lss') { WEB.playing = false; btn.textContent = '▶ Grow structure'; return; } s.value = Math.min(769, +s.value + 6); webDraw(); if (+s.value >= 769) { WEB.playing = false; btn.textContent = '▶ Grow structure'; return; } requestAnimationFrame(step); };
  requestAnimationFrame(step);
}

/* ============================================================ DARK ENERGY */
function renderDE() {
  const cp = R.cp, ft = R.ft;
  $('#s-de').innerHTML = [
    stat('Age today', R.tl.age, { obs: OBS.age, key: r => r.tl.age, d: 4, u: ' Gyr', hl: 1 }),
    stat('H<sub>0</sub>', cp.H0, { obs: OBS.H0, key: r => r.cp.H0, d: 4, u: ' km/s/Mpc', note: P.closure === 'flat' ? 'derived (flat)' : 'fixed' }),
    stat('Ω<sub>m</sub> / Ω<sub>Λ</sub> / Ω<sub>k</sub>', `${fmt(cp.Om, 3)} / ${fmt(cp.OL, 3)} / ${fmt(cp.Ok, 2)}`, {}),
    stat('Deceleration q<sub>0</sub>', ft.q0, { key: r => r.ft.q0, d: 3, note: ft.q0 < 0 ? 'accelerating' : 'decelerating' }),
    stat('Acceleration began', ft.zacc !== null ? 'z = ' + fmt(ft.zacc, 3) : 'never', { note: ft.zacc !== null ? fmtTime(R.tl.tAta(1 / (1 + ft.zacc))) + ' after Big Bang' : '' }),
    stat('Dark energy overtook matter', ft.zML !== null ? 'z = ' + fmt(ft.zML, 3) : 'never', {}),
    stat('Fate', fateTxt(R), { hl: 1, note: ft.tEnd ? `at t = ${fmt(ft.tEnd, 4)} Gyr (${fmt(ft.tEnd - R.tl.age, 3)} Gyr from now)` : 'eternal expansion → heat death' }),
    stat('Hubble time 1/H<sub>0</sub>', ft.tH, { u: ' Gyr', d: 4 }),
  ].join('');
  const past = r => { const X = [], Y = [], n = r.tl.t.length; for (let i = 0; i < n; i += (i < n - 40 ? 4 : 1)) { const a = r.tl.a[i]; if (a < 1e-4) continue; X.push(r.tl.t[i] / 3.15576e16); Y.push(a); } return [X, Y]; };
  const [px, py] = past(R), [bx, by] = past(BASE);
  const tmax = ft.tEnd ? Math.min(ft.tEnd * 1.05, R.tl.age + 200) : R.tl.age + 60;
  plot('c-at', 'tall').set({
    x: { min: 0, max: tmax, label: 'cosmic time [Gyr]', short: 't [Gyr]' }, y: { log: 1, min: 1e-3, max: 1e3, label: 'scale factor a (today = 1)', short: 'a' },
    series: [{ name: 'past (this universe)', x: px, y: py, color: '#7cc4ff', width: 2.2 }, { name: 'future (integrated)', x: ft.ts, y: ft.as, color: '#5ef0a8', width: 2.2 }, { name: 'standard ΛCDM', x: bx.concat(BASE.ft.ts), y: by.concat(BASE.ft.as), color: COL.base, dash: [4, 4], width: 1.2 }],
    vlines: [{ x: R.tl.age, label: 'today', color: '#fff' }].concat(ft.tEnd ? [{ x: ft.tEnd, label: ft.outcome === 'rip' ? 'Big Rip' : 'Big Crunch', color: '#ff6b81', dy: 14 }] : []),
  });
  const as = []; for (let l = -6; l <= 2.001; l += 0.04) as.push(Math.pow(10, l));
  const ser = [
    { name: 'radiation', x: as, y: as.map(a => cp.Or / a ** 4), color: COL.rad, width: 2 },
    { name: 'matter', x: as, y: as.map(a => cp.Om / a ** 3), color: COL.mat, width: 2 },
    { name: 'dark energy |ρ|', x: as, y: as.map(a => Math.abs(cp.OL * GP.deF(a, cp.w0, cp.wa))), color: COL.de, width: 2 },
  ];
  if (Math.abs(cp.Ok) > 1e-6) ser.push({ name: 'curvature |Ω_k|', x: as, y: as.map(a => Math.abs(cp.Ok) / (a * a)), color: COL.curv, dash: [4, 4] });
  plot('c-rho').set({ x: { log: 1, label: 'scale factor a', short: 'a' }, y: { log: 1, min: 1e-6, max: 1e22, label: 'ρ / ρ_crit,0', short: 'ρ' }, series: ser, vlines: [{ x: 1, label: 'today', color: '#fff' }] });
  const zs = []; for (let z = 0; z <= 5.001; z += 0.02) zs.push(z);
  const q = (r, z) => { const c = r.cp, a = 1 / (1 + z), w = c.w0 + c.wa * (1 - a); return 0.5 * (2 * c.Or / a ** 4 + c.Om / a ** 3 + c.OL * GP.deF(a, c.w0, c.wa) * (1 + 3 * w)) / GP.E2(c, a); };
  plot('c-q').set({
    x: { min: 0, max: 5, label: 'redshift z', short: 'z' }, y: { label: 'q(z)', short: 'q' },
    series: [{ name: 'this universe', x: zs, y: zs.map(z => q(R, z)), color: '#5ef0a8', width: 2.2 }, { name: 'standard ΛCDM', x: zs, y: zs.map(z => q(BASE, z)), color: COL.base, dash: [4, 4], width: 1.2 }],
    hlines: [{ y: 0, label: 'accelerating below', color: '#5a6190' }],
  });
}

/* ============================================================ SPACETIME */
const DEFAULT_MASSES = () => [{ X: -9, Y: 6, M: 1e15 }, { X: 9, Y: -5, M: 3e14 }, { X: 4, Y: 13, M: 1e14 }, { X: -6, Y: -11, M: 5e13 }, { X: 15, Y: 9, M: 2e13 }, { X: -16, Y: -3, M: 1e13 }];
const ST = { tGyr: null, masses: DEFAULT_MASSES(), yaw: -0.55, pitch: 1.0, L: 25, playing: false, ptr: null };
const MPC = 3.0856775814913673e22, MSUN = 1.98841e30, CL = 2.99792458e8, GLY = 9.4607304725808e24;
function stRange() { return [-5, L10(R.ft.tEnd ? R.ft.tEnd * 0.99999 : R.tl.age + 60)]; }   // log10 of time in Gyr
function stClampTime() {
  const [l0, l1] = stRange();
  if (ST.tGyr === null) ST.tGyr = R.tl.age;
  ST.tGyr = clamp(ST.tGyr, Math.pow(10, l0), Math.pow(10, l1));
  const s = $('#st-t'); if (s) { s.value = (L10(ST.tGyr) - l0) / (l1 - l0) * 1000; paintRange(s); }
}
function stMoment() {
  const tS = ST.tGyr * GP.U.Gyr, s = GP.stateAtTime(R, tS), E = GP.einstein(R, s.a, s.T);
  // conformal time at this moment (Gly), from past or future tables
  const sp = R.sp, past = tS <= sp.past.t[sp.past.t.length - 1];
  const eta = past ? Math.exp(GP.lerp(sp.past.t.map(Math.log), sp.past.eta.map(Math.log), Math.log(tS))) : GP.lerp(sp.fut.t, sp.fut.eta, tS);
  return { tS, a: s.a, T: s.T, E, eta };
}
// virial radius (Mpc) with 200× today's critical density, and potential depth relative to a 10^15 M☉ cluster
const rvir = M => Math.cbrt(3 * M * MSUN / (4 * Math.PI * 200 * 1.8784e-26 * R.cp.h * R.cp.h)) / MPC;
const fabricL = a => ST.L * Math.max(1, a);
function fabricHeights(m) {
  const L = fabricL(m.a), s = m.a, st = R.st, z = 1 / s - 1;
  const g = s < 1e-3 ? 0 : st.Dz(Math.max(z, -0.99));
  const wells = ST.masses.map(q => {
    const rv = rvir(q.M), nu = 1.686 / Math.max(st.sigM(q.M) * g, 1e-12);
    const formed = clamp(4.2 - nu, 0, 1);                       // halos appear as ~3–4σ peaks collapse
    const r0 = GP.zeroGravityRadius(q.M * MSUN, R.cp, s) / MPC;
    const torn = r0 < rv;
    return { x: s * q.X, y: s * q.Y, rv, depth: 0.3 * L * Math.pow(q.M / 1e15, 2 / 3) * formed * (torn ? 0.08 : 1), formed, r0, torn, M: q.M };
  });
  let curv = null;
  if ($('#st-curv').checked && Math.abs(R.cp.Ok) > 1e-5) {
    const Rc = s * U_cH() / Math.sqrt(Math.abs(R.cp.Ok));      // physical curvature radius, Mpc
    const Rref = U_cH() / Math.sqrt(0.1);
    curv = { sign: R.cp.Ok < 0 ? 'closed' : 'open', k: Math.min(0.12 / L * Math.sqrt(Rref / Rc), 0.16 / L) };   // edge height ≤ ~0.3 L
  }
  const hw = (x, y) => {
    let z0 = 0;
    for (const w of wells) { if (w.depth <= 0) continue; const d2 = (x - w.x) ** 2 + (y - w.y) ** 2; z0 -= w.depth * w.rv / Math.sqrt(d2 + w.rv * w.rv); }
    return z0;
  };
  const h = (x, y) => {
    let z0 = hw(x, y);
    if (curv) z0 += curv.sign === 'closed' ? -curv.k * (x * x + y * y) : curv.k * (x * x - y * y);
    return z0;
  };
  return { wells, h, hw, curv };
}
const U_cH = () => GP.U.cH100 / R.cp.h;
function fabricCamera(W, H, L) {
  L = L || ST.L; const D = 3.4 * L, F = Math.min(W * 0.95, H * 1.9) * D / (2.3 * L);
  const cx = W / 2, cy = H * 0.5, cyaw = Math.cos(ST.yaw), syaw = Math.sin(ST.yaw), cp = Math.cos(ST.pitch), sp = Math.sin(ST.pitch);
  const proj = (x, y, z) => { const x1 = x * cyaw - y * syaw, y1 = x * syaw + y * cyaw, dep = D + y1 * sp - z * cp, ver = y1 * cp + z * sp; return [cx + F * x1 / dep, cy - F * ver / dep, dep]; };
  const unproj = (u, v) => { const Y = (cy - v) / F, y1 = Y * D / (cp - Y * sp), dep = D + y1 * sp, x1 = (u - cx) / F * dep; return [x1 * cyaw + y1 * syaw, -x1 * syaw + y1 * cyaw]; };
  return { proj, unproj };
}
function depthColor(t, a) { // 0 flat -> 1 deepest: blue -> violet -> orange
  const c0 = [90, 150, 255], c1 = [190, 110, 255], c2 = [255, 170, 90];
  const [p, q, u] = t < 0.5 ? [c0, c1, t * 2] : [c1, c2, (t - 0.5) * 2];
  return `rgba(${Math.round(p[0] + (q[0] - p[0]) * u)},${Math.round(p[1] + (q[1] - p[1]) * u)},${Math.round(p[2] + (q[2] - p[2]) * u)},${a})`;
}
function drawFabric(m) {
  const cv = $('#fabric'); if (!cv || !cv.clientWidth) return;
  m = m || stMoment();
  const W = cv.clientWidth, H = cv.clientHeight, dpr = Math.min(window.devicePixelRatio || 1, 2);
  if (cv.width !== Math.round(W * dpr) || cv.height !== Math.round(H * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); }
  const c = cv.getContext('2d'); c.setTransform(dpr, 0, 0, dpr, 0, 0);
  const L = fabricL(m.a), s = m.a, TK = m.T / KB, { proj } = fabricCamera(W, H, L), F = fabricHeights(m), h = F.h;
  // background: a glowing opaque plasma before recombination, black afterwards
  const glow = clamp((L10(TK) - L10(2500)) / 1.2, 0, 1);
  const bg = c.createRadialGradient(W / 2, H / 2, 10, W / 2, H / 2, W * 0.7);
  bg.addColorStop(0, glow > 0 ? `rgba(${120 + 135 * glow},${60 + 80 * glow},${40 + 20 * glow},1)` : '#0b0d1f'); bg.addColorStop(1, '#04050b');
  c.fillStyle = bg; c.fillRect(0, 0, W, H);
  // grid: comoving lines, physically spaced by a × Δ; thinned when the universe is small
  const dc = 2.5; let k = 1; while (2 * L / (s * dc * k) > 56) k *= 2;
  const step = s * dc * k, jmax = Math.floor(L / step);
  const NS = 70;
  c.lineWidth = 1;
  for (const dir of [0, 1]) for (let j = -jmax; j <= jmax; j++) {
    const q = j * step; let prev = null, pz = 0;
    for (let i = 0; i <= NS; i++) {
      const r = -L + 2 * L * i / NS, x = dir ? r : q, y = dir ? q : r, zw = F.hw(x, y), P = proj(x, y, h(x, y));
      if (prev) { c.strokeStyle = depthColor(clamp(-(zw + pz) / 2 / (0.3 * L), 0, 1), 0.5 + 0.4 * clamp(-(zw + pz) / (0.3 * L), 0, 1)); c.beginPath(); c.moveTo(prev[0], prev[1]); c.lineTo(P[0], P[1]); c.stroke(); }
      prev = P; pz = zw;
    }
  }
  // frame of the window
  c.strokeStyle = '#ffffff22'; c.beginPath();
  for (let i = 0; i <= 4 * NS; i++) { const u = i / NS, side = Math.floor(u) % 4, f = u - Math.floor(u); const pts = [[-L + 2 * L * f, -L], [L, -L + 2 * L * f], [L - 2 * L * f, L], [-L, L - 2 * L * f]][side]; const P = proj(pts[0], pts[1], h(pts[0], pts[1])); i ? c.lineTo(P[0], P[1]) : c.moveTo(P[0], P[1]); }
  c.stroke();
  // light wave: wavelength stretches with a
  if ($('#st-light').checked) {
    const lam = 5 * s, y0 = -0.8 * L, hue = 275 - 275 * clamp((L10(s) + 1.2) / 1.6, 0, 1);
    c.strokeStyle = `hsla(${hue},95%,65%,0.95)`; c.lineWidth = 2; c.beginPath();
    for (let i = 0; i <= 260; i++) {
      const x = -L + 2 * L * i / 260, amp = lam > 0.35 ? 0.06 * L * Math.min(1, lam / 5) : 0;
      const P = proj(x, y0, h(x, y0) + amp * Math.sin(2 * Math.PI * x / lam));
      i ? c.lineTo(P[0], P[1]) : c.moveTo(P[0], P[1]);
    }
    c.stroke(); c.lineWidth = 1;
    const P = proj(-L, y0, h(-L, y0));
    c.fillStyle = `hsla(${hue},95%,75%,1)`; c.font = '11px Inter, system-ui, sans-serif';
    c.fillText(lam > 0.35 ? `light: λ ∝ a  (×${fmt(s / Math.max(m.a0 || 1, 1e-30), 3)} vs today)` : 'light: wavelength too short to draw', P[0] + 4, P[1] + 16);
  }
  // masses, their wells and zero-gravity radii
  c.font = '11px Inter, system-ui, sans-serif';
  for (const w of F.wells) {
    if (Math.abs(w.x) > L * 1.05 || Math.abs(w.y) > L * 1.05 || w.formed <= 0) continue;
    const zc = h(w.x, w.y), P = proj(w.x, w.y, zc);
    if ($('#st-zg').checked && isFinite(w.r0) && w.r0 < 2.5 * L && !w.torn) {
      c.strokeStyle = '#5ef0a8aa'; c.setLineDash([4, 4]); c.beginPath();
      for (let i = 0; i <= 72; i++) { const th = i / 72 * 2 * Math.PI, x = w.x + w.r0 * Math.cos(th), y = w.y + w.r0 * Math.sin(th); const Q = proj(x, y, h(x, y)); i ? c.lineTo(Q[0], Q[1]) : c.moveTo(Q[0], Q[1]); }
      c.stroke(); c.setLineDash([]);
    }
    const rad = 3 + 5 * Math.pow(w.M / 1e15, 0.25);
    const gl = c.createRadialGradient(P[0], P[1], 0, P[0], P[1], rad * 3);
    const col = w.torn ? '255,107,129' : '255,214,107';
    gl.addColorStop(0, `rgba(${col},${w.formed})`); gl.addColorStop(1, `rgba(${col},0)`);
    c.fillStyle = gl; c.beginPath(); c.arc(P[0], P[1], rad * 3, 0, 7); c.fill();
    c.fillStyle = w.torn ? '#ff6b81' : '#fff4d0'; c.globalAlpha = w.formed;
    c.fillText(w.torn ? 'torn apart' : `10${sup(Math.round(L10(w.M)))} M☉`, P[0] + rad + 4, P[1] - 4); c.globalAlpha = 1;
  }
  // scale bar
  const bar = [10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 1e4, 1e5, 1e6, 1e7].find(v => v >= 0.35 * L) || 0.4 * L;
  const A = proj(-L, L, h(-L, L)), B = proj(-L + bar, L, h(-L + bar, L));
  c.strokeStyle = '#fff'; c.lineWidth = 2; c.beginPath(); c.moveTo(A[0], A[1] - 10); c.lineTo(B[0], B[1] - 10); c.stroke(); c.lineWidth = 1;
  c.fillStyle = '#fff'; c.fillText(fmt(bar) + ' Mpc (physical)', A[0], A[1] - 16);
  if (glow > 0.05) { c.fillStyle = '#fff'; c.font = '600 13px Inter, system-ui, sans-serif'; c.fillText('Opaque plasma — before recombination light cannot travel freely', 16, H - 16); }
  $('#fabric-cap').innerHTML = `Window ${fmt(2 * L, 3)} Mpc across (${s > 1 ? 'in the future the view zooms out with the expansion, so bound halos shrink on screen as space grows around them' : 'fixed physical size'}). Grid lines are fixed <b>comoving</b> coordinates, so they spread apart as space stretches (a = ${fmt(s, 3)}${k > 1 ? `; every ${k}th line drawn` : ''}). Dent depth ∝ gravitational potential Φ/c² of each halo (exaggerated ~10⁶×); halos appear as they collapse (3–4σ peaks of this universe’s P(k)) and keep their physical size while the space between them expands. ${F.curv ? `Global curvature: <b>${F.curv.sign}</b> universe (Ω<sub>k</sub> = ${fmt(R.cp.Ok, 2)}), strongly exaggerated.` : 'Space is flat (Ω<sub>k</sub> = 0): no global bending, only local dents from mass.'}`;
}
function fabricPointer() {
  const cv = $('#fabric');
  cv.addEventListener('pointerdown', e => { ST.ptr = { x: e.clientX, y: e.clientY, yaw: ST.yaw, pitch: ST.pitch, moved: false }; try { cv.setPointerCapture(e.pointerId); } catch (err) { /* synthetic pointer */ } });
  cv.addEventListener('pointermove', e => {
    if (!ST.ptr) return;
    const dx = e.clientX - ST.ptr.x, dy = e.clientY - ST.ptr.y;
    if (Math.abs(dx) + Math.abs(dy) > 4) ST.ptr.moved = true;
    if (ST.ptr.moved) { ST.yaw = ST.ptr.yaw + dx * 0.008; ST.pitch = clamp(ST.ptr.pitch - dy * 0.006, 0.15, 1.45); drawFabric(); }
  });
  cv.addEventListener('pointerup', e => {
    if (ST.ptr && !ST.ptr.moved) {
      const a = stMoment().a, Lw = fabricL(a), r = cv.getBoundingClientRect(), { unproj } = fabricCamera(cv.clientWidth, cv.clientHeight, Lw), [x, y] = unproj(e.clientX - r.left, e.clientY - r.top);
      if (Math.abs(x) <= Lw && Math.abs(y) <= Lw) {
        if (ST.masses.length >= 24) ST.masses.shift();
        ST.masses.push({ X: x / a, Y: y / a, M: +$('#st-mass').value });
        stRenderMoment();
      }
    }
    ST.ptr = null;
  });
  new ResizeObserver(() => { if (tab === 'spacetime') drawFabric(); }).observe(cv);
}
function stRenderMoment() {
  stClampTime();
  const m = stMoment(), E = m.E, sp = R.sp, z = 1 / m.a - 1, future = m.tS > R.tl.age * GP.U.Gyr * 1.00001;
  m.a0 = 1;
  $('#st-t-lab').textContent = fmtTime(m.tS) + (future ? ' (future)' : '');
  drawFabric(m);
  const Hkm = E.H * MPC / 1e3, lc = E.lcurv, lP = GP.SI.lP;
  const Rc = Math.abs(R.cp.Ok) > 1e-6 ? m.a * U_cH() / Math.sqrt(Math.abs(R.cp.Ok)) * MPC / GLY : Infinity;
  const ph = m.a * m.eta, eh = sp.hasEH ? m.a * (sp.etaEnd - m.eta) : Infinity, hr = CL / E.H / GLY;
  $('#s-st').innerHTML = [
    stat('Cosmic time', fmtTime(m.tS), { hl: 1, note: future ? 'in the future' : (z > 0.01 ? `z = ${fmt(z, 3)}` : 'today') }),
    stat('Scale factor a', m.a, { d: 3, note: 'distances are ×a of today' }),
    stat('Temperature of the radiation', fmtK(m.T), { note: fmtT(m.T) }),
    stat('Expansion rate H', fmt(Hkm, 3) + ' km/s/Mpc', { note: 'doubles lengths every ' + fmtTime(Math.LN2 / E.H) }),
    stat('Expansion is', E.addot > 0 ? 'accelerating' : 'decelerating', { hl: 1, note: `ä/a = ${fmt(E.addot, 3)} s⁻² · q = ${fmt(-E.addot / E.H2, 3)}` }),
    stat('Spacetime curvature radius', fmtLen(lc), { note: `= ${fmt(lc / lP, 2)} Planck lengths` }),
    stat('Ricci scalar R', fmt(E.Ricci, 3) + ' m⁻²', { note: `8πG(ρ − 3p/c²)/c²` }),
    stat('Particle horizon (observable radius)', fmt(ph, 3) + ' Gly', { note: 'proper distance light has travelled' }),
    stat('Event horizon', isFinite(eh) ? fmt(eh, 3) + ' Gly' : 'none', { note: isFinite(eh) ? 'beyond it, signals sent now never arrive' : 'decelerating forever: no event horizon' }),
    stat('Hubble radius c/H', fmt(hr, 3) + ' Gly', { note: 'beyond it galaxies recede faster than light' }),
    stat('Curvature radius of space', isFinite(Rc) ? fmt(Rc, 3) + ' Gly' : '∞ (flat)', { note: isFinite(Rc) ? (R.cp.Ok < 0 ? 'closed: finite volume' : 'open: hyperbolic') : 'Euclidean geometry on large scales' }),
  ].join('');
  // Einstein ledger
  const rows = E.comps.filter(x => x.rho > 0);
  const maxAcc = Math.max(...rows.map(x => Math.abs(x.acc)), 1e-300);
  let html = '<table class="ledger"><tr><th>Component</th><th>ρ [kg/m³]</th><th>w = p/ρc²</th><th>share of H²</th><th>effect on expansion</th></tr>';
  for (const x of rows) {
    const push = x.acc > 0;
    html += `<tr><td>${x.name}</td><td class="n">${fmt(x.rho, 3)}</td><td class="n">${fmt(x.w, 3)}</td><td><div class="hbar"><i style="width:${clamp(x.shareH2 * 100, 0, 100)}%;background:${COL.rad}"></i></div><span class="mono muted" style="font-size:10.5px">${fmt(x.shareH2 * 100, 3)}%</span></td><td class="n ${push ? 'push' : 'pull'}">${push ? 'pushes ↗' : 'pulls ↙'} <span class="muted">${fmt(Math.abs(x.acc) / maxAcc * 100, 2)}%</span></td></tr>`;
  }
  if (Math.abs(E.kterm) > 1e-60) html += `<tr><td>Spatial curvature −kc²/a²</td><td class="n">—</td><td class="n">−⅓</td><td><span class="mono muted">${fmt(E.kterm / E.H2 * 100, 3)}%</span></td><td class="muted">no effect on ä</td></tr>`;
  html += `<tr class="tot"><td>Total</td><td class="n">${fmt(E.rho, 3)}</td><td class="n">${fmt(E.w, 3)}</td><td class="n">H = ${fmt(Hkm, 3)} km/s/Mpc</td><td class="n ${E.addot > 0 ? 'push' : 'pull'}">ä/a = ${fmt(E.addot, 3)} s⁻²</td></tr></table>`;
  html += `<p class="muted" style="font-size:12px;margin-top:8px">G<sub>μν</sub> = 8πG T<sub>μν</sub>/c⁴ for a homogeneous universe reduces to H² = (8πG/3)ρ − kc²/a² and ä/a = −(4πG/3)(ρ + 3p/c²). Energy density sets how fast space stretches; energy <i>plus three times pressure</i> sets whether the stretching speeds up or slows down.</p>`;
  $('#ledger').innerHTML = html;
  // spacetime acting back on matter and light
  const back = [];
  if (!future && z > 0.001) {
    const lamToday = 500 * (1 + z), band = lamToday < 750 ? 'visible' : lamToday < 1e6 ? 'infrared' : lamToday < 1e9 ? 'microwave' : 'radio';
    back.push(['info', `<b>Light is stretched with space.</b> A 500 nm photon emitted now arrives today at ${fmt(lamToday, 3)} nm (${band}): redshift 1 + z = ${fmt(1 + z, 3)} = a<sub>today</sub>/a<sub>then</sub>.`]);
    back.push(['info', `<b>Clocks run slow as seen from today.</b> One hour of events here would be watched by us as ${fmt(1 + z, 3)} hours — the same stretching applied to time.`]);
    back.push(['info', `<b>Free particles slow down.</b> Momentum decays as 1/a: a galaxy moving at 1000 km/s relative to the local expansion now will drift at only ${fmt(1000 * m.a, 3)} km/s by today.`]);
  } else if (future) {
    back.push(['info', `<b>Future light.</b> Everything we see today will be stretched by a further ×${fmt(m.a, 3)}; today’s CMB will have cooled to ${fmtK(m.T)}.`]);
  }
  back.push(['info', `<b>Space stretches between galaxies, not inside them.</b> Two unbound galaxies 1 Mpc apart separate at H·d = ${fmt(Hkm, 3)} km/s; at the Hubble radius (${fmt(hr, 3)} Gly) the recession exceeds c — allowed, because nothing moves <i>through</i> space faster than light.`]);
  back.push([E.addot > 0 ? 'good' : 'warn', E.addot > 0 ? `<b>Gravity has turned repulsive on the largest scales:</b> dark energy’s negative pressure (w = ${fmt(R.cp.w0, 3)}) outweighs matter in ρ + 3p/c², so the expansion accelerates.` : `<b>Gravity is attractive overall:</b> ρ + 3p/c² > 0, so the expansion is decelerating${m.T > 1e-9 ? ' — radiation pressure makes gravity pull even harder than for dust' : ''}.`]);
  if (lc < 1e3 * GP.SI.lP) back.push(['bad', `<b>Quantum-gravity regime.</b> The curvature radius is only ${fmt(lc / GP.SI.lP, 2)} Planck lengths: spacetime itself would fluctuate and general relativity no longer applies.`]);
  $('#st-back').innerHTML = back.map(([c, t]) => `<li class="${c}">${t}</li>`).join('');
  renderBoard('spacetime', m);
  return m;
}
function renderSpacetime() {
  stClampTime();
  const m = stRenderMoment(), sp = R.sp, Gy = GP.U.Gyr;
  const comov = $('#st-comoving').checked, cone = sp.cone, age = R.tl.age;
  // ---- light-cone diagram
  const ser = [], eta0 = sp.eta0, etaEnd = sp.etaEnd;
  const tY = cone.t.map(t => t / Gy), yv = comov ? cone.eta : tY;
  const addSym = (name, xs, ys, color, width, dash) => { ser.push({ name, x: xs, y: ys, color, width, dash }); ser.push({ name: '', x: xs.map(v => -v), y: ys, color, width, dash }); };
  const lcI = cone.t.map((t, i) => i).filter(i => cone.t[i] <= age * Gy * 1.00001);
  addSym('our past light cone', lcI.map(i => (comov ? 1 : cone.a[i]) * (eta0 - cone.eta[i])), lcI.map(i => yv[i]), '#ffd66b', 2.4);
  addSym('particle horizon', cone.eta.map((e, i) => (comov ? 1 : cone.a[i]) * e), yv, '#7cc4ff', 1.8);
  if (sp.hasEH) addSym('event horizon', cone.eta.map((e, i) => (comov ? 1 : cone.a[i]) * (etaEnd - e)), yv, '#ff7a8c', 1.8, [6, 4]);
  addSym('Hubble sphere c/H', cone.H.map((H, i) => CL / Math.abs(H) / GLY / (comov ? cone.a[i] : 1)), yv, '#5ef0a8', 1.4, [2, 3]);
  for (const [zg, col] of [[1, '#c792ea'], [3, '#b392ff'], [11, '#8e7cc3']]) {
    const chi = eta0 - Math.exp(GP.lerp(sp.past.a.map(Math.log), sp.past.eta.map(Math.log), Math.log(1 / (1 + zg))));
    ser.push({ name: `galaxy seen today at z = ${zg}`, x: cone.a.map(a => comov ? chi : a * chi), y: yv, color: col, width: 1, dash: [1, 3] });
  }
  const tMax = cone.t[cone.t.length - 1] / Gy, ynow = comov ? eta0 : age;
  // frame the diagram on today's horizons so the teardrop light cone stays readable
  const yTop = comov ? Math.min(cone.eta[cone.eta.length - 1], eta0 * 1.8) : Math.min(tMax, age + 25);
  const xmax = clamp(1.25 * Math.max(sp.particleHorizon, isFinite(sp.eventHorizon) ? sp.eventHorizon : 0, sp.hubble0) * (comov ? 1.3 : 1), 20, 150);
  plot('c-cone', 'tall').set({
    x: { min: -xmax, max: xmax, label: comov ? 'comoving distance [Gly]' : 'proper distance [Gly]', short: 'd [Gly]' },
    y: { min: 0, max: yTop, label: comov ? 'conformal time η [Gly]' : 'cosmic time [Gyr]', short: comov ? 'η' : 't' },
    series: ser, hlines: [{ y: ynow, label: 'today', color: '#ffffff' }, { y: comov ? GP.lerp(sp.past.t, sp.past.eta, (R.rec.tstar || 0)) : (R.rec.tstar || 0) / Gy, label: 'CMB released', color: '#ff9aa6' }],
    dots: [{ x: 0, y: ynow, color: '#fff', r: 4, label: 'us' }],
  });
  $('#cone-cap').innerHTML = `In proper coordinates our past light cone is a <b>teardrop</b>: the light now reaching us from the most distant objects was emitted when they were only a few Gly away, then carried outward by the expanding space. Today’s particle horizon is <b>${fmt(sp.particleHorizon, 3)} Gly</b> (larger than 13.8 Gly because space stretched while light travelled), the event horizon is <b>${isFinite(sp.eventHorizon) ? fmt(sp.eventHorizon, 3) + ' Gly' : 'absent'}</b>, the Hubble radius <b>${fmt(sp.hubble0, 3)} Gly</b>. <b>Horizon problem:</b> at recombination a causally connected patch spans only <b>${fmt(sp.thetaH * 180 / Math.PI, 2)}°</b> of our sky, i.e. ~${fmt(sp.patches, 2)} patches that never exchanged a signal — yet the CMB has the same temperature to 1 part in 10⁵. Inflation (${fmt(P.Ne, 3)} e-folds, stretching lengths by e<sup>${fmt(P.Ne, 2)}</sup> ≈ ${fmt(Math.exp(P.Ne), 2)}) put the whole sky inside one patch. Switch to comoving coordinates to see light travel on straight 45° lines.`;
  // ---- curvature through time
  const pt = sp.past.t, hub = sp.past.H.map(H => CL / H), phz = sp.past.a.map((a, i) => a * sp.past.eta[i] * GLY);
  const vT = { x: m.tS, label: 'selected moment', color: '#ffffff' };
  plot('c-curv').set({
    x: { log: 1, label: 'time since Big Bang [s]', short: 't', fmt: fmtTime }, y: { log: 1, min: 1e-36, max: 1e28, label: 'length [m]', short: 'ℓ', fmt: v => fmtLen(v) },
    series: [{ name: 'spacetime curvature radius K^−¼', x: pt, y: sp.past.lcurv, color: '#ff7a8c', width: 2.2 }, { name: 'Hubble radius c/H', x: pt, y: hub, color: '#5ef0a8', width: 1.6, dash: [4, 4] }, { name: 'observable universe (particle horizon)', x: pt, y: phz, color: '#7cc4ff', width: 1.6 }],
    hlines: [{ y: GP.SI.lP, label: 'Planck length 1.6×10⁻³⁵ m — quantum gravity', color: '#ffb86b' }], vlines: m.tS <= pt[pt.length - 1] ? [vT] : [],
  });
  plot('c-trace').set({
    x: { log: 1, label: 'time since Big Bang [s]', short: 't', fmt: fmtTime }, y: { min: -1.1, max: 1.1, label: 'w_eff  /  q', short: 'value' },
    series: [{ name: 'equation of state w = p/ρc²', x: pt, y: sp.past.w, color: '#ffd66b', width: 2 }, { name: 'deceleration q = −ä a/ȧ²', x: pt, y: sp.past.q, color: '#7cc4ff', width: 1.6 }],
    hlines: [{ y: 1 / 3, label: 'radiation w = ⅓', color: '#5a6190' }, { y: 0, label: 'dust w = 0', color: '#5a6190' }, { y: -1 / 3, label: 'w = −⅓: gravity switches sign', color: '#5ef0a8' }, { y: -1, label: 'Λ w = −1', color: '#5a6190' }],
    vlines: m.tS <= pt[pt.length - 1] ? [vT] : [],
  });
  // ---- bound structures
  const Ms = []; for (let l = -7; l <= 17.01; l += 0.1) Ms.push(Math.pow(10, l));
  const r0now = Ms.map(M => GP.zeroGravityRadius(M * MSUN, R.cp, 1) / MPC), r0sel = Ms.map(M => GP.zeroGravityRadius(M * MSUN, R.cp, m.a) / MPC);
  const bs = [{ name: 'zero-gravity radius today', x: Ms, y: r0now, color: '#5ef0a8', width: 2.2 }];
  if (Math.abs(m.a - 1) > 0.01) bs.push({ name: `…at the selected moment (a = ${fmt(m.a, 3)})`, x: Ms, y: r0sel, color: '#ffd66b', width: 1.6, dash: [5, 4] });
  plot('c-bound').set({
    x: { log: 1, min: 1e-7, max: 1e17, label: 'mass [M☉]', short: 'M' }, y: { log: 1, min: 1e-16, max: 1e3, label: 'size [Mpc]', short: 'r' }, series: bs,
    dots: sp.systems.map(sy => ({ x: sy.M, y: sy.R / MPC, color: sy.bound ? '#ffd66b' : '#ff6b81', r: 4, label: sy.name.split(' (')[0] })),
  });
  $('#bound-tab').innerHTML = `<p class="muted" style="font-size:12px">A system of mass M is held together if it lies <b>below</b> the line r₀ = [3M / (4π|ρ<sub>DE</sub>(1+3w)|)]<sup>⅓</sup>, where the outward push of dark energy equals the inward pull of gravity. The Local Group sits just inside its r₀ ≈ 1.5 Mpc — the edge of what gravity can hold together in our universe.</p>` +
    '<table class="ledger"><tr><th>System</th><th>size</th><th>zero-gravity radius now</th><th>fate</th></tr>' + sp.systems.map(sy => `<tr><td>${sy.name}</td><td class="n">${fmtLen(sy.R)}</td><td class="n">${isFinite(sy.r0) ? fmtLen(sy.r0) : '∞'}</td><td class="n ${sy.tRip !== null ? 'pull' : 'push'}">${sy.tRip !== null ? `torn apart at t = ${fmt(sy.tRip, 5)} Gyr (${fmtTime((R.ft.tEnd - sy.tRip) * Gy)} before the rip)` : sy.bound ? 'stays bound' : 'already unbound'}</td></tr>`).join('') + '</table>' +
    (R.ft.outcome === 'rip' ? '<p class="muted" style="font-size:12px">Atoms, held by electromagnetism, follow ~10⁻¹⁹ s before the rip (Caldwell, Kamionkowski &amp; Weinberg 2003).</p>' : '');
  // ---- gravitational waves
  const gw = sp.gw, rr = R.inf.r;
  const curve = (f0, O0, lo, hi, a1, a2) => { const X = [], Y = []; for (let l = L10(lo); l <= L10(hi) + 1e-9; l += 0.05) { const f = Math.pow(10, l); X.push(f); Y.push(O0 * 0.5 * (Math.pow(f / f0, -a1) + Math.pow(f / f0, a2))); } return [X, Y]; };
  const [lx, ly] = curve(3e-3, 2e-13, 2e-5, 0.5, 3.5, 2), [bx, by] = curve(0.3, 2e-17, 1e-3, 20, 4, 2), [gx, gy] = curve(25, 1.2e-8, 12, 1500, 3, 2.5), [ex, ey] = curve(20, 2e-12, 3, 3000, 4, 2);
  const nX = [], nY = []; for (let l = L10(2e-9); l <= L10(6e-8); l += 0.05) { const f = Math.pow(10, l); nX.push(f); nY.push(3.6e-9 * Math.pow(f / 3.17e-8, 2 / 3)); }
  const cmbX = gw.f.filter(f => f < 1e-16), cmbY = gw.O.slice(0, cmbX.length).map(v => v * 0.036 / Math.max(rr, 1e-12));
  plot('c-gw').set({
    x: { log: 1, min: 1e-19, max: 1e4, label: 'frequency today [Hz]', short: 'f' }, y: { log: 1, min: 1e-20, max: 1e-5, label: 'Ω_GW h²', short: 'Ω h²' },
    series: [
      { name: `inflation (r = ${fmt(rr, 2)})`, x: gw.f, y: gw.O, color: '#ffd66b', width: 2.4 },
      { name: 'CMB B-mode bound (r < 0.036)', x: cmbX, y: cmbY, color: '#ff6b81', width: 2 },
      { name: 'NANOGrav 15-yr signal (likely black-hole binaries)', x: nX, y: nY, color: '#c792ea', width: 3 },
      { name: 'LISA (approx.)', x: lx, y: ly, color: '#7cc4ff', dash: [4, 4] }, { name: 'BBO/DECIGO (approx.)', x: bx, y: by, color: '#5ef0a8', dash: [4, 4] },
      { name: 'LIGO-Virgo O3 limit', x: gx, y: gy, color: '#ff9aa6', dash: [4, 4] }, { name: 'Einstein Tel./Cosmic Expl. (approx.)', x: ex, y: ey, color: '#ffb86b', dash: [4, 4] },
    ],
    vlines: [{ x: gw.feq, label: 'horizon at equality', color: '#5a6190' }, { x: Math.min(gw.frh, 5e3), label: 'reheating cut-off', color: '#c792ea', dy: 14 }],
  });
  const at = f => GP.lerp(gw.f.map(Math.log), gw.O, Math.log(f));
  $('#s-gw').innerHTML = [
    stat('Ω<sub>GW</sub>h² at 1 mHz (LISA)', at(1e-3), {}), stat('Ω<sub>GW</sub>h² at 0.3 Hz (BBO)', at(0.3), { note: at(0.3) > 2e-17 ? 'within BBO reach' : 'below BBO reach' }),
    stat('Energy scale of inflation', fmt(R.inf.V14, 3) + ' GeV', {}), stat('Tensor tilt n<sub>t</sub> = −r/8', -rr / 8, { d: 3 }),
  ].join('');
}
function stPlay() {
  const btn = $('#st-play');
  if (ST.playing) { ST.playing = false; btn.textContent = '▶ Run cosmic history'; return; }
  ST.playing = true; btn.textContent = '❚❚ Pause';
  const [l0, l1] = stRange(); if (L10(ST.tGyr) >= l1 - 0.01) ST.tGyr = Math.pow(10, l0);
  let last = performance.now(), lastFull = 0;
  const step = now => {
    if (!ST.playing || tab !== 'spacetime') { ST.playing = false; btn.textContent = '▶ Run cosmic history'; return; }
    const dt = (now - last) / 1000; last = now;
    const [a0, a1] = stRange(); let l = L10(ST.tGyr) + dt * (a1 - a0) / 30;
    if (l >= a1) { l = a1; ST.playing = false; btn.textContent = '▶ Run cosmic history'; }
    ST.tGyr = Math.pow(10, l);
    if (now - lastFull > 90) { stRenderMoment(); lastFull = now; } else { stClampTime(); drawFabric(); }
    requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

/* ============================================================ SCENARIOS */
const SCEN = [
  { tag: 'Antimatter', title: 'No CP violation', set: { eps: 0 }, tab: 'bary', txt: 'ε = 0: X and anti-X decay identically. Matter and antimatter annihilate completely — no nucleosynthesis, no stars. Dark-matter halos still form, but they stay dark.' },
  { tag: 'Antimatter', title: 'Asymmetry made after the electroweak transition', set: { M_X: 20, K: 1, eps: 1e-7 }, tab: 'bary', txt: 'A light (20 GeV) particle makes its lepton asymmetry below T_sph = 131.7 GeV. Sphalerons are already off, so leptons never become baryons: η collapses.' },
  { tag: 'Antimatter', title: '…now delay the electroweak transition', set: { M_X: 20, K: 1, eps: 1e-7, T_sph: 1 }, tab: 'bary', txt: 'Same 20 GeV particle, but sphalerons stay active down to 1 GeV. The order of events is restored and the matter excess survives. Timing, not just physics, decides.' },
  { tag: 'Antimatter', title: 'Minimal SU(5) GUT baryogenesis', set: { bg_mode: 'gut', M_X: 1e15, K: 1 }, tab: 'bary', txt: 'X bosons at 10¹⁵ GeV violate B but conserve B−L. A real asymmetry is made — then sphalerons wash out B+L and nothing survives. The historical reason leptogenesis replaced GUT baryogenesis.' },
  { tag: 'Antimatter', title: 'GUT-type decays below the EW scale', set: { bg_mode: 'gut', M_X: 30, K: 1, eps: 3.5e-8 }, tab: 'bary', txt: 'The same B−L-conserving decays, but after sphaleron freeze-out: baryon number made this late survives.' },
  { tag: 'Reheating', title: 'Low reheating temperature (10⁶ GeV)', set: { T_rh: 1e6 }, tab: 'seq', txt: 'The plasma is never hot enough to make the 10¹⁰ GeV decaying particles: η ≈ 0. WIMPs are unaffected — their freeze-out happens much later.' },
  { tag: 'Reheating', title: 'Reheating at 1 GeV', set: { T_rh: 1 }, tab: 'dm', txt: 'Below the 100 GeV WIMP’s freeze-out temperature (~4 GeV): dark matter is only made by the thermal tail, far too little. Leptogenesis fails too.' },
  { tag: 'Light elements', title: 'A fourth neutrino', set: { Neff: 4.044 }, tab: 'bbn', txt: 'Faster expansion → earlier n/p freeze-out → more neutrons → Y_p rises by ~0.013. BBN and the CMB both limit N_eff ≈ 3.' },
  { tag: 'Light elements', title: 'Dark radiation created after BBN', set: { dN_inj: 1, T_inj: 3e-6 }, tab: 'cmb', txt: 'A new light species appearing at 3 keV (after nucleosynthesis) leaves the light elements untouched but changes the expansion before recombination — the acoustic scale shifts. Watch the timeline marker.' },
  { tag: 'Light elements', title: 'Short-lived neutron (τ = 100 s)', set: { tau_n: 100 }, tab: 'bbn', txt: 'A stronger weak force keeps n↔p in equilibrium longer, and neutrons decay before the deuterium bottleneck opens: much less helium.' },
  { tag: 'Light elements', title: 'Unbound deuteron', set: { BD_s: 0 }, tab: 'bbn', txt: 'Without a bound deuteron there is no first step to heavier nuclei. Every neutron decays: a pure-hydrogen universe (and a very different stellar history).' },
  { tag: 'Light elements', title: 'Smaller n–p mass difference (×0.7)', set: { Q_s: 0.7 }, tab: 'bbn', txt: 'Neutrons are cheaper and live longer (τ_n grows automatically): a helium-rich universe.' },
  { tag: 'Constants', title: 'Heavier electron (×1.1)', set: { me_s: 1.1 }, tab: 'cmb', txt: 'Hydrogen binds 10% more tightly: recombination happens ~10% earlier, the sound horizon shrinks and the CMB peaks move — a proposed ingredient for the Hubble tension.' },
  { tag: 'Constants', title: 'Fine-structure constant +2%', set: { alpha_s: 1.02 }, tab: 'cmb', txt: 'Binding energy ∝ α²: last scattering moves ~4% earlier.' },
  { tag: 'Constants', title: 'Stronger gravity at BBN (G × 1.2)', set: { G_s: 1.2 }, tab: 'bbn', txt: 'H ∝ √G: the same effect as extra relativistic species.' },
  { tag: 'Dark matter', title: 'No dark matter', set: { link_dm: false, omega_c: 0 }, tab: 'lss', txt: 'Baryons cannot grow until recombination and Silk damping erases small scales: σ₈ collapses and galaxies are rare. In a flat universe H₀ drops too.' },
  { tag: 'Dark matter', title: 'Weaker annihilation (⟨σv⟩ ÷ 10)', set: { sv: 2.125e-27 }, tab: 'dm', txt: 'Freeze-out comes earlier and 10× more WIMPs survive: Ω_c h² ≈ 1.2. Matter domination starts sooner, structure grows fast, the universe is younger.' },
  { tag: 'Dark matter', title: 'Heavy WIMP, same coupling (3 TeV)', set: { m_dm: 3000 }, tab: 'dm', txt: 'The relic density barely changes: it depends on ⟨σv⟩, not on the mass. That is the WIMP miracle.' },
  { tag: 'Dark matter', title: '1 keV warm dark matter', set: { m_wdm: 1 }, tab: 'lss', txt: 'Free-streaming erases halos below ~10¹⁰ M☉: no dwarf galaxies, first galaxies delayed. Set the web box to 20 Mpc to see it.' },
  { tag: 'Dark energy', title: 'Phantom dark energy (w = −1.3)', set: { w0: -1.3 }, tab: 'de', txt: 'ρ_DE grows as the universe expands. The scale factor reaches infinity at finite time: the Big Rip.' },
  { tag: 'Dark energy', title: 'Negative cosmological constant', set: { omega_L: -0.05 }, tab: 'de', txt: 'Attractive vacuum energy: expansion halts and reverses into a Big Crunch.' },
  { tag: 'Dark energy', title: 'Λ 300× larger (Weinberg)', set: { omega_L: 93.2 }, tab: 'lss', txt: 'Acceleration starts before halos can collapse: growth freezes and Milky-Way galaxies never form. Weinberg’s anthropic argument for a small Λ.' },
  { tag: 'Dark energy', title: 'Thawing dark energy (w₀ = −0.75, wₐ = −0.8)', set: { w0: -0.75, wa: -0.8 }, tab: 'de', txt: 'Evolving dark energy close to the DESI 2024–25 preference. Compare age, H₀ and q(z) with ΛCDM.' },
  { tag: 'Spacetime', title: 'Watch spacetime tear: the Big Rip sequence', set: { w0: -1.5 }, tab: 'spacetime', txt: 'Phantom dark energy (w = −1.5) grows as space stretches. Its repulsion overwhelms gravity scale by scale: clusters and the Local Group unbind first, the Milky Way ~2 Gyr before the end, the Solar System decades before, Earth–Moon hours before. Press “Run cosmic history”.' },
  { tag: 'Spacetime', title: 'A closed universe (positive curvature)', set: { closure: 'fixedH', H0: 64 }, tab: 'spacetime', txt: 'Keep the densities but lower H₀: the total exceeds the critical density, Ω_k < 0 and space closes on itself like a 3-sphere — finite volume, triangles with angle sums above 180°.' },
  { tag: 'Spacetime', title: 'An open universe (negative curvature)', set: { closure: 'fixedH', H0: 72 }, tab: 'spacetime', txt: 'Raise H₀ with the same contents: Ω_k > 0, space is hyperbolic (saddle-shaped), parallel light rays diverge.' },
  { tag: 'Spacetime', title: 'No dark energy: gravity always wins', set: { omega_L: 0.0001 }, tab: 'spacetime', txt: 'Without dark energy there is no zero-gravity radius, no event horizon and no acceleration: expansion decelerates forever and every structure remains bound.' },
  { tag: 'Inflation', title: 'Chaotic φ² inflation', set: { inf_model: 'quadratic' }, tab: 'inflation', txt: 'Predicts r ≈ 0.14 — excluded by BICEP/Keck. Its n_s is almost identical to Starobinsky’s, so only primordial gravitational waves (r) tell the two apart.' },
  { tag: 'Particles', title: 'Late quark confinement (T_c = 30 MeV)', set: { T_qcd: 0.03 }, tab: 'thermal', txt: 'The QCD step in g* moves to lower temperature, re-timing the clock of the early universe.' },
  { tag: 'Particles', title: 'A universe without muons', set: { off: { mu: true } }, tab: 'thermal', txt: 'Remove the muon from the plasma: g* drops between ~100 MeV and ~30 MeV, the universe expands more slowly there.' },
];
function buildCards() {
  $('#cards').innerHTML = SCEN.map((s, i) => {
    const q = QUIZ[s.title], v = NB.verdicts[s.title];
    return `<div class="card${v ? (v.ok ? ' done-ok' : ' done-bad') : ''}" data-i="${i}"><span class="tag">${q ? 'Gedankenexperiment · ' : ''}${s.tag}</span><h4>${s.title}</h4>` +
      (q ? `<div class="ask">${q.ask}</div><div class="opts">${q.opts.map((o, j) => `<button class="opt" data-j="${j}">${o}</button>`).join('')}</div>` : '') +
      (v ? `<div class="verdict">${v.html}</div>` : '') +
      `<p${q && !v ? ' hidden' : ''}>${s.txt}</p><button class="go">${q && !v ? 'Skip the prediction and run →' : 'Run this universe →'}</button></div>`;
  }).join('');
  $$('#cards .card').forEach(c => {
    const s = SCEN[+c.dataset.i];
    $('.go', c).onclick = () => applyScenario(s);
    $$('.opt', c).forEach(b => b.onclick = () => applyScenario(s, +b.dataset.j));
  });
}
function applyScenario(s, pred) {
  P = clone(GP.DEFAULTS); Object.assign(P, clone(s.set));
  P.massScale = P.massScale || {}; P.off = P.off || {};
  compute();
  const q = QUIZ[s.title];
  let head = `<b>${s.title}.</b> ${s.txt}`;
  if (q && pred !== undefined) {
    const ans = q.ans(R), ok = ans === pred, why = q.why(R);
    NB.total++; if (ok) NB.right++;
    const html = `You predicted <b>${q.opts[pred]}</b> — <span class="${ok ? 'ok' : 'no'}">${ok ? 'the equations agree ✓' : 'the equations say: ' + q.opts[ans] + ' ✗'}</span>. ${why}`;
    NB.verdicts[s.title] = { ok, html };
    head = `<span class="verdict">${html}</span><br><span class="muted">${s.txt}</span> <span class="mono" style="font-size:11px">· intuition score ${NB.right}/${NB.total}</span>`;
    nbAdd('gedanken', 'Gedankenexperiment: ' + s.title, `predicted “${q.opts[pred]}” — ${ok ? 'correct' : 'wrong, answer: ' + q.opts[ans]}. ${why.replace(/<[^>]+>/g, '')}`);
    buildCards();
  } else nbAdd('run', 'Scenario: ' + s.title);
  showTab(s.tab);
  $('#banner-txt').innerHTML = head; $('#banner').classList.add('on');
}

/* ============================================================ METHODS */
function renderMethods() {
  if (renderMethods.done) return; renderMethods.done = true;
  const B = BASE, nb = B.nuc;
  const rows = [
    ['H₀ (flat, from ω’s)', B.cp.H0, '67.36 ± 0.54', 'Planck 2018'], ['Age of the universe [Gyr]', B.tl.age, '13.797 ± 0.023', 'Planck 2018'],
    ['z_eq', B.rec.zeq, '3402 ± 26', 'Planck 2018'], ['g* above the EW scale', B.th.g(1e3).gr, '106.75', 'Standard Model'],
    ['Leptogenesis efficiency κ (K = 10)', B.bg.kappa, '0.032', 'Buchmüller+ 2005 fit'], ['WIMP Ωh² (100 GeV, 2.1×10⁻²⁶)', B.dm.omegah2, '≈ 0.12', 'Steigman+ 2012'],
    ['Y_p', nb.Yp, '0.2471', 'PRIMAT (Pitrou+ 2018)'], ['D/H ×10⁵', nb.DH * 1e5, '2.44–2.6', 'PRIMAT / older rates'], ['³He/H ×10⁵', nb.He3H * 1e5, '1.04', 'PRIMAT'], ['⁷Li/H ×10¹⁰', nb.Li7H * 1e10, '4.7–5.6', 'rate-set dependent'],
    ['z* (τ = 1)', B.rec.zstar, '1089.92 ± 0.25', 'Planck 2018'], ['100 θ*', B.rec.theta100, '1.04110 ± 0.00031', 'Planck 2018'], ['r_s(z*) [Mpc]', B.rec.rs, '144.43 ± 0.26', 'Planck 2018'],
    ['Particle horizon today [Gly]', B.sp.particleHorizon, '≈ 46', 'Davis & Lineweaver 2004'], ['Event horizon today [Gly]', B.sp.eventHorizon, '≈ 16–17', 'Davis & Lineweaver 2004'],
    ['Local Group zero-gravity radius [Mpc]', B.sp.systems[1].r0 / MPC, '≈ 1.5', 'Chernin+ 2009'], ['CMB causal patch angle [deg]', B.sp.thetaH * 180 / Math.PI, '≈ 1–2', 'textbook horizon problem'],
    ['τ_reion (z_re = 7.7)', B.rec.tauReion, '0.054 ± 0.007', 'Planck 2018'], ['σ₈', B.st.sigma8, '0.811 ± 0.006', 'Planck 2018'], ['q₀', B.ft.q0, '−0.53', 'ΛCDM'], ['z_acc', B.ft.zacc, '0.63', 'ΛCDM'],
  ];
  $('#val').innerHTML = '<tr><th>Quantity</th><th>This code</th><th>Published</th><th>Source</th></tr>' + rows.map(r => `<tr><td>${r[0]}</td><td class="n">${fmt(r[1], 5)}</td><td class="n">${r[2]}</td><td class="muted">${r[3]}</td></tr>`).join('');
  $('#methods-text').innerHTML = `
  <h3>Thermal history</h3><p>Energy and entropy of every Standard-Model species from exact Bose–Einstein/Fermi–Dirac integrals (tabulated in m/T); QCD crossover as a smooth quark–gluon ↔ pion switch at T<sub>c</sub>; neutrinos decouple instantaneously at T<sub>dec</sub> and T<sub>ν</sub>/T follows from plasma entropy.</p>
  <div class="eq">a(T) = (g<sub>*s,0</sub>/g<sub>*s</sub>(T))<sup>1/3</sup> T<sub>0</sub>/T &nbsp;·&nbsp; H² = (8π/3M<sub>Pl</sub>²)[π²/30 g<sub>*</sub>T⁴ + ρ<sub>m</sub> + ρ<sub>DE</sub> + ρ<sub>k</sub>] &nbsp;·&nbsp; t = ∫ d ln a / H</div>
  <h3>Baryogenesis</h3><p>Out-of-equilibrium decays of X (Buchmüller, Di Bari &amp; Plümacher 2005) with sphaleron conversion a<sub>sph</sub> = 28/79 applied only to asymmetry created while T &gt; T<sub>sph</sub>; SU(5)-type (B−L = 0) asymmetry erased above T<sub>sph</sub>.</p>
  <div class="eq">dN<sub>X</sub>/dz = −D(N<sub>X</sub>−N<sup>eq</sup>) &nbsp;·&nbsp; dN<sub>B−L</sub>/dz = ε D(N<sub>X</sub>−N<sup>eq</sup>) − W N<sub>B−L</sub> &nbsp;·&nbsp; D = Kz K₁/K₂, W = ¼Kz³K₁ &nbsp;·&nbsp; η = a<sub>sph</sub>N<sub>B−L</sub>/f</div>
  <h3>Dark-matter freeze-out</h3><div class="eq">dY/dx = −(s⟨σv⟩/Hx)(Y² − Y<sub>eq</sub>²) &nbsp;·&nbsp; Y<sub>eq</sub> = 45 g x² K₂(x)/(4π⁴ g<sub>*s</sub>) &nbsp;·&nbsp; Ωh² = m Y<sub>∞</sub> s<sub>0</sub>/ρ<sub>c</sub></div><p>Implicit step solved exactly (quadratic), stable for any stiffness. Warm DM: Viel+ 2005 transfer-function cut-off.</p>
  <h3>Nucleosynthesis</h3><p>n, p, D, T, ³He, ⁴He, ⁷Li, ⁷Be; 11 reactions (Smith, Kawano &amp; Malaney 1993 / Caughlan &amp; Fowler 1988 fits) with detailed-balance reverse rates. Weak n↔p rates integrated in the Born approximation with FD electrons and neutrinos, normalised to τ<sub>n</sub>; +0.0040 in Y<sub>p</sub> for radiative/finite-mass corrections (Pitrou+ 2018). Photon temperature from e±γ entropy conservation. Backward-Euler + Newton, Δln a = 0.0025.</p>
  <h3>Recombination</h3><p>Peebles three-level atom with the RECFAST fudge F = 1.14 (Seager+ 1999), helium by Saha, tanh reionisation (CAMB). Atomic constants rescaled with α and m<sub>e</sub> (B ∝ α²m<sub>e</sub>, α<sub>B</sub> ∝ α²m<sub>e</sub>⁻², Λ<sub>2s</sub> ∝ α⁸m<sub>e</sub>, σ<sub>T</sub> ∝ α²m<sub>e</sub>⁻²; Hart &amp; Chluba 2018).</p>
  <h3>Structure</h3><div class="eq">D″ + (2 + d ln E/d ln a)D′ = (3/2)Ω<sub>m</sub>(a)D &nbsp;·&nbsp; Δ²(k) = (4/25)A<sub>s</sub>(k/k<sub>p</sub>)<sup>n<sub>s</sub>−1</sup>(k/H₀)⁴T²(k)D²/Ω<sub>m</sub>²</div><p>Eisenstein &amp; Hu 1998 no-wiggle transfer function, massive-ν suppression, Sheth–Tormen mass function, Moster+ 2013 stellar-to-halo relation scaled by the baryon fraction. Cosmic web: 2-D Zel'dovich displacement of a Gaussian field with this P(k).</p>
  <h3>Spacetime &amp; gravity</h3><div class="eq">H² = (8πG/3)ρ − kc²/a² &nbsp;·&nbsp; ä/a = −(4πG/3)(ρ + 3p/c²) &nbsp;·&nbsp; R = 8πG(ρ−3p/c²)/c² &nbsp;·&nbsp; K = 12[(ä/a)² + (8πGρ/3)²]/c⁴ &nbsp;·&nbsp; η = ∫c dt/a</div><p>Einstein’s equations for the FLRW metric with the thermal pressure of every species (so R vanishes for pure radiation and spikes at annihilations). Horizons from conformal time along the computed past and the integrated future. Bound structures: Newtonian limit in a dark-energy background, zero-gravity radius r₀ = [3M/4π|ρ<sub>DE</sub>(1+3w)|]<sup>⅓</sup> (Chernin 2001). Primordial gravitational waves: tensor spectrum rA<sub>s</sub>(f/f<sub>*</sub>)<sup>−r/8</sup> transferred as Ω<sub>GW</sub> = (3/128)Ω<sub>r</sub>P<sub>t</sub>[½(f<sub>eq</sub>/f)² + 16/9] with g* dilution and a reheating cut-off (Boyle &amp; Steinhardt 2008); detector curves approximate. The fabric view is a faithful map of these quantities with exaggerated vertical scales — an embedding picture, not the full 4-D geometry.</p>
  <h3>Dark energy &amp; fate</h3><p>CPL w(a) = w₀ + w<sub>a</sub>(1−a). The acceleration equation ä = −(a/2)Σ Ω<sub>i</sub>(1+3w<sub>i</sub>)a<sup>−3(1+w<sub>i</sub>)</sup> is integrated forward with RK4, catching Big Rip (a → ∞ at finite t) and recollapse.</p>
  <h3>Honest limits</h3><p class="muted">Reduced-order models, not CAMB/CLASS/PRIMAT: expect ~0.5% on H₀, age, θ*; ~1% on Y<sub>p</sub>; ~5–10% on D/H and ⁷Li; ~3–5% on σ₈. Where the code differs from data in standard ΛCDM, that offset is added to the error when colouring agreement dots. Comparisons between universes (Δ values, pinned baselines) are far more precise than absolute values. Late-time growth ignores baryon–photon oscillations and nonlinear feedback; varying constants are applied only where stated.</p>`;
}

/* ============================================================ BLACKBOARDS
 * The governing equations of each epoch, typeset with KaTeX, with this universe's numbers
 * substituted and — where physicists would reach for one — a back-of-the-envelope estimate
 * set against the full numerical result. */
function texN(v, d) {
  if (v === null || v === undefined || !isFinite(v)) return '\\text{—}';
  if (v === 0) return '0';
  const a = Math.abs(v); d = d || 3;
  if (a >= 1e-3 && a < 1e5) return String(parseFloat(v.toPrecision(d)));
  const e = Math.floor(Math.log10(a)), m = parseFloat((v / Math.pow(10, e)).toPrecision(d));
  if (Math.abs(m) === 10) return (m < 0 ? '-' : '') + '10^{' + (e + 1) + '}';
  return (m === 1 ? '' : m === -1 ? '-' : m + '\\times ') + '10^{' + e + '}';
}
// readable plain-text rendering of our TeX, used until KaTeX arrives (or if the CDN is unreachable)
function texToText(t) {
  const SYM = { alpha: 'α', beta: 'β', gamma: 'γ', delta: 'δ', varepsilon: 'ε', epsilon: 'ε', eta: 'η', theta: 'θ', kappa: 'κ', lambda: 'λ', Lambda: 'Λ', mu: 'μ', nu: 'ν', pi: 'π', rho: 'ρ', sigma: 'σ', tau: 'τ', chi: 'χ', Omega: 'Ω', odot: '☉', ell: 'ℓ',
    times: '×', simeq: '≃', approx: '≈', lesssim: '≲', ll: '≪', Rightarrow: '⇒', int: '∫', partial: '∂', infty: '∞', propto: '∝', langle: '⟨', rangle: '⟩', ddot: '', dot: '', text: '', mathrm: '', rm: '', tfrac: '', mathcal: '' };
  let s = t.replace(/\\begin\{gathered\}|\\end\{gathered\}/g, '').replace(/\\\\/g, ' · ').replace(/\\(xrightarrow)(\[[^\]]*\])?\{([^{}]*)\}/g, ' →$3→ ');
  for (let k = 0; k < 6; k++) {                       // innermost groups first
    s = s.replace(/\^\{([^{}]*)\}/g, '^$1').replace(/_\{([^{}]*)\}/g, '_$1').replace(/\\sqrt\{([^{}]*)\}/g, '√($1)')
      .replace(/\\(mathrm|text|rm|mathcal)\{([^{}]*)\}/g, '$2').replace(/\\[td]?frac\{([^{}]*)\}\{([^{}]*)\}/g, '($1)/($2)');
  }
  s = s.replace(/\\(Big|big|left|right)[()|.]?/g, '').replace(/\\[,;:! ]|\\quad|\\qquad/g, ' ')
    .replace(/\\([A-Za-z]+)/g, (m, w) => (w in SYM ? SYM[w] : w))
    .replace(/\^\{([^{}]*)\}/g, '^$1').replace(/_\{([^{}]*)\}/g, '_$1').replace(/[{}]/g, '').replace(/\s+/g, ' ');
  return s.trim();
}
function renderTeX(el, tex, display) {
  el.classList.remove('tex-plain');
  if (window.katex) { try { window.katex.render(tex, el, { displayMode: !!display, throwOnError: false }); return; } catch (e) { /* fall through to plain text */ } }
  el.textContent = texToText(tex);
  el.classList.add('tex-plain');
}
function ensureBoard(t) {
  const sec = $(`section[data-tab="${t}"]`); if (!sec) return null;
  let b = $('.chalkboard', sec);
  if (!b) {
    const stack = $('.stack', sec); if (!stack) return null;
    const pnl = document.createElement('div'); pnl.className = 'panel board-panel';
    pnl.innerHTML = '<div class="ph"><h3>On the blackboard</h3><span class="muted" style="font-size:11px">live values · back-of-the-envelope vs full calculation</span></div><div class="chalkboard"></div>';
    stack.insertBefore(pnl, stack.children[1] || null);
    b = $('.chalkboard', pnl);
  }
  return b;
}
function renderBoard(t, m) {
  const f = BOARDS[t]; if (!f) return;
  const b = ensureBoard(t); if (!b) return;
  let lines; try { lines = f(m); } catch (e) { console.warn('board', t, e); return; }
  b.innerHTML = lines.map(() => '<div class="chalk-line"><div class="tex"></div><div class="note"></div></div>').join('');
  $$('.chalk-line', b).forEach((el, i) => {
    const [tex, note, cmp] = lines[i];
    renderTeX($('.tex', el), tex, true);
    const n = $('.note', el);
    if (note) { n.innerHTML = note; if (cmp) n.classList.add('cmp'); } else n.remove();
  });
}
const MPL = 1.220890e19, HBAR = 6.582119569e-25;
const INF_TEX = {
  starobinsky: 'n_s = 1-\\frac{2}{N_*},\\qquad r = \\frac{12}{N_*^{2}}',
  quadratic: 'n_s = 1-\\frac{2}{N_*+\\frac12},\\qquad r = \\frac{8}{N_*+\\frac12}',
  quartic: 'n_s = 1-\\frac{3}{N_*+1},\\qquad r = \\frac{16}{N_*+1}',
  hilltop: 'n_s \\simeq 1-\\frac{3}{N_*},\\qquad r \\ll 10^{-3}',
  custom: 'n_s,\\ r\\ \\text{set by hand}',
};
const BOARDS = {
  thermal: () => {
    const T = 1e-3, g = R.th.g(T), tEnv = 0.301 / Math.sqrt(g.gr) * MPL / (T * T) * HBAR, g0 = R.th.g(R.cp.T0);
    return [
      [`\\rho = \\frac{\\pi^2}{30}\\,g_*(T)\\,T^4,\\qquad s = \\frac{2\\pi^2}{45}\\,g_{*s}(T)\\,T^3,\\qquad g_*(1\\,\\mathrm{TeV}) = ${texN(R.th.g(1e3).gr, 4)}`, 'every relativistic species counts; each one that annihilates hands its entropy to the rest'],
      [`t = \\frac{1}{2H} = 0.301\\,g_*^{-1/2}\\,\\frac{M_{\\rm Pl}}{T^2}\\;\\xrightarrow[\\;g_*=${texN(g.gr, 4)}\\;]{T\\,=\\,1\\,\\mathrm{MeV}}\\;${texN(tEnv, 3)}\\ \\mathrm{s}`, `back of the envelope <b>${fmt(tEnv, 3)} s</b> · full integration from the Planck time <b>${fmt(R.tl.tAtT(T), 3)} s</b>`, 1],
      [`\\frac{T_\\nu}{T_\\gamma} = \\Big(\\frac{4}{11}\\Big)^{1/3} = 0.7138`, `e⁺e⁻ entropy heats only the photons · computed today: <b>${fmt(g0.r, 4)}</b>`, 1],
    ];
  },
  inflation: () => {
    const i = R.inf;
    return [
      [`${INF_TEX[P.inf_model] || INF_TEX.custom}\\qquad (N_* = ${texN(P.Ne, 3)})`, `this model: n<sub>s</sub> = <b>${fmt(i.ns, 4)}</b>, r = <b>${fmt(i.r, 3)}</b> · Planck n<sub>s</sub> = 0.9649 ± 0.0042, r &lt; 0.036`, 1],
      [`V^{1/4} = \\Big(\\frac{3\\pi^2}{2}\\,A_s\\,r\\Big)^{1/4} M_{\\rm Pl} = ${texN(i.V14, 3)}\\ \\mathrm{GeV}`, 'the energy scale of inflation is fixed by the gravitational-wave amplitude r'],
      [`H_{\\rm inf} = \\frac{\\sqrt{V/3}}{M_{\\rm Pl}} = ${texN(i.Hinf, 3)}\\ \\mathrm{GeV},\\qquad T_{\\rm rh} \\lesssim \\Big(\\frac{30\\,V}{\\pi^2 g_*}\\Big)^{1/4} = ${texN(i.Tmax, 3)}\\ \\mathrm{GeV}`, `chosen T<sub>rh</sub> = <b>${fmt(P.T_rh)} GeV</b>${P.T_rh > i.Tmax ? ' — hotter than this inflaton can deliver!' : ''}`],
    ];
  },
  bary: () => {
    const bg = R.bg, K = P.K, zB = 2 + 4 * Math.pow(K, 0.13) * Math.exp(-2.5 / K), kFit = 2 / (K * zB) * (1 - Math.exp(-K * zB / 2));
    const etaEnv = 28 / 79 / bg.f * 0.75 * P.eps * kFit;
    return [
      [`\\frac{dN_X}{dz} = -D\\,(N_X - N_X^{\\rm eq}),\\qquad \\frac{dN_{B-L}}{dz} = \\varepsilon\\,D\\,(N_X - N_X^{\\rm eq}) - W\\,N_{B-L}`, 'out-of-equilibrium decays (source) against inverse decays (washout W)'],
      [`\\kappa \\approx \\frac{2}{K z_B}\\Big(1-e^{-K z_B/2}\\Big),\\quad z_B \\approx 2 + 4K^{0.13}e^{-2.5/K}\\;\\Rightarrow\\;\\kappa = ${texN(kFit, 3)}\\quad(K = ${texN(K, 3)})`, `fit <b>${fmt(kFit, 3)}</b> · full Boltzmann solution <b>${fmt(bg.kappa, 3)}</b>`, 1],
      [`\\eta_B = \\frac{a_{\\rm sph}}{f}\\,\\tfrac34\\,\\varepsilon\\,\\kappa = \\frac{28/79}{${texN(bg.f, 3)}}\\times\\tfrac34\\times ${texN(P.eps, 2)}\\times ${texN(kFit, 2)} = ${texN(etaEnv, 3)}`, `envelope <b>${fmt(etaEnv, 3)}</b> · full, with sphaleron timing and ${P.bg_mode === 'lepto' ? 'leptogenesis' : P.bg_mode === 'gut' ? 'B−L = 0' : 'SO(10)'} rules <b>${fmt(bg.eta, 3)}</b> · observed 6.10×10⁻¹⁰`, 1],
    ];
  },
  dm: () => {
    const d = R.dm, g = R.th.g(d.Tf), sv = (P.sv + 6 * P.sv_b / d.xf) / 1.1674e-17, env = 1.07e9 * d.xf / (Math.sqrt(g.gr) * MPL * sv);
    const xfEnv = Math.log(0.038 * P.g_dm / Math.sqrt(g.gr) * MPL * P.m_dm * sv);
    return [
      [`\\frac{dY}{dx} = -\\frac{s\\,\\langle\\sigma v\\rangle}{H\\,x}\\big(Y^2 - Y_{\\rm eq}^2\\big),\\qquad x = \\frac{m_\\chi}{T}`, 'annihilation tries to keep equilibrium; expansion carries the partners apart'],
      [`x_f \\approx \\ln\\!\\Big[0.038\\,\\frac{g_\\chi}{\\sqrt{g_*}}\\,M_{\\rm Pl}\\,m_\\chi\\langle\\sigma v\\rangle\\Big] = ${texN(xfEnv, 3)}`, `numerical freeze-out at x<sub>f</sub> = <b>${fmt(d.xf, 3)}</b> (T<sub>f</sub> = ${fmtT(d.Tf)})`, 1],
      [`\\Omega_\\chi h^2 \\approx \\frac{1.07\\times10^{9}\\,\\mathrm{GeV^{-1}}\\,x_f}{\\sqrt{g_*}\\,M_{\\rm Pl}\\,\\langle\\sigma v\\rangle} = \\frac{1.07\\times10^{9}\\times ${texN(d.xf, 3)}}{\\sqrt{${texN(g.gr, 3)}}\\times 1.22\\times10^{19}\\times ${texN(sv, 3)}} = ${texN(env, 3)}`, `Kolb–Turner estimate <b>${fmt(env, 3)}</b> · full Boltzmann solution <b>${fmt(d.omegah2, 3)}</b> · observed 0.120`, 1],
    ];
  },
  bbn: () => {
    // textbook freeze-out: Γ ∝ G_F² T⁵ ∝ T⁵/τ_n meets H ∝ √(G g*) T²  ⇒  T_f ∝ (G g*)^{1/6} τ_n^{1/3}
    const nb = R.nuc, gst = 5.5 + 1.75 * P.Neff, Tf = 0.75 * Math.pow(P.G_s * gst / 10.83, 1 / 6) * Math.cbrt(P.tau_n / 878.4), Q = 1.29333 * P.Q_s, npf = Math.exp(-Q / Tf);
    const tn = nb.TDmax ? GP.lerp(nb.hist.T, nb.hist.t, nb.TDmax) : 200, np = npf * Math.exp(-tn / nb.tauEff), Ye = 2 * np / (1 + np);
    return [
      [`T_f \\simeq 0.75\\,\\mathrm{MeV}\\Big(\\frac{G\\,g_*}{G_0\\,g_{*,0}}\\Big)^{1/6}\\Big(\\frac{\\tau_n}{878\\,\\mathrm{s}}\\Big)^{1/3} = ${texN(Tf, 3)}\\,\\mathrm{MeV},\\qquad \\frac{n}{p}\\Big|_{\\rm freeze} = e^{-Q/T_f} = e^{-${texN(Q, 4)}/${texN(Tf, 3)}} = ${texN(npf, 3)}`, `where the weak rate G<sub>F</sub>²T⁵ meets the expansion rate √(G g*)·T²`],
      [`\\frac{n}{p}\\Big|_{\\rm BBN} = ${texN(npf, 3)}\\times e^{-t_{\\rm nuc}/\\tau_n} = ${texN(npf, 3)}\\times e^{-${texN(tn, 3)}/${texN(nb.tauEff, 4)}} = ${texN(np, 3)}`, 'free neutrons decay until the deuterium bottleneck opens'],
      [`Y_p \\approx \\frac{2\\,(n/p)}{1+n/p} = ${texN(Ye, 3)}`, `back of the envelope <b>${fmt(Ye, 3)}</b> · full 8-nuclide network <b>${fmt(nb.Yp, 4)}</b> · observed 0.245 ± 0.003`, 1],
    ];
  },
  cmb: () => {
    const rc = R.rec, B = rc.BH_eV;
    const lines = [[`\\frac{x_e^2}{1-x_e} = \\frac{1}{n_b}\\Big(\\frac{m_e k_B T}{2\\pi\\hbar^2}\\Big)^{3/2} e^{-B/k_B T},\\qquad B = 13.6\\,\\mathrm{eV}\\times\\frac{\\alpha^2 m_e}{\\alpha_0^2\\, m_{e,0}} = ${texN(B, 4)}\\ \\mathrm{eV}`, 'Saha: the ionisation balance between atoms and a hot photon bath']];
    if (rc.transparent) { lines.push(['\\tau(z) < 1\\ \\text{everywhere}', 'too few baryons: the universe never becomes opaque — no last-scattering surface']); return lines; }
    const ratio = B / (8.617333e-5 * rc.TstarK);
    lines.push([`\\frac{B}{k_B T_*} = \\frac{${texN(B, 4)}\\,\\mathrm{eV}}{k_B\\times ${texN(rc.TstarK, 4)}\\,\\mathrm{K}} = ${texN(ratio, 3)}\\qquad\\text{while}\\qquad \\ln\\frac{1}{\\eta} = ${texN(Math.log(1 / R.eta), 3)}`, 'recombination waits until even the Wien tail of ~10⁹ photons per baryon cannot re-ionise hydrogen']);
    lines.push([`\\theta_* = \\frac{r_s}{D_M} = \\frac{${texN(rc.rs, 4)}\\,\\mathrm{Mpc}}{${texN(rc.DM, 5)}\\,\\mathrm{Mpc}} = ${texN(rc.theta, 4)}\\;\\Rightarrow\\;\\ell_A = \\frac{\\pi}{\\theta_*} = ${texN(rc.ellA, 4)}`, `Planck measures 100θ<sub>*</sub> = 1.0411 · here <b>${fmt(rc.theta100, 5)}</b>`, 1]);
    lines.push([`r_s = \\int_0^{t_*}\\frac{c_s\\,dt}{a},\\qquad c_s = \\frac{c}{\\sqrt{3(1+\\mathcal{R})}},\\qquad \\mathcal{R}_* = \\frac{3\\rho_b}{4\\rho_\\gamma} = ${texN(0.75 * R.cp.omega_b / R.cp.omega_g / (1 + rc.zstar), 3)}`, 'sound in the photon–baryon fluid sets the ruler imprinted on the CMB']);
    return lines;
  },
  lss: () => [
    [`\\ddot\\delta + 2H\\dot\\delta = 4\\pi G\\bar\\rho_m\\,\\delta\\;\\Rightarrow\\;\\delta \\propto a\\ \\text{(matter era)},\\qquad D(a{=}1) = ${texN(R.st.gr.D0, 3)}`, `dark energy stalls growth: today D is ${fmt(R.st.gr.D0, 3)} of the matter-era extrapolation`],
    [`\\sigma^2(R) = \\int \\Delta^2(k)\\,W^2(kR)\\,d\\ln k\\;\\Rightarrow\\;\\sigma_8 = ${texN(R.st.sigma8, 3)}`, 'Planck: 0.811 ± 0.006', 1],
    [`\\nu = \\frac{\\delta_c}{\\sigma(M,z)},\\quad \\delta_c = \\frac{3}{20}(12\\pi)^{2/3} = 1.686\\;\\Rightarrow\\;M_*(\\nu{=}1) = ${texN(R.st.Mnl, 2)}\\,M_\\odot`, 'spherical collapse: a region collapses when its linear overdensity reaches 1.686'],
  ],
  de: () => {
    const cp = R.cp, q0e = cp.Om / 2 + 0.5 * (1 + 3 * cp.w0) * cp.OL;
    const L = [[`\\rho_{\\rm DE} \\propto a^{-3(1+w)},\\qquad w(a) = w_0 + w_a(1-a) = ${texN(cp.w0, 3)} ${cp.wa < 0 ? '-' : '+'} ${texN(Math.abs(cp.wa), 3)}\\,(1-a)`, cp.w0 < -1 ? 'w < −1: the density GROWS as space expands (phantom)' : 'w = −1 is a cosmological constant: vacuum energy that never dilutes'],
      [`q_0 = \\tfrac12\\Omega_m + \\tfrac12(1+3w_0)\\,\\Omega_{\\rm DE} = \\tfrac12(${texN(cp.Om, 3)}) + \\tfrac12(${texN(1 + 3 * cp.w0, 3)})(${texN(cp.OL, 3)}) = ${texN(q0e, 3)}`, `full (with radiation): <b>${fmt(R.ft.q0, 3)}</b>`, 1]];
    if (cp.OL > 0 && Math.abs(cp.Ok) < 1e-4 && cp.w0 === -1 && cp.wa === 0) {
      const ageE = R.ft.tH * 2 / (3 * Math.sqrt(cp.OL)) * Math.asinh(Math.sqrt(cp.OL / cp.Om));
      L.push([`t_0 = \\frac{2}{3H_0\\sqrt{\\Omega_\\Lambda}}\\,\\sinh^{-1}\\!\\sqrt{\\frac{\\Omega_\\Lambda}{\\Omega_m}} = ${texN(ageE, 4)}\\ \\mathrm{Gyr}`, `analytic matter+Λ <b>${fmt(ageE, 4)} Gyr</b> · full integration from the Planck time <b>${fmt(R.tl.age, 4)} Gyr</b>`, 1]);
    }
    if (cp.w0 < -1) {
      const ripE = R.ft.tH * 2 / (3 * Math.abs(1 + cp.w0) * Math.sqrt(1 - cp.Om));
      L.push([`t_{\\rm rip} - t_0 \\approx \\frac{2}{3\\,|1+w|\\,H_0\\sqrt{1-\\Omega_m}} = ${texN(ripE, 3)}\\ \\mathrm{Gyr}`, `integrated acceleration equation: <b>${R.ft.tEnd ? fmt(R.ft.tEnd - R.tl.age, 3) + ' Gyr' : '—'}</b>`, 1]);
    }
    return L;
  },
  spacetime: m => {
    const E = m.E, kt = Math.abs(E.kterm) > 1e-60 ? `${E.kterm > 0 ? '+' : '-'}\\,${texN(Math.abs(E.kterm), 3)}\\,\\mathrm{s^{-2}}` : '';
    return [
      [`G_{\\mu\\nu} = \\frac{8\\pi G}{c^4}\\,T_{\\mu\\nu}\\;\\xrightarrow{\\;\\rm FLRW\\;}\\; H^2 = \\frac{8\\pi G}{3}\\,\\rho - \\frac{k c^2}{a^2}`, 'the time–time component: energy density sets how fast space stretches'],
      [`H^2 = \\frac{8\\pi\\,(6.674\\times10^{-11})}{3}\\times ${texN(E.rho, 3)}\\,\\mathrm{kg\\,m^{-3}}\\,${kt} = ${texN(E.H2, 3)}\\,\\mathrm{s^{-2}}\\;\\Rightarrow\\; H = ${texN(E.H * MPC / 1e3, 4)}\\ \\mathrm{km\\,s^{-1}\\,Mpc^{-1}}`, `at t = ${fmtTime(m.tS)}`, 1],
      [`\\frac{\\ddot a}{a} = -\\frac{4\\pi G}{3}\\Big(\\rho + \\frac{3p}{c^2}\\Big) = -\\frac{4\\pi G}{3}\\big(${texN(E.rho, 3)} ${E.p < 0 ? '-' : '+'} 3\\times ${texN(Math.abs(E.p), 3)}\\big) = ${texN(E.addot, 3)}\\ \\mathrm{s^{-2}}`, E.addot > 0 ? 'negative pressure wins: gravity is repulsive and the expansion accelerates' : 'ρ + 3p/c² > 0: gravity attracts and the expansion decelerates'],
      [`R = \\frac{8\\pi G}{c^2}\\Big(\\rho - \\frac{3p}{c^2}\\Big) = ${texN(E.Ricci, 3)}\\ \\mathrm{m^{-2}},\\qquad \\ell_{\\rm curv} = K^{-1/4} = ${texN(E.lcurv, 3)}\\ \\mathrm{m} = ${texN(E.lcurv / GP.SI.lP, 3)}\\,\\ell_P`, 'radiation is traceless, so its Ricci scalar vanishes — but the Ricci tensor and K do not'],
      [`1+z = \\frac{a_0}{a} = \\frac{\\lambda_{\\rm obs}}{\\lambda_{\\rm emit}} = \\frac{\\Delta t_{\\rm obs}}{\\Delta t_{\\rm emit}} = \\frac{T}{T_0} = ${texN(1 / m.a, 4)}`, 'one stretching factor for wavelengths, clocks and temperatures'],
    ];
  },
};
function renderHero() {
  const eq = $('.hero-eq'); if (eq && !eq.dataset.done && window.katex) { renderTeX(eq, eq.dataset.tex, true); eq.dataset.done = 1; }
  else if (eq && !window.katex) eq.textContent = 'G_μν + Λ g_μν = (8πG/c⁴) T_μν';
  const live = $('#hero-live'); if (!live || !R) return;
  renderTeX(live, `\\begin{gathered} H^2 = \\frac{8\\pi G}{3}\\rho - \\frac{kc^2}{a^2}\\;\\Rightarrow\\; H_0 = ${texN(R.cp.H0, 4)}\\ \\tfrac{\\mathrm{km}}{\\mathrm{s\\,Mpc}} \\\\ t_0 = ${texN(R.tl.age, 4)}\\ \\mathrm{Gyr},\\qquad \\eta = ${texN(R.eta, 3)} \\end{gathered}`, true);
}

/* ============================================================ GEDANKENEXPERIMENTS
 * Commit to a prediction first; the simulation — not a stored answer — decides who was right. */
const cmpIdx = (v, ref, tol) => v > ref + tol ? 0 : v < ref - tol ? 1 : 2;
const QUIZ = {
  'No CP violation': { ask: 'What happens to the helium fraction Yₚ?', opts: ['it rises', 'it collapses to ~0', 'unchanged'], ans: r => r.nuc.Yp < 0.01 ? 1 : cmpIdx(r.nuc.Yp, BASE.nuc.Yp, 1e-3) === 0 ? 0 : 2, why: r => `Yₚ = ${fmt(r.nuc.Yp, 3)}: with η = ${fmt(r.eta, 2)} there are no nucleons left to fuse.` },
  'Asymmetry made after the electroweak transition': { ask: 'Does the matter excess survive?', opts: ['yes', 'no'], ans: r => r.eta > 1e-12 ? 0 : 1, why: r => `η = ${fmt(r.eta, 2)}: the lepton asymmetry appears at ${fmtT(r.bg.Tgen)}, after sphalerons shut off at 131.7 GeV.` },
  '…now delay the electroweak transition': { ask: 'Same particle, but sphalerons stay active down to 1 GeV. Does matter survive now?', opts: ['yes', 'no'], ans: r => r.eta > 1e-12 ? 0 : 1, why: r => `η = ${fmt(r.eta, 3)}: the asymmetry is made while sphalerons can still convert it.` },
  'Minimal SU(5) GUT baryogenesis': { ask: 'X bosons make a genuine B asymmetry at 10¹⁵ GeV. How much survives?', opts: ['all of it', 'the fraction 28/79', 'none'], ans: r => r.eta < 1e-14 ? 2 : 1, why: r => `η = ${fmt(r.eta, 2)}: B − L = 0, and sphalerons erase B + L.` },
  'Low reheating temperature (10⁶ GeV)': { ask: 'Which fails: the matter excess or the dark matter?', opts: ['matter', 'dark matter', 'both', 'neither'], ans: r => { const a = r.eta < 1e-12, b = r.omega_c < 0.05; return a && b ? 2 : a ? 0 : b ? 1 : 3; }, why: r => `η = ${fmt(r.eta, 2)}, Ω<sub>c</sub>h² = ${fmt(r.omega_c, 3)}.` },
  'Reheating at 1 GeV': { ask: 'Which fails: the matter excess or the dark matter?', opts: ['matter', 'dark matter', 'both', 'neither'], ans: r => { const a = r.eta < 1e-12, b = r.omega_c < 0.05; return a && b ? 2 : a ? 0 : b ? 1 : 3; }, why: r => `η = ${fmt(r.eta, 2)}, Ω<sub>c</sub>h² = ${fmt(r.omega_c, 3)}.` },
  'A fourth neutrino': { ask: 'The helium fraction Yₚ goes…', opts: ['up', 'down', 'unchanged'], ans: r => cmpIdx(r.nuc.Yp, BASE.nuc.Yp, 1e-3), why: r => `Yₚ: ${fmt(BASE.nuc.Yp, 4)} → ${fmt(r.nuc.Yp, 4)}. Faster expansion freezes n/p out earlier, at a higher neutron fraction.` },
  'Dark radiation created after BBN': { ask: 'Which observable shifts?', opts: ['the light elements', 'the CMB acoustic scale θ*', 'both'], ans: r => { const dy = Math.abs(r.nuc.Yp - BASE.nuc.Yp) > 5e-4, dt = Math.abs(r.rec.theta100 - BASE.rec.theta100) > 2e-4; return dy && dt ? 2 : dt ? 1 : 0; }, why: r => `ΔYₚ = ${fmt(r.nuc.Yp - BASE.nuc.Yp, 2)}, 100θ*: ${fmt(BASE.rec.theta100, 5)} → ${fmt(r.rec.theta100, 5)}.` },
  'Short-lived neutron (τ = 100 s)': { ask: 'Helium…', opts: ['more of it', 'less of it'], ans: r => r.nuc.Yp > BASE.nuc.Yp ? 0 : 1, why: r => `Yₚ = ${fmt(r.nuc.Yp, 3)}: equilibrium lasts longer and neutrons decay before fusing.` },
  'Unbound deuteron': { ask: 'What fraction of baryons ends up in helium?', opts: ['still about a quarter', 'almost none', 'all of it'], ans: r => r.nuc.Yp < 0.01 ? 1 : r.nuc.Yp > 0.9 ? 2 : 0, why: r => `Yₚ = ${fmt(r.nuc.Yp, 2)}: no deuteron, no first step on the ladder.` },
  'Smaller n–p mass difference (×0.7)': { ask: 'Helium…', opts: ['more of it', 'less of it'], ans: r => r.nuc.Yp > BASE.nuc.Yp ? 0 : 1, why: r => `Yₚ = ${fmt(r.nuc.Yp, 3)}: e^(−Q/T) grows and neutrons live longer.` },
  'Heavier electron (×1.1)': { ask: 'The CMB is released…', opts: ['earlier (higher z)', 'later (lower z)', 'at the same time'], ans: r => cmpIdx(r.rec.zstar, BASE.rec.zstar, 1), why: r => `z*: ${fmt(BASE.rec.zstar, 5)} → ${fmt(r.rec.zstar, 5)}; binding energy ∝ m<sub>e</sub>.` },
  'Fine-structure constant +2%': { ask: 'The CMB is released…', opts: ['earlier (higher z)', 'later (lower z)', 'at the same time'], ans: r => cmpIdx(r.rec.zstar, BASE.rec.zstar, 1), why: r => `z*: ${fmt(BASE.rec.zstar, 5)} → ${fmt(r.rec.zstar, 5)}; binding energy ∝ α².` },
  'Stronger gravity at BBN (G × 1.2)': { ask: 'The helium fraction Yₚ goes…', opts: ['up', 'down', 'unchanged'], ans: r => cmpIdx(r.nuc.Yp, BASE.nuc.Yp, 1e-3), why: r => `Yₚ = ${fmt(r.nuc.Yp, 4)}: H ∝ √G, same as extra neutrinos.` },
  'No dark matter': { ask: 'The clumpiness of matter today (σ₈)…', opts: ['is higher', 'is lower', 'is unchanged'], ans: r => cmpIdx(r.st.sigma8, BASE.st.sigma8, 0.01), why: r => `σ₈: ${fmt(BASE.st.sigma8, 3)} → ${fmt(r.st.sigma8, 3)}.` },
  'Weaker annihilation (⟨σv⟩ ÷ 10)': { ask: 'The dark-matter density Ωh² becomes…', opts: ['~10× larger', '~10× smaller', 'unchanged'], ans: r => { const x = r.omega_c / BASE.omega_c; return x > 5 ? 0 : x < 0.2 ? 1 : 2; }, why: r => `Ωh²: ${fmt(BASE.omega_c, 3)} → ${fmt(r.omega_c, 3)}. Ω ∝ 1/⟨σv⟩.` },
  'Heavy WIMP, same coupling (3 TeV)': { ask: 'Mass ×30 at fixed ⟨σv⟩. The relic density…', opts: ['~30× larger', 'about the same', '~30× smaller'], ans: r => { const x = r.omega_c / BASE.omega_c; return x > 3 ? 0 : x < 0.33 ? 2 : 1; }, why: r => `Ωh² = ${fmt(r.omega_c, 3)}: fewer particles freeze out, each heavier — the WIMP miracle.` },
  '1 keV warm dark matter': { ask: 'The first galaxies form…', opts: ['earlier', 'later', 'at the same time'], ans: r => { const z = r.st.zFirstGal, b = BASE.st.zFirstGal; return z === null ? 1 : cmpIdx(z, b, 0.2); }, why: r => `first 10⁸ M☉ halos: z ≈ ${fmt(BASE.st.zFirstGal, 3)} → ${r.st.zFirstGal === null ? 'never' : 'z ≈ ' + fmt(r.st.zFirstGal, 3)}.` },
  'Phantom dark energy (w = −1.3)': { ask: 'How does this universe end?', opts: ['eternal expansion', 'Big Rip', 'Big Crunch'], ans: r => ({ expand: 0, rip: 1, crunch: 2 })[r.ft.outcome], why: r => `${fateTxt(r)}${r.ft.tEnd ? ' in ' + fmt(r.ft.tEnd - r.tl.age, 3) + ' Gyr' : ''}.` },
  'Negative cosmological constant': { ask: 'How does this universe end?', opts: ['eternal expansion', 'Big Rip', 'Big Crunch'], ans: r => ({ expand: 0, rip: 1, crunch: 2 })[r.ft.outcome], why: r => `${fateTxt(r)}${r.ft.tEnd ? ' in ' + fmt(r.ft.tEnd - r.tl.age, 3) + ' Gyr' : ''}.` },
  'Λ 300× larger (Weinberg)': { ask: 'Do Milky-Way-mass galaxies ever form?', opts: ['yes', 'no'], ans: r => r.st.galaxiesEver ? 0 : 1, why: r => `maximum growth is only ${fmt(r.st.growthMaxRatio, 3)}× today’s: acceleration freezes structure.` },
  'Watch spacetime tear: the Big Rip sequence': { ask: 'Which is torn apart first?', opts: ['the Milky Way', 'the Solar System', 'both at once'], ans: r => { const a = r.sp.systems[2].tRip, b = r.sp.systems[3].tRip; return a !== null && (b === null || a < b) ? 0 : b !== null && (a === null || b < a) ? 1 : 2; }, why: r => `Milky Way ${fmtTime((r.ft.tEnd - r.sp.systems[2].tRip) * GP.U.Gyr)} before the rip; Solar System ${fmtTime((r.ft.tEnd - r.sp.systems[3].tRip) * GP.U.Gyr)} before.` },
  'A closed universe (positive curvature)': { ask: 'The angles of a cosmic triangle add up to…', opts: ['more than 180°', 'less than 180°', 'exactly 180°'], ans: r => r.cp.Ok < -1e-4 ? 0 : r.cp.Ok > 1e-4 ? 1 : 2, why: r => `Ω<sub>k</sub> = ${fmt(r.cp.Ok, 3)}.` },
  'An open universe (negative curvature)': { ask: 'The angles of a cosmic triangle add up to…', opts: ['more than 180°', 'less than 180°', 'exactly 180°'], ans: r => r.cp.Ok < -1e-4 ? 0 : r.cp.Ok > 1e-4 ? 1 : 2, why: r => `Ω<sub>k</sub> = ${fmt(r.cp.Ok, 3)}.` },
  'No dark energy: gravity always wins': { ask: 'Does this universe have an event horizon?', opts: ['yes', 'no'], ans: r => r.sp.hasEH ? 0 : 1, why: r => r.sp.hasEH ? `event horizon ${fmt(r.sp.eventHorizon, 3)} Gly.` : 'decelerating forever: every event will eventually be seen.' },
  'Chaotic φ² inflation': { ask: 'Is this model allowed by the data?', opts: ['yes', 'no — r is too large', 'no — nₛ is wrong'], ans: r => r.inf.r > 0.036 ? 1 : Math.abs(r.inf.ns - 0.9649) > 0.0084 ? 2 : 0, why: r => `r = ${fmt(r.inf.r, 3)} (limit 0.036), nₛ = ${fmt(r.inf.ns, 4)}.` },
};

/* ============================================================ LAB NOTEBOOK & CONSOLE */
const NB = { entries: [], right: 0, total: 0, hist: [], hi: 0, verdicts: {} };
function nbLoad() { try { const d = JSON.parse(localStorage.getItem('genesis-nb') || 'null'); if (d) Object.assign(NB, d); } catch (e) { /* storage unavailable */ } NB.hi = NB.hist.length; }
function nbSave() { try { localStorage.setItem('genesis-nb', JSON.stringify({ entries: NB.entries.slice(-200), right: NB.right, total: NB.total, hist: NB.hist.slice(-60), verdicts: NB.verdicts })); } catch (e) { /* storage unavailable */ } }
const QUANT = {
  eta: ['baryon-to-photon ratio η', r => r.eta], Yp: ['helium mass fraction', r => r.nuc.Yp], DH: ['D/H', r => r.nuc.DH], He3H: ['³He/H', r => r.nuc.He3H], Li7H: ['⁷Li/H', r => r.nuc.Li7H],
  omega_b: ['Ω_b h²', r => r.omega_b], omega_c: ['Ω_c h²', r => r.omega_c], H0: ['H₀ [km/s/Mpc]', r => r.cp.H0], age: ['age [Gyr]', r => r.tl.age], Ok: ['Ω_k', r => r.cp.Ok],
  zstar: ['last-scattering z*', r => r.rec.zstar], theta: ['100 θ*', r => r.rec.theta100], rs: ['sound horizon r_s [Mpc]', r => r.rec.rs], zeq: ['z_eq', r => r.rec.zeq], tau: ['τ_reion', r => r.rec.tauReion],
  sigma8: ['σ₈', r => r.st.sigma8], S8: ['S₈', r => r.st.S8], zgal: ['first-galaxy z', r => r.st.zFirstGal], nMW: ['Milky-Way halos per Gpc³', r => r.st.nMW * 1e9],
  kappa: ['leptogenesis efficiency κ', r => r.bg.kappa], xf: ['DM freeze-out x_f', r => r.dm.xf], ns: ['n_s', r => r.ns], r: ['tensor ratio r', r => r.inf.r],
  q0: ['deceleration q₀', r => r.ft.q0], zacc: ['acceleration onset z', r => r.ft.zacc], trip: ['time to Big Rip/Crunch [Gyr]', r => r.ft.tEnd ? r.ft.tEnd - r.tl.age : null],
  PH: ['particle horizon [Gly]', r => r.sp.particleHorizon], EH: ['event horizon [Gly]', r => r.sp.eventHorizon], tauN: ['effective neutron lifetime [s]', r => r.nuc.tauEff],
};
const ALIAS = { me: 'me_s', alpha: 'alpha_s', G: 'G_s', Q: 'Q_s', BD: 'BD_s', MX: 'M_X', Trh: 'T_rh', Tsph: 'T_sph', Tqcd: 'T_qcd', mdm: 'm_dm', mwdm: 'm_wdm', ob: 'omega_b', oc: 'omega_c', oL: 'omega_L', tau: 'tau_n', N: 'Ne' };
const resolveKey = k => (k in GP.DEFAULTS ? k : ALIAS[k] && ALIAS[k] in GP.DEFAULTS ? ALIAS[k] : Object.keys(GP.DEFAULTS).find(q => q.toLowerCase() === k.toLowerCase()));
function parseVal(key, txt) {
  const d = GP.DEFAULTS[key];
  if (typeof d === 'boolean') return /^(true|on|1|yes)$/i.test(txt);
  if (typeof d === 'string') return txt;
  if (!/^[\d\s.eE+\-*/()]+$/.test(txt)) return NaN;
  try { return Function('"use strict";return (' + txt + ')')(); } catch (e) { return NaN; }
}
function nbOut(txt, cls) { const o = $('#nb-out'), d = document.createElement('div'); if (cls) d.className = cls; d.innerHTML = txt; o.append(d); o.scrollTop = o.scrollHeight; }
const snapshot = r => ({ eta: r.eta, Yp: r.nuc.Yp, DH: r.nuc.DH, omega_c: r.omega_c, H0: r.cp.H0, age: r.tl.age, zstar: r.rec.zstar, sigma8: r.st.sigma8, fate: fateTxt(r) });
function nbAdd(kind, title, text) { NB.entries.push({ t: new Date().toISOString(), kind, title, text: text || '', changes: diffs(), res: snapshot(R) }); nbSave(); nbRender(); }
function nbRender() {
  $('#nb-score').textContent = NB.total ? `intuition ${NB.right}/${NB.total}` : '';
  $('#nb-log').innerHTML = NB.entries.slice().reverse().map(e => {
    const ch = Object.entries(e.changes || {}).map(([k, v]) => `${k}=${typeof v === 'number' ? fmtIn(v) : JSON.stringify(v)}`).join(', ');
    const r = e.res;
    return `<div class="nb-entry ${e.kind}"><div class="when">${new Date(e.t).toLocaleString()}</div><b>${e.title}</b>${e.text ? ` — ${e.text}` : ''}${ch ? `<div class="res">Δ params: ${ch}</div>` : ''}${r ? `<div class="res">η=${fmt(r.eta, 3)} · Yₚ=${fmt(r.Yp, 4)} · D/H=${fmt(r.DH, 3)} · Ω_c h²=${fmt(r.omega_c, 3)} · H₀=${fmt(r.H0, 4)} · t₀=${fmt(r.age, 4)} Gyr · z*=${fmt(r.zstar, 5)} · σ₈=${fmt(r.sigma8, 3)} · ${r.fate}</div>` : ''}</div>`;
  }).join('') || '<p class="muted" style="font-size:12px">Experiments you run are logged here automatically — scenarios, predictions, console commands, scans and pinned baselines.</p>';
}
const HELP = `<span class="dim">Commands</span>
  <b>key = value</b>        set parameters, e.g. <b>me_s = 1.1</b>  or  <b>w0 = -1.3; wa = 0.2</b>
  <b>? q</b>  /  <b>? all</b>        print a quantity (vs ΛCDM), e.g. <b>? zstar</b>
  <b>scan key a b n q…</b>  parameter scan with a plot, e.g. <b>scan Neff 2 5 8 Yp DH</b>
  <b>params</b>             parameters that differ from ΛCDM
  <b>reset</b> · <b>pin</b> · <b>tab name</b> · <b>note text</b> · <b>clear</b> · <b>keys</b> · <b>quantities</b>
<span class="dim">↑/↓ recall history. Aliases: me, alpha, G, Q, BD, MX, Trh, Tsph, mdm, ob, oc, oL, tau …</span>`;
function printQ(names) {
  if (!names.length || names[0] === 'all') names = Object.keys(QUANT);
  for (const n of names) {
    const q = QUANT[n] || QUANT[Object.keys(QUANT).find(k => k.toLowerCase() === n.toLowerCase())];
    if (!q) { nbOut(`unknown quantity “${n}” — type <b>quantities</b>`, 'err'); continue; }
    const v = q[1](R), b = q[1](BASE);
    nbOut(`${q[0].padEnd(34)} ${String(fmt(v, 5)).padStart(12)}   <span class="dim">ΛCDM ${fmt(b, 5)}${typeof v === 'number' && typeof b === 'number' ? '  ' + delta(v, b, 3) : ''}</span>`);
  }
}
async function doScan(args) {
  const key = resolveKey(args[0] || ''), a = parseFloat(args[1]), b = parseFloat(args[2]), n = Math.min(40, Math.max(2, parseInt(args[3]) || 8)), qs = args.slice(4).length ? args.slice(4) : ['Yp'];
  if (!key || typeof GP.DEFAULTS[key] !== 'number' || !isFinite(a) || !isFinite(b)) { nbOut('usage: scan key from to n quantity… (numeric key)', 'err'); return; }
  const qf = qs.map(q => [q, QUANT[q]]).filter(x => { if (!x[1]) nbOut(`unknown quantity ${x[0]}`, 'err'); return x[1]; });
  if (!qf.length) return;
  const logx = (C[key] && C[key].log && a > 0 && b > 0) || (a > 0 && b / a >= 100);
  const xs = [], ys = qf.map(() => []);
  nbOut(`scanning ${key} from ${fmtIn(a)} to ${fmtIn(b)} (${n} points, ${logx ? 'log' : 'linear'})…`, 'dim');
  for (let i = 0; i < n; i++) {
    const x = logx ? a * Math.pow(b / a, i / (n - 1)) : a + (b - a) * i / (n - 1);
    const Pc = clone(P); Pc[key] = x; let r;
    try { r = GP.run(Pc); } catch (e) { nbOut(`  ${fmtIn(x)}: failed (${e.message})`, 'err'); continue; }
    xs.push(x); qf.forEach(([, q], j) => ys[j].push(q[1](r)));
    nbOut(`  ${key}=${fmtIn(x).padEnd(10)} ` + qf.map(([nm], j) => `${nm}=${fmt(ys[j][ys[j].length - 1], 4)}`).join('   '));
    await new Promise(res => setTimeout(res, 0));
  }
  const box = $('#nb-plot'); box.classList.add('on');
  if (!plots['nb-plot']) plots['nb-plot'] = new Plot(box);
  const cols = ['#ffd66b', '#7cc4ff', '#ff7a8c', '#5ef0a8', '#c792ea'];
  const allPos = ys.every(y => y.every(v => v > 0)), spread = allPos ? Math.max(...ys.flat()) / Math.min(...ys.flat()) : 1;
  plots['nb-plot'].set({ x: { log: logx ? 1 : 0, label: key, short: key }, y: { log: allPos && spread > 30 ? 1 : 0, label: qs.join(', '), short: 'value' },
    series: qf.map(([nm], j) => ({ name: nm, x: xs, y: ys[j], color: cols[j % cols.length], width: 2 })).concat(qf.map(([nm], j) => ({ name: '', x: xs, y: ys[j], color: cols[j % cols.length], points: 1, r: 2.5 }))) });
  nbAdd('run', `Scan ${key} ∈ [${fmtIn(a)}, ${fmtIn(b)}]`, qf.map(([nm], j) => `${nm}: ${fmt(ys[j][0], 3)} → ${fmt(ys[j][ys[j].length - 1], 3)}`).join('; '));
}
function nbRun(line) {
  line = line.trim(); if (!line) return;
  nbOut('› ' + line.replace(/</g, '&lt;'), 'in'); NB.hist.push(line); NB.hi = NB.hist.length; nbSave();
  if (line.startsWith('?')) { printQ(line.slice(1).trim().split(/\s+/).filter(Boolean)); return; }
  const [cmd, ...rest] = line.split(/\s+/);
  switch (cmd.toLowerCase()) {
    case 'help': nbOut(HELP); return;
    case 'clear': $('#nb-out').innerHTML = ''; return;
    case 'reset': P = clone(GP.DEFAULTS); compute(); nbOut('back to standard ΛCDM', 'ok'); nbAdd('run', 'Reset to ΛCDM'); return;
    case 'pin': $('#btn-pin').click(); nbOut(PIN ? 'baseline pinned — Δ values now compare against this universe' : 'baseline released', 'ok'); return;
    case 'tab': { const t = (rest[0] || '').toLowerCase(), ok = $$('#tabs button').map(b => b.dataset.t).find(x => x.startsWith(t)); if (ok) { showTab(ok); nbOut('→ ' + ok, 'ok'); } else nbOut('tabs: ' + $$('#tabs button').map(b => b.dataset.t).join(', '), 'err'); return; }
    case 'note': nbAdd('note', 'Note', rest.join(' ').replace(/</g, '&lt;')); nbOut('noted', 'ok'); return;
    case 'params': { const d = diffs(); nbOut(Object.keys(d).length ? Object.entries(d).map(([k, v]) => `  ${k} = ${JSON.stringify(v)}   <span class="dim">(ΛCDM ${JSON.stringify(GP.DEFAULTS[k])})</span>`).join('\n') : 'standard ΛCDM — nothing changed'); return; }
    case 'keys': nbOut(Object.keys(GP.DEFAULTS).filter(k => typeof GP.DEFAULTS[k] !== 'object').map(k => `${k}=${JSON.stringify(P[k])}`).join('  ')); return;
    case 'quantities': nbOut(Object.entries(QUANT).map(([k, q]) => `  ${k.padEnd(9)} ${q[0]}`).join('\n')); return;
    case 'print': case 'show': printQ(rest); return;
    case 'scan': doScan(rest); return;
  }
  if (line.includes('=')) {
    const set = [];
    for (const part of line.split(/[;,]/)) {
      const m = part.match(/^\s*([\w]+)\s*=\s*(.+?)\s*$/); if (!m) continue;
      const key = resolveKey(m[1]);
      if (!key || typeof GP.DEFAULTS[key] === 'object') { nbOut(`unknown parameter “${m[1]}” — type <b>keys</b>`, 'err'); continue; }
      const v = parseVal(key, m[2]);
      if (typeof v === 'number' && !isFinite(v)) { nbOut(`could not read a number from “${m[2]}”`, 'err'); continue; }
      P[key] = v; set.push(`${key} = ${typeof v === 'number' ? fmtIn(v) : v}`);
    }
    if (set.length) {
      compute();
      nbOut(set.join(', ') + '  →  ' + `η=${fmt(R.eta, 3)}  Yₚ=${fmt(R.nuc.Yp, 4)}  z*=${fmt(R.rec.zstar, 5)}  σ₈=${fmt(R.st.sigma8, 3)}  H₀=${fmt(R.cp.H0, 4)}  ${fateTxt(R)}`, 'ok');
      if (R.notes.length) nbOut(R.notes.slice(0, 3).map(x => '  • ' + x.txt).join('\n'), 'dim');
      nbAdd('run', 'Console: ' + set.join(', '));
    }
    return;
  }
  nbOut(`unknown command “${cmd.replace(/</g, '&lt;')}” — type <b>help</b>`, 'err');
}
function nbToggle(open) {
  const d = $('#nb'), on = open === undefined ? !d.classList.contains('on') : open;
  d.classList.toggle('on', on);
  if (on) { nbRender(); if (!$('#nb-out').children.length) nbOut('GENESIS console — type <b>help</b>. Parameters you set here drive the whole laboratory.', 'dim'); setTimeout(() => $('#nb-cmd').focus(), 60); }
}
function nbExport(kind) {
  const cols = ['eta', 'Yp', 'DH', 'omega_c', 'H0', 'age', 'zstar', 'sigma8', 'fate'];
  const head = ['Experiment', 'Changes', 'η', 'Yₚ', 'D/H', 'Ω_c h²', 'H₀', 't₀ [Gyr]', 'z*', 'σ₈', 'fate'];
  const rows = NB.entries.map(e => [e.title + (e.text ? ' — ' + e.text : ''), Object.entries(e.changes || {}).map(([k, v]) => `${k}=${typeof v === 'object' ? JSON.stringify(v) : v}`).join(', ') || 'ΛCDM', ...cols.map(c => typeof e.res[c] === 'number' ? fmtIn(e.res[c]) : e.res[c])]);
  let txt, name;
  if (kind === 'md') { txt = `# GENESIS lab notebook\n\n| ${head.join(' | ')} |\n|${head.map(() => '---').join('|')}|\n` + rows.map(r => `| ${r.map(x => String(x).replace(/\|/g, '/')).join(' | ')} |`).join('\n') + '\n'; name = 'genesis-notebook.md'; }
  else {
    const esc = s => String(s).replace(/([&%$#_{}])/g, '\\$1').replace(/η/g, '$\\eta$').replace(/σ₈/g, '$\\sigma_8$').replace(/Ω/g, '$\\Omega$').replace(/[ₚ₀₈]/g, '');
    txt = `% GENESIS lab notebook\n\\begin{tabular}{${'l'.repeat(head.length)}}\n\\hline\nExperiment & Changes & $\\eta$ & $Y_p$ & D/H & $\\Omega_c h^2$ & $H_0$ & $t_0$ [Gyr] & $z_*$ & $\\sigma_8$ & fate \\\\\n\\hline\n` + rows.map(r => r.map(esc).join(' & ') + ' \\\\').join('\n') + '\n\\hline\n\\end{tabular}\n'; name = 'genesis-notebook.tex';
  }
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([txt], { type: 'text/plain' })); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

/* ============================================================ units, theme, keyboard */
function setUnits(u) { UNITS = u; try { localStorage.setItem('genesis-units', u); } catch (e) { /* ignore */ } $('#sel-units').value = u; renderReadout(); render(); }
function setChalk(on) { document.body.classList.toggle('chalk', on); $('#btn-chalk').classList.toggle('on', on); try { localStorage.setItem('genesis-chalk', on ? '1' : ''); } catch (e) { /* ignore */ } Object.values(plots).forEach(p => p.draw()); if (tab === 'seq') drawSeq(); }
function keyboard(e) {
  const t = e.target, typing = t && (t.tagName === 'INPUT' || t.tagName === 'SELECT' || t.tagName === 'TEXTAREA');
  if (e.key === 'Escape') { nbToggle(false); if (typing) t.blur(); return; }
  if (typing || e.ctrlKey || e.metaKey || e.altKey) return;
  const tabs = $$('#tabs button').map(b => b.dataset.t);
  if (e.key === '/') { e.preventDefault(); nbToggle(true); }
  else if (e.key === 'n') nbToggle();
  else if (e.key === 'b') setChalk(!document.body.classList.contains('chalk'));
  else if (e.key === 'u') { const o = ['natural', 'SI', 'planck']; setUnits(o[(o.indexOf(UNITS) + 1) % 3]); toast('Units: ' + $('#sel-units').selectedOptions[0].textContent); }
  else if (/^[0-9]$/.test(e.key)) { const i = e.key === '0' ? 9 : +e.key - 1; if (tabs[i]) showTab(tabs[i]); }
}
function initLab() {
  nbLoad();
  try { UNITS = localStorage.getItem('genesis-units') || 'natural'; if (localStorage.getItem('genesis-chalk')) document.body.classList.add('chalk'); } catch (e) { /* ignore */ }
  $('#sel-units').value = UNITS; $('#btn-chalk').classList.toggle('on', document.body.classList.contains('chalk'));
  $('#sel-units').onchange = e => setUnits(e.target.value);
  $('#btn-chalk').onclick = () => setChalk(!document.body.classList.contains('chalk'));
  $('#btn-nb').onclick = () => nbToggle(); $('#hero-nb').onclick = () => nbToggle(true); $('#nb-close').onclick = () => nbToggle(false);
  $$('[data-go]').forEach(b => { if (b.tagName === 'BUTTON') b.onclick = () => showTab(b.dataset.go); });
  $('#nb-md').onclick = () => nbExport('md'); $('#nb-tex').onclick = () => nbExport('tex');
  $('#nb-clear').onclick = () => { if (confirm('Clear the lab notebook log and score?')) { NB.entries = []; NB.right = NB.total = 0; NB.verdicts = {}; nbSave(); nbRender(); buildCards(); } };
  const cmd = $('#nb-cmd');
  cmd.addEventListener('keydown', e => {
    if (e.key === 'Enter') { nbRun(cmd.value); cmd.value = ''; }
    else if (e.key === 'ArrowUp') { if (NB.hi > 0) { NB.hi--; cmd.value = NB.hist[NB.hi] || ''; } e.preventDefault(); }
    else if (e.key === 'ArrowDown') { if (NB.hi < NB.hist.length) { NB.hi++; cmd.value = NB.hist[NB.hi] || ''; } e.preventDefault(); }
  });
  document.addEventListener('keydown', keyboard);
  window.addEventListener('load', () => { renderHero(); render(); });   // KaTeX arrives after first paint
}

/* ============================================================ plumbing */
function diffs() {
  const d = {}, D = GP.DEFAULTS;
  for (const k of Object.keys(P)) { if (JSON.stringify(P[k]) !== JSON.stringify(D[k])) d[k] = P[k]; }
  return d;
}
function saveHash() { const d = diffs(); const h = Object.keys(d).length ? '#u=' + encodeURIComponent(JSON.stringify(d)) : ''; history.replaceState(null, '', location.pathname + location.search + h); }
function loadHash() {
  const m = location.hash.match(/#u=(.*)$/); if (!m) return;
  try { const d = JSON.parse(decodeURIComponent(m[1])); for (const k of Object.keys(d)) if (k in GP.DEFAULTS) P[k] = d[k]; } catch (e) { console.warn('bad link', e); }
}
function exportJSON() {
  const out = {
    generator: 'GENESIS early-universe lab', parameters: P, changedFromLCDM: diffs(),
    results: {
      eta: R.eta, omega_b: R.omega_b, omega_c: R.omega_c, H0: R.cp.H0, Omega_m: R.cp.Om, Omega_L: R.cp.OL, Omega_k: R.cp.Ok, age_Gyr: R.tl.age,
      baryogenesis: { eta: R.bg.eta, kappa: R.bg.kappa, T_generation_GeV: R.bg.Tgen }, darkMatter: { omegah2: R.dm.omegah2, x_f: R.dm.xf, T_f_GeV: R.dm.Tf },
      bbn: { Yp: R.nuc.Yp, D_H: R.nuc.DH, He3_H: R.nuc.He3H, Li7_H: R.nuc.Li7H, tau_n_eff: R.nuc.tauEff },
      cmb: { zstar: R.rec.zstar, theta100: R.rec.theta100, rs_Mpc: R.rec.rs, DM_Mpc: R.rec.DM, tau_reion: R.rec.tauReion, z_eq: R.rec.zeq },
      structure: { sigma8: R.st.sigma8, S8: R.st.S8, z_first_galaxies: R.st.zFirstGal, n_MW_per_Mpc3: R.st.nMW },
      inflation: { ns: R.inf.ns, r: R.inf.r }, fate: { outcome: R.ft.outcome, t_end_Gyr: R.ft.tEnd, q0: R.ft.q0, z_acc: R.ft.zacc },
      epochs: R.epochs.map(e => ({ name: e.name, T_GeV: e.T, t_s: e.t })), notes: R.notes.map(n => n.txt),
    },
  };
  const blob = new Blob([JSON.stringify(out, null, 2)], { type: 'application/json' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'genesis-universe.json'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
function init() {
  initLab();
  BASE = GP.run({});
  loadHash();
  $$('.ctrls').forEach(el => el.dataset.c.split(',').forEach(k => el.append(buildCtl(k.trim()))));
  buildSpeciesTable(); buildCards();
  $$('#tabs button').forEach(b => b.onclick = () => showTab(b.dataset.t));
  $('#btn-reset').onclick = () => { P = clone(GP.DEFAULTS); $('#banner').classList.remove('on'); compute(); toast('Back to standard ΛCDM'); };
  $('#btn-pin').onclick = () => {
    if (PIN) { PIN = null; $('#btn-pin').classList.remove('on'); $('#btn-pin').textContent = 'Pin as baseline'; }
    else { PIN = R; $('#btn-pin').classList.add('on'); $('#btn-pin').textContent = 'Baseline pinned ✕'; toast('Δ values now compare against this universe'); nbAdd('run', 'Pinned as baseline'); }
    renderReadout(); render();
  };
  $('#btn-share').onclick = () => { saveHash(); navigator.clipboard.writeText(location.href).then(() => toast('Link to this universe copied'), () => toast('Copy failed — the URL in the address bar reproduces this universe')); };
  $('#btn-export').onclick = exportJSON;
  $('#banner-x').onclick = () => $('#banner').classList.remove('on');
  $('#btn-play').onclick = play;
  $('#bbn-vs-t').onchange = () => renderBBN();
  $('#web-box').onchange = () => { webBuild(); webDraw(); };
  $('#web-a').oninput = () => webDraw();
  $('#web-play').onclick = webPlay;
  $$('[data-csv]').forEach(b => b.onclick = () => {
    const p = plots[b.dataset.csv]; if (!p) return;
    const blob = new Blob([p.csv()], { type: 'text/csv' }), a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = b.dataset.csv.replace('c-', 'genesis-') + '.csv'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  });
  seqPointer(); fabricPointer();
  $('#st-t').oninput = () => { const [l0, l1] = stRange(); ST.tGyr = Math.pow(10, l0 + $('#st-t').value / 1000 * (l1 - l0)); stRenderMoment(); };
  $('#st-play').onclick = stPlay;
  $('#st-now').onclick = () => { ST.tGyr = R.tl.age; renderSpacetime(); };
  $('#st-clear').onclick = () => { ST.masses = []; stRenderMoment(); };
  $('#st-default').onclick = () => { ST.masses = DEFAULT_MASSES(); stRenderMoment(); };
  ['#st-zg', '#st-light', '#st-curv'].forEach(id => $(id).onchange = () => stRenderMoment());
  $('#st-comoving').onchange = () => renderSpacetime();
  compute();
  window.__GENESIS = { nbRun, nbToggle, setUnits, setChalk, NB, get R() { return R; }, get P() { return P; }, set: (o) => { Object.assign(P, o); compute(); }, reset: () => { P = clone(GP.DEFAULTS); compute(); }, showTab, SCEN, applyScenario, inspect: T => { SEQ.lT = L10(T); drawSeq(); renderInspector(); }, markers: () => SEQ.markers, ST };
  // extension API for lab2.js (extra tabs, panels, tools)
  window.GEN = {
    get R() { return R; }, get P() { return P; }, get BASE() { return BASE; }, get PIN() { return PIN; }, get tab() { return tab; },
    setP: o => { P = o; P.massScale = P.massScale || {}; P.off = P.off || {}; compute(); }, set: o => { Object.assign(P, o); compute(); }, changed, compute,
    EXT, C, BOARDS, SCEN, QUIZ, plots, plot, stat, delta, pull, dotClass, buildCtl, showTab, render, toast, nbAdd, diffs, clone, clamp, fateTxt, OBS,
    fmt, fmtT, fmtK, fmtTime, fmtLen, fmtIn, texN, renderTeX, renderBoard, paintRange, applyScenario, $, $$, COL,
  };
}
init();
})();
