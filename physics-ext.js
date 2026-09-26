/* GENESIS — extended physics: CMB power spectrum, neutrinos, inflaton dynamics, phase-transition
 * gravitational waves, topological defects, primordial black holes, non-WIMP dark matter, and the
 * data likelihood + optimiser used for fitting. Pure functions on top of physics.js (GP). */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./physics.js'));
  else root.GX = factory(root.GP);
})(typeof self !== 'undefined' ? self : this, function (GP) {
'use strict';
const PI = Math.PI, U = GP.U, lerp = GP.lerp, E2 = GP.E2;
const clampNum = (v, a, b) => Math.min(b, Math.max(a, v));
const MPC_M = 3.0856775814913673e22, MRED = 2.435e18, MPL = 1.220890e19, HBAR = 6.582119569e-25;
const erfc = x => { // Numerical Recipes erfc, |error| < 1.2e-7
  const z = Math.abs(x), t = 1 / (1 + 0.5 * z);
  const r = t * Math.exp(-z * z - 1.26551223 + t * (1.00002368 + t * (0.37409196 + t * (0.09678418 + t * (-0.18628806 + t * (0.27886807 + t * (-1.13520398 + t * (1.48851587 + t * (-0.82215223 + t * 0.17087277)))))))));
  return x >= 0 ? r : 2 - r;
};

/* ============================================================ CMB temperature power spectrum
 * Semi-analytic (Hu & Sugiyama-type) acoustic source at last scattering:
 *   Θ0+Ψ = (1/5)[A(k)(1+3R)(1+R)^(-1/4) cos(k r_s + φ) − 3R T_Ψ(k)] e^(−k²/k_D²)
 *   Θ1   = (1/5) A(k)(1+3R)(1+R)^(-3/4)/√3 · sin(k r_s + φ) e^(−k²/k_D²)
 * (radiation driving A(k), baryon loading R, Silk damping k_D integrated through recombination),
 * projected with Bessel functions averaged over their fast oscillation:
 *   C_ℓ = 4π ∫ dk/k Δ²_ζ [S0² j_ℓ²(kD) + S1² j_ℓ'²(kD)],  j_ℓ² → 1/(2x√(x²−ν²)), j_ℓ'² → √(x²−ν²)/(2x³).
 * Calibrated once (A_d, φ) so standard ΛCDM lands on the Planck peak positions and heights; all
 * parameter dependences are physical. Temperature only; no lensing, no ISW. */
// fitted once to the Planck 2018 ΛCDM TT peaks/troughs (positions ≲2%, heights 2–14%); see test/validate.js
const CMB_CAL = { Ad: 1.3064, phase: 0.3891, psi: 0.4383, sigr: 0.058, kd: 1.0486, lf: 0.4455, lw: 0.118 };
function silkScale(R) {
  const { cp, rec } = R, cMpc = U.cH100 / cp.h;
  const Hc = z => Math.sqrt(Math.max(E2(cp, 1 / (1 + z)), 1e-30)) / cMpc;
  const Rb = z => 0.75 * cp.omega_b / cp.omega_g / (1 + z);
  const xe = z => z >= rec.z[0] ? 1 + 2 * rec.fHe : lerp(rec.z, rec.xeRec, z);
  const N = 700, l0 = Math.log(1 + rec.zstar), l1 = Math.log(1e6), dl = (l1 - l0) / N;
  let kd2 = 0;
  for (let i = 0; i <= N; i++) {
    const z = Math.exp(l0 + i * dl) - 1, w = (i === 0 || i === N) ? 0.5 : 1, R_ = Rb(z);
    const lam = 1 / (Math.max(xe(z), 1e-6) * rec.nH0 * (1 + z) ** 2 * rec.sigT) / MPC_M;   // comoving photon mean free path [Mpc]
    kd2 += w * (1 + z) * dl / Hc(z) * lam / (6 * (1 + R_)) * (R_ * R_ / (1 + R_) + 16 / 15);
  }
  return 1 / Math.sqrt(kd2);
}
function cmbSpectrum(R, cal) {
  const { cp, rec, P } = R;
  cal = Object.assign({}, CMB_CAL, cal || {});
  if (!rec || rec.transparent || !isFinite(rec.zstar) || !(cp.omega_b > 0)) return null;
  const cMpc = U.cH100 / cp.h, D = rec.DM, rs = rec.rs, zs = rec.zstar;
  const Rs = 0.75 * cp.omega_b / cp.omega_g / (1 + zs);
  const keq = Math.sqrt(2 * cp.Om * (1 + rec.zeq)) / cMpc;
  const kD = silkScale(R);
  const Hs = Math.sqrt(E2(cp, 1 / (1 + zs))) / cMpc;
  const sigr = rec.width ? cal.sigr * rec.width / 2.355 / Hs : 0;
  const tau = rec.tauReion, As = P.As, ns = R.ns, T2 = (cp.T0K * 1e6) ** 2;
  const src = k => {
    const x = k / keq, drv = x * x / (1 + x * x), A = 1 + (cal.Ad - 1) * drv;   // matter-era amplitude → radiation-driven amplitude
    const arg = k * rs + cal.phase * drv;
    const damp = Math.exp(-((k / (cal.kd * kD)) ** 2) - 0.5 * (k * sigr) ** 2);
    const Tpsi = 1 / (1 + cal.psi * x * x);
    const wkb = 1 + (Math.pow(1 + Rs, -0.25) - 1) * drv;      // WKB amplitude only for modes already oscillating (keeps Sachs–Wolfe exact)
    const s0 = 0.2 * (A * (1 + 3 * Rs) * wkb * Math.cos(arg) * damp - 3 * Rs * Tpsi);
    const s1 = 0.2 * A * (1 + 3 * Rs) * wkb / Math.sqrt(3 * (1 + Rs)) * Math.sin(arg) * damp;
    return [s0, s1];
  };
  const ells = [], Dl = [];
  for (let l = 2; l < 40; l++) ells.push(l);
  for (let l = 40; l <= 2600; l += 8) ells.push(l);
  const NU = 220, Umax = 7, du = Umax / NU;
  for (const l of ells) {
    const nu = l + 0.5; let s = 0;
    for (let i = 0; i <= NU; i++) {
      const u = i * du, ch = Math.cosh(u), k = nu * ch / D, w = (i === 0 || i === NU) ? 0.5 : 1;
      const [s0, s1] = src(k), th = Math.tanh(u);
      s += w * (s0 * s0 + s1 * s1 * th * th) / (ch * ch) * As * Math.pow(k / 0.05, ns - 1);
    }
    const reion = Math.exp(-2 * tau) + (1 - Math.exp(-2 * tau)) * Math.exp(-l / 12);
    Dl.push(l * (l + 1) / (nu * nu) * T2 * s * du * reion);
  }
  // gravitational lensing by large-scale structure smooths the acoustic peaks: Gaussian kernel of width lw·ℓ, weight lf
  if (cal.lf > 0) {
    const sm = Dl.map((_, i) => {
      const l = ells[i], sg = Math.max(cal.lw * l, 1); let s = 0, w = 0;
      for (let j = 0; j < ells.length; j++) { const d = (ells[j] - l) / sg; if (Math.abs(d) > 4) continue; const ww = Math.exp(-0.5 * d * d) * (j === 0 ? 1 : ells[j] - ells[j - 1]); s += ww * Dl[j]; w += ww; }
      return s / w;
    });
    for (let i = 0; i < Dl.length; i++) Dl[i] = (1 - cal.lf) * Dl[i] + cal.lf * sm[i];
  }
  // peaks and troughs
  const peaks = [], troughs = [];
  for (let i = 1; i < ells.length - 1; i++) {
    if (ells[i] < 100) continue;
    const ext = () => { // parabola through three neighbouring points → sub-grid extremum
      const x0 = ells[i - 1], x1 = ells[i], x2 = ells[i + 1], y0 = Dl[i - 1], y1 = Dl[i], y2 = Dl[i + 1];
      const den = (x0 - x1) * (x0 - x2) * (x1 - x2), A = (x2 * (y1 - y0) + x1 * (y0 - y2) + x0 * (y2 - y1)) / den, B = (x2 * x2 * (y0 - y1) + x1 * x1 * (y2 - y0) + x0 * x0 * (y1 - y2)) / den;
      if (A === 0) return { l: x1, D: y1 };
      const C0 = y1 - A * x1 * x1 - B * x1, xv = clampNum(-B / (2 * A), x0, x2);
      return { l: xv, D: A * xv * xv + B * xv + C0 };
    };
    if (Dl[i] > Dl[i - 1] && Dl[i] >= Dl[i + 1]) peaks.push(ext());
    if (Dl[i] < Dl[i - 1] && Dl[i] <= Dl[i + 1]) troughs.push(ext());
  }
  return { ells, Dl, peaks, troughs, kD, lD: kD * D, keq, Rs, ellA: PI * D / rs };
}
// approximate Planck 2018 best-fit ΛCDM TT peak/trough locations and heights (μK²), for orientation
const PLANCK_TT = [[220, 5750], [415, 1690], [537, 2580], [678, 1730], [814, 2510], [985, 1080], [1125, 1260], [1275, 760], [1445, 820]];

/* ============================================================ neutrinos */
const DM21 = 7.42e-5, DM31 = 2.515e-3, DM32I = 2.498e-3;   // eV², NuFIT 5.x
function nuMasses(hier, mLight) {
  const m = Math.max(mLight, 0);
  if (hier === 'inverted') { const m3 = m, m2 = Math.sqrt(m3 * m3 + DM32I), m1 = Math.sqrt(Math.max(m2 * m2 - DM21, 0)); return [m1, m2, m3]; }
  return [m, Math.sqrt(m * m + DM21), Math.sqrt(m * m + DM31)];
}
function neutrinos(R) {
  const { cp, th, P } = R;
  const g0 = th.g(cp.T0), TnuK = g0.r * cp.T0K, kTnu = 8.617333e-5 * TnuK;          // eV
  const ngam = 410.73 * (cp.T0K / 2.7255) ** 3, nPerFlavour = 3 / 11 * ngam * (g0.r / Math.cbrt(4 / 11)) ** 3;
  const species = (P.nu_masses && P.nu_masses.length === 3) ? P.nu_masses : [P.mnu / 3, P.mnu / 3, P.mnu / 3];
  const per = species.map(m => ({
    m, znr: m > 0 ? m / (3.15 * kTnu) - 1 : null,
    v: m > 0 ? Math.min(299792, 3.15 * kTnu / m * 299792) : 299792,               // km/s today
    knr: m > 0 ? 0.018 * Math.sqrt(cp.Om) * Math.sqrt(m) * cp.h : 0,               // 1/Mpc
  }));
  const fnu = cp.omega_nu / Math.max(cp.omega_m, 1e-9);
  return { TnuK, nPerFlavour, nTotal: nPerFlavour * P.Neff / 1.015, per, fnu, supp: 1 - Math.exp(-8 * fnu), omega_nu: cp.omega_nu, sum: P.mnu,
    minNO: nuMasses('normal', 0).reduce((a, b) => a + b), minIO: nuMasses('inverted', 0).reduce((a, b) => a + b) };
}
// Dodelson–Widrow sterile-neutrino dark matter (non-resonant): Ωh² ≈ 0.1 (sin²2θ/3e-9)(m/3 keV)^1.8
const dodelsonWidrow = (mkeV, s2) => 0.1 * (s2 / 3e-9) * Math.pow(mkeV / 3, 1.8);

/* ============================================================ inflaton dynamics
 * φ'' + (3 − φ'²/2)(φ' + V'/V) = 0 in e-folds N (reduced Planck units), exact background, stops at ε = 1.
 * Normalised to A_s at the pivot; the comoving Hubble radius 1/(aH) is joined through a matter-like
 * reheating phase (a ∝ H^−2/3) to the radiation era at T_rh, which fixes how many e-folds before the
 * end the CMB pivot scale actually left the horizon. */
const POTENTIALS = {
  starobinsky: { V: p => (1 - Math.exp(-Math.sqrt(2 / 3) * p)) ** 2, dV: p => { const e = Math.exp(-Math.sqrt(2 / 3) * p); return 2 * Math.sqrt(2 / 3) * e * (1 - e); }, d2V: p => { const s = Math.sqrt(2 / 3), e = Math.exp(-s * p); return 2 * s * s * e * (2 * e - 1); }, phi0: 6.2, label: 'V₀(1 − e^{−√(2/3) φ/M})²' },
  quadratic: { V: p => 0.5 * p * p, dV: p => p, d2V: () => 1, phi0: 20, label: '½ m² φ²' },
  quartic: { V: p => 0.25 * p ** 4, dV: p => p ** 3, d2V: p => 3 * p * p, phi0: 27, label: '¼ λ φ⁴' },
  hilltop: { V: p => 1 - (p / 10) ** 4, dV: p => -4 * p ** 3 / 1e4, d2V: p => -12 * p * p / 1e4, phi0: 3.4, label: 'V₀[1 − (φ/μ)⁴], μ = 10 M' },
};
function inflatonRun(R) {
  const { P, tl } = R, mod = POTENTIALS[P.inf_model] || POTENTIALS.starobinsky;
  const V = mod.V, dV = mod.dV, d2V = mod.d2V;
  const rhs = (p, q) => { const k = 3 - q * q / 2; return [q, -k * (q + dV(p) / V(p))]; };
  let p = mod.phi0, q = -dV(p) / V(p), N = 0;
  const hN = 0.01, out = { N: [], phi: [], eps: [], H: [] };
  for (let i = 0; i < 40000; i++) {
    const eps = q * q / 2;
    if (i % 10 === 0) { out.N.push(N); out.phi.push(p); out.eps.push(eps); out.H.push(Math.sqrt(Math.max(V(p), 0) / (3 - eps))); }
    if (eps >= 1 || !(V(p) > 0)) break;
    const k1 = rhs(p, q), k2 = rhs(p + hN / 2 * k1[0], q + hN / 2 * k1[1]), k3 = rhs(p + hN / 2 * k2[0], q + hN / 2 * k2[1]), k4 = rhs(p + hN * k3[0], q + hN * k3[1]);
    p += hN / 6 * (k1[0] + 2 * k2[0] + 2 * k3[0] + k4[0]); q += hN / 6 * (k1[1] + 2 * k2[1] + 2 * k3[1] + k4[1]); N += hN;
  }
  const Nend = N, Ntot = Nend;
  // pivot at N_* e-folds before the end (slider), slow-roll observables evaluated numerically there
  const Nst = Math.min(P.Ne, Ntot - 0.5), pst = lerp(out.N, out.phi, Nend - Nst);
  const epsV = 0.5 * (dV(pst) / V(pst)) ** 2, etaV = d2V(pst) / V(pst);
  const nsNum = 1 - 6 * epsV + 2 * etaV, rNum = 16 * epsV;
  // normalise V so that P_ζ = V/(24π² ε M⁴) = A_s at the pivot
  const Vscale = P.As * 24 * PI * PI * epsV / V(pst);
  const Hgev = hr => Math.sqrt(Vscale) * hr * MRED;                                 // H in GeV from reduced-unit H
  const Hend = Hgev(out.H[out.H.length - 1]), Hst = Hgev(lerp(out.N, out.H, Nend - Nst));
  // reheating: H falls from H_end to H(T_rh) with a ∝ H^(−2/3); then the thermal timeline
  const g = R.th.g(Math.min(P.T_rh, 1e19)), Hrh = Math.sqrt(PI * PI * g.gr / 90) * P.T_rh ** 2 / MRED;   // GeV
  const reheatOK = Hrh < Hend;
  const lnArh = Math.log(tl.aAtT(Math.min(P.T_rh, 1e19)));
  const lnAend = lnArh - (reheatOK ? 2 / 3 * Math.log(Hend / Hrh) : 0);
  const rH = (lnA, Hgv) => Math.log10(2.99792458e8 / (Math.exp(lnA) * Hgv / HBAR) / MPC_M);     // log10 comoving Hubble radius [Mpc]
  const curve = { lnA: [], lrH: [], phase: [] };
  for (let i = 0; i < out.N.length; i++) { const lnA = lnAend - (Nend - out.N[i]); curve.lnA.push(lnA); curve.lrH.push(rH(lnA, Hgev(out.H[i]))); curve.phase.push(0); }
  if (reheatOK) for (let j = 1; j <= 40; j++) { const Hh = Hend * Math.pow(Hrh / Hend, j / 40), lnA = lnAend + 2 / 3 * Math.log(Hend / Hh); curve.lnA.push(lnA); curve.lrH.push(rH(lnA, Hh)); curve.phase.push(1); }
  for (let i = 0; i < tl.T.length; i += 4) if (tl.T[i] < P.T_rh) { const lnA = Math.log(tl.a[i]); curve.lnA.push(lnA); curve.lrH.push(rH(lnA, tl.H[i] * HBAR)); curve.phase.push(2); }
  // where each comoving scale k [1/Mpc] left the horizon (k = aH during inflation)
  const exitN = k => { const target = -Math.log10(k); for (let i = 0; i < out.N.length; i++) if (curve.lrH[i] <= target) return Nend - out.N[i]; return null; };
  const Gamma = Hrh;                                                                 // decay rate ≈ H at reheating
  return { N: out.N, phi: out.phi, eps: out.eps, H: out.H.map(Hgev), Nend, Ntot, Nst, pst, nsNum, rNum, Hst, Hend, Hrh, Gamma, reheatOK,
    lnAend, curve, NexitPivot: exitN(0.05), NexitGal: exitN(1), NexitHorizon: exitN(cpH0(R)), label: mod.label, V, Vscale };
}
const cpH0 = R => R.cp.h / U.cH100;   // a0H0/c in 1/Mpc

/* ============================================================ first-order phase transitions → GWs
 * Sound waves + MHD turbulence (Caprini et al. 2016/2020), with the finite sound-wave lifetime. */
function ptGW(o) {
  const a = o.alpha, bH = o.betaH, vw = o.vw, T = o.Tstar, g = o.gstar || 106.75;
  const kv = a / (0.73 + 0.083 * Math.sqrt(a) + a);
  const Uf = Math.sqrt(0.75 * kv * a / (1 + a)), Htau = Math.min(1, Math.pow(8 * PI, 1 / 3) * Math.max(vw, 0.1) / (bH * Math.max(Uf, 1e-9)));
  const fsw = 1.9e-5 / vw * bH * (T / 100) * Math.pow(g / 100, 1 / 6);
  const ft = 2.7e-5 / vw * bH * (T / 100) * Math.pow(g / 100, 1 / 6), hst = 1.65e-5 * (T / 100) * Math.pow(g / 100, 1 / 6);
  const kt = 0.05 * kv, f = [], sw = [], tb = [], tot = [];
  for (let l = -10; l <= 4.001; l += 0.04) {
    const fr = Math.pow(10, l), x = fr / fsw, y = fr / ft;
    const s = 2.65e-6 / bH * (kv * a / (1 + a)) ** 2 * Math.pow(100 / g, 1 / 3) * vw * x ** 3 * Math.pow(7 / (4 + 3 * x * x), 3.5) * Htau;
    const t = 3.35e-4 / bH * Math.pow(kt * a / (1 + a), 1.5) * Math.pow(100 / g, 1 / 3) * vw * y ** 3 / (Math.pow(1 + y, 11 / 3) * (1 + 8 * PI * fr / hst));
    f.push(fr); sw.push(s); tb.push(t); tot.push(s + t);
  }
  let pk = 0, fpk = fsw; tot.forEach((v, i) => { if (v > pk) { pk = v; fpk = f[i]; } });
  return { f, sw, tb, tot, fsw, peak: pk, fpeak: fpk, kv, Htau };
}

/* ============================================================ topological defects (Kibble mechanism) */
function defects(o, R) {
  const g = o.gstar || 106.75, T0 = R.cp.T0, s0 = 2 * PI * PI / 45 * R.th.g(T0).gs * T0 ** 3 / Math.pow(U.hbarc, 3);
  // monopoles: about one per Hubble volume at T_c (Kibble); inflation dilutes them if T_rh < T_c
  const H = Tc => 1.66 * Math.sqrt(g) * Tc * Tc / MPL;
  const Yk = Math.pow(H(o.Tc) / o.Tc, 3) * 45 / (2 * PI * PI * g) * o.Tc ** 3 / o.Tc ** 3;
  const diluted = R.P.T_rh < o.Tc;
  const monoOmega = diluted ? 0 : o.mMono * Yk * s0 / U.rhoch2cgs;
  // cosmic strings: Gμ ≈ (η/M_Pl)²
  const Gmu = (o.etaString / MPL) ** 2;
  // domain walls: σ ≈ η³, ρ_w ≈ σH; walls dominate once σH > 3H²M²
  const sigma = o.etaWall ** 3, Hdom = sigma / (3 * MRED * MRED), Tdom = Math.sqrt(Hdom * MPL / (1.66 * Math.sqrt(10)));
  return { Ykibble: Yk, monoOmega, diluted, Gmu, cmbGmu: 1.5e-7, ptaGmu: 1e-10, Tdom, wallsBad: Tdom > T0 };
}

/* ============================================================ primordial black holes */
const PBH_LIMITS = [ // log10(M/g), log10 f_max — approximate composite (Carr, Kohri, Sendouda & Yokoyama 2021)
  [14.7, -10], [15, -8], [15.5, -6.5], [16, -4.5], [16.5, -2.8], [17, -1.2], [17.3, 0], [22, 0], [22.5, -1], [23, -2], [24, -2], [26, -1.5],
  [28, -1.3], [30, -1.3], [31, -1], [32, -1.2], [33, -2], [34, -3], [35, -3], [36, -4], [38, -6], [40, -8]];
function pbh(R, Mg, f) {
  const G = 6.674e-8, c = 2.998e10, hbar = 1.0546e-27, kB = 1.3807e-16, Msun = 1.989e33, gam = 0.2;
  const tf = G * Mg / (gam * c ** 3);                                    // formation time [s]: M = γ c³t/G
  const Tf = tf > 1e-44 ? R.tl.TAtt(tf) : null;
  const TH = hbar * c ** 3 / (8 * PI * G * Mg * kB);                     // Hawking temperature [K]
  const tauGyr = R.tl.age * Math.pow(Mg / 5.1e14, 3);                    // evaporating today at 5.1e14 g
  const lm = Math.log10(Mg);
  const fmax = lm < PBH_LIMITS[0][0] ? null : Math.pow(10, lerp(PBH_LIMITS.map(p => p[0]), PBH_LIMITS.map(p => p[1]), lm));
  const beta = 8.9e-9 * Math.sqrt(Mg / Msun) * f * (R.omega_c / 0.12);  // initial mass fraction
  // Press–Schechter: β = erfc(δ_c/(√2 σ)), δ_c ≈ 0.45 → required σ and P_ζ ≈ (81/16)σ²
  let lo = 1e-4, hi = 5; for (let i = 0; i < 80; i++) { const m = Math.sqrt(lo * hi); if (erfc(0.45 / (Math.SQRT2 * m)) > beta) hi = m; else lo = m; }
  const sigma = Math.sqrt(lo * hi), Pz = 81 / 16 * sigma * sigma;
  const k = 7.5e5 * Math.pow(Mg / (30 * Msun), -0.5);                   // comoving scale re-entering at formation [1/Mpc]
  return { tf, Tf, TH, tauGyr, evaporated: tauGyr < R.tl.age, fmax, allowed: fmax === null ? null : f <= fmax, beta, sigma, Pz, boost: Pz / R.P.As, k, Msun: Mg / Msun };
}

/* ============================================================ beyond-WIMP dark matter */
function darkMatterAlt(P, th, inf, omega_b) {
  // freeze-in from decays B → χ (Hall, Jedamzik, March-Russell & West 2010)
  const mB = P.fi_mB, lam = P.fi_lambda, Gam = lam * lam * mB / (8 * PI), gs = th.g(mB / 3).gs;
  const reach = Math.exp(-Math.max(0, mB / P.T_rh - 1));                  // B must be thermally populated
  const fi = { omegah2: 1.09e27 * 2 * P.fi_m * Gam / (Math.pow(gs, 1.5) * mB * mB) * reach, Gamma: Gam, lambdaNeeded: lam * Math.sqrt(0.12 / Math.max(1.09e27 * 2 * P.fi_m * Gam / (Math.pow(gs, 1.5) * mB * mB) * reach, 1e-300)) };
  // QCD axion, misalignment. PQ broken before inflation if f_a > max(T_rh, H_I/2π): single θ_i,
  // isocurvature β_iso = P_iso/(P_iso + A_s) with P_iso = (H_I/(π θ f_a))² (Ω_a/Ω_c)². Otherwise ⟨θ²⟩ = π²/3 (×1.5 anharmonic).
  const HI = inf.Hinf, pre = P.ax_fa > Math.max(P.T_rh, HI / (2 * PI));
  const th2 = pre ? P.ax_theta * P.ax_theta : 1.5 * PI * PI / 3;
  const axO = 0.12 * Math.pow(P.ax_fa / 9e11, 1.165) * th2;
  const Piso = pre ? Math.pow(HI / (PI * Math.max(P.ax_theta, 1e-6) * P.ax_fa), 2) : 0;
  const ax = { omegah2: axO, ma_ueV: 5.7 * (1e12 / P.ax_fa), pre, betaIso: Piso / (Piso + P.As), isoOK: !pre || Piso / (Piso + P.As) < 0.038 };
  // asymmetric DM sharing the baryon asymmetry: Ω_χ/Ω_b = (m_χ/m_p)(η_χ/η_b)
  const adm = { omegah2: omega_b * P.adm_m / 0.938 * P.adm_ratio, mNeeded: 0.12 / Math.max(omega_b, 1e-12) * 0.938 / P.adm_ratio };
  return { fi, ax, adm };
}

/* ============================================================ data, likelihood, optimiser */
const DATA = {
  theta: { name: 'CMB acoustic scale 100θ*', val: 1.04110, err: 0.00031, get: r => r.rec.theta100, ref: 1.04110, src: 'Planck 2018' },
  omb: { name: 'CMB peak heights → ω_b', val: 0.02237, err: 0.00015, get: r => r.omega_b, ref: null, src: 'Planck 2018 (compressed)' },
  omc: { name: 'CMB peak heights → ω_c', val: 0.1200, err: 0.0012, get: r => r.omega_c, ref: null, src: 'Planck 2018 (compressed)' },
  DH: { name: 'Primordial deuterium D/H', val: 2.527e-5, err: 0.075e-5, get: r => r.nuc.DH, ref: 2.51e-5, src: 'Cooke+ 2018 (+ nuclear-rate error)' },
  Yp: { name: 'Primordial helium Y_p', val: 0.2449, err: 0.0040, get: r => r.nuc.Yp, ref: 0.2471, src: 'Aver+ 2015' },
  H0: { name: 'Local H₀ (Cepheids + SNe Ia)', val: 73.04, err: 1.04, get: r => r.cp.H0, ref: null, src: 'SH0ES 2022' },
  S8: { name: 'Weak lensing S₈', val: 0.776, err: 0.017, get: r => r.st.S8, ref: 0.832, src: 'DES Y3 + KiDS-1000' },
};
function chi2(R, keys, BASE) {
  let tot = 0; const parts = {};
  for (const k of keys) {
    const d = DATA[k]; let v = d.get(R);
    if (d.ref !== null && BASE) v *= d.ref / d.get(BASE);          // calibrate: this code's ΛCDM ≡ the reference prediction
    const c = ((v - d.val) / d.err) ** 2;
    parts[k] = { pred: v, pull: (v - d.val) / d.err, chi2: c };
    tot += isFinite(c) ? c : 1e6;
  }
  return { chi2: tot, parts };
}
// Nelder–Mead as a generator so a UI can run it without freezing (yield after each evaluation batch)
function* nelderMead(f, x0, steps, opt) {
  opt = Object.assign({ maxIt: 250, tol: 1e-5 }, opt);
  const n = x0.length; let simplex = [x0.slice()];
  for (let i = 0; i < n; i++) { const x = x0.slice(); x[i] += steps[i]; simplex.push(x); }
  let fv = []; for (const x of simplex) { fv.push(f(x)); yield { it: 0, best: Math.min(...fv) }; }
  for (let it = 1; it <= opt.maxIt; it++) {
    const idx = fv.map((v, i) => i).sort((a, b) => fv[a] - fv[b]); simplex = idx.map(i => simplex[i]); fv = idx.map(i => fv[i]);
    if (Math.abs(fv[n] - fv[0]) < opt.tol * (1 + Math.abs(fv[0]))) break;
    const cen = new Array(n).fill(0); for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) cen[j] += simplex[i][j] / n;
    const pt = c => cen.map((v, j) => v + c * (simplex[n][j] - v));
    const xr = pt(-1), fr = f(xr);
    if (fr < fv[0]) { const xe = pt(-2), fe = f(xe); if (fe < fr) { simplex[n] = xe; fv[n] = fe; } else { simplex[n] = xr; fv[n] = fr; } }
    else if (fr < fv[n - 1]) { simplex[n] = xr; fv[n] = fr; }
    else {
      const xc = fr < fv[n] ? pt(-0.5) : pt(0.5), fc = f(xc);
      if (fc < Math.min(fr, fv[n])) { simplex[n] = xc; fv[n] = fc; }
      else for (let i = 1; i <= n; i++) { simplex[i] = simplex[i].map((v, j) => simplex[0][j] + 0.5 * (v - simplex[0][j])); fv[i] = f(simplex[i]); }
    }
    yield { it, best: fv[0], x: simplex[0] };
  }
  const i0 = fv.indexOf(Math.min(...fv));
  return { x: simplex[i0], fx: fv[i0] };
}
// finite-difference Hessian of χ² (generator), covariance = 2 H⁻¹
function* hessian(f, x, h) {
  const n = x.length, H = Array.from({ length: n }, () => new Array(n).fill(0)), f0 = f(x); yield 0;
  const at = (i, di, j, dj) => { const y = x.slice(); y[i] += di; if (j >= 0) y[j] += dj; return f(y); };
  for (let i = 0; i < n; i++) {
    const fp = at(i, h[i], -1), fm = at(i, -h[i], -1); yield 0;
    H[i][i] = (fp - 2 * f0 + fm) / (h[i] * h[i]);
    for (let j = 0; j < i; j++) {
      const v = (at(i, h[i], j, h[j]) - at(i, h[i], j, -h[j]) - at(i, -h[i], j, h[j]) + at(i, -h[i], j, -h[j])) / (4 * h[i] * h[j]); yield 0;
      H[i][j] = H[j][i] = v;
    }
  }
  return H;
}
function invert(M) {
  const n = M.length, A = M.map((r, i) => r.concat(Array.from({ length: n }, (_, j) => (i === j ? 1 : 0))));
  for (let c = 0; c < n; c++) {
    let p = c; for (let r = c + 1; r < n; r++) if (Math.abs(A[r][c]) > Math.abs(A[p][c])) p = r;
    [A[c], A[p]] = [A[p], A[c]]; const d = A[c][c]; if (Math.abs(d) < 1e-300) return null;
    for (let k = 0; k < 2 * n; k++) A[c][k] /= d;
    for (let r = 0; r < n; r++) if (r !== c) { const fct = A[r][c]; for (let k = 0; k < 2 * n; k++) A[r][k] -= fct * A[c][k]; }
  }
  return A.map(r => r.slice(n));
}
// run a full fit synchronously (used by the Node tests; the UI drives the generators itself)
function fitSync(Pbase, keys, dataKeys, BASE, x0, steps) {
  const mk = x => { const P = JSON.parse(JSON.stringify(Pbase)); keys.forEach((k, i) => { P[k] = x[i]; }); return P; };
  const f = x => { try { return chi2(GP.run(mk(x)), dataKeys, BASE).chi2; } catch (e) { return 1e9; } };
  const gen = nelderMead(f, x0, steps); let r; while (!(r = gen.next()).done); const best = r.value;
  const hg = hessian(f, best.x, steps.map(s => s * 0.3)); let hr; while (!(hr = hg.next()).done); const Hm = hr.value;
  const inv = invert(Hm), err = inv ? inv.map((row, i) => Math.sqrt(Math.max(2 * row[i], 0))) : null;
  return { x: best.x, chi2: best.fx, err, P: mk(best.x) };
}

GP.HOOKS.dmAlt = darkMatterAlt;

return { cmbSpectrum, CMB_CAL, PLANCK_TT, silkScale, nuMasses, neutrinos, dodelsonWidrow, POTENTIALS, inflatonRun, ptGW, defects, PBH_LIMITS, pbh, darkMatterAlt, DATA, chi2, nelderMead, hessian, invert, fitSync, erfc };
});
