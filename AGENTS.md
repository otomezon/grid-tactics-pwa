# AGENTS.md — Grid Tactics PWA

## 1. Project identity and source of truth

- Repository: `otomezon/grid-tactics-pwa`
- Intended product: an original, turn-based tactical SRPG playable in a smartphone browser and installable as a PWA.
- The product name in the supplied design is the provisional name **Tactical SRPG PWA**. Treat naming as open until confirmed.
- The supplied baseline design is [`docs/game-design.md`](docs/game-design.md), version 1.0, dated 2026-11-09, status “initial implementation design proposal”.
- **Initial repository audit (2026-11-09, before the documentation upload):** the repository contained no application source, package manifest, tests, CI, deployment configuration, README, or prior development rules. The baseline documentation was subsequently uploaded to `main` in commit [`11cda17`](https://github.com/otomezon/grid-tactics-pwa/commit/11cda17c71cc332ec5527737c9bafe2aaa3174ea). The repository now contains the documentation baseline. PR #1 (docs) and PR #2 (PWA/map prototype) are merged. The current combat branch adds a formula/forecast/resolution kernel under `src/domain/combat/`, but it is not yet connected to the gameplay UI, real weapon content, or persisted RNG state. Enemy AI, progression, and campaign features remain unimplemented.
- When implementation is added, source code, executable tests, configuration, and observed runtime behavior are evidence of current implementation. They do not automatically override intended product requirements. Record conflicts in `docs/design-reconciliation.md` and request a product decision where necessary.

## 2. Critical instructions for AI agents

1. At the start of every task, read this file and [`docs/README.md`](docs/README.md).
2. Read the relevant sections of [`docs/game-design.md`](docs/game-design.md), then inspect the actual source files and tests related to the task. Do not assume the proposed architecture already exists.
3. Confirm the active branch, working-tree changes, repository status, and recent history before editing. Preserve user changes.
4. Distinguish **confirmed implementation**, **design proposal**, **inference**, and **unknown** in explanations and documentation.
5. Do not invent gameplay rules, formulas, content, schemas, endpoints, environment variables, scripts, or deployment steps. Keep unresolved decisions unresolved and request a decision when they block safe implementation.
6. Keep changes minimal and task-scoped. Do not perform broad refactors, upgrade dependencies, add libraries, or change application behavior unless the task requires it.
7. Do not use names, characters, dialogue, maps, images, music, or other protected expressive material from existing SRPG franchises. The game must use original worldbuilding and assets, as required by the design.

## 3. Intended technology and architecture (proposal only)

The current Phase 0 scaffold uses Node.js 26 by `.nvmrc`, npm, React / React DOM 19.3.1, TypeScript 7.0.2, Vite 8.3.6, `@vitejs/plugin-react` 6.2.1, `vite-plugin-pwa` 2.0.0, Vitest 5.0.0, and browser IndexedDB. Direct dependency versions are pinned in `package.json`; no npm lockfile is present yet, so generate and commit `package-lock.json` on the first local install.

The current scaffold has `src/content`, `src/domain`, `src/persistence`, and a temporary React UI in `src/App.tsx`. The following is the intended separation; some layers remain planned:

- `content`: data definitions for characters, classes, weapons, terrain, maps, chapters, and events.
- `domain` / `engine`: movement, combat, progression, enemy AI, and victory/defeat rules.
- `application`: commands, phase progression, game orchestration, and save timing.
- `ui`: screens, map, menus, unit details, combat forecast, logs, and results.
- `persistence`: IndexedDB access, save repository, and save migrations.
- `pwa`: manifest, service worker, and offline asset caching.

Treat this as a target boundary, not a mandated directory tree. Inspect the actual code before choosing paths or introducing abstractions.

The current scripts are in `package.json`; see `docs/development.md`. Vitest tests are colocated with domain modules, and CI is configured in `.github/workflows/ci.yml`.

## 4. Gameplay invariants from the design baseline

Unless a later approved decision changes them:

- The core game is fully turn-based, without time limits or real-time action requirements.
- The initial map target is typically 10×10, with 12×12 as a guideline; movement is orthogonal (four directions), one unit per tile.
- A unit normally acts once per side's phase. No post-attack remount/re-move is planned for the initial version.
- Terrain movement, defense, and avoidance modifiers belong in data definitions, not scattered UI code.
- The sword/lance/axe triangle modifies hit by ±20 percentage points only; bows and magic are outside the triangle in the initial proposal.
- Combat calculations must be centralized in `src/domain/combat/` and shared by forecast and resolution. Do not duplicate formulas in UI components. The current resolver receives caller-supplied deterministic rolls and does not own or persist RNG state.
- The proposed follow-up threshold is a speed difference of 4; critical damage is 3× normal damage; weapon durability and personal skills are excluded from the initial version.
- Maps, deployments, objectives, and events should be data-driven rather than hard-coded into screen components.
- Game state should be serializable plain data. Do not place DOM nodes or functions in persisted game state.
- UI actions must go through validated application/domain commands. Invalid commands must not mutate game state.
- Randomness should be reproducible using persisted RNG state (or seed plus consumed position), separate from presentation effects.

The detailed proposed formulas, values, and exceptions are in `docs/game-design.md`. That file takes precedence over abbreviated reminders here, but neither document proves implementation.

## 5. Coding and design rules when code exists

- Follow existing repository conventions first. Do not introduce a new formatting, linting, state-management, routing, or testing convention without need.
- Keep domain logic independent from React and browser APIs where practical.
- Represent balance values (weapon triangle, follow-up threshold, terrain effects, growth rates, experience rewards, and combat formulas) in a central, testable location or validated data definitions.
- Prefer deterministic, pure functions for reachability, forecasts, damage, hit/critical checks, growth, and victory evaluation where possible.
- Validate map dimensions, terrain arrays, IDs, weapon compatibility, coordinates, and save versions at data boundaries.
- Keep content data separate from algorithms. Avoid per-stage conditionals in generic engine code.
- Make touch operation primary on phones; do not make any essential action dependent on hover. Use visible non-color cues for selection and range indications.
- Lock or guard input during animation/transition so repeated taps cannot execute duplicate actions.
- Do not silently alter established save formats. Add an explicit, tested migration when the save format changes.

## 6. Security, privacy, and content

- Never commit API keys, passwords, access tokens, private signing keys, or real `.env` values. Document variable names and safe setup instructions only after confirming them in code/config.
- Do not add analytics, accounts, remote synchronization, telemetry, or external services unless the user approves the product and privacy impact.
- Treat imported/save data and content assets as untrusted input. Validate structural invariants before use.
- Avoid unsafe HTML injection and unsafe dynamic script evaluation. Keep dependencies minimal and review service-worker/cache behavior.
- Do not claim authentication, encryption, backup, or tamper resistance unless implemented and verified.
- Do not connect to or modify production systems, deploy, delete user data, or change database contents without explicit authorization.
- Create original characters, maps, narrative, artwork, and audio. Do not reproduce existing game assets or expressive content.

## 7. Development workflow

### Start

1. Read `AGENTS.md` and `docs/README.md`.
2. Read relevant requirements in `docs/game-design.md` and current findings in `docs/current-state.md` / `docs/design-reconciliation.md`.
3. Inspect Git status, current branch, recent commits, project manifests, source, tests, and relevant GitHub Issues/PRs.
4. Identify scope, impacted modules, compatibility implications, data/save/API changes, and acceptance criteria.
5. For significant or ambiguous changes, write down the proposed approach and unresolved decisions before coding.

### Implement

- Use a dedicated work branch; follow any repository-specific branch convention if one is introduced. Otherwise use `feature/`, `fix/`, `refactor/`, `docs/`, or `chore/` prefixes.
- Keep commits focused and descriptive. Do not commit directly to the default branch as the normal workflow.
- Preserve backward compatibility unless a breaking change is explicitly approved.
- Add/update tests for changed logic and edge cases. For RNG-dependent tests, use deterministic seeds/state.
- Do not implement a speculative requirement merely because it appears as an open question in the design.

### Verify and finish

- Discover available scripts from the actual package manifest before running commands; do not assume `npm`, `pnpm`, `yarn`, or specific script names.
- Run relevant tests, type checks, lint/static analysis, and production build when available. Record exact commands and outcomes.
- If a check cannot run, state why; never report it as passed.
- Inspect the final diff and ensure unrelated application files, secrets, and generated artifacts are not included.
- Update the relevant docs when behavior, architecture, save format, API, security assumptions, or feature status changes.
- Open a PR with purpose, scope, tests, risk/impact, documentation changes, and unresolved items. Do not merge without user approval.

## 8. Documentation ownership

- `docs/game-design.md`: full supplied product/gameplay design proposal; preserve its provenance and do not silently rewrite its intent.
- `docs/architecture.md`: target architecture and observed architectural facts (clearly labeled).
- `docs/combat.md`: combat formula implementation, weapon model, deterministic roll interface, and unresolved gameplay decisions.
- `docs/development.md`: confirmed setup/build/test/deploy instructions only; mark unavailable details as unknown.
- `docs/database.md`: actual storage implementation when present; until then, only the proposed IndexedDB save model.
- `docs/security.md`: verified controls and explicitly identified gaps/risks.
- `docs/current-state.md`: feature-by-feature implementation/test status and evidence paths.
- `docs/design-reconciliation.md`: A/B/C/D comparison, open decisions, and discrepancies.
- `docs/README.md`: documentation index and ownership map.

Update each fact in its owning document rather than copying the same detailed information into multiple documents. Keep this file concise and point to the specialized documents.

## 9. GitHub collaboration

- Use Issues for scoped tasks/bugs with context, acceptance criteria, tests, and references.
- Use branches and PRs for reviewable changes. PR descriptions should include rationale, files, tests, compatibility/risks, docs, and unresolved questions.
- Respect repository settings and existing conventions when they become available.
- Do not close Issues, overwrite/delete branches, force-push, or merge PRs without authorization.
