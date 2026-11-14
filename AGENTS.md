# AGENTS.md — Grid Tactics PWA

## 1. Project identity and source of truth

- Repository: `otomezon/grid-tactics-pwa`
- Intended product: an original, turn-based tactical SRPG playable in a smartphone browser and installable as a PWA.
- Product name remains provisional.
- Baseline design: [`docs/game-design.md`](docs/game-design.md), version 1.0 (2026-11-09), initial implementation proposal. PR #1–#119, PR #121, PR #123–#125, and PR #127–#134 are merged; PR #119 adds the manual smartphone/PWA verification checklist; PR #121 commits npm lockfile v3 and standardizes CI/setup on `npm ci`; PR #123 synchronizes the current-state audit snapshot; PR #124 adds an iPhone-sized WebKit mobile-emulation project; PR #125 adds two-tap mobile movement coverage; PR #127 adds narrow-width map scrolling and touch-selection coverage; PR #128 makes event acknowledgement wait for its IndexedDB save and fixes vertical positioning in the narrow WebKit map test; PR #129 verifies a two-tap move at the 320px WebKit map's right edge; PR #130 adds Chromium keyboard-accessibility coverage for the pending event dialog; PR #131 defers event-dialog initial focus and adds WebKit touch coverage; PR #132 completes focus timing, restoration, and keyboard-history coverage; PR #114 adds player-operated one-shot map-location interactions and PR #115 adds validated map-event recruitment. PR #116 adds persistent branching dialogue choices; PR #117 adds a save-file round-trip regression test for selected choices and synchronizes the saveVersion 7 documentation; PR #133 adds three-chapter WebKit mobile continuity coverage; PR #134 adds WebKit mobile PWA offline-shell and offline battle-save resume coverage; PR #136 adds a read-only campaign-choice history panel with chapter/source ID fallback. PR #99 added campaign-persistent per-ally battle records, PR #100 centralized the fourteen adopted class IDs and seven promotion paths, and PR #101 hardened the immutability of the compatibility projections. PR #102 established player-command boundaries and map events, PR #103–#105 added persisted event acknowledgement and current-chapter event history, PR #106 expanded the player phase-end risk review, PR #107 added strike-by-strike enemy attack forecast details, PR #108 added enemy-action map previews, PR #109 configured the prototype protagonist-defeat and Chapter 1 boss objectives, PR #110 added UI-only return-to-title navigation from results, and PR #111 aligned browser E2E fixtures with the Chapter 1 boss and protected-protagonist rules. Preserve the distinction between approved non-numeric promotion policy and unapproved numeric values; do not invent class caps, bonuses, movement, or weapon-access data.
- Source and tests prove current implementation, not final balance. Distinguish design proposal, temporary prototype choice, inference, and product decision.
- Battle result screens may return to the campaign title without clearing or rewriting the current save. Keep this navigation as a UI-only state change; the title screen's continue action must restore the same victory/defeat result.
- Deployment-slot terrain inspection is limited to existing configured playerDeployment coordinates and existing TERRAIN_DEFINITIONS. Show movement-type passability using the same terrain movementCost values already used by validation; if an assigned unit cannot enter the tile, warn but do not invent a new placement rule or auto-correct the assignment.
- The deployment formation preview is a view of the current selected roster and slot assignments. The existing position dropdown remains the sole editing path; occupied preview tiles may open candidate details, but the preview must not invent slots or alter party/deployment rules.
- The player-phase end review is optional UI only: keep the existing ability to end a phase with unacted allies, reuse the existing enemy forecast and unit-selection handlers, and do not persist review state or change the save schema.

## 2. Critical instructions

1. Read this file and [`docs/README.md`](docs/README.md) at task start.
2. Read relevant design sections and inspect actual source/tests.
3. Confirm branch, working-tree changes, repository status, and recent history before editing.
4. Do not invent final gameplay rules or balance values. Label temporary heuristics and fixtures as provisional.
5. Keep changes scoped; do not upgrade dependencies or add libraries without need.
6. Do not use protected characters, maps, dialogue, images, music, or other expressive material from existing SRPG franchises.

## 3. Current architecture

- `content`: terrain, test map/units, provisional weapon content, the typed fourteen-class registry (`class-definitions.ts`), promotion paths/bonuses, and promotion-item definitions. Class movement and weapon access remain on the saved unit until CP-09／10 data is approved.
- `domain/models`: serializable game state and save validation.
- `domain/movement`: terrain-cost reachability and deterministic lowest-cost route reconstruction.
- `domain/combat`: weapon compatibility, formulas, forecast, deterministic resolver, provisional Manhattan distance, and projected enemy threat range.
- `domain/random`: Xorshift32.
- `domain/rules`: battle outcome evaluation and fort recovery at faction phase start.
- `domain/progression`: experience threshold, deterministic level growth, and data-driven class promotion rules.
- `application`: player/enemy combat commands, battle-result detail projection, class-promotion command, chapter reward command, next-chapter preparation, validated player deployment preparation, deterministic enemy-phase resolution, registered-ID-based item-use commands, grouped inventory-stack projection, and read-only battle objective / terrain inspection projections.
- `src/components/operation-guide.tsx`: accessible, responsive, six-step operation guide; keep it explanatory only and do not introduce game-state effects.
- `src/components/enemy-target-evaluations.tsx` and `src/components/enemy-movement-evaluations.tsx`: collapsible, read-only explanations of the actual enemy resolver candidate scores. `src/components/enemy-attack-forecast-details.tsx` renders the chosen enemy attack plan’s existing strike forecast. Reuse returned values; do not calculate alternate AI decisions or combat forecasts in UI.
- `src/components/campaign-title-screen.tsx`: startup hub for new/continued campaigns, JSON save import/export, and local backup creation/restoration. New campaign setup must not replace the previous auto-save until deployment is explicitly confirmed.
- `App.tsx`: chapter-aware prototype map UI with live victory/defeat objective progress and focused-tile terrain details (existing costs/modifiers only; view-only), detailed in-session battle reports from resolved attacks and enemy-phase actions, plus a separate persisted campaign battle log of confirmed actions and actual strike outcomes, deployment preparation and read-only candidate details, battle forecast, results/rewards summary with enemy roster and surviving-player details, next-chapter launch, inventory display, class-promotion confirmation with an eight-stat preview, HP/EXP outcomes, item/action cost, and preserved movement/weapon/equipment details, plus a player-phase enemy threat-range toggle with accessible map overlays, transient movement-cost and route previews on reachable tiles, a transient enemy-phase action report derived from `EnemyPhaseResult.actions`, and a transient player-attack strike report derived from `AttackExecution`. Neither report is saved; the enemy-phase report is regenerated when an enemy-phase checkpoint is resumed. The preview shares the domain calculation with the promotion command; all numeric values remain provisional and do not settle CP-15.
- `persistence`: IndexedDB schema version 1, saveVersion 1〜9→10 migration, versioned JSON save export/import, and three-generation local backup/restore.

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
- saveVersion is 10; preserve migration tests for versions 1 through 9.
- Enemy IDs are processed in stable lexical order. Current AI score and Manhattan distance are provisional, not approved final rules.
- In the current prototype campaign content, `unit_001` is the protected protagonist in all three chapters; Chapter 1 uses `enemy_005` as its `defeat_boss` target. These IDs and display labels are prototype content, not finalized character/story decisions. Preserve the map defeat condition when authoring prototype chapter variants; do not add save fields for it.

## 5. Coding and design rules

- Keep domain independent from React/DOM/IndexedDB.
- Keep content separate from algorithms.
- Validate data boundaries and save versions.
- Make touch operation primary; narrow-screen map tiles keep a 40px minimum target through horizontal scrolling. Keep the map viewport keyboard-focusable and use non-color cues alongside map highlights.
- CI includes an iPhone 13-sized WebKit mobile-emulation smoke test for touch-driven deployment details at 390px and 320px widths, plus two-tap map movement with autosave invariants. The WebKit mobile project also verifies the cached PWA shell opens offline at 320px and a committed battle autosave can be resumed after an offline reload using touch input. Treat these only as WebKit engine coverage; never report them as physical iOS Safari, PWA installation, standalone-mode, OS lifecycle, or physical-device offline verification.
- The 320px WebKit mobile E2E also exercises the two-tap move at the map's right edge after horizontal scrolling; this remains browser emulation, not physical-device verification.
- Pending map-event dialog initial focus must be applied only after its actions become enabled (the acknowledgement save may initially disable them), and deferred until the opening click's default action has completed. After the final pending event is acknowledged, return focus to the map viewport. E2E must cover initial focus, Tab/Shift+Tab focus containment, Escape/backdrop non-dismissal, unchanged autosave until explicit acknowledgement, focus restoration, and event-history keyboard dismissal.
- The WebKit mobile project may emulate a 320px viewport and touch input, but it does not prove physical iOS Safari, installed-PWA, standalone, OS lifecycle, or real-device offline behavior.
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
- Display growth rates directly from UnitGrowthRates as per-level probabilities, with a clear note that capped stats do not increase. Do not present expected/guaranteed gains or alter applyExperience, RNG consumption, class caps, or saveVersion when adding growth UI.
- Deployment loadout changes may equip only owned, registered, class/type-compatible weapons or unequip with null. Apply them to active and reserve player candidates as an in-memory pre-deployment edit; never persist before the existing explicit deployment-confirmation path. The editor itself does not change the GameState schema; persist using the current saveVersion.
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
- `development.md`: confirmed commands, committed npm lockfile, reproducible install, and CI.
- `smartphone-verification.md`: manual smartphone/PWA verification scenarios and evidence record.
- `database.md`: IndexedDB schema and migrations.
- `current-state.md`: feature/test status.
- `design-reconciliation.md`: proposal/implementation differences.
- `README.md`: documentation index.


- Enemy action logs may carry the selected `AttackPlan.forecast` as ephemeral data. Render its strike values consistently in the enemy-phase forecast, phase-end review, and in-session battle history; never store the forecast in GameStateSnapshot or recompute a separate forecast in UI.
- Enemy forecast / phase-end review action selection may focus the corresponding source tile, selected destination, and target on the map using the existing action log plus the current pre-phase unit positions. This is a read-only, transient visualization: do not infer or draw a movement route, recalculate an AI action, execute input, or persist selection state. Clear it on normal map/unit interaction or GameState change.

- A player-unit inspector may project only existing snapshot/content values for living allies at `inspectedPosition`. It is read-only: inspection must not change equipment, use items, execute combat, mutate GameState/RNG, save, or alter saveVersion. Preserve unknown inventory IDs in display projections rather than silently discarding them.

- The detailed transient battle report may show forecasts and AI evaluations for the current session only. Separately, `GameStateSnapshot.campaignBattleLog` stores only committed player commands, actual player-attack strike outcomes, and resolved enemy actions/actual strike outcomes in a monotonic campaign sequence. Never persist forecasts, hit-rate predictions, AI candidate scores/evaluations, previews, inspections, selection, or cancelled commands. Keep the durable log bounded to 5,000 entries, retain it across chapter transitions, JSON save files, and local backups, and derive defeater counts only from actual strikes that reduce a target from positive HP to zero. Older saves receive an empty log; do not infer historical actions.


- Development-only class promotion routes: /?promotion-lab=1 uses deterministic synthetic test fixtures; /?promotion-snapshots=1 reads only user-selected v7 portable save exports in ephemeral browser memory, validates them against registered chapter maps, and simulates promotion only on a detached in-memory copy. Never add file contents to IndexedDB, network requests, analytics, persistent storage, or live GameState. A missing promotion seal may be added only to the detached comparison copy and must be labelled test-only; this does not define or grant a chapter reward.


- Development-only promotion combat comparison: `/?promotion-snapshots=1` may run isolated fixed-seed combat samples from user-selected valid save exports only. Control and promotion branches must receive the same deterministic seed per paired sample; each sample starts from a fresh detached copy of the original snapshot, and no HP/EXP/defeat state may carry over between trials. Use existing `performAttack` logic without changing combat formulas. Respect CP-12: promotion's action remains consumed in the promotion result; only the detached sample copy may model the next player action opportunity. Label the 20/100/250 sample aggregation as repeated isolated single-exchange evidence, not full battle, chapter win rate, or real-play result. Never persist imported content or sample results, send them over the network, or treat synthetic fixtures as actual playtest data.


- Development-only promotion playtest matrix: `/?promotion-snapshots=1` may suggest one low-rank, median-rank, and upper-rank unit candidate for each of the seven basic classes only when at least three candidates exist for that class. Percentiles are average mid-ranks across eight stats and are candidate-selection aids, not growth rates or cap-proximity tests. Require a human to confirm each case's candidate, enemy, and conditions before running the 21-case isolated sample matrix. Candidate profile assignments may be overridden; no class with fewer than three candidates may be silently filled by synthetic values. The per-case data type must remain explicit (unconfirmed, user-declared actual play, or synthetic), and a user-declared actual-play source is not independently verified. CSV output occurs only on explicit download. Never persist/import save files or sample results to IndexedDB/GameState/autosave, never send them over the network, and never treat synthetic/unknown fixtures as actual playtest evidence or numeric balance approval.


- Development-only promotion enemy-phase sample (PR #86 work): reuse `beginEnemyPhase` and `runEnemyPhase` on detached copies only. Pair control/promotion with the same deterministic seeds and require matching chapter/map, saveVersion, player phase, turn, start RNG, target unit HP/EXP/position/movement/weapon context, other units, and reserves. Control spends the action by waiting; promotion retains the action consumed by `performClassChange`. This is a one-enemy-phase comparison with provisional AI, not an alternative-action benchmark, full battle, or campaign simulation. Keep snapshots/results memory-only and add no GameState / IndexedDB / autosave / network writes. Label the sample limits in UI, CSV, tests, and docs.

- Battle contribution summaries must be derived only from actual player-initiated attack reports. Match strike actor IDs to the initiating ally to exclude enemy counters. Never infer kills, damage, or hit outcomes from forecasts or incomplete persisted snapshots; report no data when the session history is absent.
- Deployment candidate comparison is a read-only view over the existing chapter candidate roster, including active and reserve units. Keep its selection local to the comparison component; do not mutate member selection, assignments, loadouts, GameState, IndexedDB, or saveVersion. Do not turn numeric comparisons into an invented unit ranking.
- Campaign unit battle records are persistent aggregates, not event logs. Validate unique registered player IDs and non-negative counts, update them only from actual player-initiated attack execution, copy them into the next chapter state, and preserve them through JSON save and backup. Version 1/2/3 migrations initialize an empty record list; never fabricate past statistics.

## プレイヤー操作の実装境界

- App/UIイベントハンドラー内で `GameStateSnapshot` のユニット配列を直接更新しない。移動・武器変更・待機を含む確定操作は `src/application/` のcommandへ委譲する。
- commandは入力snapshotを不変に保ち、合法性検証と次状態の生成を担う。UI側はプレビュー・確認・履歴・保存・表示を担当する。
- 移動のUIプレビューは最終確定の根拠にせず、commandでも地形・占有・移動力を再検証する。

- Map events are map-local content (`GameMapDefinition.events`). Supported one-shot triggers are stage start, exact turn/phase start, deployed-unit defeat, boss defeat, victory, defeat, `unit-interacts` on one registered map tile (optionally restricted to a player unit ID), and `event-choice` matching a selected option on a `show-choice` event. Interaction locations have unique coordinates and must not overlap initial deployments. Resolve matching events in content order and persist their IDs in `GameStateSnapshot.firedMapEventIds`; do not re-fire them after reload, JSON import, backup restore, or within the same chapter. New chapter templates start with an empty event ID list.
- Fired map-event messages remain pending until the player explicitly acknowledges them. Persist acknowledgement IDs in `GameStateSnapshot.acknowledgedMapEventIds`; validate them as a unique subset of fired IDs. Rebuild pending message text from the active map definition and persisted fired IDs so reload/import/backup restore can display it without copying message text into the save. Preserve event firing order using the persisted fired-ID sequence.
- Block battle input and next-chapter transition while a map-event message is pending. Use an accessible modal dialog with a visible acknowledgement control; do not dismiss on Escape/backdrop click. When an enemy-phase-start event is pending, save the enemy-phase checkpoint but do not run enemy AI until the last pending message is acknowledged. On v5→v6 migration, treat existing fired IDs as acknowledged because v5 did not persist whether transient status messages had been read; never replay old events as a side effect of migration. Browser E2E also protects the keyboard contract: focus starts on the explicit action, Tab/Shift+Tab stay within the dialog, and Escape does not acknowledge or close the pending event.
- Run stage-start and initial player turn-start only after deployment confirmation succeeds. Resolve later turn/phase, defeat, boss, and outcome triggers only from committed state transitions. Do not fire events for previews, selection, inspection, forecasts, cancellation, invalid commands, or uncommitted UI state.
- Every map event action has a message that is acknowledged before battle input resumes. Supported actions are `show-message`, `show-choice` with 2–4 unique labelled options, `grant-item` to a living deployed ally, `spawn-reinforcement` for a predeclared enemy GameUnit, and `recruit-unit` for a validated CampaignUnit. A selected option is recorded in `mapEventChoices`; only branch events whose `event-choice` trigger exactly matches that recorded selection may fire. A `show-choice` may also declare a unique `campaignChoiceKey`; its selection is recorded once in `campaignChoices` and carried to later chapters. Later chapter map events may use `condition: { type: "campaign-choice", key, choiceId }` to gate execution on that prior selection. Keep chapter-local `mapEventChoices` separate from campaign-wide choices, validate the key/source/choice references, and never author story branches or select choices without approved content. Do not acknowledge a choice event without selecting an option. Validate item IDs, quantity 1–5, recipient identity, inventory capacity, reinforcement identity/faction/terrain/position, and occupied tiles. Apply actions in content order to a detached snapshot; if any action fails, reject the entire event transition without partially changing the caller's state or firing IDs. A `unit-interacts` command is available only to a living, not-yet-acted player unit standing on the registered tile during a playing player phase; movement beforehand is allowed, and the command consumes that unit's action only after the event effect succeeds. Failed event effects must not consume the actor's action or fire the event. Persist fired/acknowledged event IDs, selected event/choice IDs, campaign battle history, and ordinary GameState unit/inventory/action fields using saveVersion 10. Do not add any item/reinforcement content to existing prototype chapters, invent promotion rewards, or retroactively mark historical events as fired during save migration. Villages/chests/doors as independent map objects and authored dialogue/character content remain unsupported; generic recruitment and dialogue-choice event mechanics are implemented. Do not invent production character, story, or branch content.
- The event-history panel is a read-only projection of `getMapEventMessageHistory(state, map)`: show all fired event actions, including acknowledged ones, in persisted `firedMapEventIds` order. Rebuild text from active-map content; do not add save fields, timestamps, session history writes, inferred events, or untriggered story content. Keep the history scoped to the current chapter.


- WebKit mobile emulation tests must keep a 320px portrait map inside its own horizontal scroll container, preserve the 40px minimum tile target, allow selection of a right-edge unit after the map is scrolled, and prove that read-only selection leaves IndexedDB autosave unchanged. This is browser emulation evidence only, not physical-device Safari/PWA evidence.

- Browser E2E map-event acknowledgement must wait until the event ID is present in the IndexedDB auto-save `acknowledgedMapEventIds` before handling another dialog. Use the shared `e2e/helpers/map-events.ts`; it supports click or touch activation and must never auto-select `show-choice`.
- Narrow WebKit mobile map tests must scroll the map within `.map-viewport`, keep the page width within the CSS viewport, retain 40px minimum tile targets, and scroll the right-edge unit into vertical view before tapping. Read-only selection must leave the autosave unchanged.

- A 320px WebKit mobile regression test must exercise the two-tap move on the rightmost map column after scrolling the map container: the first tap displays a read-only path with byte-for-byte-equivalent autosave, and the second tap commits the destination and `hasMoved` state. Do not represent this as physical-device Safari validation.

- The campaign-choice history panel is a separate read-only projection of `GameStateSnapshot.campaignChoices`, not part of the current-chapter map-event history. Rebuild chapter title, speaker, prompt, and selected label only from the saved source IDs and registered `CHAPTERS` content. Preserve ledger order; never invent missing dialogue/labels, timestamps, or unselected events. When source content is no longer available, show the saved choice/source IDs as a fallback. Do not add GameState fields or modify saveVersion for this UI.


- The durable campaign battle log is a distinct record from aggregate `campaignUnitBattleRecords` and the detailed session-only `battleHistory`. Store only confirmed command facts and actual strike HP transitions, cap at 5,000 entries, preserve one global increasing sequence across chapters, and initialize it empty when migrating saveVersion 1–8 to 10; migration from v9 to v10 must preserve all recorded actions, strikes, and existing chapter results. Do not store forecasts, target/movement evaluations, AI scores, or timestamps.

- A terminal chapter result is a distinct `chapter-result` entry in `campaignBattleLog`. Derive it only from the existing `evaluateBattleOutcome` result and current map objective; record it once per chapter with outcome, objective type, reason (`objective-cleared`, `party-wiped`, or `protected-unit-defeated`), and exact living player/enemy counts. Do not change defeat/victory rules, rewards, or story content. The result must be persisted through the normal save path, restoration/import/backup recovery, and next-chapter preparation; later chapter entries keep the single global sequence. Never reconstruct results for historical chapters during migration. v9→v10 preserves the existing campaign log; v1–v8 initialize it empty.
