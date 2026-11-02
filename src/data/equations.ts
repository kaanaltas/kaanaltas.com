// TeX source for the landing-page equation mesh (docs/design-system.md §7).
// Typeset at build time by src/lib/tex.ts (MathJax, Computer Modern) and
// shipped to the canvas as SVG sprites, so the mesh reads as real LaTeX.

/** Glyph nodes: these form the links. */
export const MESH_GLYPHS = [
  String.raw`\partial`,
  String.raw`\nabla`,
  String.raw`\Sigma`,
  String.raw`\int`,
  String.raw`\Delta`,
  String.raw`\rho`,
  String.raw`\mu`,
  String.raw`\lambda`,
  String.raw`\theta`,
  String.raw`\eta`,
  String.raw`\alpha`,
  String.raw`\gamma`,
  String.raw`\varepsilon`,
  String.raw`\rightleftharpoons`,
  String.raw`\approx`,
  String.raw`\infty`,
  String.raw`\dot m`,
];

/**
 * A mesh equation: its TeX, or its TeX plus an `open` form. An equation with
 * an `open` form is expandable: on hover (dwell) or tap the closed form
 * cross-fades into the open one and back (docs/design-system.md §7). The open
 * form is a genuine expansion or generalisation of the closed one, never a
 * different law, and it is typeset at build time like everything else.
 */
export type MeshEq = string | { tex: string; open?: string };

/**
 * The owner's picks: always placed first (shuffled), ahead of everything
 * else, so each of them shows on any desktop screen. An inner array is one
 * slot that picks one of its entries per visit.
 */
export const MESH_KEY: (MeshEq | MeshEq[])[] = [
  // Boltzmann entropy, absolute or as a change between two macrostates.
  [
    {
      tex: String.raw`S = k_{B} \ln \Omega`,
      // Gibbs entropy. With Ω equally likely microstates, p_i = 1/Ω, the sum
      // is -Ω·(1/Ω)·ln(1/Ω) = ln Ω, which is the closed form again.
      open: String.raw`S = -k_{B} \sum_{i} p_i \ln p_i`,
    },
    {
      tex: String.raw`\Delta S = k_{B} \ln \frac{\Omega_2}{\Omega_1}`,
      // The change as a difference of two Boltzmann entropies.
      open: String.raw`\Delta S = S_2 - S_1 = k_{B} \ln \Omega_2 - k_{B} \ln \Omega_1`,
    },
  ],
  {
    tex: String.raw`\Delta G = \Delta H - T\,\Delta S`,
    // The general differential of G = H - TS. The closed form is its
    // isothermal case (dT = 0, integrated); with dH = T dS + V dp it becomes
    // the fundamental relation dG = V dp - S dT. Chosen over
    // ΔG = ΔG° + RT ln Q, which adds composition but not the T-dependence.
    open: String.raw`\begin{aligned} dG &= dH - T\,dS - S\,dT \\ &= V\,dp - S\,dT \end{aligned}`,
  },
  {
    tex: String.raw`\begin{array}{l} \displaystyle\min_{x}\; f(x) \\[-4pt] \text{s.t.}\;\; g(x) \le 0,\; h(x) = 0 \end{array}`,
    // KKT conditions at a local optimum x* (under a constraint
    // qualification): stationarity of the Lagrangian; then dual feasibility,
    // complementary slackness and primal feasibility.
    open: String.raw`\begin{array}{l} \displaystyle\nabla f(x^{*}) + \sum_{i} \lambda_i \nabla g_i(x^{*}) + \sum_{j} \mu_j \nabla h_j(x^{*}) = 0 \\[2pt] \lambda_i \ge 0,\;\; \lambda_i\, g_i(x^{*}) = 0,\;\; g(x^{*}) \le 0,\;\; h(x^{*}) = 0 \end{array}`,
  },
  {
    tex: String.raw`\theta_{k+1} = \theta_k - \eta\,\nabla_{\theta} L(\theta_k)`,
    // Componentwise, with the loss as a mean over the data,
    // L(θ) = (1/n) Σ_i ℓ(θ; x_i).
    open: String.raw`\theta_{k+1,\,j} = \theta_{k,\,j} - \frac{\eta}{n} \sum_{i=1}^{n} \frac{\partial\, \ell(\theta_k;\, x_i)}{\partial \theta_j}`,
  },
  {
    // Momentum balance in its closed (Cauchy) form.
    tex: String.raw`\rho\,\frac{D\mathbf u}{Dt} = \nabla\cdot\boldsymbol{\sigma} + \mathbf f`,
    // Navier–Stokes: the material derivative written out, and the stress of
    // a Newtonian fluid at constant density and viscosity,
    // σ = -pI + μ(∇u + ∇uᵀ) with ∇·u = 0, so ∇·σ = -∇p + μ∇²u.
    open: String.raw`\rho\left(\frac{\partial \mathbf u}{\partial t} + (\mathbf u\cdot\nabla)\,\mathbf u\right) = -\nabla p + \mu\nabla^{2}\mathbf u + \mathbf f`,
  },
  {
    // van 't Hoff: temperature dependence of the equilibrium constant.
    tex: String.raw`\frac{d \ln K}{dT} = \frac{\Delta H^{\circ}}{R T^{2}}`,
    // Integrated from T_1 to T_2 with ΔH° constant: ∫dT/T² = -(1/T_2 - 1/T_1).
    open: String.raw`\ln\frac{K_2}{K_1} = -\frac{\Delta H^{\circ}}{R} \left(\frac{1}{T_2} - \frac{1}{T_1}\right)`,
  },
  {
    // Fourier's law of heat conduction (isotropic k).
    tex: String.raw`\mathbf q = -k\,\nabla T`,
    open: String.raw`\begin{aligned} q_x &= -k\,\frac{\partial T}{\partial x} \\ q_y &= -k\,\frac{\partial T}{\partial y} \\ q_z &= -k\,\frac{\partial T}{\partial z} \end{aligned}`,
  },
];

/**
 * Next in line (shuffled). Key + featured = 8, the equation count at
 * 1440×900, so a desktop screen shows all of them.
 */
export const MESH_FEATURED: (MeshEq | MeshEq[])[] = [
  {
    tex: String.raw`P + \tfrac12\rho v^2 + \rho g h = \text{const}`,
    // Between two points on one streamline (steady, inviscid, incompressible):
    // the streamline Euler equation ρ v ∂v/∂s = -∂P/∂s - ρg ∂h/∂s integrated
    // from point 1 to point 2.
    open: String.raw`P_1 + \tfrac12\rho v_1^2 + \rho g h_1 = P_2 + \tfrac12\rho v_2^2 + \rho g h_2`,
  },
];

/** Fills the remaining slots on larger screens. */
export const MESH_POOL: MeshEq[] = [
  String.raw`k = A\,e^{-E_a/RT}`,
  String.raw`\nabla f + \sum_i \lambda_i \nabla g_i = 0`,
  String.raw`\rho\left(\frac{\partial \mathbf u}{\partial t} + \mathbf u\cdot\nabla\mathbf u\right) = -\nabla p + \mu\nabla^2\mathbf u`,
  {
    tex: String.raw`\frac{\partial \rho}{\partial t} + \nabla\cdot(\rho\,\mathbf u) = 0`,
    // Continuity in Cartesian components, u = (u, v, w).
    open: String.raw`\frac{\partial \rho}{\partial t} + \frac{\partial (\rho u)}{\partial x} + \frac{\partial (\rho v)}{\partial y} + \frac{\partial (\rho w)}{\partial z} = 0`,
  },
  String.raw`dS \ge \frac{\delta Q}{T}`,
  String.raw`\Delta G^\circ = -RT \ln K`,
  String.raw`\begin{array}{l} \displaystyle\min_{x}\; c^{\top} x \\[-4pt] \text{s.t.}\;\; Ax \le b,\; x \in \mathbb{Z}^n \end{array}`,
  String.raw`\frac{dm}{dt} = \sum \dot m_{\text{in}} - \sum \dot m_{\text{out}}`,
  String.raw`y = \frac{\alpha x}{1 + (\alpha - 1)\,x}`,
  String.raw`\log_{10} P = A - \frac{B}{C + T}`,
  String.raw`y_i P = x_i \gamma_i P_i^{\text{sat}}`,
  String.raw`Q = UA\,\Delta T_{\text{lm}}`,
  String.raw`\frac{\partial C}{\partial t} = D\nabla^2 C - \mathbf v\cdot\nabla C + r`,
  String.raw`\min_{u}\, \sum_k \lVert y_k - r_k\rVert_Q^2 + \lVert \Delta u_k\rVert_R^2`,
  {
    tex: String.raw`\operatorname{softmax}\!\left(\frac{QK^{\top}}{\sqrt{d}}\right)V`,
    // Row i of the output: the softmax (taken along each row) written out.
    open: String.raw`\mathbf o_i = \sum_{j} \frac{\exp(\mathbf q_i^{\top}\mathbf k_j / \sqrt{d})}{\sum_{l} \exp(\mathbf q_i^{\top}\mathbf k_l / \sqrt{d})}\, \mathbf v_j`,
  },
];
