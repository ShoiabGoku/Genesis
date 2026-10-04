# GENESIS — Early-Universe Laboratory

An interactive laboratory for the hot Big Bang. Reorder cosmic history — reheating, baryogenesis,
the electroweak and QCD transitions, dark-matter freeze-out, the appearance of new light particles —
and every consequence is recomputed from the governing equations: the matter–antimatter asymmetry,
light-element abundances, the CMB last-scattering surface, dark-matter relic density, galaxy and
halo masses, the cosmic web, and the fate of the universe.

Nothing is a canned animation: every number and curve comes from solving the physics in `physics.js`.

## Run

Serve the folder with any static server (plain browser scripts, no build step, no dependencies):

```
node serve.js 8777        # then open http://localhost:8777
```

## What is modelled

| Epoch | Model |
|---|---|
| Thermal history | Exact Bose–Einstein / Fermi–Dirac energy & entropy for all SM species; QCD crossover; instantaneous ν decoupling; a(T) from entropy conservation; t(T) from the Friedmann equation |
| Inflation | Slow-roll predictions (n_s, r, V¼, max. T_rh) for R², φ², φ⁴, hilltop or custom |
| Baryogenesis | Boltzmann equations for out-of-equilibrium decays (Buchmüller–Di Bari–Plümacher), sphaleron conversion a_sph = 28/79 only above T_sph, leptogenesis / SU(5) / SO(10) modes |
| Dark matter | Freeze-out Boltzmann equation with s- and p-wave ⟨σv⟩, low-reheating production, warm-DM free-streaming |
| Nucleosynthesis | 8 nuclides, 11 reactions (SKM93 / CF88 fits + detailed balance), exact Born-approximation weak rates, implicit Newton solver |
| Recombination | Peebles three-level atom + RECFAST fudge, helium Saha, tanh reionisation; atomic physics rescaled with α and m_e |
| Structure | Linear growth with w₀–wₐ dark energy, Eisenstein–Hu transfer function, massive-ν suppression, Sheth–Tormen halo mass function, Moster+13 stellar masses, 2-D Zel'dovich cosmic web |
| Fate | Acceleration equation integrated forward (Big Rip / Big Crunch / heat death) |
| Spacetime & gravity | Einstein's equations for FLRW with every species' pressure (Ricci & Kretschmann curvature, curvature radius vs Planck length), conformal-time light cones and particle/event horizons, horizon problem, zero-gravity radius of bound systems and the Big-Rip tearing sequence, primordial gravitational-wave spectrum vs detectors, and an interactive 3-D "fabric" (comoving grid stretching, potential wells, global curvature, redshifting light) |

Earlier epochs feed later ones (η → BBN & CMB, Ω_DM → structure, Y_p → recombination, n_s → P(k));
each link can be cut to set the downstream quantity by hand.

## Universe simulator (sim.js)

Two universes animated side by side on one cosmic clock — standard (or a pinned universe) vs yours.
Each shows the same comoving patch: its size follows that universe's a(t), the plasma glows and cools
with T = T₀/a, the cosmic web grows with σ₈·D(t), galaxies light up at its first-star epoch, and the
ending plays out (eternal expansion, Big Rip with structures torn apart, or turnaround and Big Crunch).

New knobs, propagated through every stage (freeze-outs, BBN, recombination, growth, fate):
- **Expansion speed ξ** — H → ξH at all times while gravity's pull on matter is unchanged
  (faster: more helium and dark matter, less structure; slower: the opposite).
- **Early dark energy** — fraction f at redshift z_c, Λ-like before z_c and diluting as a⁻⁶ after
  (before recombination it shrinks the sound horizon; during BBN it raises helium; at ~10¹³ it changes
  the dark-matter relic density).

## Extended laboratory (physics-ext.js + lab2.js)

| Feature | What is computed |
|---|---|
| CMB power spectrum | Semi-analytic acoustic source (driving, baryon loading, Silk damping integrated through recombination, lensing smoothing), Bessel-averaged projection; calibrated once to Planck ΛCDM (peaks ≲2% in ℓ, ≲15% in height) |
| Neutrinos | Mass orderings from oscillation splittings, CνB temperature and density, free-streaming suppression, N_eff from BBN vs CMB damping tail, Dodelson–Widrow sterile DM |
| Inflaton dynamics | Exact background φ'' + (3 − φ'²/2)(φ' + V'/V) = 0, numeric n_s and r, comoving Hubble radius through reheating, self-consistent pivot-exit e-folds |
| Relics | First-order phase-transition GWs (sound waves + turbulence), monopoles/strings/walls (Kibble), primordial black holes (formation, Hawking evaporation, constraints, required P_ζ) |
| Dark-matter candidates | WIMP, freeze-in, QCD axion (pre/post-inflation, isocurvature), asymmetric DM |
| Lithium problem | Nuclear-rate multipliers and stellar depletion against D/H |
| Fit the data | Compressed Planck (θ*, ω_b, ω_c), D/H, Y_p, SH0ES H₀, S₈; Nelder–Mead + Hessian errors; Hubble-tension study across extensions |
| Research | Side-by-side universes, sensitivity matrix, fine-tuning maps, Jupyter/CAMB/CLASS/PDF export |
| Learn | Six guided lectures with narration, eight engineering challenges, AI physicist (Claude via the user's own API key, offline fallback) |

## Working like a physicist

- **Blackboards** on every tab: the governing equations typeset with KaTeX, this universe's numbers
  substituted, and a back-of-the-envelope estimate set against the full numerical result
  (e.g. Kolb–Turner Ωh² 0.123 vs Boltzmann 0.120; t(1 MeV) 0.74 s vs 0.742 s; η 6.17 vs 6.11 ×10⁻¹⁰).
- **Gedankenexperiments**: commit to a prediction first; the simulation — not a stored answer — judges it,
  and an intuition score is kept.
- **Lab notebook & console** (`n` or `/`): `me_s = 1.1`, `? zstar`, `scan Neff 2 5 8 Yp DH` (with a plot),
  `params`, `pin`, `note …`. Every experiment is logged automatically and exports to Markdown or a LaTeX table.
- **Units**: natural (GeV), SI (K, s, m) or Planck units (`u`); **Blackboard theme** (`b`); tabs on `1`–`0`.

## Validation

`node test/validate.js` checks the standard-ΛCDM run against published values
(Planck 2018, PRIMAT, PDG): H₀, age, z_eq, g*, leptogenesis efficiency, WIMP relic density,
Y_p, D/H, ³He/H, ⁷Li/H, dY_p/dN_eff, z*, 100θ*, r_s, τ_reion, σ₈, particle & event horizons,
Local Group zero-gravity radius, Einstein-equation H₀, q₀, z_acc, and the Big-Rip time against exact quadrature. The same table is recomputed live on
the Methods tab.

Reduced-order models, not CAMB/CLASS/PRIMAT: expect ~0.5 % on H₀/age/θ*, ~1 % on Y_p,
5–10 % on D/H and ⁷Li, 3–5 % on σ₈. Differences between two universes (Δ values, pinned
baselines) are much more precise than absolute values.

## Files

- `physics.js` — all physics, pure functions (browser `window.GP`, Node `require`)
- `plot.js` — dependency-free log/linear plotting with hover readout and CSV export
- `app.js` — interface: timeline sequencer, plasma inspector, tabs, scenarios, cosmic web
- `index.html`, `style.css` — layout
- `test/validate.js` — numerical validation suite
- `serve.js` — tiny static server for local use

`window.__GENESIS` exposes the live state for scripting: `.P` parameters, `.R` results,
`.set({...})`, `.reset()`, `.showTab(name)`, `.applyScenario(s)`, `.inspect(T_GeV)`.
