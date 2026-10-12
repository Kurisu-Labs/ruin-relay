# Integrated 3D branch validation

Verified at 2026-10-11T17:03:00.889080+00:00, before push. Tested source commit: `6ce30a1917b3e19a9230e5bf2a0a1839ede4c34f`.
Upstream main merged into this feature branch: `ff8602406391596e1214fd9e7eb93bae5191d7d6`.

- Production build/typecheck, formatting, contract tests and unit tests: passed.
- Browser: full integrated suite not completed; omitted from this push with `--skip-browser`.
- Phaser and its atlases are removed. Three.js remains lazy-loaded; WebGL 2 is required.
- These are local automated checks, not a new Sepolia transaction or a measurement of real-device mobile FPS.

Browser validation remains pending. Complete it before treating this branch as ready to merge. An interrupted or partial browser run is not counted as a pass.
Source, test scripts and configuration were held fixed during validation. The following commit only records this evidence.
