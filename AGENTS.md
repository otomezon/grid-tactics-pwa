# AGENTS.md — Grid Tactics PWA

## 1. Project identity and source of truth

- Repository: `otomezon/grid-tactics-pwa`
- Intended product: an original, turn-based tactical SRPG playable in a smartphone browser and installable as a PWA.
- Product name remains provisional.
- Baseline design: [`docs/game-design.md`](docs/game-design.md), version 1.0 (2026-11-09), initial implementation proposal.
- PR #1–#93 are merged; latest merge commit `5e545b734635436b4a55bda5e3696d8e02865139` (main CI run #1146 passed). PR #92 adds the launch/title flow, save hub, and third prototype chapter; PR #93 synchronizes the repository status docs. The current work branch adds one continuous three-chapter browser handoff test using prepared cleared-chapter snapshots. It does not simulate manual battles or establish balance evidence. Smartphone OS install/restore and physical-device interaction still require manual verification; Chromium E2E is not a substitute. Chapter 3 reuses existing units, weapons, battle rules, and provisional terrain data; do not present prototype content as final campaign, balance, story, or rewards. PR #90 exposes the existing movement-candidate score components read-only, preserving the candidate set/order, tie-break, phase resolution, GameUnit, and saveVersion. PR #86 extends the development-only 21-case promotion matrix with paired one-enemy-phase samples; the control branch waits while promotion spends the action, and the sample is not a multi-turn battle or alternative-player-action benchmark. PR #87 adds class-content tactical roles for ranged attackers and exposes target-priority rationale; PR #88 adds enemy movement rationale; PR #89 exposes existing attack-target score components for every legal candidate. The current work branch exposes the existing movement destination score components for all reachable candidates in a read-only comparison. Preserve the exact scoring formula, candidate set/order, Y→X tie-break, action resolution, phase order, and GameUnit/saveVersion. Role weights and all AI scoring remain provisional. Actual-play data is distinct from synthetic CI fixtures; CP-04 / 05 numeric values and first promotion-item reward content remain unresolved.
- Source and tests prove current implementation, not final balance. Distinguish design proposal, temporary prototype choice, inference, and product decision.
- Deployment-slot terrain inspection is limited to existing configured playerDeployment coordinates and existing TERRAIN_DEFINITIONS. Show movement-type passability using the same terrain movementCost values already used by validation; if an assigned unit cannot enter the tile, warn but do not invent a new placement rule or auto-correct the assignment.
- The deployment formation preview is a view of the current selected roster and slot assignments. The existing position dropdown remains the sole editing path; occupied preview tiles may open candidate details, but the preview must not invent slots or alter party/deployment rules.
- The player-phase end review is optional UI only: keep the existing ability to end a phase with unacted allies, reuse the existing enemy forecast and unit-selection handlers, and do not persist review state or alter saveVersion.

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
- `domain/movement`: terrain-cost reachability and deterministic lowest-cost route reconstruction.
- `domain/combat`: weapon compatibility, formulas, forecast, deterministic resolver, provisional Manhattan distance, and projected enemy threat range.
- `domain/random`: Xorshift32.
- `domain/rules`: battle outcome evaluation and fort recovery at faction phase start.
- `domain/progression`: experience threshold, deterministic level growth, and data-driven class promotion rules.
- `application`: player/enemy combat commands, battle-result detail projection, class-promotion command, chapter reward command, next-chapter preparation, validated player deployment preparation, deterministic enemy-phase resolution, registered-ID-based item-use commands, grouped inventory-stack projection, and read-only battle objective / terrain inspection projections.
- `src/components/operation-guide.tsx`: accessible, responsive, six-step operation guide; keep it explanatory only and do not introduce game-state effects.
- `src/components/enemy-target-evaluations.tsx` and `src/components/enemy-movement-evaluations.tsx`: collapsible, read-only explanations of the actual enemy resolver candidate scores. Reuse returned score breakdowns; do not calculate alternate AI decisions in UI.
- `src/components/campaign-title-screen.tsx`: startup hub for new/continued campaigns, JSON save import/export, and local backup creation/restoration. New campaign setup must not replace the previous auto-save until deployment is explicitly confirmed.
- `App.tsx`: chapter-aware prototype map UI with live victory/defeat objective progress and focused-tile terrain details (existing costs/modifiers only; view-only), chronological in-session battle history from resolved attacks and enemy-phase actions (not persisted), deployment preparation and read-only candidate details, battle forecast, results/rewards summary with enemy roster and surviving-player details, next-chapter launch, inventory display, class-promotion confirmation with an eight-stat preview, HP/EXP outcomes, item/action cost, and preserved movement/weapon/equipment details, plus a player-phase enemy threat-range toggle with accessible map overlays, transient movement-cost and route previews on reachable tiles, a transient enemy-phase action report derived from `EnemyPhaseResult.actions`, and a transient player-attack strike report derived from `AttackExecution`. Neither report is saved; the enemy-phase report is regenerated when an enemy-phase checkpoint is resumed. The preview shares the domain calculation with the promotion command; all numeric values remain provisional and do not settle CP-15.
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
- Make touch operation primary; narrow-screen map tiles keep a 40px minimum target through horizontal scrolling. Keep the map viewport keyboard-focusable and use non-color cues alongside map highlights.
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
- Bundle related implementation, tests, and documentation into one reviewable change. Avoid separate PRs for trivial follow-up or documentation-only synchronization; update the owning docs with the substantive feature.
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


- A player-unit inspector may project only existing snapshot/content values for living allies at `inspectedPosition`. It is read-only: inspection must not change equipment, use items, execute combat, mutate GameState/RNG, save, or alter saveVersion. Preserve unknown inventory IDs in display projections rather than silently discarding them.

- The transient battle history records only completed player commands (movement, weapon change, item use, class change, wait), executed player attacks, and resolved enemy phases in chronological sequence. Movement previews, inspection, selection, forecast, and confirmation cancellation are not events. Keep it in session UI state only; do not add it to GameStateSnapshot, IndexedDB, save files, or saveVersion.


- Development-only class promotion routes: /?promotion-lab=1 uses deterministic synthetic test fixtures; /?promotion-snapshots=1 reads only user-selected v3 portable save exports in ephemeral browser memory, validates them against registered chapter maps, and simulates promotion only on a detached in-memory copy. Never add file contents to IndexedDB, network requests, analytics, persistent storage, or live GameState. A missing promotion seal may be added only to the detached comparison copy and must be labelled test-only; this does not define or grant a chapter reward.


- Development-only promotion combat comparison: `/?promotion-snapshots=1` may run isolated fixed-seed combat samples from user-selected valid save exports only. Control and promotion branches must receive the same deterministic seed per paired sample; each sample starts from a fresh detached copy of the original snapshot, and no HP/EXP/defeat state may carry over between trials. Use existing `performAttack` logic without changing combat formulas. Respect CP-12: promotion's action remains consumed in the promotion result; only the detached sample copy may model the next player action opportunity. Label the 20/100/250 sample aggregation as repeated isolated single-exchange evidence, not full battle, chapter win rate, or real-play result. Never persist imported content or sample results, send them over the network, or treat synthetic fixtures as actual playtest data.


- Development-only promotion playtest matrix: `/?promotion-snapshots=1` may suggest one low-rank, median-rank, and upper-rank unit candidate for each of the seven basic classes only when at least three candidates exist for that class. Percentiles are average mid-ranks across eight stats and are candidate-selection aids, not growth rates or cap-proximity tests. Require a human to confirm each case's candidate, enemy, and conditions before running the 21-case isolated sample matrix. Candidate profile assignments may be overridden; no class with fewer than three candidates may be silently filled by synthetic values. The per-case data type must remain explicit (unconfirmed, user-declared actual play, or synthetic), and a user-declared actual-play source is not independently verified. CSV output occurs only on explicit download. Never persist/import save files or sample results to IndexedDB/GameState/autosave, never send them over the network, and never treat synthetic/unknown fixtures as actual playtest evidence or numeric balance approval.


- Development-only promotion enemy-phase sample (PR #86 work): reuse `beginEnemyPhase` and `runEnemyPhase` on detached copies only. Pair control/promotion with the same deterministic seeds and require matching chapter/map, saveVersion, player phase, turn, start RNG, target unit HP/EXP/position/movement/weapon context, other units, and reserves. Control spends the action by waiting; promotion retains the action consumed by `performClassChange`. This is a one-enemy-phase comparison with provisional AI, not an alternative-action benchmark, full battle, or campaign simulation. Keep snapshots/results memory-only and add no GameState / IndexedDB / autosave / network writes. Label the sample limits in UI, CSV, tests, and docs.
