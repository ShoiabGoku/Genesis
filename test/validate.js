// Numerical validation of the physics core against published results.
// Run: node test/validate.js
const GP = require('../physics.js');
let fails = 0;
function check(name, got, want, tol) {
  const ok = Math.abs(got - want) <= tol;
  if (!ok) fails++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name.padEnd(42)} got ${Number(got).toPrecision(5).padStart(11)}  want ${want} ± ${tol}`);
}
const t0 = Date.now();
const R = GP.run({});
console.log(`full pipeline: ${Date.now() - t0} ms`);
const t1 = Date.now(); GP.run({ omega_L: 0.31 }); console.log(`cached re-run: ${Date.now() - t1} ms`);

// thermodynamics
const th = R.th;
check('g* at 1 TeV (SM = 106.75)', th.g(1000).gr, 106.75, 0.3);
check('g*s today (3.91-3.94)', th.g(2.35e-13).gs, 3.93, 0.03);
check('T_nu/T today = (4/11)^(1/3)', th.g(1e-9).r, Math.cbrt(4 / 11), 0.004);

// background
check('H0 derived from flat closure', R.cp.H0, 67.36, 0.3);
check('age of universe [Gyr]', R.tl.age, 13.797, 0.06);
check('z_eq', R.rec.zeq, 3402, 40);
{ let s = 0; const N = 20000; for (let i = 1; i <= N; i++) { const a = (i - 0.5) / N; s += 1 / (a * Math.sqrt(GP.E2(R.cp, a))) / N; } check('timeline age == direct integral', R.tl.age, s * 977.792 / R.cp.H0, 0.02); }

// baryogenesis -> eta
check('eta_10 from leptogenesis (tuned default)', R.bg.eta * 1e10, 6.10, 0.4);
check('leptogenesis efficiency K=10 (BDP fit 0.032)', R.bg.kappa, 0.032, 0.006);

// dark matter
check('WIMP relic omega h^2 (100 GeV, 2.05e-26)', R.dm.omegah2, 0.120, 0.012);
check('freeze-out x_f (~20-25)', R.dm.xf, 22, 4);

// BBN at Planck eta
const nb = GP.bbn({ eta: 6.104e-10, Neff: 3.044, dNinj: 0, TinjMeV: 0, tau_n: 878.4, Q_s: 1, me_s: 1, G_s: 1, BD_s: 1 });
check('BBN Y_p (PRIMAT 0.2471)', nb.Yp, 0.247, 0.004);
check('BBN D/H x1e5 (PRIMAT 2.44)', nb.DH * 1e5, 2.5, 0.25);
check('BBN 3He/H x1e5 (1.04)', nb.He3H * 1e5, 1.04, 0.15);
check('BBN 7Li/H x1e10 (4.5-5.5 by rate set)', nb.Li7H * 1e10, 4.8, 1.0);
check('neutron lifetime reproduced', nb.tauEff, 878.4, 0.5);
const nb4 = GP.bbn({ eta: 6.104e-10, Neff: 4.044, dNinj: 0, TinjMeV: 0, tau_n: 878.4, Q_s: 1, me_s: 1, G_s: 1, BD_s: 1 });
check('dY_p/dN_eff (~0.013)', nb4.Yp - nb.Yp, 0.013, 0.003);

// recombination
check('z* (Planck 1089.9)', R.rec.zstar, 1090, 6);
check('100 theta* (Planck 1.0411)', R.rec.theta100, 1.0411, 0.006);
check('r_s(z*) Mpc (144.4)', R.rec.rs, 144.4, 1.5);
check('reionisation optical depth (0.054)', R.rec.tauReion, 0.054, 0.01);

// structure
check('sigma8 (0.811)', R.st.sigma8, 0.811, 0.04);

// spacetime
check('particle horizon today [Gly] (~46.3)', R.sp.particleHorizon, 46.3, 0.8);
check('event horizon today [Gly] (~16.5)', R.sp.eventHorizon, 16.5, 0.7);
check('Hubble radius [Gly]', R.sp.hubble0, 14.5, 0.1);
check('Local Group zero-gravity radius [Mpc] (~1.5)', R.sp.systems[1].r0 / 3.0857e22, 1.5, 0.2);
{ const E = GP.einstein(R, 1, R.cp.T0); check('Einstein eq. reproduces H0', E.H * 3.0857e19, R.cp.H0, 0.05); }
{ const Rr = GP.run({ w0: -1.3 }); let s2 = 0; const du = 1e-3; for (let u = du / 2; u < 400; u += du) s2 += du / Math.sqrt(GP.E2(Rr.cp, Math.exp(u)));
  check('Big Rip time = exact quadrature [Gyr]', Rr.ft.tEnd - Rr.tl.age, s2 * Rr.ft.tH, 0.05); }
// extended physics
{
  const GX = require('../physics-ext.js');
  const c = GX.cmbSpectrum(R), pk = c.peaks;
  check('CMB first peak ℓ (Planck 220)', pk[0].l, 220, 8);
  check('CMB second peak ℓ (Planck 537)', pk[1].l, 537, 12);
  check('CMB third peak ℓ (Planck 814)', pk[2].l, 814, 15);
  check('CMB first-peak height μK² (~5750)', pk[0].D, 5750, 900);
  check('CMB 1st/2nd peak ratio (~2.2)', pk[0].D / pk[1].D, 2.2, 0.35);
  const hiB = GX.cmbSpectrum(GP.run({ link_eta: false, omega_b: 0.029 }));
  console.log(`  more baryons raise odd/even contrast: 1st/2nd = ${(hiB.peaks[0].D / hiB.peaks[1].D).toFixed(2)} (ΛCDM ${(pk[0].D / pk[1].D).toFixed(2)})`);
  const I = GX.inflatonRun(R);
  check('inflaton n_s numeric vs slow-roll', I.nsNum, R.inf.ns, 0.003);
  check('pivot exits ~50-60 e-folds before end', I.NexitPivot, 55, 6);
  check('Σmν minimum, normal ordering [eV]', GX.nuMasses('normal', 0).reduce((a, b) => a + b), 0.0588, 0.002);
  check('T_ν today [K]', GX.neutrinos(R).TnuK, 1.945, 0.01);
  check('asymmetric DM mass for Ω_c/Ω_b [GeV]', GP.run({}).dmAlt.adm.mNeeded, 5.0, 0.2);
  check('GUT monopoles without inflation: log Ωh² ≫ 0', Math.log10(GX.defects({ Tc: 1e16, mMono: 1e17, etaString: 1e16, etaWall: 1e5 }, GP.run({ T_rh: 1e17 })).monoOmega), 18, 3);
  check('PBH of 5.1e14 g evaporates today [Gyr]', GX.pbh(R, 5.1e14, 1e-9).tauGyr, R.tl.age, 0.01);
}
// fate
check('q0 (-0.53)', R.ft.q0, -0.53, 0.03);
check('z_acc (~0.63)', R.ft.zacc, 0.63, 0.05);
const rip = GP.run({ w0: -1.5 });
const tH = rip.ft.tH, Ode = rip.cp.OL;
console.log(`phantom w=-1.5: outcome=${rip.ft.outcome}, rip in ${(rip.ft.tEnd - rip.tl.age).toFixed(1)} Gyr (analytic approx ${(2 / 3 / 0.5 / Math.sqrt(Ode) * tH).toFixed(1)})`);
const crunch = GP.run({ omega_L: -0.05 });
console.log(`negative Lambda: outcome=${crunch.ft.outcome}, crunch in ${(crunch.ft.tEnd - crunch.tl.age).toFixed(1)} Gyr`);

// what-ifs should move things in the right direction
const late = GP.run({ M_X: 1e2, K: 10 });
console.log(`leptogenesis at M_X=100 GeV (after sphalerons): eta=${late.bg.eta.toExponential(2)}`);
const gut = GP.run({ bg_mode: 'gut', M_X: 1e15 });
console.log(`SU(5) B-L=0 at 1e15: eta=${gut.bg.eta.toExponential(2)}`);
const lowRh = GP.run({ T_rh: 1e8 });
console.log(`T_rh=1e8 < M_X: eta=${lowRh.bg.eta.toExponential(2)}`);
const heavyE = GP.run({ me_s: 1.1 });
console.log(`m_e x1.1: z*=${heavyE.rec.zstar.toFixed(1)} (expect ~+10%), Yp=${heavyE.nuc.Yp.toFixed(4)}`);
const noBD = GP.run({ BD_s: 0 });
console.log(`deuteron unbound: Yp=${noBD.nuc.Yp.toExponential(2)}`);
const noCP = GP.run({ eps: 0 });
console.log(`no CP: omega_b=${noCP.omega_b.toExponential(2)} Yp=${noCP.nuc.Yp.toExponential(2)} sigma8=${noCP.st.sigma8.toFixed(3)}`);
const wdm = GP.run({ m_wdm: 1 });
console.log(`1 keV WDM: n(>1e8) today vs CDM: ${GP.lerp(wdm.st.hmfs[0].lM, wdm.st.hmfs[0].nGt, 8).toExponential(2)} vs ${GP.lerp(R.st.hmfs[0].lM, R.st.hmfs[0].nGt, 8).toExponential(2)}`);
const bigL = GP.run({ omega_L: 0.3107 * 300 });
console.log(`Lambda x300: galaxiesEver=${bigL.st.galaxiesEver} growthMax=${bigL.st.growthMaxRatio.toFixed(3)}`);
console.log('first stars z', R.st.zFirstStars && R.st.zFirstStars.toFixed(1), 'first galaxies z', R.st.zFirstGal && R.st.zFirstGal.toFixed(1), 'Mbig', R.st.Mbig && R.st.Mbig.toExponential(2));
console.log('notes:', R.notes.map(n => n.txt));
console.log(fails ? `\n${fails} FAILED` : '\nALL PASS');
process.exit(fails ? 1 : 0);
