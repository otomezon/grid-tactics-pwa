# AGENTS.md — Grid Tactics PWA

## 1. Project identity and source of truth

- Repository: `otomezon/grid-tactics-pwa`
- Intended product: an original, turn-based tactical SRPG playable in a smartphone browser and installable as a PWA.
- The product name in the supplied design is the provisional name **Tactical SRPG PWA**. Treat naming as open until confirmed.
- The supplied baseline design is [`docs/game-design.md`](docs/game-design.md), version 1.0, dated 2026-11-09, status “initial implementation design proposal”.
- PR #1 (documentation baseline), PR #2 (PWA/map/movement prototype), and PR #3 (combat calculation kernel) are merged. The current branch connects combat forecast and attack resolution to the map UI, includes provisional weapon data, and upgrades saves to version 2. Enemy AI, enemy phase, progression, and campaign features remain unimplemented.
- Source code and tests evidence current implementation, not necessarily approved game balance. Preserve the distinction between design proposal, temporary prototype values, inference, and product decisions.

## 2. Critical instructions for AI agents

1. At the start of every task, read this file and [`docs/README.md`](docs/README.md).
2. Read relevant sections of [`docs/game-design.md`](docs/game-design.md), then inspect actual source and tests.
3. Confirm the active branch, working-tree changes, repository status, and recent history before editing. Preserve user changes.
4. Distinguish **confirmed implementation**, **design proposal**, **temporary prototype choice**, **inference**, and **unknown** in explanations and documentation.
5. Do not invent gameplay rules or final balance values. Temporary values may be used only when explicitly labeled as prototype fixtures and documented as unapproved.
6. Keep changes minimal and task-scoped. Do not perform broad refactors, upgrade dependencies, add libraries, or change behavior unless required.
7. Do not use names, characters, dialogue, maps, images, music, or other protected expressive material from existing SRPG franchises.

## 3. Technology and architecture

The current scaffold uses Node.js 26, npm, React / React DOM 19.3.1, TypeScript 7.0.2, Vite 8.3.6, `@vitejs/plugin-react` 6.2.1, `vite-plugin-pwa` 2.0.0, Vitest 5.0.0, and browser IndexedDB. Direct dependency versions are pinned in `package.json`; no npm lockfile is present yet.

Current source boundaries:

- `content`: terrain, test map/units, and explicitly provisional sample weapons.
- `domain/models`: serializable game state, save validation.
- `domain/movement`: terrain-cost reachability.
- `domain/combat`: weapon compatibility, formulas, range checks, forecast, deterministic resolver, and provisional Manhattan grid distance.
- `domain/random`: Xorshift32 seed/state and combat-roll generation.
- `application`: validated gameplay commands, currently `perform-attack.ts`.
- `ui`: temporary React screen in `src/App.tsx`.
- `persistence`: IndexedDB repository and saveVersion migrations.
- `pwa`: Vite plugin manifest, service worker, and static asset caching.

See [`docs/architecture.md`](docs/architecture.md) and [`docs/combat.md`](docs/combat.md) for detailed responsibilities and limitations.

## 4. Gameplay invariants

Unless a later approved decision changes them:

- Fully turn-based; no time limits or real-time action requirements.
- Initial map target is typically 10×10; movement is orthogonal (four directions), one unit per tile.
- A unit normally acts once per side's phase. No post-attack remount/re-move is planned for the initial version.
- Terrain movement, defense, and avoidance modifiers belong in data definitions, not scattered UI code.
- Sword/lance/axe triangle modifies hit by ±20 percentage points only; bows and magic are outside the triangle in the initial proposal.
- Combat calculations live in `src/domain/combat/` and are shared by forecast and resolution.
- Proposed follow-up threshold is speed difference 4; critical damage is 3× normal damage; weapon durability and personal skills are excluded from the initial version.
- Maps, deployments, objectives, and events should be data-driven.
- Game state is serializable plain data. Do not put DOM nodes or functions in persisted state.
- UI actions go through validated application/domain commands. Invalid commands must not mutate state.
- Randomness is reproducible through the persisted non-zero 32-bit `rngState`. The current implementation uses Xorshift32; do not change the algorithm or save representation without tests and migration.
- `saveVersion` is currently 2. Keep legacy version 1 migration covered by tests.

Detailed proposals and exceptions are in `docs/game-design.md`; current implementation and unresolved choices are in `docs/current-state.md`, `docs/combat.md`, and `docs/design-reconciliation.md`.

## 5. Coding and design rules

- Follow existing repository conventions. Avoid new formatting, state-management, routing, or testing conventions without need.
- Keep domain logic independent from React and browser APIs.
- Keep balance values centralized in testable content or domain constants.
- Prefer deterministic functions for reachability, combat forecasts/resolution, growth, and victory evaluation.
- Validate map dimensions, terrain arrays, IDs, weapon compatibility, coordinates, and save versions at boundaries.
- Keep content separate from algorithms.
- Make touch operation primary; no essential action may depend on hover. Use non-color cues as well as color for selection/range.
- Guard input during saves/transitions to prevent duplicate actions.
- Never silently change established save formats. Add an explicit, tested migration.

## 6. Security, privacy, and content

- Never commit API keys, passwords, access tokens, private signing keys, or real `.env` values.
- Do not add analytics, accounts, remote sync, telemetry, or external services without approval.
- Treat imported/save data and content assets as untrusted; validate before use.
- Do not claim authentication, encryption, backup, or tamper resistance unless implemented and verified.
- Do not connect to or modify production systems, deploy, or delete user data without explicit authorization.
- Create original characters, maps, narrative, artwork, and audio.

## 7. Development workflow

### Start
1. Read `AGENTS.md` and `docs/README.md`.
2. Read relevant requirements and current findings.
3. Inspect Git status, branch, recent commits, manifests, source, tests, and relevant Issues/PRs.
4. Identify scope, impacted modules, compatibility implications, save/API changes, and acceptance criteria.
5. Record design decisions and unresolved questions before significant changes.

### Implement
- Use a dedicated work branch; normally use `feature/`, `fix/`, `refactor/`, `docs/`, or `chore/`.
- Keep commits focused. Do not normally commit directly to the default branch.
- Preserve backward compatibility; add migration when save shape changes.
- Add/update tests for behavior and edge cases. Seed RNG tests deterministically.
- Do not implement speculative open questions as final product rules.

### Verify and finish
- Discover scripts from `package.json`; do not assume commands.
- Run relevant tests, type checks, static analysis, and build. Report exact results.
- If a check cannot run, state why; never report it as passed.
- Inspect final diff for unrelated files, secrets, and generated artifacts.
- Update owning docs when behavior, architecture, save format, security assumptions, or feature status changes.
- Open a PR with purpose, scope, tests, impact, docs, and unresolved questions. Do not merge without user approval.

## 8. Documentation ownership

- `docs/game-design.md`: supplied product/gameplay design proposal; preserve its provenance and intent.
- `docs/architecture.md`: actual module boundaries, data flow, and target architecture.
- `docs/combat.md`: combat formulas, UI integration, prototype weapon values, range convention, and open rules.
- `docs/development.md`: confirmed setup/build/test/deploy instructions.
- `docs/database.md`: actual IndexedDB schema, saveVersion, and migrations.
- `docs/security.md`: verified controls and gaps.
- `docs/current-state.md`: feature and test status.
- `docs/design-reconciliation.md`: A/B/C/D comparison and decisions.
- `docs/README.md`: documentation index.

Update information in its owning document; avoid detailed duplication.

## 9. GitHub collaboration

- Use Issues for scoped tasks with context, acceptance criteria, tests, and references.
- Use branches and PRs for reviewable changes. Include rationale, files, tests, compatibility risks, docs, and unresolved questions.
- Respect repository settings.
- Do not close Issues, overwrite/delete branches, force-push, or merge PRs without authorization.
