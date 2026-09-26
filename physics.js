/* GENESIS — early-universe physics core.
 * Pure functions, no DOM: loads in the browser (window.GP) and in Node (require).
 * Every number the app shows is computed here from the equations named in each
 * section header; nothing is a canned animation. Units: natural (GeV) unless noted.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.GP = factory();
})(typeof self !== 'undefined' ? self : this, function () {
'use strict';

const PI = Math.PI, ZETA3 = 1.2020569031595942;
const U = {
  hbar: 6.582119569e-25,     // GeV s
  hbarc: 1.973269804e-14,    // GeV cm
  Mpl: 1.220890e19,          // GeV, G = 1/Mpl^2
  kB: 8.617333262e-14,       // GeV / K
  H100: 2.1331196e-42,       // 100 km/s/Mpc in GeV
  H100s: 3.24077929e-18,     // 100 km/s/Mpc in 1/s
  cH100: 2997.92458,         // c / (100 km/s/Mpc) in Mpc
  Gyr: 3.15576e16, yr: 3.15576e7,
  NA: 6.02214076e23,
  rhoMsun: 2.77536627e11,    // critical density / h^2 in Msun / Mpc^3
};
U.rhoch2 = 3 * U.H100 * U.H100 * U.Mpl * U.Mpl / (8 * PI);   // GeV^4
U.rhoch2cgs = U.rhoch2 / Math.pow(U.hbarc, 3);                // GeV / cm^3

/* ------------------------------------------------------------------ defaults */
const DEFAULTS = {
  // late-universe inventory (Planck 2018 TT,TE,EE+lowE+lensing)
  omega_b: 0.02237, omega_c: 0.1200, omega_L: 0.3107, mnu: 0.06,
  T0: 2.7255, Neff: 3.044, closure: 'flat', H0: 67.36,
  w0: -1, wa: 0, As: 2.1e-9, ns: 0.9649, z_re: 7.7,
  // constants of nature (multipliers of measured values)
  alpha_s: 1, me_s: 1, Q_s: 1, BD_s: 1, G_s: 1, tau_n: 878.4,
  // thermal history
  T_rh: 1e13, T_sph: 131.7, T_qcd: 0.155, T_dnu: 2.0e-3,
  dN_inj: 0, T_inj: 1e-5, massScale: {}, off: {},
  // inflation
  inf_model: 'starobinsky', Ne: 57, r_custom: 0.01, ns_custom: 0.965,
  // baryogenesis (thermal leptogenesis, strong washout)
  bg_mode: 'lepto', M_X: 1e10, K: 10, eps: 2.0e-6, bg_init: 'thermal',
  // dark matter (WIMP freeze-out)
  m_dm: 100, sv: 2.125e-26, sv_b: 0, g_dm: 2, m_wdm: 0,
  // alternative dark matter (used when dm_mode ≠ 'wimp'; physics in physics-ext.js)
  dm_mode: 'wimp', fi_m: 1e-4, fi_mB: 1000, fi_lambda: 3.9e-9, ax_fa: 2.29e11, ax_theta: 1, adm_m: 5.05, adm_ratio: 1,
  // nuclear-rate multipliers keyed by reaction index, stellar lithium depletion factor
  bbn_mul: {}, li_depl: 1, nu_masses: [],
  // links: earlier epochs feed later ones
  link_eta: true, link_dm: true, link_yp: true, link_inf: true,
};

const OBS = {
  eta10: [6.104, 0.058], omega_b: [0.02237, 0.00015], omega_c: [0.1200, 0.0012],
  Yp: [0.245, 0.003], DH: [2.547e-5, 0.035e-5], He3H: [1.1e-5, 0.2e-5], Li7H: [1.6e-10, 0.3e-10],
  age: [13.797, 0.023], zstar: [1089.92, 0.25], theta100: [1.04110, 0.00031],
  sigma8: [0.811, 0.006], H0: [67.36, 0.54], ns: [0.9649, 0.0042], Neff: [2.99, 0.17],
  rmax: 0.036,
};

/* ------------------------------------------------------------ special funcs */
function besselI0(x) { const y = (x / 3.75) ** 2; return 1 + y * (3.5156229 + y * (3.0899424 + y * (1.2067492 + y * (0.2659732 + y * (0.0360768 + y * 0.0045813))))); }
function besselI1(x) { const y = (x / 3.75) ** 2; return x * (0.5 + y * (0.87890594 + y * (0.51498869 + y * (0.15084934 + y * (0.02658733 + y * (0.00301532 + y * 0.00032411)))))); }
// exponentially scaled modified Bessel functions: Kn_s(x) = e^x Kn(x)
function K0s(x) {
  if (x <= 2) { const y = x * x / 4; return Math.exp(x) * (-Math.log(x / 2) * besselI0(x) + (-0.57721566 + y * (0.42278420 + y * (0.23069756 + y * (0.03488590 + y * (0.00262698 + y * (0.00010750 + y * 0.0000074))))))); }
  const y = 2 / x; return (1 / Math.sqrt(x)) * (1.25331414 + y * (-0.07832358 + y * (0.02189568 + y * (-0.01062446 + y * (0.00587872 + y * (-0.00251540 + y * 0.00053208))))));
}
function K1s(x) {
  if (x <= 2) { const y = x * x / 4; return Math.exp(x) * (Math.log(x / 2) * besselI1(x) + (1 / x) * (1 + y * (0.15443144 + y * (-0.67278579 + y * (-0.18156897 + y * (-0.01919402 + y * (-0.00110404 + y * (-0.00004686)))))))); }
  const y = 2 / x; return (1 / Math.sqrt(x)) * (1.25331414 + y * (0.23498619 + y * (-0.03655620 + y * (0.01504268 + y * (-0.00780353 + y * (0.00325614 + y * (-0.00068245)))))));
}
function K2s(x) { return K0s(x) + 2 / x * K1s(x); }

function deF(a, w0, wa) { return Math.pow(a, -3 * (1 + w0 + wa)) * Math.exp(-3 * wa * (1 - a)); }
function wOf(a, w0, wa) { return w0 + wa * (1 - a); }
function lerp(xs, ys, x) { // xs monotonic (either direction)
  const n = xs.length, inc = xs[n - 1] > xs[0];
  if (inc ? x <= xs[0] : x >= xs[0]) return ys[0];
  if (inc ? x >= xs[n - 1] : x <= xs[n - 1]) return ys[n - 1];
  let lo = 0, hi = n - 1;
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if ((xs[m] < x) === inc) lo = m; else hi = m; }
  const w = (x - xs[lo]) / (xs[hi] - xs[lo]);
  return ys[lo] + w * (ys[hi] - ys[lo]);
}

/* ------------------------------------------------ relativistic thermodynamics
 * rho = g pi^2/30 T^4 [7/8] R(m/T),  p = rho_rel/3 P(m/T),  s from (rho+p)/T,
 * n = g zeta3/pi^2 T^3 [3/4] N(m/T). Tables are ln-valued on a log10(x) grid. */
const TL0 = -4, TL1 = 2.6, TN = 500, TDL = (TL1 - TL0) / (TN - 1);
const THERM = (function () {
  const out = { B: { R: [], P: [], N: [] }, F: { R: [], P: [], N: [] } };
  const NS = 600, SMAX = Math.sqrt(90), hs = SMAX / NS;
  const I0 = { B: PI ** 4 / 15, F: 7 * PI ** 4 / 120 }, N0 = { B: 2 * ZETA3, F: 1.5 * ZETA3 };
  for (const st of ['B', 'F']) {
    for (let i = 0; i < TN; i++) {
      const x = Math.pow(10, TL0 + i * TDL);
      let sr = 0, sp = 0, sn = 0;
      for (let k = 1; k <= NS; k++) {
        const s = k * hs, t = s * s, u = x + t, w = k === NS ? 1 : (k % 2 ? 4 : 2);
        const pp = Math.sqrt(t * (t + 2 * x));
        const occ = st === 'F' ? 1 / (Math.exp(u) + 1) : 1 / Math.expm1(u);
        const j = 2 * s * w * occ;
        sr += u * u * pp * j; sp += pp * pp * pp * j; sn += u * pp * j;
      }
      const L = v => Math.log(Math.max(v * hs / 3, 1e-300));
      out[st].R.push(L(sr / I0[st])); out[st].P.push(L(sp / I0[st])); out[st].N.push(L(sn / N0[st]));
    }
  }
  return out;
})();
function thermF(tab, x) {
  if (x <= 1e-4) return 1;
  const l = Math.log10(x);
  if (l >= TL1) return 0;
  const f = (l - TL0) / TDL, i = Math.floor(f), w = f - i;
  return Math.exp(tab[i] * (1 - w) + tab[i + 1] * w);
}
const Rx = (x, F) => thermF(F ? THERM.F.R : THERM.B.R, x);
const Px = (x, F) => thermF(F ? THERM.F.P : THERM.B.P, x);
const Sx = (x, F) => (3 * Rx(x, F) + Px(x, F)) / 4;
const Nx = (x, F) => thermF(F ? THERM.F.N : THERM.B.N, x);

/* ---------------------------------------------------- Standard-Model plasma */
const SPECIES = [
  { id: 'gamma', name: 'Photon', sym: 'γ', g: 2, m: 0, F: false, anti: false, col: '#ffd66b' },
  { id: 'gluon', name: 'Gluons', sym: 'g', g: 16, m: 0, F: false, phase: 'q', anti: false, col: '#ff8a5b' },
  { id: 't', name: 'Top quark', sym: 't', g: 12, m: 172.69, F: true, phase: 'q', anti: true, col: '#ff5d73' },
  { id: 'H', name: 'Higgs boson', sym: 'H', g: 1, m: 125.25, F: false, anti: false, col: '#c792ea' },
  { id: 'Z', name: 'Z boson', sym: 'Z', g: 3, m: 91.1876, F: false, anti: false, col: '#82aaff' },
  { id: 'W', name: 'W bosons', sym: 'W±', g: 6, m: 80.377, F: false, anti: true, col: '#7fb4ff' },
  { id: 'b', name: 'Bottom quark', sym: 'b', g: 12, m: 4.18, F: true, phase: 'q', anti: true, col: '#ff7a8c' },
  { id: 'c', name: 'Charm quark', sym: 'c', g: 12, m: 1.27, F: true, phase: 'q', anti: true, col: '#ff9aa6' },
  { id: 'tau', name: 'Tau lepton', sym: 'τ', g: 4, m: 1.77686, F: true, anti: true, col: '#5ee0b0' },
  { id: 's', name: 'Strange quark', sym: 's', g: 12, m: 0.0934, F: true, phase: 'q', anti: true, col: '#ffb3bd' },
  { id: 'mu', name: 'Muon', sym: 'μ', g: 4, m: 0.1056584, F: true, anti: true, col: '#6ee7c8' },
  { id: 'pi', name: 'Pions', sym: 'π', g: 3, m: 0.1380, F: false, phase: 'h', anti: true, col: '#f7a35c' },
  { id: 'd', name: 'Down quark', sym: 'd', g: 12, m: 0.00467, F: true, phase: 'q', anti: true, col: '#ffc8cf' },
  { id: 'u', name: 'Up quark', sym: 'u', g: 12, m: 0.00216, F: true, phase: 'q', anti: true, col: '#ffdde1' },
  { id: 'e', name: 'Electron', sym: 'e', g: 4, m: 0.51099895e-3, F: true, anti: true, col: '#8be9fd' },
];

function makeThermo(P) {
  const sp = SPECIES.filter(s => !(P.off && P.off[s.id])).map(s => {
    let m = s.m * ((P.massScale && P.massScale[s.id]) || 1);
    if (s.id === 'e') m *= P.me_s;
    return Object.assign({}, s, { m });
  });
  // QCD crossover: smooth in ln T so the quark-gluon fraction vanishes as T -> 0 (a tanh in T would floor at ~1e-9)
  const Tc = P.T_qcd, qcdS = T => 0.5 * (1 + Math.tanh(Math.log(T / Tc) / 0.1));
  function plasma(T) {
    const S = qcdS(T);
    let gr = 0, gs = 0, gp = 0;
    for (const s of sp) {
      const w = s.phase === 'q' ? S : s.phase === 'h' ? 1 - S : 1;
      if (w < 1e-12) continue;
      const x = s.m / T, f = s.F ? 0.875 : 1;
      gr += w * s.g * f * Rx(x, s.F); gs += w * s.g * f * Sx(x, s.F); gp += w * s.g * f * Px(x, s.F);
    }
    return [gr, gs, S, gp];
  }
  const gsDec = plasma(P.T_dnu)[1];
  const NT = 1600, L0 = Math.log(1e20), L1 = Math.log(1e-14), dL = (L1 - L0) / (NT - 1);
  const GR = new Float64Array(NT), GS = new Float64Array(NT), RN = new Float64Array(NT), GPp = new Float64Array(NT);
  for (let i = 0; i < NT; i++) {
    const T = Math.exp(L0 + i * dL);
    const [grP, gsP, , gpP] = plasma(T);
    const r = T >= P.T_dnu ? 1 : Math.min(1, Math.cbrt(gsP / gsDec));
    const r3 = r * r * r, r4 = r3 * r;
    GR[i] = grP + 1.75 * P.Neff * r4 + (P.dN_inj > 0 && T < P.T_inj ? 1.75 * P.dN_inj * r4 : 0);
    GS[i] = gsP + 1.75 * P.Neff * r3;
    GPp[i] = gpP + (GR[i] - grP);          // neutrinos and dark radiation are relativistic: p = rho/3
    RN[i] = r;
  }
  function g(T) {
    const f = Math.min(NT - 1.000001, Math.max(0, (Math.log(T) - L0) / dL)), i = Math.floor(f), w = f - i;
    return { gr: GR[i] + w * (GR[i + 1] - GR[i]), gs: GS[i] + w * (GS[i + 1] - GS[i]), r: RN[i] + w * (RN[i + 1] - RN[i]), gp: GPp[i] + w * (GPp[i + 1] - GPp[i]) };
  }
  // radiation-era Hubble rate (GeV) — used by the freeze-out problems
  function Hrad(T) { return Math.sqrt(8 * PI / 3 * PI * PI / 30 * g(T).gr) * T * T / U.Mpl; }
  // relative number densities of each species at temperature T (for the plasma inspector)
  function composition(T) {
    const S = qcdS(T);
    const rows = [];
    for (const s of sp) {
      const w = s.phase === 'q' ? S : s.phase === 'h' ? 1 - S : 1;
      const x = s.m / T;
      rows.push({ id: s.id, name: s.name, sym: s.sym, col: s.col, m: s.m, anti: s.anti,
        n: w * s.g * (s.F ? 0.75 : 1) * Nx(x, s.F) * ZETA3 / (PI * PI) * T ** 3 });
    }
    const r = g(T).r;
    rows.push({ id: 'nu', name: 'Neutrinos', sym: 'ν', col: '#b6f09c', m: 0, anti: true,
      n: 2 * P.Neff * 0.75 * ZETA3 / (PI * PI) * (r * T) ** 3 });
    return rows;
  }
  return { g, Hrad, plasma, composition, species: sp };
}

/* ----------------------------------------------- background (Friedmann) */
function cosmology(P, th, omega_b, omega_c) {
  const T0 = P.T0 * U.kB, g0 = th.g(T0);
  const omega_r = PI * PI / 30 * g0.gr * T0 ** 4 / U.rhoch2;
  const omega_nu = P.mnu / 93.14;
  const omega_m = omega_b + omega_c + omega_nu;
  let h, Ok;
  if (P.closure === 'fixedH') { h = P.H0 / 100; Ok = 1 - (omega_m + omega_r + P.omega_L) / (h * h); }
  else { h = Math.sqrt(Math.max(omega_m + omega_r + P.omega_L, 1e-4)); Ok = 0; }
  // with a negative dark-energy density the flat universe may recollapse before it ever cools to T0
  const invalid = P.closure !== 'fixedH' && omega_m + omega_r + P.omega_L <= 1e-4;
  const h2 = h * h;
  return {
    h, H0: 100 * h, Om: omega_m / h2, Ob: omega_b / h2, Oc: omega_c / h2, Onu: omega_nu / h2, Or: omega_r / h2,
    OL: P.omega_L / h2, Ok, w0: P.w0, wa: P.wa, omega_b, omega_c, omega_m, omega_r, omega_nu, omega_L: P.omega_L,
    T0K: P.T0, T0, gs0: g0.gs, gr0: g0.gr, rhoc0: U.rhoch2 * h2,
    omega_g: 2.4729e-5 * (P.T0 / 2.7255) ** 4, invalid,
  };
}
function E2(cp, a) { return cp.Or / a ** 4 + cp.Om / a ** 3 + cp.Ok / (a * a) + cp.OL * deF(a, cp.w0, cp.wa); }

/* Full thermal timeline T = 1e19 GeV -> T0: a(T) from entropy conservation,
 * H from all components, t = integral d ln a / H. */
function timeline(cp, th) {
  const N = 2600, L1 = Math.log(1.2e19), L0 = Math.log(cp.T0);
  const T = new Float64Array(N), a = new Float64Array(N), t = new Float64Array(N), H = new Float64Array(N),
    gr = new Float64Array(N), gs = new Float64Array(N), fr = new Float64Array(N), fm = new Float64Array(N), fl = new Float64Array(N);
  for (let i = 0; i < N; i++) {
    const Ti = Math.exp(L1 + (L0 - L1) * i / (N - 1)), g = th.g(Ti);
    const ai = Math.cbrt(cp.gs0 / g.gs) * cp.T0 / Ti;
    const rr = PI * PI / 30 * g.gr * Ti ** 4, rm = cp.rhoc0 * cp.Om / ai ** 3, rl = cp.rhoc0 * cp.OL * deF(ai, cp.w0, cp.wa), rk = cp.rhoc0 * cp.Ok / (ai * ai);
    const rho = Math.max(rr + rm + rl + rk, 1e-300);
    T[i] = Ti; a[i] = ai; gr[i] = g.gr; gs[i] = g.gs;
    H[i] = Math.sqrt(8 * PI * rho / 3) / U.Mpl / U.hbar;
    const tot = rr + rm + Math.abs(rl);
    fr[i] = rr / tot; fm[i] = rm / tot; fl[i] = rl / tot;
    if (i === 0) t[i] = 1 / (2 * H[i]);
    else t[i] = t[i - 1] + 0.5 * (1 / H[i] + 1 / H[i - 1]) * Math.log(ai / a[i - 1]);
  }
  const lnT = Array.from(T, Math.log), lnt = Array.from(t, Math.log), lna = Array.from(a, Math.log);
  return {
    T, a, t, H, gr, gs, fr, fm, fl, age: t[N - 1] / U.Gyr,
    tAtT: Tq => Math.exp(lerp(lnT, lnt, Math.log(Tq))),
    aAtT: Tq => Math.exp(lerp(lnT, lna, Math.log(Tq))),
    TAta: aq => Math.exp(lerp(lna, lnT, Math.log(aq))),
    tAta: aq => Math.exp(lerp(lna, lnt, Math.log(aq))),
    TAtt: tq => Math.exp(lerp(lnt, lnT, Math.log(tq))),
  };
}

/* ------------------------------------------------------- baryogenesis
 * Out-of-equilibrium decay of a heavy particle X (Buchmüller–Di Bari–Plümacher):
 *   dN_X/dz   = -D (N_X - N_X^eq),            z = M_X/T
 *   dN_A/dz   = -eps D (N_X - N_X^eq) - W N_A
 * D = K z K1/K2, W = K z^3 K1 / 4, N_X^eq = (3/8) z^2 K2.
 * Sphalerons (active for T > T_sph) convert B-L into B with a_sph = 28/79 and
 * erase any B+L; what survives depends on WHEN the asymmetry is made. */
function baryogenesis(P, th) {
  const M = P.M_X, K = P.K, eps = P.eps, mode = P.bg_mode;
  const z0 = Math.max(1e-2, M / P.T_rh), zEnd = Math.max(120, z0 + 120);
  const thermalStart = P.bg_init === 'thermal' && z0 <= 0.1;
  const Neq = z => 0.375 * z * z * K2s(z) * Math.exp(-z);
  const N = 3000, lz0 = Math.log(z0), dlz = (Math.log(zEnd) - lz0) / N;
  let Nx = thermalStart ? Neq(z0) : 0, A = 0, A2 = 0, Across = null, zCross = null;
  const zsph = M / P.T_sph;
  const hist = { z: [], Nx: [], Neq: [], A: [], A2: [] };
  let srcMax = 0, zGen = z0, zPrev = z0;
  for (let i = 1; i <= N; i++) {
    const z = Math.exp(lz0 + i * dlz), hz = z - zPrev; zPrev = z;
    const k1 = K1s(z), k2 = K2s(z), D = K * z * k1 / k2, W = 0.25 * K * z ** 3 * k1 * Math.exp(-z), ne = Neq(z);
    Nx = (Nx + hz * D * ne) / (1 + hz * D);
    const src = eps * D * (Nx - ne);             // sign chosen so eps > 0 gives matter (eta > 0)
    if (Math.abs(src) > srcMax) { srcMax = Math.abs(src); zGen = z; }
    if (z < zsph) A = (A + hz * src) / (1 + hz * W);
    else {
      if (Across === null) { Across = A; zCross = z; }
      A2 = (A2 + hz * src) / (1 + hz * W);
    }
    if (i % 10 === 0) { hist.z.push(z); hist.Nx.push(Nx); hist.Neq.push(ne); hist.A.push(Across === null ? A : Across); hist.A2.push(A2); }
  }
  if (Across === null) Across = A;          // sphalerons still active at the end: all converted
  const gsM = th.g(Math.min(M, 1e19)).gs;
  const f = 2387 / 86 * gsM / 106.75;       // photon dilution from T~M to recombination
  const asph = 28 / 79;
  let eta;
  if (mode === 'lepto') eta = asph * Across / f;                  // L made after T_sph never becomes B
  else if (mode === 'gut') eta = A2 / f;                           // B-L=0: pre-sphaleron B erased, late B survives
  else eta = (asph * Across + A2) / f;                             // 'so10': B and B-L violating
  const kappa = eps !== 0 ? (Across + A2) / (0.75 * eps) : 0;
  return { eta, kappa, Across, A2, zGen, Tgen: M / zGen, zsph, z0, thermalStart, f, hist };
}

/* ------------------------------------------------------- dark matter freeze-out
 * dY/dx = -(s <sigma v>/(H x)) (Y^2 - Yeq^2),   x = m/T   (Gondolo–Gelmini)
 * Implicit (backward-Euler) step solved exactly as a quadratic in Y. */
function darkMatter(P, th, cp0) {
  const m = P.m_dm, g = P.g_dm;
  const conv = U.hbarc * U.hbarc * 2.99792458e10;           // cm^3/s per GeV^-2
  const sa = P.sv / conv, sb = P.sv_b / conv;
  const x0 = Math.max(1, m / P.T_rh), x1 = Math.max(2000, x0 * 40);
  const Yeq = (x, gs) => 45 / (4 * PI ** 4) * g / gs * x * x * K2s(x) * Math.exp(-x);
  const N = 3000, l0 = Math.log(x0), dl = (Math.log(x1) - l0) / N;
  let Y = x0 <= 1.5 ? Yeq(x0, th.g(m / x0).gs) : 0, xf = null, xPrev = x0;
  const hist = { x: [], Y: [], Yeq: [] };
  for (let i = 1; i <= N; i++) {
    const x = Math.exp(l0 + i * dl), h = x - xPrev; xPrev = x;
    const T = m / x, gg = th.g(T), s = 2 * PI * PI / 45 * gg.gs * T ** 3;
    const lam = s * (sa + 6 * sb / x) / (th.Hrad(T) * x);
    const ye = Yeq(x, gg.gs), c = h * lam;
    Y = c > 1e-12 ? (-1 + Math.sqrt(1 + 4 * c * (Y + c * ye * ye))) / (2 * c) : Y;
    if (xf === null && x > 3 && Y > 2.5 * ye) xf = x;
    if (i % 6 === 0) { hist.x.push(x); hist.Y.push(Y); hist.Yeq.push(ye); }
  }
  const T0 = P.T0 * U.kB, s0 = 2 * PI * PI / 45 * th.g(T0).gs * T0 ** 3 / Math.pow(U.hbarc, 3);
  const omegah2 = m * Y * s0 / U.rhoch2cgs;
  return { omegah2, Yinf: Y, xf: xf || x0, Tf: m / (xf || x0), x0, hist, produced: x0 <= 1.5 };
}

/* --------------------------------------------- Big-Bang nucleosynthesis
 * 8 nuclides, 11 strong reactions (Smith–Kawano–Malaney 1993 fits, reverse
 * rates by detailed balance) + n<->p weak rates integrated exactly in the Born
 * approximation with Fermi–Dirac e± and neutrinos, normalised to tau_n.
 * Photon temperature from e±+gamma entropy conservation; implicit Newton solver. */
const BBN_A = [1, 1, 2, 3, 3, 4, 7, 7];
const BBN_NAMES = ['n', 'p', 'D', 'T', '³He', '⁴He', '⁷Li', '⁷Be'];
const RX = [ // a, b -> c, d (d = -1: photon);  reverse coefficient, Q/T9, D-binding multiplicity
  [0, 1, 2, -1, 4.68e9, 25.815, 1],
  [2, 1, 4, -1, 1.63e10, 63.75, -1],
  [2, 2, 4, 0, 1.73, 37.94, -2],
  [2, 2, 3, 1, 1.73, 46.80, -2],
  [3, 2, 5, 0, 5.54, 204.1, -1],
  [4, 0, 3, 1, 1.001, 8.863, 0],
  [4, 2, 5, 1, 5.55, 212.4, -1],
  [3, 5, 6, -1, 1.12e10, 28.63, 0],
  [4, 5, 7, -1, 1.12e10, 18.42, 0],
  [7, 0, 6, 1, 1.001, 19.07, 0],
  [6, 1, 5, 5, 4.69, 201.3, 0],
];
function bbnRates(T9r, out) {
  const T9 = Math.min(T9r, 10);
  const t13 = Math.cbrt(T9), t23 = t13 * t13, t43 = T9 * t13, t53 = T9 * t23, t12 = Math.sqrt(T9), t32 = T9 * t12;
  const tm13 = 1 / t13, tm23 = 1 / t23, tm32 = 1 / t32, T92 = T9 * T9, T952 = T92 * t12, ex = Math.exp;
  out[0] = 4.742e4 * (1 - 0.8504 * t12 + 0.4895 * T9 - 0.09623 * t32 + 8.471e-3 * T92 - 2.80e-4 * T952);
  out[1] = 2.65e3 * tm23 * ex(-3.720 * tm13) * (1 + 0.112 * t13 + 1.99 * t23 + 1.56 * T9 + 0.162 * t43 + 0.324 * t53);
  out[2] = 3.95e8 * tm23 * ex(-4.259 * tm13) * (1 + 0.098 * t13 + 0.765 * t23 + 0.525 * T9 + 9.61e-3 * t43 + 0.0167 * t53);
  out[3] = 4.17e8 * tm23 * ex(-4.258 * tm13) * (1 + 0.098 * t13 + 0.518 * t23 + 0.355 * T9 - 0.010 * t43 - 0.018 * t53);
  out[4] = 1.063e11 * tm23 * ex(-4.559 * tm13 - (T9 / 0.0754) ** 2) * (1 + 0.092 * t13 - 0.375 * t23 - 0.242 * T9 + 33.82 * t43 + 55.42 * t53) + 8.047e8 * tm23 * ex(-0.4857 / T9);
  out[5] = 7.21e8 * (1 - 0.508 * t12 + 0.228 * T9);
  out[6] = 5.021e10 * tm23 * ex(-7.144 * tm13 - (T9 / 0.270) ** 2) * (1 + 0.058 * t13 + 0.603 * t23 + 0.245 * T9 + 6.97 * t43 + 7.19 * t53) + 5.212e8 / t12 * ex(-1.762 / T9);
  const T9a = T9 / (1 + 0.1378 * T9);
  out[7] = 3.032e5 * tm23 * ex(-8.090 * tm13) * (1 + 0.0516 * t13 + 0.0229 * t23 + 8.28e-3 * T9 - 3.28e-4 * t43 - 3.01e-4 * t53) + 5.109e5 * T9a ** (5 / 6) * tm32 * ex(-8.068 / Math.cbrt(T9a));
  const T9b = T9 / (1 + 0.1071 * T9);
  out[8] = 4.817e6 * tm23 * ex(-14.964 * tm13) * (1 + 0.0325 * t13 - 1.04e-3 * t23 - 2.37e-4 * T9 - 8.11e-5 * t43 - 4.69e-5 * t53) + 5.938e6 * T9b ** (5 / 6) * tm32 * ex(-12.859 / Math.cbrt(T9b));
  const T9c = T9 / (1 + 13.076 * T9);
  out[9] = 2.675e9 * (1 - 0.560 * t12 + 0.179 * T9 - 0.0283 * t32 + 2.214e-3 * T92 - 6.851e-5 * T952) + 9.391e8 * T9c ** 1.5 * tm32 + 4.467e7 * tm32 * ex(-0.07486 / T9);
  const T9d = T9 / (1 + 0.759 * T9);
  out[10] = 1.096e9 * tm23 * ex(-8.472 * tm13) - 4.830e8 * T9d ** (5 / 6) * tm32 * ex(-8.472 / Math.cbrt(T9d)) + 1.06e10 * tm32 * ex(-30.442 / T9);
  for (let i = 0; i < 11; i++) if (!(out[i] > 0)) out[i] = 0;
}
const fermi = x => 1 / (Math.exp(x) + 1);
// n<->p weak rates in units of K (Born approximation); q = Q/me, z = me/T, zn = me/Tnu
function weakRates(q, z, zn) {
  const emax = Math.max(q, 1) + 1 + 45 * Math.max(1 / z, 1 / zn);
  const NS = 400, smax = Math.sqrt(emax - 1), hs = smax / NS;
  let np = 0, pn = 0;
  for (let k = 1; k <= NS; k++) {
    const s = k * hs, e = 1 + s * s, w = (k === NS ? 1 : (k % 2 ? 4 : 2)) * 2 * s * e * s * Math.sqrt(2 + s * s);
    const fe = fermi(e * z), fbe = fermi(-e * z);
    np += w * ((e - q) ** 2 * fbe * fermi((e - q) * zn) + (e + q) ** 2 * fe * fermi(-(e + q) * zn));
    pn += w * ((e + q) ** 2 * fbe * fermi((e + q) * zn) + (e - q) ** 2 * fe * fermi(-(e - q) * zn));
  }
  return [np * hs / 3, pn * hs / 3];
}
function phaseInt(q) { // vacuum neutron-decay phase-space integral
  const N = 4000, h = (q - 1) / N; let s = 0;
  for (let k = 0; k <= N; k++) { const e = 1 + k * h, w = (k === 0 || k === N) ? 1 : (k % 2 ? 4 : 2); s += w * e * Math.sqrt(Math.max(e * e - 1, 0)) * (q - e) ** 2; }
  return s * h / 3;
}
const Q0 = 1.29333236, ME0 = 0.51099895; // MeV
// Born-approximation weak rates under-produce helium; radiative, finite-nucleon-mass,
// finite-temperature and incomplete-nu-decoupling corrections add dY_p = +0.0040 (Pitrou+ 2018).
const YP_CORR = 0.0040; // applied proportionally to the Born-approximation helium
const F0 = phaseInt(Q0 / ME0);

function solveLin(A, b, n) { // in-place Gaussian elimination with partial pivoting
  for (let c = 0; c < n; c++) {
    let p = c, mx = Math.abs(A[c * n + c]);
    for (let r = c + 1; r < n; r++) { const v = Math.abs(A[r * n + c]); if (v > mx) { mx = v; p = r; } }
    if (p !== c) { for (let k = 0; k < n; k++) { const t = A[c * n + k]; A[c * n + k] = A[p * n + k]; A[p * n + k] = t; } const t = b[c]; b[c] = b[p]; b[p] = t; }
    const d = A[c * n + c] || 1e-300;
    for (let r = c + 1; r < n; r++) {
      const f = A[r * n + c] / d; if (f === 0) continue;
      for (let k = c; k < n; k++) A[r * n + k] -= f * A[c * n + k];
      b[r] -= f * b[c];
    }
  }
  for (let r = n - 1; r >= 0; r--) { let s = b[r]; for (let k = r + 1; k < n; k++) s -= A[r * n + k] * b[k]; b[r] = s / (A[r * n + r] || 1e-300); }
  return b;
}

function bbn(o) {
  const me = ME0 * o.me_s, Q = Q0 * o.Q_s, q = Q / me;
  const Kw = o.me_s ** 5 / (o.tau_n * F0);               // G_F^2 m_e^5 prefactor, fixed by measured tau_n
  const tauEff = 1 / (Kw * phaseInt(Math.max(q, 1.0001)) || 1e-300);
  const dQD = 25.815 * (o.BD_s - 1);
  const Ts = 10, sF = T => T ** 3 * (2 + 3.5 * Sx(me / T, true));
  const S0 = sF(Ts);
  const Tofa = (a, guess) => { let T = guess; for (let k = 0; k < 8; k++) T = Math.cbrt(S0 / (a ** 3 * (2 + 3.5 * Sx(me / T, true)))); return T; };
  const Ta3end = S0 / 2;                                   // (T a)^3 after e± annihilation
  const hc3 = Math.pow(1.973269804e-11, 3);                // (MeV cm)^3
  const nb0 = o.eta * 2 * ZETA3 / (PI * PI) * Ta3end / hc3; // baryons per cm^3 at a = 1
  const MplMeV = 1.220890e22, hbarMeV = 6.582119569e-22;
  const Hof = (T, Tnu, a) => {
    let rho = PI * PI / 15 * T ** 4 + PI * PI / 30 * 3.5 * Rx(me / T, true) * T ** 4 + PI * PI / 30 * 1.75 * o.Neff * Tnu ** 4;
    if (o.dNinj > 0 && T < o.TinjMeV) rho += PI * PI / 30 * 1.75 * o.dNinj * Tnu ** 4;
    rho += nb0 / a ** 3 * hc3 * 939;
    return Math.sqrt(8 * PI * o.G_s * rho / 3) / MplMeV / hbarMeV;
  };
  const NSP = 8;
  let Y = new Float64Array(NSP); const Yold = new Float64Array(NSP);
  Y[0] = 1 / (1 + Math.exp(Q / Ts)); Y[1] = 1 - Y[0];
  for (let i = 2; i < NSP; i++) Y[i] = 1e-30;
  const lf = new Float64Array(11), lr = new Float64Array(11), f = new Float64Array(NSP), J = new Float64Array(NSP * NSP), A = new Float64Array(NSP * NSP), b = new Float64Array(NSP);
  const dl = 0.0025, Tend = 0.004;
  let lna = 0, T = Ts, t = 1 / (2 * Hof(Ts, Ts, 1));
  const hist = { T: [], t: [], X: [], Xn_eq: [] };
  let Tfreeze = null, TDmax = null, XDmax = 0, step = 0;
  const derivs = (Yv, nbNA, lnp, lpn) => {
    f.fill(0); J.fill(0);
    f[0] += -lnp * Yv[0] + lpn * Yv[1]; f[1] += lnp * Yv[0] - lpn * Yv[1];
    J[0] -= lnp; J[1] += lpn; J[NSP] += lnp; J[NSP + 1] -= lpn;
    for (let r = 0; r < 11; r++) {
      const [ia, ib, ic, id] = RX[r], kf = nbNA * lf[r];
      let F, pa, pb = 0, R, pc, pd = 0;
      if (ia === ib) { F = 0.5 * kf * Yv[ia] * Yv[ia]; pa = kf * Yv[ia]; } else { F = kf * Yv[ia] * Yv[ib]; pa = kf * Yv[ib]; pb = kf * Yv[ia]; }
      if (id < 0) { R = lr[r] * Yv[ic]; pc = lr[r]; }
      else { const kr = nbNA * lr[r]; if (ic === id) { R = 0.5 * kr * Yv[ic] * Yv[ic]; pc = kr * Yv[ic]; } else { R = kr * Yv[ic] * Yv[id]; pc = kr * Yv[id]; pd = kr * Yv[ic]; } }
      const net = F - R;
      const st = id < 0 ? [[ia, -1], [ib, -1], [ic, 1]] : [[ia, -1], [ib, -1], [ic, 1], [id, 1]];
      for (const [k, cf] of st) {
        f[k] += cf * net;
        const row = k * NSP;
        J[row + ia] += cf * pa; if (ia !== ib) J[row + ib] += cf * pb;
        J[row + ic] -= cf * pc; if (id >= 0 && id !== ic) J[row + id] -= cf * pd;
      }
    }
  };
  while (T > Tend && step < 20000) {
    step++;
    lna += dl; const a = Math.exp(lna);
    T = Tofa(a, T); const Tnu = Ts / a;
    const H = Hof(T, Tnu, a), dt = dl / H; t += dt;
    const nbNA = nb0 / a ** 3 / U.NA, T9 = T / 0.08617333262;
    bbnRates(T9, lf);
    if (o.mul) for (let r = 0; r < 11; r++) lf[r] *= o.mul[r];        // nuclear-rate multipliers (lithium-problem experiments)
    for (let r = 0; r < 11; r++) {
      const Qr = RX[r][5] + RX[r][6] * dQD;
      const ex = Math.exp(Math.max(-700, Math.min(700, -Qr / T9)));
      lr[r] = RX[r][3] < 0 ? RX[r][4] * T9 ** 1.5 * ex * lf[r] : RX[r][4] * ex * lf[r];
    }
    const [wnp, wpn] = weakRates(q, me / T, me / Tnu);
    const lnp = Kw * wnp, lpn = Kw * wpn;
    if (Tfreeze === null && lnp + lpn < H) Tfreeze = T;
    Yold.set(Y);
    for (let it = 0; it < 12; it++) {
      derivs(Y, nbNA, lnp, lpn);
      for (let i = 0; i < NSP; i++) { b[i] = -(Y[i] - Yold[i] - dt * f[i]); for (let j = 0; j < NSP; j++) A[i * NSP + j] = (i === j ? 1 : 0) - dt * J[i * NSP + j]; }
      solveLin(A, b, NSP);
      let err = 0;
      for (let i = 0; i < NSP; i++) { const yn = Math.max(Y[i] + b[i], 1e-40); err = Math.max(err, Math.abs(yn - Y[i]) / (yn + 1e-25)); Y[i] = yn; }
      if (err < 1e-9) break;
    }
    if (Y[2] * 2 > XDmax) { XDmax = Y[2] * 2; TDmax = T; }
    if (step % 5 === 0) {
      hist.T.push(T); hist.t.push(t);
      hist.X.push(Array.from(Y, (y, i) => y * BBN_A[i]));
      hist.Xn_eq.push(1 / (1 + Math.exp(Q / T)));
    }
  }
  const H1 = Y[1] + Y[0];                                  // free neutrons decay to protons
  return {
    Yp: 4 * Y[5] * (1 + YP_CORR / 0.2431), YpBorn: 4 * Y[5], DH: Y[2] / H1, He3H: (Y[4] + Y[3]) / H1, Li7H: (Y[6] + Y[7]) / H1,
    Xn_final: Y[0], Y: Array.from(Y), Tfreeze, TDmax, tauEff, hist, tEnd: t,
  };
}

/* ------------------------------------------------ recombination (CMB)
 * Hydrogen: Peebles three-level atom with the RECFAST fudge (F = 1.14);
 * helium: Saha. Atomic constants scale with alpha and m_e (Hart & Chluba 2018). */
function recombination(cp, o, tl) {
  const kB = 1.380649e-23, hP = 6.62607015e-34, c = 2.99792458e8, eV = 1.602176634e-19;
  const sA = o.alpha_s, sM = o.me_s, sB = sA * sA * sM, me = 9.1093837015e-31 * sM;
  const BH = 13.598434 * sB * eV, E2s = BH / 4, Ea = 0.75 * BH, BHe1 = 24.587387 * sB * eV, BHe2 = 54.417763 * sB * eV;
  const lamA = hP * c / Ea, L2s = 8.2245809 * sA ** 8 * sM, sigT = 6.6524587e-29 * sA * sA / (sM * sM);
  const Yp = Math.min(Math.max(o.Yp, 0), 0.99), fHe = Yp / (3.9715 * (1 - Yp));
  const nH0 = 11.2236 * (1 - Yp) * cp.omega_b, T0 = cp.T0K;
  const Hz = z => cp.h * U.H100s * Math.sqrt(Math.max(E2(cp, 1 / (1 + z)), 1e-30));
  const alphaB = T => { const t = T / (1e4 * sB); return 1.14e-19 * sA * sA / (sM * sM) * 4.309 * Math.pow(t, -0.6166) / (1 + 0.6703 * Math.pow(t, 0.5300)); };
  const phase = T => Math.pow(2 * PI * me * kB * T / (hP * hP), 1.5);
  function saha(z) {
    const T = T0 * (1 + z), nH = nH0 * (1 + z) ** 3, ph = phase(T), kT = kB * T;
    const SH = ph * Math.exp(-BH / kT), S1 = 4 * ph * Math.exp(-BHe1 / kT), S2 = ph * Math.exp(-BHe2 / kT);
    let lo = 0, hi = nH * (1 + 2 * fHe) * 1.0001, xp = 1, y1 = 0, y2 = 0;
    for (let k = 0; k < 90; k++) {
      const ne = 0.5 * (lo + hi);
      xp = SH / (ne + SH); const r1 = S1 / ne, r2 = S2 / ne, y0 = 1 / (1 + r1 + r1 * r2); y1 = r1 * y0; y2 = r1 * r2 * y0;
      if (nH * (xp + fHe * (y1 + 2 * y2)) > ne) lo = ne; else hi = ne;
    }
    return { xp, y1, y2, xe: xp + fHe * (y1 + 2 * y2) };
  }
  const heI = (z, xp) => { // singly ionised helium fraction from Saha given hydrogen ionisation
    const T = T0 * (1 + z), nH = nH0 * (1 + z) ** 3, S1 = 4 * phase(T) * Math.exp(-BHe1 / (kB * T));
    let y1 = 0; for (let k = 0; k < 6; k++) { const ne = nH * (xp + fHe * y1) + 1e-30; const r = S1 / ne; y1 = r / (1 + r); }
    return y1;
  };
  function dxdz(x, z) {
    const T = T0 * (1 + z), kT = kB * T, nH = nH0 * (1 + z) ** 3, H = Hz(z);
    const xe = x + fHe * heI(z, x), aB = alphaB(T), bB = aB * phase(T) * Math.exp(-E2s / kT);
    const Kf = lamA ** 3 / (8 * PI * H), nn = nH * Math.max(1 - x, 0);
    const Cp = (1 + Kf * L2s * nn) / (1 + Kf * (L2s + bB) * nn);
    return Cp * (xe * x * nH * aB - bB * (1 - x) * Math.exp(-Ea / kT)) / (H * (1 + z));
  }
  const zs = [], xe = [], xs = [];
  let z = 9000, x = 1;
  while (z > 0) {
    const S = saha(z);
    if (S.xp < 0.99) break;
    zs.push(z); xe.push(S.xe); xs.push(S.xe); x = S.xp; z -= 5;
  }
  while (z > 0) {
    const dz = z > 400 ? 0.5 : 1, zn = Math.max(z - dz, 0);
    let xn = x;
    for (let it = 0; it < 30; it++) {
      const g = xn - x + dz * dxdz(xn, zn), e = 1e-7 * Math.max(xn, 1e-10);
      const gp = 1 + dz * (dxdz(xn + e, zn) - dxdz(xn - e, zn)) / (2 * e);
      const nx = Math.min(1, Math.max(1e-12, xn - g / gp));
      if (Math.abs(nx - xn) < 1e-12 * Math.max(xn, 1e-6)) { xn = nx; break; }
      xn = nx;
    }
    x = xn; z = zn;
    zs.push(z); xe.push(x + fHe * heI(z, x)); xs.push(saha(z).xe);
  }
  // reionisation (CAMB tanh model) + He II reionisation at z = 3.5
  const yre = (1 + o.z_re) ** 1.5, dy = 0.75 * Math.sqrt(1 + o.z_re);
  const xeR = xe.map((v, i) => {
    const zz = zs[i], y = (1 + zz) ** 1.5;
    const re = (1 + fHe) * 0.5 * (1 + Math.tanh((yre - y) / dy)) + fHe * 0.5 * (1 + Math.tanh((3.5 - zz) / 0.5));
    return Math.max(v, re);
  });
  // optical depth from z = 0 upward, and the visibility function
  const n = zs.length, tau = new Float64Array(n), tauR = new Float64Array(n), vis = new Float64Array(n);
  const dtau = (i, arr) => arr[i] * nH0 * (1 + zs[i]) ** 3 * sigT * c / (Hz(zs[i]) * (1 + zs[i]));
  for (let i = n - 2; i >= 0; i--) {
    const dz = zs[i] - zs[i + 1];
    tau[i] = tau[i + 1] + 0.5 * dz * (dtau(i, xeR) + dtau(i + 1, xeR));
    tauR[i] = tauR[i + 1] + 0.5 * dz * (dtau(i, xe) + dtau(i + 1, xe));
  }
  let zstar = null, vmax = 0, zvis = 0;
  for (let i = 0; i < n; i++) {
    vis[i] = Math.exp(-tau[i]) * dtau(i, xeR);
    if (zs[i] > 200 && vis[i] > vmax) { vmax = vis[i]; zvis = zs[i]; }
    if (zstar === null && i < n - 1 && tauR[i] >= 1 && tauR[i + 1] < 1) zstar = zs[i + 1] + (1 - tauR[i + 1]) / (tauR[i] - tauR[i + 1]) * (zs[i] - zs[i + 1]);
  }
  // too few baryons: optical depth never reaches 1 in the integrated range — photons last scattered earlier (or never)
  const transparent = zstar === null;
  if (transparent) zstar = NaN;
  let half = [null, null];
  for (let i = 0; i < n; i++) if (zs[i] > 200 && vis[i] > vmax / 2) { if (half[0] === null) half[0] = zs[i]; half[1] = zs[i]; }
  const tauReion = tau[n - 1] !== undefined ? lerp(zs, Array.from(tau), 50) : 0;
  // sound horizon and angular scale of the acoustic peaks
  const astar = 1 / (1 + zstar), Rb = 0.75 * cp.omega_b / cp.omega_g;
  const Eof = a => Math.sqrt(Math.max(E2(cp, a), 1e-30));
  let rs = 0; { const M = 4000, h = astar / M; for (let k = 0; k <= M; k++) { const a = Math.max(k * h, 1e-12), w = (k === 0 || k === M) ? 1 : (k % 2 ? 4 : 2); rs += w / (a * a * Eof(a) * Math.sqrt(3 * (1 + Rb * a))); } rs *= h / 3 * U.cH100 / cp.h; }
  let chi = 0; { const M = 4000, l0 = Math.log(astar), h = -l0 / M; for (let k = 0; k <= M; k++) { const a = Math.exp(l0 + k * h), w = (k === 0 || k === M) ? 1 : (k % 2 ? 4 : 2); chi += w / (a * Eof(a)); } chi *= h / 3 * U.cH100 / cp.h; }
  let DM = chi;
  if (Math.abs(cp.Ok) > 1e-8) { const dh = U.cH100 / cp.h, sk = Math.sqrt(Math.abs(cp.Ok)); DM = cp.Ok > 0 ? dh / sk * Math.sinh(sk * chi / dh) : dh / sk * Math.sin(sk * chi / dh); }
  const theta = rs / DM;
  const tstar = tl ? tl.tAta(astar) : null;
  const zeq = cp.omega_m / cp.omega_r - 1;
  const xeRes = lerp(zs, xe, 200);
  return {
    z: zs, xe: xeR, xeRec: xe, xeSaha: xs, vis: Array.from(vis), zstar, zvis, width: half[0] && half[1] ? half[0] - half[1] : null,
    rs, DM, theta, theta100: 100 * theta, ellA: PI / theta, tauReion, tstar, zeq, xeRes, BH_eV: BH / eV,
    TstarK: T0 * (1 + zstar), transparent, nH0, sigT, fHe,
  };
}

/* ------------------------------------------------ structure formation
 * Linear growth D(a) with w0-wa dark energy, Eisenstein & Hu (1998) no-wiggle
 * transfer function, warm-DM cutoff (Viel+ 2005), sigma(R), Sheth–Tormen
 * halo mass function, Moster+ (2013) stellar-to-halo relation. */
function growth(cp, aMax) {
  const Om = cp.Om, OL = cp.OL, Ok = cp.Ok, w0 = cp.w0, wa = cp.wa;
  const e2 = a => Om / a ** 3 + Ok / (a * a) + OL * deF(a, w0, wa);
  const dlnE = a => { const E2v = e2(a); return 0.5 * (-3 * Om / a ** 3 - 2 * Ok / (a * a) - 3 * (1 + wOf(a, w0, wa)) * OL * deF(a, w0, wa)) / E2v; };
  const rhs = (a, D, Dp) => [Dp, -(2 + dlnE(a)) * Dp + 1.5 * Om / a ** 3 / e2(a) * D];
  const la0 = Math.log(1e-3), la1 = Math.log(aMax), h = 0.004;
  const LA = [], DD = [], FF = [];
  let la = la0, D = 1e-3, Dp = 1e-3;
  while (la < la1) {
    const a = Math.exp(la);
    if (!(e2(a) > 0) || !(e2(Math.exp(la + h)) > 0)) break;
    LA.push(la); DD.push(D); FF.push(Dp / D);
    const k1 = rhs(a, D, Dp), a2 = Math.exp(la + h / 2), a3 = Math.exp(la + h);
    const k2 = rhs(a2, D + h / 2 * k1[0], Dp + h / 2 * k1[1]);
    const k3 = rhs(a2, D + h / 2 * k2[0], Dp + h / 2 * k2[1]);
    const k4 = rhs(a3, D + h * k3[0], Dp + h * k3[1]);
    D += h / 6 * (k1[0] + 2 * k2[0] + 2 * k3[0] + k4[0]); Dp += h / 6 * (k1[1] + 2 * k2[1] + 2 * k3[1] + k4[1]);
    la += h;
    if (!isFinite(D)) break;
  }
  const Dat = a => lerp(LA, DD, Math.log(a));
  return { LA, D: DD, f: FF, Dat, D0: Dat(1), Dmax: Math.max(...DD) };
}
function structure(cp, o) {
  const h = cp.h, om = Math.max(cp.omega_b + cp.omega_c, 1e-6), ob = cp.omega_b, fb = Math.min(ob / om, 1), Th = cp.T0K / 2.7;
  const s = 44.5 * Math.log(9.83 / om) / Math.sqrt(1 + 10 * Math.pow(Math.max(ob, 1e-8), 0.75));
  const aG = 1 - 0.328 * Math.log(431 * om) * fb + 0.38 * Math.log(22.3 * om) * fb * fb;
  const OmT = om / (h * h);
  const alW = o.m_wdm > 0 ? 0.049 * Math.pow(o.m_wdm, -1.11) * Math.pow(Math.max(cp.Oc, 1e-4) / 0.25, 0.11) * Math.pow(h / 0.7, 1.22) / h : 0;
  const fnu = cp.omega_nu / Math.max(cp.omega_m, 1e-6), knr = 0.018 * Math.sqrt(cp.Om) * Math.sqrt(Math.max(cp.omega_nu * 93.14 / 3, 1e-6)) * h;
  function Tk(k) {
    const Geff = OmT * h * (aG + (1 - aG) / (1 + Math.pow(0.43 * k * s, 4)));
    const q = k * Th * Th / (Math.max(Geff, 1e-6) * h);
    const L = Math.log(2 * Math.E + 1.8 * q), C = 14.2 + 731 / (1 + 62.5 * q);
    let T = L / (L + C * q * q);
    if (alW > 0) T *= Math.pow(1 + Math.pow(alW * k, 2.24), -5 / 1.12);
    if (fnu > 0) T *= Math.exp(-4 * fnu * k * k / (k * k + knr * knr));   // massive-nu free streaming: P -> P(1 - 8 f_nu) for small f_nu
    return T;
  }
  const gr = growth(cp, 1e3);
  const D0 = gr.D0, cH0 = U.cH100 / h;
  const NK = 900, lk0 = Math.log(1e-5), lk1 = Math.log(2e3), dlk = (lk1 - lk0) / (NK - 1);
  const ks = new Float64Array(NK), D2 = new Float64Array(NK);
  for (let i = 0; i < NK; i++) {
    const k = Math.exp(lk0 + i * dlk); ks[i] = k;
    D2[i] = 4 / 25 * o.As * Math.pow(k / 0.05, o.ns - 1) * Math.pow(k * cH0, 4) * Tk(k) ** 2 * (D0 / cp.Om) ** 2;
  }
  const W = x => x < 1e-3 ? 1 - x * x / 10 : 3 * (Math.sin(x) - x * Math.cos(x)) / (x * x * x);
  const sigR = R => { let s2 = 0; for (let i = 0; i < NK; i++) { const w = W(ks[i] * R); s2 += (i === 0 || i === NK - 1 ? 0.5 : 1) * D2[i] * w * w; } return Math.sqrt(s2 * dlk); };
  const rhom = U.rhoMsun * (cp.omega_b + cp.omega_c);     // Msun / Mpc^3 (clustering matter)
  const RofM = M => Math.cbrt(3 * M / (4 * PI * rhom));
  const sigma8 = sigR(8 / h);
  const lM = [], sig = [];
  for (let lm = 4; lm <= 17.01; lm += 0.1) { lM.push(lm); sig.push(sigR(RofM(10 ** lm))); }
  const sigM = M => Math.exp(lerp(lM, sig.map(Math.log), Math.log10(M)));
  const Dz = z => gr.Dat(1 / (1 + z)) / D0;
  const dc = 1.686;
  function hmf(z) {
    const g = Dz(z), out = { lM: [], dndlnM: [], nGt: [] };
    for (let i = 0; i < lM.length; i++) {
      const sM = sig[i] * g, nu = dc / sM;
      const i0 = Math.max(0, i - 1), i1 = Math.min(lM.length - 1, i + 1);
      const dls = -(Math.log(sig[i1]) - Math.log(sig[i0])) / ((lM[i1] - lM[i0]) * Math.LN10);
      const aa = 0.707, fST = 0.3222 * Math.sqrt(2 * aa / PI) * (1 + Math.pow(aa * nu * nu, -0.3)) * nu * Math.exp(-aa * nu * nu / 2);
      out.lM.push(lM[i]); out.dndlnM.push(rhom / 10 ** lM[i] * fST * dls);
    }
    let cum = 0;
    for (let i = out.lM.length - 1; i >= 0; i--) { cum += out.dndlnM[i] * 0.1 * Math.LN10; out.nGt[i] = cum; }
    return out;
  }
  const hmfs = {}; for (const z of [0, 1, 2, 4, 6, 10]) hmfs[z] = hmf(z);
  // characteristic numbers
  const Mnl = (() => { for (let i = 0; i < lM.length; i++) if (sig[i] < dc) return 10 ** lM[i]; return null; })();
  const zForPeak = (M, nsig) => { const need = dc / (nsig * sigM(M)); if (need > gr.Dmax / D0) return null; if (need >= 1) return 0; return 1 / lerp(gr.D.map(d => d / D0), gr.LA.map(Math.exp), need) - 1; };
  const Vobs = 4 / 3 * PI * Math.pow(14200, 3);          // comoving observable volume, Mpc^3
  const nAt = (hm, M) => lerp(hm.lM, hm.nGt, Math.log10(M));
  let Mbig = null; for (let i = hmfs[0].lM.length - 1; i >= 0; i--) if (hmfs[0].nGt[i] * Vobs >= 1) { Mbig = 10 ** hmfs[0].lM[i]; break; }
  // Moster et al. 2013 stellar-to-halo mass relation, scaled by the cosmic baryon fraction
  const fbScale = fb / 0.157;
  const mstar = (Mh, z) => { const zz = z / (1 + z), M1 = 10 ** (11.59 + 1.195 * zz), N = 0.0351 - 0.0247 * zz, be = 1.376 - 0.826 * zz, ga = 0.608 + 0.329 * zz; return Mh * 2 * N / (Math.pow(Mh / M1, -be) + Math.pow(Mh / M1, ga)) * fbScale; };
  const Pk = (k, a) => { const d2 = Math.exp(lerp(Array.from(ks, Math.log), Array.from(D2, v => Math.log(Math.max(v, 1e-300))), Math.log(k))); const g = gr.Dat(a) / D0; return 2 * PI * PI * d2 / k ** 3 * g * g; };
  // Weinberg test: can a Milky-Way halo ever collapse in this universe?
  const galaxiesEver = sigM(1e12) * gr.Dmax / D0 >= dc;
  return {
    sigma8, S8: sigma8 * Math.sqrt(cp.Om / 0.3), ks: Array.from(ks), D2: Array.from(D2), lM, sig, hmfs, Mnl, Mbig,
    zFirstStars: zForPeak(1e6, 3), zFirstGal: zForPeak(1e8, 3), zMW: zForPeak(1e12, 1),
    nMW: nAt(hmfs[0], 1e12), nCluster: nAt(hmfs[0], 1e14), nMW6: nAt(hmfs[6], 1e11),
    mstar, fb, gr, Dz, Pk, sigM, galaxiesEver, growthMaxRatio: gr.Dmax / D0, alW,
  };
}

/* ------------------------------------------------ dark energy & fate
 * Second-order Friedmann (acceleration) equation integrated into the future so
 * recollapse (Big Crunch) and phantom Big Rip are captured, not assumed. */
function fate(cp, age) {
  const tH = 977.792 / cp.H0;                               // 1/H0 in Gyr
  const acc = a => -0.5 * a * (2 * cp.Or / a ** 4 + cp.Om / a ** 3 + cp.OL * deF(a, cp.w0, cp.wa) * (1 + 3 * wOf(a, cp.w0, cp.wa)));
  let a = 1, v = Math.sqrt(Math.max(E2(cp, 1), 0)), t = 0;
  const ts = [age], as = [1];
  const tMax = 1000 / tH;                                  // look 1000 Gyr ahead
  let outcome = 'expand', tEnd = null, turned = false;
  for (let k = 0; k < 400000 && t < tMax; k++) {
    const dt = Math.min(0.002, 0.002 * a / Math.max(Math.abs(v), 1e-9));
    const f = (aa, vv) => [vv, acc(aa)];
    const k1 = f(a, v), k2 = f(a + dt / 2 * k1[0], v + dt / 2 * k1[1]), k3 = f(a + dt / 2 * k2[0], v + dt / 2 * k2[1]), k4 = f(a + dt * k3[0], v + dt * k3[1]);
    a += dt / 6 * (k1[0] + 2 * k2[0] + 2 * k3[0] + k4[0]); v += dt / 6 * (k1[1] + 2 * k2[1] + 2 * k3[1] + k4[1]); t += dt;
    if (v < 0) turned = true;
    if (k % 20 === 0 || v / a > 20) { ts.push(age + t * tH); as.push(a); }
    // a Big Rip needs H itself to diverge (de Sitter keeps H constant); follow it until the Hubble time is
    // ~1e-12 of today's so that even planetary systems are seen being torn apart
    if (a > 1e10 && v / a > 1e12 * Math.sqrt(Math.max(E2(cp, 1), 1e-9))) { outcome = 'rip'; tEnd = age + t * tH; break; }
    if (a > 1e250) break;
    if (turned && a < 1e-3) { outcome = 'crunch'; tEnd = age + t * tH; break; }
  }
  ts.push(age + t * tH); as.push(a);
  // deceleration parameter today and the start of acceleration
  const q = aa => { const e2 = E2(cp, aa); return 0.5 * (2 * cp.Or / aa ** 4 + cp.Om / aa ** 3 + cp.OL * deF(aa, cp.w0, cp.wa) * (1 + 3 * wOf(aa, cp.w0, cp.wa))) / e2; };
  let zacc = null; for (let z = 0; z < 20; z += 0.002) { if (q(1 / (1 + z)) > 0) { zacc = z; break; } }
  let zML = null; for (let z = 0; z < 50; z += 0.002) { const aa = 1 / (1 + z); if (cp.Om / aa ** 3 > cp.OL * deF(aa, cp.w0, cp.wa)) { zML = z; break; } }
  return { ts, as, outcome, tEnd, q0: q(1), zacc, zML, tH, turned };
}

/* ------------------------------------------------ spacetime & gravity
 * Einstein's equations for the FLRW metric ds² = −c²dt² + a²(t)[dχ² + S_k(χ)² dΩ²]:
 *   H² = (8πG/3)ρ − kc²/a²          (matter/energy -> how fast space stretches)
 *   ä/a = −(4πG/3)(ρ + 3p/c²)      (pressure gravitates: p < −ρc²/3 repels)
 *   R = 8πG(ρ − 3p/c²)/c²,  K = R_abcd R^abcd = 12[(ä/a)² + (8πGρ/3)²]/c⁴
 * Conformal time η = ∫c dt/a gives light cones and horizons; the Newtonian limit
 * inside an expanding background gives the zero-gravity radius of bound systems. */
const SI = { c: 2.99792458e8, G: 6.67430e-11, Gly: 9.4607304725808e24, Mpc: 3.0856775814913673e22, AU: 1.495978707e11,
  Msun: 1.98841e30, lP: 1.616255e-35, tP: 5.391247e-44, kgPerGeV4: 1.78266192e-27 / Math.pow(1.973269804e-16, 3) };
// energy density (kg/m³) and pressure (p/c², kg/m³) of every component at scale factor a, plasma temperature T [GeV]
function components(R, a, T) {
  const { th, cp, P } = R, u = SI.kgPerGeV4, g = th.g(T);
  const Nnu = P.Neff + (P.dN_inj > 0 && T < P.T_inj ? P.dN_inj : 0);
  const rg = PI * PI / 15 * T ** 4 * u, rnu = PI * PI / 30 * 1.75 * Nnu * (g.r * T) ** 4 * u;
  const rall = PI * PI / 30 * g.gr * T ** 4 * u, pall = PI * PI / 90 * g.gp * T ** 4 * u;
  const rhoc = cp.rhoc0 * u, rde = rhoc * cp.OL * deF(a, cp.w0, cp.wa), w = wOf(a, cp.w0, cp.wa);
  return [
    { id: 'gamma', name: 'Photons', rho: rg, p: rg / 3 },
    { id: 'nu', name: 'Neutrinos' + (P.dN_inj > 0 && T < P.T_inj ? ' + dark radiation' : ''), rho: rnu, p: rnu / 3 },
    { id: 'plasma', name: 'Other thermal particles', rho: Math.max(rall - rg - rnu, 0), p: Math.max(pall - rg / 3 - rnu / 3, 0) },
    { id: 'matter', name: 'Cold matter (dark matter + baryons)', rho: rhoc * cp.Om / a ** 3, p: 0 },
    { id: 'de', name: 'Dark energy', rho: rde, p: w * rde },
  ];
}
// Einstein-equation bookkeeping at one moment (a, T)
function einstein(R, a, T) {
  const G = SI.G, c = SI.c, comps = components(R, a, T);
  let rho = 0, p = 0; for (const x of comps) { rho += x.rho; p += x.p; }
  const kterm = -R.cp.Ok * (R.cp.h * U.H100s) ** 2 / (a * a);          // −kc²/a² in s⁻²
  const H2 = 8 * PI * G / 3 * rho + kterm, addot = -4 * PI * G / 3 * (rho + 3 * p);
  const Ricci = 8 * PI * G * (rho - 3 * p) / (c * c);                  // m⁻²
  const Kret = 12 * (addot * addot + (8 * PI * G / 3 * rho) ** 2) / c ** 4; // m⁻⁴
  for (const x of comps) {
    x.w = x.rho > 0 ? x.p / x.rho : 0;
    x.shareH2 = 8 * PI * G / 3 * x.rho / Math.max(H2, 1e-300);
    x.acc = -4 * PI * G / 3 * (x.rho + 3 * x.p);                        // contribution to ä/a [s⁻²]
  }
  return { comps, rho, p, w: p / rho, H2, H: Math.sqrt(Math.max(H2, 0)), addot, kterm, Ricci, Kret, lcurv: Math.pow(Kret, -0.25) };
}
function zeroGravityRadius(M, cp, a) {           // M in kg -> metres (Infinity if dark energy does not repel)
  const rde = cp.rhoc0 * SI.kgPerGeV4 * cp.OL * deF(a, cp.w0, cp.wa), push = -rde * (1 + 3 * wOf(a, cp.w0, cp.wa));
  return push > 0 ? Math.cbrt(3 * M / (4 * PI * push)) : Infinity;
}
const SYSTEMS = [
  { name: 'Coma galaxy cluster', M: 1.5e15, R: 2.9 * SI.Mpc },
  { name: 'Local Group (Milky Way + Andromeda)', M: 2.3e12, R: 1.0 * SI.Mpc },
  { name: 'Milky Way (dark halo)', M: 1.3e12, R: 0.2 * SI.Mpc },
  { name: 'Solar System (to Neptune)', M: 1.0014, R: 30 * SI.AU },
  { name: 'Earth–Moon', M: 3.04e-6, R: 3.844e8 },
];
function spacetime(R) {
  const { tl, ft, cp, rec } = R, c = SI.c, Gyr = U.Gyr;
  // --- past: conformal time along the thermal timeline (radiation era start: η = 2ct/a)
  const past = { t: [], a: [], eta: [], H: [], Ricci: [], lcurv: [], w: [], q: [] };
  let eta = 2 * c * tl.t[0] / tl.a[0];
  for (let i = 0; i < tl.t.length; i++) {
    if (i > 0) eta += 0.5 * (c / tl.a[i] + c / tl.a[i - 1]) * (tl.t[i] - tl.t[i - 1]);
    const E = einstein(R, tl.a[i], tl.T[i]);
    past.t.push(tl.t[i]); past.a.push(tl.a[i]); past.eta.push(eta / SI.Gly); past.H.push(tl.H[i]);
    past.Ricci.push(E.Ricci); past.lcurv.push(E.lcurv); past.w.push(E.w); past.q.push(-E.addot / Math.max(E.H2, 1e-300));
  }
  const eta0 = past.eta[past.eta.length - 1];
  // --- future: conformal time along the integrated fate
  const fut = { t: [], a: [], eta: [], H: [] };
  let ef = eta0 * SI.Gly;
  for (let j = 0; j < ft.ts.length; j++) {
    if (j > 0) { const dt = (ft.ts[j] - ft.ts[j - 1]) * Gyr; ef += 0.5 * (c / ft.as[j] + c / ft.as[j - 1]) * dt; }
    fut.t.push(ft.ts[j] * Gyr); fut.a.push(ft.as[j]); fut.eta.push(ef / SI.Gly);
  }
  for (let j = 0; j < fut.t.length; j++) { const j0 = Math.max(0, j - 1), j1 = Math.min(fut.t.length - 1, j + 1); fut.H.push((Math.log(fut.a[j1]) - Math.log(fut.a[j0])) / (fut.t[j1] - fut.t[j0] || 1)); }
  const etaEnd = fut.eta[fut.eta.length - 1];
  // conformal time converges (an event horizon exists) if the universe ends, or keeps accelerating
  const aE = ft.as[ft.as.length - 1], qEnd = (cp.Om / aE ** 3 + cp.OL * deF(aE, cp.w0, cp.wa) * (1 + 3 * wOf(aE, cp.w0, cp.wa))) / 2;
  const hasEH = ft.outcome !== 'expand' || qEnd < 0;
  // --- horizons today (Gly)
  const hubble0 = c / (cp.h * U.H100s) / SI.Gly;
  const aStar = 1 / (1 + rec.zstar);
  const etaRec = isFinite(aStar) ? Math.exp(lerp(past.a.map(Math.log), past.eta.map(Math.log), Math.log(aStar))) : NaN;
  const thetaH = etaRec / (eta0 - etaRec);                               // angular radius of a causal patch on the CMB sky
  // --- light-cone diagram samples (t ≥ 1 Myr)
  const cone = { t: [], a: [], eta: [], H: [] };
  for (let i = 0; i < past.t.length; i += 3) if (past.t[i] > 1e-3 * Gyr) { cone.t.push(past.t[i]); cone.a.push(past.a[i]); cone.eta.push(past.eta[i]); cone.H.push(past.H[i]); }
  const tStop = (ft.tEnd || (R.tl.age + 60)) * Gyr;
  for (let j = 1; j < fut.t.length; j++) { if (fut.t[j] > tStop) break; if (j % 2) continue; cone.t.push(fut.t[j]); cone.a.push(fut.a[j]); cone.eta.push(fut.eta[j]); cone.H.push(fut.H[j]); }
  // --- which structures stay bound, and when a phantom universe tears them apart
  const systems = SYSTEMS.map(sy => {
    const M = sy.M * SI.Msun, r0 = zeroGravityRadius(M, cp, 1);
    let tRip = null;
    for (let j = 0; j < fut.a.length; j++) if (zeroGravityRadius(M, cp, fut.a[j]) < sy.R) { tRip = fut.t[j] / Gyr; break; }
    return Object.assign({}, sy, { r0, bound: r0 > sy.R, tRip });
  });
  return { past, fut, cone, eta0, etaEnd, hasEH, particleHorizon: eta0, eventHorizon: hasEH ? etaEnd - eta0 : Infinity, hubble0,
    etaRec, thetaH, patches: 4 / (thetaH * thetaH), systems, gw: gwSpectrum(R) };
}
// time -> (a, T) using the past timeline or the integrated future
function stateAtTime(R, tSec) {
  const age = R.tl.age * U.Gyr;
  if (tSec <= age) { const T = R.tl.TAtt(tSec); return { a: R.tl.aAtT(T), T }; }
  const a = lerp(R.ft.ts, R.ft.as, tSec / U.Gyr);
  return { a, T: R.cp.T0 / a };
}
/* Primordial gravitational waves from inflation: tensor power P_t = r A_s (f/f_*)^(n_t),
 * transferred through radiation (flat plateau) and matter (∝ f⁻²) eras (Boyle & Steinhardt 2008),
 * with the g* dilution of modes re-entering the horizon at temperature T(f), and the reheating cutoff. */
function gwSpectrum(R) {
  const { cp, inf, P, th } = R;
  const r = inf.r, nt = -r / 8, fstar = 0.05 * SI.c / (2 * PI * SI.Mpc);
  const keq = Math.sqrt(2 * cp.Om * (1 + R.rec.zeq)) * cp.h / U.cH100;   // Mpc⁻¹
  const feq = keq * SI.c / (2 * PI * SI.Mpc), frh = 2.65e-7 * P.T_rh;
  const g0 = th.g(cp.T0);
  const f = [], O = [];
  for (let l = -19; l <= 5.001; l += 0.05) {
    const fr = Math.pow(10, l), Tf = Math.max(fr / 2.65e-7, cp.T0 * (1 + R.rec.zeq)), gg = th.g(Math.min(Tf, 1e19));
    const dil = (gg.gr / g0.gr) * Math.pow(g0.gs / gg.gs, 4 / 3);
    const val = 3 / 128 * cp.omega_r * r * P.As * Math.pow(fr / fstar, nt) * (0.5 * (feq / fr) ** 2 + 16 / 9) * dil / (1 + (fr / frh) ** 2);
    f.push(fr); O.push(val);
  }
  return { f, O, feq, frh, fstar };
}

/* ------------------------------------------------ inflation (slow roll) */
function inflation(P) {
  const N = P.Ne; let ns, r;
  switch (P.inf_model) {
    case 'quadratic': ns = 1 - 2 / (N + 0.5); r = 8 / (N + 0.5); break;
    case 'quartic': ns = 1 - 3 / (N + 1); r = 16 / (N + 1); break;
    case 'starobinsky': ns = 1 - 2 / N; r = 12 / (N * N); break;
    case 'hilltop': ns = 1 - 3 / N; r = 1e-5; break;              // quartic hilltop, small field
    default: ns = P.ns_custom; r = P.r_custom;
  }
  const MplR = 2.435e18, V = 1.5 * PI * PI * P.As * r * MplR ** 4;
  const V14 = Math.pow(V, 0.25), Hinf = Math.sqrt(V / 3) / MplR, Tmax = Math.pow(30 * V / (PI * PI * 106.75), 0.25);
  return { ns, r, V14, Hinf, Tmax };
}

/* ------------------------------------------------ the full pipeline */
const cache = new Map();
const HOOKS = {};   // physics-ext.js registers optional pieces here (e.g. HOOKS.dmAlt for non-WIMP dark matter)
function memo(key, fn) {
  if (cache.has(key)) return cache.get(key);
  const v = fn(); cache.set(key, v);
  if (cache.size > 60) cache.delete(cache.keys().next().value);
  return v;
}
function etaFromOmegaB(omega_b, T0) { return 273.9e-10 * omega_b * Math.pow(2.7255 / T0, 3); }

function run(Pin) {
  const P = Object.assign({}, DEFAULTS, Pin, { massScale: Object.assign({}, (Pin && Pin.massScale) || {}), off: Object.assign({}, (Pin && Pin.off) || {}) });
  const thKey = JSON.stringify([P.massScale, P.off, P.me_s, P.T_qcd, P.T_dnu, P.Neff, P.dN_inj, P.T_inj]);
  const th = memo('th' + thKey, () => makeThermo(P));
  const inf = inflation(P);
  const ns = P.link_inf ? inf.ns : P.ns;
  const bg = memo('bg' + thKey + JSON.stringify([P.M_X, P.K, P.eps, P.T_rh, P.T_sph, P.bg_mode, P.bg_init]), () => baryogenesis(P, th));
  const dm = memo('dm' + thKey + JSON.stringify([P.m_dm, P.sv, P.sv_b, P.g_dm, P.T_rh, P.T0]), () => darkMatter(P, th));
  const omega_b = P.link_eta ? Math.abs(bg.eta) / etaFromOmegaB(1, P.T0) : P.omega_b;
  const eta = etaFromOmegaB(omega_b, P.T0);
  const dmAlt = HOOKS.dmAlt ? HOOKS.dmAlt(P, th, inf, omega_b) : null;
  const dmOmega = P.dm_mode === 'freezein' && dmAlt ? dmAlt.fi.omegah2 : P.dm_mode === 'axion' && dmAlt ? dmAlt.ax.omegah2 : P.dm_mode === 'adm' && dmAlt ? dmAlt.adm.omegah2 : dm.omegah2;
  const omega_c = P.link_dm ? dmOmega : P.omega_c;
  const mul = Array.from({ length: 11 }, (_, r) => (P.bbn_mul && P.bbn_mul[r]) || 1);
  const bo = { eta, Neff: P.Neff, dNinj: P.dN_inj, TinjMeV: P.T_inj * 1e3, tau_n: P.tau_n, Q_s: P.Q_s, me_s: P.me_s, G_s: P.G_s, BD_s: P.BD_s, mul };
  const nuc = memo('bbn' + JSON.stringify(bo), () => bbn(bo));
  const Yp = P.link_yp ? nuc.Yp : 0.245;
  const cp = cosmology(P, th, omega_b, omega_c);
  const tl = timeline(cp, th);
  const rec = recombination(cp, { Yp, alpha_s: P.alpha_s, me_s: P.me_s, z_re: P.z_re }, tl);
  const st = structure(cp, { As: P.As, ns, m_wdm: P.m_wdm });
  const ft = fate(cp, tl.age);
  const R = { P, th, inf, ns, bg, dm, dmAlt, eta, omega_b, omega_c, nuc, Yp, cp, tl, rec, st, ft };
  R.sp = spacetime(R);
  R.epochs = epochs(R);
  R.notes = diagnose(R);
  return R;
}

/* The cosmic calendar, computed from the current parameters */
function epochs(R) {
  const { P, tl, bg, dm, nuc, rec, st, ft, cp } = R;
  const T0 = cp.T0, Tz = z => tl.TAta(1 / (1 + z));
  const E = [];
  const add = (id, name, T, desc, kind) => { if (T && isFinite(T) && T > 0) E.push({ id, name, T, t: T >= 1.2e19 ? 5.39e-44 : tl.tAtT(T), desc, kind: kind || 'event' }); };
  add('planck', 'Planck epoch', 1.2e19, 'Quantum gravity scale — the model starts here.', 'fixed');
  add('reheat', 'Reheating', P.T_rh, 'Inflaton decays; the hot Big Bang plasma is born at T_rh.', 'drag');
  add('bgen', 'Baryogenesis', bg.Tgen, 'Heavy X decays out of equilibrium, violating CP: the matter excess is made.', 'drag');
  add('ew', 'Sphaleron freeze-out (EW)', P.T_sph, 'Electroweak symmetry breaks; B+L-violating sphalerons switch off.', 'drag');
  add('dmfo', 'Dark-matter freeze-out', dm.Tf, 'WIMP annihilation can no longer keep up with expansion.', 'drag');
  add('qcd', 'Quark confinement (QCD)', P.T_qcd, 'Quarks and gluons bind into hadrons.', 'drag');
  add('nudec', 'Neutrino decoupling', P.T_dnu, 'Weak interactions too slow: the neutrino background decouples.', 'fixed');
  add('npfo', 'n/p freeze-out', nuc.Tfreeze ? nuc.Tfreeze * 1e-3 : null, 'Weak n↔p conversion stops; neutron fraction frozen (then decays).', 'fixed');
  add('ee', 'e⁺e⁻ annihilation', 0.511e-3 * P.me_s / 3, 'Electrons and positrons annihilate, heating photons relative to neutrinos.', 'fixed');
  add('bbn', 'Nucleosynthesis', nuc.TDmax ? nuc.TDmax * 1e-3 : null, 'Deuterium bottleneck breaks; nearly all neutrons end up in ⁴He.', 'fixed');
  if (P.dN_inj > 0) add('inj', 'Dark radiation appears', P.T_inj, 'A new relativistic species is injected (ΔN_eff).', 'drag');
  add('eq', 'Matter–radiation equality', rec.zeq > 0 ? Tz(rec.zeq) : null, 'Matter density overtakes radiation; dark-matter clumps start growing.', 'fixed');
  add('rec', 'Recombination / CMB', Tz(rec.zstar), 'Atoms form, the universe turns transparent: the CMB is released.', 'fixed');
  if (st.zFirstStars) add('stars', 'First stars', Tz(st.zFirstStars), '3σ peaks of 10⁶ M☉ minihalos collapse.', 'fixed');
  if (st.zFirstGal) add('gal', 'First galaxies', Tz(st.zFirstGal), '3σ peaks of 10⁸ M☉ halos collapse.', 'fixed');
  add('reion', 'Reionisation', Tz(P.z_re), 'Starlight re-ionises intergalactic hydrogen.', 'fixed');
  if (ft.zML !== null) add('lam', 'Dark-energy domination', Tz(ft.zML), 'Dark energy density overtakes matter.', 'fixed');
  if (ft.zacc !== null && ft.zacc > 0) add('acc', 'Acceleration begins', Tz(ft.zacc), 'Expansion starts to speed up (q = 0).', 'fixed');
  add('now', 'Today', T0, 'T = ' + cp.T0K.toFixed(4) + ' K.', 'fixed');
  return E;
}

/* Physics diagnostics — plain-language consequences of the current choices */
function diagnose(R) {
  const { P, bg, dm, nuc, rec, st, ft, cp, inf, eta } = R, out = [];
  const say = (lvl, txt) => out.push({ lvl, txt });
  if (cp.invalid) say('bad', 'With this much negative dark energy the universe recollapses before it ever cools to today’s CMB temperature — "today" never happens. (Numbers below use a floor H0.)');
  if (P.T_rh > inf.Tmax * 1.0001) say('warn', `Reheating temperature ${fmtE(P.T_rh)} GeV exceeds the maximum the inflaton energy allows (${fmtE(inf.Tmax)} GeV).`);
  if (P.T_rh < 4e-3) say('bad', 'Reheating below ~4 MeV: neutrinos never thermalise — BBN and the CMB would be badly wrong (excluded).');
  if (!bg.thermalStart && P.M_X > P.T_rh) say('info', `T_rh < M_X: the heavy X particles are only produced by inverse decays (Boltzmann-suppressed by ~e^(−M/T_rh)).`);
  if (P.eps === 0) say('bad', 'No CP violation: particles and antiparticles are made equally — Sakharov condition 2 fails.');
  if (P.bg_mode === 'lepto' && bg.Tgen < P.T_sph) say('bad', `The lepton asymmetry is made at T≈${fmtE(bg.Tgen)} GeV, after sphalerons froze out at ${fmtE(P.T_sph)} GeV — it can never be converted into baryons.`);
  if (P.bg_mode === 'gut' && bg.Tgen > P.T_sph) say('warn', 'B−L-conserving (SU(5)-type) baryogenesis above the electroweak scale: sphalerons erase B+L, leaving nothing.');
  if (Math.abs(eta) < 1e-14) say('bad', `η ≈ ${fmtE(Math.abs(eta))}: essentially all matter annihilated with antimatter. Symmetric freeze-out would leave only n_b/n_γ ~ 10⁻¹⁹ — no stars, no planets.`);
  else if (eta < 0) say('info', 'Negative η: the universe is made of antimatter — physically indistinguishable, we just rename it.');
  if (!dm.produced) say('info', `T_rh below the dark-matter mass scale: DM is produced only by the thermal tail (freeze-in-like). Ωh² = ${dm.omegah2.toPrecision(3)}.`);
  if (R.omega_c > 0.2) say('warn', `Ω_c h² = ${R.omega_c.toPrecision(3)} — ${(R.omega_c / 0.12).toFixed(1)}× the observed amount.`);
  if (R.omega_c < 0.03) say('warn', `Very little dark matter (Ω_c h² = ${R.omega_c.toPrecision(2)}): baryon perturbations stay frozen until recombination, structure is delayed.`);
  if (Math.abs(nuc.Yp - 0.245) > 0.01) say('warn', `Helium mass fraction Y_p = ${nuc.Yp.toFixed(3)} (observed 0.245 ± 0.003).`);
  if (nuc.DH < 1e-7 && eta > 1e-12) say('info', 'Deuterium almost completely burnt.');
  if (P.BD_s <= 0) say('bad', 'Deuteron unbound: no path to heavier nuclei — the universe stays pure hydrogen.');
  if (st.sigma8 < 0.3) say('warn', `σ₈ = ${st.sigma8.toFixed(2)}: structure far below observed; galaxies are rare or absent today.`);
  if (!st.galaxiesEver) say('bad', 'Weinberg bound: Milky-Way-mass halos never collapse — dark energy or low amplitude wins before gravity can.');
  if (ft.outcome === 'rip') say('info', `Phantom dark energy: Big Rip ${(ft.tEnd - R.tl.age).toFixed(1)} Gyr from now.`);
  if (ft.outcome === 'crunch') say('info', `The universe recollapses: Big Crunch ${(ft.tEnd - R.tl.age).toFixed(1)} Gyr from now.`);
  if (P.m_wdm > 0 && P.m_wdm < 3) say('warn', `Warm dark matter (${P.m_wdm} keV) erases small halos — conflicts with Lyman-α forest (m ≳ 3–5 keV).`);
  if (inf.r > OBS.rmax) say('warn', `Tensor-to-scalar ratio r = ${inf.r.toFixed(3)} exceeds BICEP/Keck bound r < 0.036.`);
  if (rec.transparent) say('bad', 'Too few baryons to make the universe opaque: no last-scattering surface below z = 9000 — the CMB as we know it (with acoustic peaks) would not exist.');
  if (Math.abs(rec.zstar - 1090) > 30) say('info', `Last scattering moved to z* = ${rec.zstar.toFixed(0)} (standard ≈ 1090).`);
  if (P.dN_inj > 0 && P.T_inj * 1e3 < 0.01) say('info', 'Dark radiation appears after BBN: light elements are untouched but the CMB sees extra N_eff.');
  return out;
}
function fmtE(v) { if (v === 0) return '0'; const e = Math.floor(Math.log10(Math.abs(v))); const m = v / 10 ** e; return (Math.abs(e) <= 2 ? v.toPrecision(3) : m.toFixed(2) + 'e' + e); }

return {
  U, DEFAULTS, OBS, SPECIES, BBN_NAMES, BBN_A, THERM: { Rx, Px, Sx, Nx }, K1s, K2s,
  SI, SYSTEMS, components, einstein, zeroGravityRadius, spacetime, stateAtTime, gwSpectrum,
  makeThermo, cosmology, timeline, baryogenesis, darkMatter, bbn, recombination, growth, structure, fate, inflation,
  run, epochs, diagnose, etaFromOmegaB, E2, deF, lerp, HOOKS,
};
});
