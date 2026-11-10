# AGENTS.md — Grid Tactics PWA

## 1. Project identity and source of truth

- Repository: `otomezon/grid-tactics-pwa`
- Intended product: an original, turn-based tactical SRPG playable in a smartphone browser and installable as a PWA.
- Product name remains provisional.
- Baseline design: [`docs/game-design.md`](docs/game-design.md), version 1.0 (2026-11-09), initial implementation proposal.
- PR #1–#18 are merged. Current implementation includes fort recovery, a data-driven chapter registry, validated chapter item rewards, chapter carry-over, next-chapter UI, chapter-aware save restoration, map-specific defeat conditions, static map-definition validation, saved-unit deployment roster validation, pre-battle deployment positioning, and persistent campaign reserves/party selection. PR #17 added read-only character details and owned-weapon inspection to deployment preparation. PR #18 extracted its inventory presentation mapping into a pure application helper with unit tests. The current follow-up adds Playwright browser coverage for deployment, local save restoration, and mobile-width layout. Chapter-specific minimum/maximum party rules remain undefined. Chapter 2 is explicitly prototype content; reward values, protagonist identity, and final campaign map data remain product decisions.
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
- `persistence`: IndexedDB and saveVersion 1／2→3 migration with campaign reserves.

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
- `development.md`: confirmed commands and CI.
- `database.md`: IndexedDB schema and migrations.
- `current-state.md`: feature/test status.
- `design-reconciliation.md`: proposal/implementation differences.
- `README.md`: documentation index.
