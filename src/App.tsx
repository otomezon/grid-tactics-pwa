import { useEffect, useMemo, useState } from "react";
import { CHAPTER_01_MAP, INITIAL_GAME_STATE } from "./content/maps/chapter-01";
import { TERRAIN_DEFINITIONS } from "./content/terrain";
import { WEAPONS_BY_ID } from "./content/weapons";
import { performAttack, createAttackPlan } from "./application/perform-attack";
import { calculateReachableTiles } from "./domain/movement/calculate-reachable-tiles";
import { isWithinWeaponRange, canUnitUseWeapon } from "./domain/combat/combat";
import { calculateManhattanDistance } from "./domain/combat/grid-distance";
import type { GameStateSnapshot, Position } from "./domain/models/game";
import type { AttackPlan } from "./application/perform-attack";
import { createRandomSeed } from "./domain/random/xorshift32";
import { migrateGameStateSnapshot } from "./persistence/migrations";
import { loadGameState, saveGameState } from "./persistence/save-repository";

type SaveStatus = "loading" | "ready" | "saving" | "saved" | "unavailable" | "failed" | "invalid";

const SAVE_STATUS_LABELS: Record<SaveStatus, string> = {
  loading: "読み込み中",
  ready: "未保存",
  saving: "保存中",
  saved: "保存済み",
  unavailable: "保存機能を利用できません",
  failed: "保存に失敗",
  invalid: "保存データを確認してください"
};

function samePosition(left: Position, right: Position): boolean {
  return left.x === right.x && left.y === right.y;
}

function positionLabel(position: Position): string {
  return String(position.x + 1) + "列・" + String(position.y + 1) + "行";
}

function strikeKindLabel(kind: AttackPlan["forecast"]["strikes"][number]["kind"]): string {
  if (kind === "initial") return "先制攻撃";
  if (kind === "counter") return "反撃";
  return "追撃";
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "戦闘操作に失敗しました。";
}

export default function App() {
  const [gameState, setGameState] = useState<GameStateSnapshot>(INITIAL_GAME_STATE);
  const [selectedUnitId, setSelectedUnitId] = useState<string | null>(null);
  const [combatTargetId, setCombatTargetId] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("loading");
  const [message, setMessage] = useState("味方ユニットを選択してください。");
  const [loadBlocked, setLoadBlocked] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function restoreSave(): Promise<void> {
      try {
        const stored = await loadGameState();
        if (cancelled) return;

        if (stored === null) {
          setGameState({
            ...INITIAL_GAME_STATE,
            rngState: createRandomSeed()
          });
          setSaveStatus("ready");
          return;
        }

        const migration = migrateGameStateSnapshot(stored, CHAPTER_01_MAP);
        if (!migration) {
          setSaveStatus("invalid");
          setLoadBlocked(true);
          setMessage("保存データの形式またはマップが現在の版と一致しません。データ保全のため操作を停止しています。");
          return;
        }

        setGameState(migration.snapshot);
        if (migration.migrated) {
          setSaveStatus("saving");
          try {
            await saveGameState(migration.snapshot);
            if (!cancelled) {
              setSaveStatus("saved");
              setMessage("以前のセーブデータを新しい形式へ移行しました。");
            }
          } catch {
            if (!cancelled) {
              setSaveStatus("failed");
              setMessage("セーブデータは読み込みましたが、新形式への保存に失敗しました。次の行動時に再保存します。");
            }
          }
          return;
        }

        setSaveStatus("saved");
        setMessage("前回の自動保存データを復元しました。");
      } catch {
        if (!cancelled) {
          setSaveStatus("unavailable");
          setMessage("IndexedDBに接続できません。操作はできますが、自動保存は利用できません。");
        }
      }
    }

    void restoreSave();
    return () => {
      cancelled = true;
    };
  }, []);

  const selectedUnit = useMemo(
    () => gameState.units.find((unit) => unit.id === selectedUnitId) ?? null,
    [gameState.units, selectedUnitId]
  );

  const selectedWeapon = selectedUnit?.equippedWeaponId
    ? WEAPONS_BY_ID[selectedUnit.equippedWeaponId] ?? null
    : null;

  const reachableTiles = useMemo(() => {
    if (!selectedUnit || selectedUnit.faction !== "player" || selectedUnit.hasMoved || selectedUnit.hasActed) {
      return [];
    }

    return calculateReachableTiles({
      terrain: CHAPTER_01_MAP.terrain,
      start: selectedUnit.position,
      movementPoints: selectedUnit.move,
      movementType: selectedUnit.movementType,
      occupiedPositions: gameState.units
        .filter((unit) => unit.id !== selectedUnit.id)
        .map((unit) => unit.position)
    });
  }, [gameState.units, selectedUnit]);

  const interactive = saveStatus !== "loading" && saveStatus !== "saving" && !loadBlocked;
  const reachableKeys = useMemo(
    () => new Set(reachableTiles.map((tile) => String(tile.x) + "," + String(tile.y))),
    [reachableTiles]
  );

  const attackableKeys = useMemo(() => {
    if (
      !selectedUnit ||
      selectedUnit.faction !== "player" ||
      selectedUnit.hasActed ||
      !selectedWeapon ||
      !canUnitUseWeapon(selectedUnit, selectedWeapon)
    ) {
      return new Set<string>();
    }

    return new Set(
      gameState.units
        .filter((unit) => unit.faction === "enemy" && unit.currentHp > 0)
        .filter((unit) => {
          const distance = calculateManhattanDistance(selectedUnit.position, unit.position);
          return isWithinWeaponRange(distance, selectedWeapon);
        })
        .map((unit) => String(unit.position.x) + "," + String(unit.position.y))
    );
  }, [gameState.units, selectedUnit, selectedWeapon]);

  const combatPlan = useMemo(() => {
    if (!selectedUnit || !combatTargetId) return null;

    try {
      return {
        plan: createAttackPlan(gameState, CHAPTER_01_MAP, selectedUnit.id, combatTargetId),
        error: null as string | null
      };
    } catch (error) {
      return {
        plan: null as AttackPlan | null,
        error: getErrorMessage(error)
      };
    }
  }, [gameState, selectedUnit, combatTargetId]);

  async function persist(
    nextState: GameStateSnapshot,
    successMessage = "行動をIndexedDBに自動保存しました。"
  ): Promise<void> {
    setSaveStatus("saving");

    try {
      await saveGameState(nextState);
      setSaveStatus("saved");
      setMessage(successMessage);
    } catch {
      setSaveStatus("failed");
      setMessage("行動は画面に反映されましたが、セーブに失敗しました。ストレージ設定を確認してください。");
    }
  }

  async function handleTileClick(position: Position): Promise<void> {
    if (!interactive) return;

    const unitOnTile = gameState.units.find((unit) => samePosition(unit.position, position));
    if (unitOnTile) {
      if (unitOnTile.faction === "player") {
        if (unitOnTile.hasActed) {
          setSelectedUnitId(unitOnTile.id);
          setCombatTargetId(null);
          setMessage(unitOnTile.name + "は行動済みです。");
        } else {
          setSelectedUnitId(unitOnTile.id);
          setCombatTargetId(null);
          setMessage(unitOnTile.name + "を選択しました。青は移動可能、赤は攻撃可能な敵です。");
        }
        return;
      }

      if (!selectedUnit || selectedUnit.faction !== "player" || selectedUnit.hasActed) {
        setMessage("先に行動可能な味方ユニットを選択してください。");
        return;
      }

      try {
        createAttackPlan(gameState, CHAPTER_01_MAP, selectedUnit.id, unitOnTile.id);
        setCombatTargetId(unitOnTile.id);
        setMessage(unitOnTile.name + "への戦闘予測を表示しています。内容を確認して攻撃を確定してください。");
      } catch (error) {
        setCombatTargetId(null);
        setMessage(getErrorMessage(error));
      }
      return;
    }

    if (!selectedUnit || selectedUnit.faction !== "player" || selectedUnit.hasMoved || selectedUnit.hasActed) {
      setMessage("先に移動可能な味方ユニットを選択してください。");
      return;
    }

    if (!reachableKeys.has(String(position.x) + "," + String(position.y))) {
      setMessage("そのマスには移動できません。移動力・地形・他ユニットの位置を確認してください。");
      return;
    }

    const nextState: GameStateSnapshot = {
      ...gameState,
      units: gameState.units.map((unit) =>
        unit.id === selectedUnit.id ? { ...unit, position, hasMoved: true } : unit
      )
    };

    setGameState(nextState);
    setCombatTargetId(null);
    await persist(nextState, selectedUnit.name + "が" + positionLabel(position) + "へ移動しました。攻撃または待機を選択してください。");
  }

  async function handleWeaponChange(weaponId: string): Promise<void> {
    if (!selectedUnit || selectedUnit.hasActed || !interactive) return;

    const weapon = WEAPONS_BY_ID[weaponId];
    if (!weapon || !selectedUnit.inventory.includes(weaponId) || !canUnitUseWeapon(selectedUnit, weapon)) {
      setMessage("このユニットはその武器を装備できません。");
      return;
    }

    const nextState: GameStateSnapshot = {
      ...gameState,
      units: gameState.units.map((unit) =>
        unit.id === selectedUnit.id ? { ...unit, equippedWeaponId: weaponId } : unit
      )
    };

    setGameState(nextState);
    setCombatTargetId(null);
    await persist(nextState, selectedUnit.name + "は" + weapon.name + "を装備しました。");
  }

  async function handleAttack(): Promise<void> {
    if (!selectedUnit || !combatTargetId || !interactive || !combatPlan?.plan) return;

    try {
      const execution = performAttack(
        gameState,
        CHAPTER_01_MAP,
        selectedUnit.id,
        combatTargetId
      );
      const targetName = gameState.units.find((unit) => unit.id === combatTargetId)?.name ?? "敵";
      const log = execution.result.events.map((event) => {
        const actor = gameState.units.find((unit) => unit.id === event.attackerId)?.name ?? "ユニット";
        const outcome = !event.hit ? "ミス" : event.critical ? "必殺" : "命中";
        return actor + "の" + strikeKindLabel(event.kind) + "：" + outcome + "（" + event.damage + "ダメージ）";
      }).join(" / ");
      const defeated = execution.result.defenderHp <= 0;
      const successMessage = log + (defeated ? "。" + targetName + "を撃破しました。" : "。");
      setGameState(execution.nextState);
      setCombatTargetId(null);
      if (!execution.nextState.units.some((unit) => unit.id === selectedUnit.id)) {
        setSelectedUnitId(null);
      }
      await persist(execution.nextState, successMessage);
    } catch (error) {
      setCombatTargetId(null);
      setMessage(getErrorMessage(error));
    }
  }

  async function handleWait(): Promise<void> {
    if (!selectedUnit || !interactive || selectedUnit.hasActed) return;

    const nextState: GameStateSnapshot = {
      ...gameState,
      units: gameState.units.map((unit) =>
        unit.id === selectedUnit.id ? { ...unit, hasActed: true } : unit
      )
    };

    setGameState(nextState);
    setCombatTargetId(null);
    await persist(nextState, selectedUnit.name + "は待機しました。");
  }

  const selectedStatus = selectedUnit
    ? selectedUnit.hasActed
      ? "行動済み"
      : selectedUnit.hasMoved
        ? "移動済み"
        : "未行動"
    : null;

  const selectedInventoryWeapons = selectedUnit
    ? selectedUnit.inventory
        .map((weaponId) => WEAPONS_BY_ID[weaponId])
        .filter((weapon): weapon is NonNullable<typeof weapon> => Boolean(weapon))
    : [];

  return (
    <main className="app-shell">
      <header className="app-header">
        <div>
          <p className="eyebrow">TACTICAL SRPG · DEVELOPMENT BUILD</p>
          <h1>Grid Tactics</h1>
          <p className="subtitle">マップ・移動・戦闘予測・攻撃のプロトタイプ</p>
        </div>
        <div className="header-status">
          <span className="phase-badge">第{gameState.turn}ターン · 自軍フェイズ</span>
          <span className={"save-badge save-" + saveStatus}>{SAVE_STATUS_LABELS[saveStatus]}</span>
        </div>
      </header>

      <div className="prototype-notice">
        <strong>開発プロトタイプ</strong>
        <span>仮マップ・仮ユニット・仮武器を使用しています。敵AI、フェイズ進行、成長・キャンペーンはまだ実装していません。</span>
      </div>

      <div className="battle-layout">
        <section className="map-card" aria-labelledby="map-heading">
          <div className="section-heading">
            <div>
              <p className="eyebrow">CHAPTER 01 · TEST MAP</p>
              <h2 id="map-heading">試作マップ</h2>
            </div>
            <span className="map-size">10 × 10</span>
          </div>

          <div
            className="map-grid"
            style={{ gridTemplateColumns: "repeat(" + CHAPTER_01_MAP.width + ", minmax(0, 1fr))" }}
            aria-label="10列10行の戦闘マップ"
          >
            {Array.from({ length: CHAPTER_01_MAP.height }, (_, y) =>
              Array.from({ length: CHAPTER_01_MAP.width }, (_, x) => {
                const position = { x, y };
                const terrain = CHAPTER_01_MAP.terrain[y]?.[x] ?? "plain";
                const unit = gameState.units.find((candidate) => samePosition(candidate.position, position));
                const isSelected = unit?.id === selectedUnitId;
                const isReachable = reachableKeys.has(String(x) + "," + String(y));
                const isAttackable = attackableKeys.has(String(x) + "," + String(y));
                const isTargeted = unit?.id === combatTargetId;
                const classes = [
                  "map-tile",
                  "terrain-" + terrain,
                  unit ? "has-unit" : "",
                  isSelected ? "is-selected" : "",
                  isReachable ? "is-reachable" : "",
                  isAttackable ? "is-attackable" : "",
                  isTargeted ? "is-targeted" : ""
                ].filter(Boolean).join(" ");
                const ariaLabel = positionLabel(position) + "、" + TERRAIN_DEFINITIONS[terrain].label +
                  (unit ? "、" + unit.name : "") +
                  (isSelected ? "、選択中" : "") +
                  (isReachable ? "、移動可能" : "") +
                  (isAttackable ? "、攻撃可能" : "");

                return (
                  <button
                    className={classes}
                    key={String(x) + "-" + String(y)}
                    type="button"
                    aria-label={ariaLabel}
                    aria-pressed={Boolean(isSelected || isTargeted)}
                    disabled={!interactive}
                    onClick={() => void handleTileClick(position)}
                  >
                    <span className="terrain-mark" aria-hidden="true">
                      {TERRAIN_DEFINITIONS[terrain].symbol}
                    </span>
                    {unit && (
                      <span className={"unit-token unit-" + unit.faction} aria-hidden="true">
                        {unit.faction === "player" ? "味" : "敵"}
                      </span>
                    )}
                    {isReachable && <span className="move-marker" aria-hidden="true" />}
                    <span className="tile-coordinate" aria-hidden="true">
                      {x + 1},{y + 1}
                    </span>
                  </button>
                );
              })
            )}
          </div>

          <div className="map-legend" aria-label="マップ凡例">
            <span><i className="legend-swatch ally" />味方</span>
            <span><i className="legend-swatch enemy" />敵</span>
            <span><i className="legend-swatch move" />移動可能</span>
            <span><i className="legend-swatch attack" />攻撃可能</span>
            <span><i className="legend-swatch selected" />選択中</span>
          </div>
        </section>

        <aside className="side-panel">
          <section className="info-card">
            <p className="eyebrow">COMMAND</p>
            <h2>ユニット情報</h2>
            {selectedUnit ? (
              <>
                <div className="unit-heading">
                  <span className={"large-unit-token unit-" + selectedUnit.faction}>
                    {selectedUnit.faction === "player" ? "味" : "敵"}
                  </span>
                  <div>
                    <h3>{selectedUnit.name}</h3>
                    <p>Lv.{selectedUnit.level} · {selectedUnit.classId}</p>
                  </div>
                </div>
                <div className="unit-details">
                  <div><span>HP</span><strong>{selectedUnit.currentHp} / {selectedUnit.stats.hp}</strong></div>
                  <div><span>移動力</span><strong>{selectedUnit.move}</strong></div>
                  <div><span>移動種別</span><strong>{selectedUnit.movementType === "infantry" ? "歩兵" : "騎馬"}</strong></div>
                  <div><span>行動状態</span><strong>{selectedStatus}</strong></div>
                  <div><span>攻撃力</span><strong>{selectedUnit.stats.strength} / 魔力 {selectedUnit.stats.magic}</strong></div>
                </div>
                {selectedUnit.faction === "player" && (
                  <div className="weapon-select">
                    <label htmlFor="equipped-weapon">装備武器</label>
                    <select
                      id="equipped-weapon"
                      value={selectedUnit.equippedWeaponId ?? ""}
                      disabled={!interactive || selectedUnit.hasActed}
                      onChange={(event) => void handleWeaponChange(event.target.value)}
                    >
                      <option value="">未装備</option>
                      {selectedInventoryWeapons.map((weapon) => (
                        <option key={weapon.id} value={weapon.id}>{weapon.name}</option>
                      ))}
                    </select>
                    {selectedWeapon && <p className="helper-text">威力 {selectedWeapon.power} · 命中 {selectedWeapon.hit}% · 必殺 {selectedWeapon.critical}% · 射程 {selectedWeapon.minRange}-{selectedWeapon.maxRange}</p>}
                  </div>
                )}
                <div className="command-actions">
                  <button
                    className="primary-button"
                    type="button"
                    disabled={!interactive || selectedUnit.hasActed}
                    onClick={() => void handleWait()}
                  >
                    待機
                  </button>
                  <button
                    className="secondary-button"
                    type="button"
                    disabled={saveStatus === "saving"}
                    onClick={() => {
                      setSelectedUnitId(null);
                      setCombatTargetId(null);
                    }}
                  >
                    選択解除
                  </button>
                </div>
                <p className="helper-text">
                  {selectedUnit.hasActed
                    ? "このユニットは行動済みです。"
                    : selectedUnit.hasMoved
                      ? "移動済みです。赤く表示された敵をタップすると戦闘予測を確認できます。"
                      : "青いマスへ移動するか、赤い敵をタップして攻撃を選択できます。"}
                </p>
              </>
            ) : (
              <p className="empty-selection">マップ上の味方ユニットをタップして選択してください。</p>
            )}
          </section>

          {combatTargetId && (
            <section className="info-card combat-forecast-card" aria-labelledby="forecast-heading">
              <p className="eyebrow">COMBAT FORECAST</p>
              <h2 id="forecast-heading">戦闘予測</h2>
              {combatPlan?.plan ? (
                <>
                  <div className="forecast-header">
                    <strong>{gameState.units.find((unit) => unit.id === selectedUnitId)?.name} vs {gameState.units.find((unit) => unit.id === combatTargetId)?.name}</strong>
                    <span>距離 {combatPlan.plan.forecast.distance}</span>
                  </div>
                  <div className="forecast-strikes">
                    {combatPlan.plan.forecast.strikes.map((strike, index) => {
                      const actor = gameState.units.find((unit) => unit.id === strike.attackerId);
                      return (
                        <div className="forecast-strike" key={String(index) + "-" + strike.kind}>
                          <div className="forecast-strike-title">
                            <strong>{strikeKindLabel(strike.kind)}</strong>
                            <span>{actor?.name ?? "ユニット"}</span>
                          </div>
                          <div className="forecast-values">
                            <span>ダメージ <strong>{strike.normalDamage}</strong></span>
                            <span>命中 <strong>{strike.hitRate}%</strong></span>
                            <span>必殺 <strong>{strike.criticalRate}%</strong></span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <p className="helper-text">予測は各攻撃候補の理論値です。先行攻撃で撃破された場合、後続攻撃は実行されません。</p>
                  <button className="primary-button block-button" type="button" disabled={!interactive} onClick={() => void handleAttack()}>
                    攻撃を確定
                  </button>
                </>
              ) : (
                <p className="message-text">{combatPlan?.error ?? "戦闘対象を確認できません。"}</p>
              )}
              <button
                className="secondary-button block-button"
                type="button"
                disabled={saveStatus === "saving"}
                onClick={() => setCombatTargetId(null)}
              >
                戦闘予測を閉じる
              </button>
            </section>
          )}

          <section className="info-card">
            <p className="eyebrow">MESSAGE</p>
            <h2>戦況メッセージ</h2>
            <p className="message-text" role="status" aria-live="polite">{message}</p>
          </section>

          <section className="info-card">
            <p className="eyebrow">TERRAIN</p>
            <h2>地形効果</h2>
            <dl className="terrain-list">
              <div><dt>平地・道</dt><dd>移動 1</dd></div>
              <div><dt>森</dt><dd>歩兵 2 / 騎馬 3</dd></div>
              <div><dt>山</dt><dd>歩兵 2 / 騎馬進入不可</dd></div>
              <div><dt>砦</dt><dd>移動 1 · 防御 +2</dd></div>
              <div><dt>壁・水域</dt><dd>進入不可</dd></div>
            </dl>
            <p className="helper-text">地形補正値は設計書の初期案です。</p>
          </section>

          <section className="info-card">
            <p className="eyebrow">SAVE</p>
            <h2>ローカル保存</h2>
            <p className="message-text">{SAVE_STATUS_LABELS[saveStatus]}</p>
            <p className="helper-text">移動・武器変更・攻撃・待機の確定時にIndexedDBへ自動保存します。戦闘乱数の状態も保存します。</p>
          </section>
        </aside>
      </div>

      <footer className="app-footer">
        <span>Grid Tactics PWA · Prototype</span>
        <span>データはこのブラウザ内に保存されます。</span>
      </footer>
    </main>
  );
}
