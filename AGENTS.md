# AGENTS.md — Grid Tactics PWA

## 1. Project identity and source of truth

- Repository: `otomezon/grid-tactics-pwa`
- Intended product: an original, turn-based tactical SRPG playable in a smartphone browser and installable as a PWA.
- Product name remains provisional.
- Baseline design: [`docs/game-design.md`](docs/game-design.md), version 1.0 (2026-11-09), initial implementation proposal.
- PR #1–#34 are merged. Current implementation includes fort recovery, a data-driven chapter registry, validated chapter item rewards, chapter carry-over, next-chapter UI, chapter-aware save restoration, map-specific defeat conditions, static map-definition validation, saved-unit deployment roster validation, pre-battle deployment positioning, persistent campaign reserves/party selection, and validated JSON save export/import. PR #17 added read-only character details and owned-weapon inspection to deployment preparation. PR #18 extracted its inventory presentation mapping into a pure application helper with unit tests. PR #19 added Playwright browser coverage for deployment, local save restoration, enemy-phase progression, and mobile-width layout. PR #20 verified the production PWA manifest, service-worker control, and offline app-shell startup. PR #21 verified service-worker update activation, automatic reload, and IndexedDB save restoration after an additional offline reload. PR #22 merged the versioned JSON save export/import flow without changing IndexedDB or GameStateSnapshot save schemas. PR #23 added manually created local save backups with three rotating generations and confirmed restore. Its merge commit is `f283e38c67c4b4c822e47d93d54d7b7941b0abac`, currently at `main`. PR #25 added the class-promotion specification audit and decision register, PR #27 added the provisional balance worksheet, and PR #28 implemented the approved non-numeric baseline: promotion is limited to a unit before movement/action, consumes that unit's action, and no longer grants a promotion seal to fresh campaigns automatically. PR #28's merge commit is `c59c8afcf41a3b1f8e14f26747cf13f8af9c5a15`. PR #29 added regression coverage for promotion state preservation, all seven one-step paths, explicit chapter-reward gating and full-inventory rejection, and confirmation cancellation preserving autosave; its merge commit is `35cf355e4b642943208b3f3a56ee57f3fea9c0ca` (CI run #497: 22 test files / 142 tests and 11 Chromium E2E tests passed). PR #30 refreshed repository guidance and implementation-status documentation after PR #29; its merge commit is `bac853ed0b3c22c709c03015117f90675a96a8b7` (CI run #499: 22 test files / 142 tests and 11 Chromium E2E tests passed). PR #31 recorded that documentation synchronization; its merge commit is `c6b7fa9ac5ef0db575fc18359067f0733976215e`. PR #32 added CP-07 / CP-08 boundary tests for EXP 0 and 99, current HP 1 and full HP, and HP-bonus clipping at the configured cap without healing; its merge commit is `860e64130a754c056d970b11adf272ebca33b2fb` (CI run #503: 22 test files / 146 tests and 11 Chromium E2E tests passed). PR #33 synchronized the post-PR-32 documentation; its merge commit is `b04947dc3bee010b9e08ab408daf9be76b5a80e6` (CI run #505: 22 test files / 146 tests and 11 Chromium E2E tests passed). PR #34 added regression coverage ensuring that a later failure in a multi-entry chapter-reward batch leaves the input snapshot unchanged; its merge commit is `20c7ee2a440628d6ebf3ab197badc688a6ad56f4` (CI run #506: 22 test files / 147 tests and 11 Chromium E2E tests passed). Class bonus/cap values and the first explicit promotion-item reward remain undecided. Chapter-specific minimum/maximum party rules remain undefined. Chapter 2 is explicitly prototype content; reward values, protagonist identity, and final campaign map data remain product decisions.
- Source and tests prove current implementation, not final balance. Distinguish design proposal, temporary prototype choice, inference, and product decision.

## 2. Critical instructions

1. Read this file and [`docs/README.md`](docs/README.md) at task start.
2. Read relevant design sections and inspect actual source/tests.
3. Confirm branch, working-tree changes, repository status, and recent history before editing.
4. Do not invent final gameplay rules or balance values. Label temporary heuristics and fixtures as provisional.
5. Keep changes scoped; do not upgrade dependencies or add libraries without need.
6. Do not use protected characters, maps, dialogue, images, music, or other expressive material from existing SRPG franchises.

## 3. Current architecture

- `content`: terrain, test map/units, provisional weapon content, promotion paths/bonuses and promotion-item definitions.
- `domain/models`: serializable game state and save validation.
- `domain/movement`: terrain-cost reachability.
- `domain/combat`: weapon compatibility, formulas, forecast, deterministic resolver, provisional Manhattan distance.
- `domain/random`: Xorshift32.
- `domain/rules`: battle outcome evaluation and fort recovery at faction phase start.
- `domain/progression`: experience threshold, deterministic level growth, and data-driven class promotion rules.
- `application`: player/enemy combat commands, class-promotion command, chapter reward command, next-chapter preparation, validated player deployment preparation, and deterministic enemy-phase resolution.
- `App.tsx`: chapter-aware prototype map UI, deployment preparation and read-only candidate details, battle forecast, phase-end control, results/rewards summary, next-chapter launch, inventory display, and class-promotion confirmation.
- `persistence`: IndexedDB, saveVersion 1／2→3 migration, versioned JSON save export/import, and three-generation local backup/restore.

See `docs/architecture.md`, `docs/combat.md`, and `docs/enemy-ai.md`.

## 4. Gameplay invariants

- Fully turn-based; no time limits.
- Initial map target is typically 10×10; movement is orthogonal (four directions), one unit per tile.
- A unit normally acts once per faction phase; no post-attack remount/re-move.
- Terrain effects belong in data definitions.
- Sword/lance/axe triangle modifies hit by ±20 points; bows and magic are outside the triangle in the initial proposal.
- Combat forecast and resolution share `src/domain/combat/`.
- Follow-up threshold proposal is speed difference 4; critical damage is 3×.
- Map objective is data-driven (`defeat_all` or `defeat_boss`).
- Game state is serializable plain data.
- UI actions go through validated application/domain commands.
- Xorshift32 state is persisted as non-zero 32-bit `rngState`; do not change without migration/tests.
- saveVersion is 3; preserve version 1 and version 2 migration tests.
- Enemy IDs are processed in stable lexical order. Current AI score and Manhattan distance are provisional, not approved final rules.

## 5. Coding and design rules

- Keep domain independent from React/DOM/IndexedDB.
- Keep content separate from algorithms.
- Validate data boundaries and save versions.
- Make touch operation primary; use non-color cues alongside map highlights.
- Guard input during save/phase transitions.
- Never silently change save format; add explicit migration.
- Do not treat absent role tags or a missing protagonist identifier as if implemented.

## 6. Security and content

- Never commit secrets or real environment values.
- No analytics, accounts, telemetry, remote sync, or external services without approval.
- Treat save/content data as untrusted and validate it.
- Do not claim encryption, backup, or tamper resistance unless implemented.
- Create original worldbuilding and assets.

## 7. Workflow

### Start
1. Read `AGENTS.md` and `docs/README.md`.
2. Read relevant requirements and current-state docs.
3. Inspect branch, recent commits, package scripts, source, tests, and open Issues/PRs.
4. Identify save compatibility, risks, acceptance criteria, and unresolved choices.

### Implement
- Use dedicated `feature/`, `fix/`, `refactor/`, `docs/`, or `chore/` branch.
- Preserve existing save compatibility; add migration if schema changes.
- Add deterministic tests for gameplay and AI edge cases.
- Do not silently settle open product decisions.

### Verify and finish
- Use scripts actually defined in `package.json`.
- Run typecheck, tests, and build; report exact outcomes.
- If not run, state why.
- Inspect diff and update the owning docs.
- Open a reviewable PR with scope, tests, risks, docs, and unresolved items. Do not merge without user approval.

## 8. Documentation ownership

- `game-design.md`: supplied proposal; preserve original.
- `architecture.md`: module boundaries and data flow.
- `combat.md`: combat calculations and unresolved combat rules.
- `enemy-ai.md`: phase progression, AI scoring, outcomes, and open decisions.
- `progression.md`: EXP rewards, growth checks, provisional stat caps, and stage results.
- `class-promotion.md`: class-promotion design basis, unresolved decisions, save compatibility, and implementation plan.
- `class-promotion-balance-worksheet.md`: unapproved class stat-cap / promotion-bonus / movement / weapon worksheet and playtest record.
- `development.md`: confirmed commands and CI.
- `database.md`: IndexedDB schema and migrations.
- `current-state.md`: feature/test status.
- `design-reconciliation.md`: proposal/implementation differences.
- `README.md`: documentation index.
