import { useEffect, useMemo, useState } from "react";
import { CHAPTER_01_MAP, INITIAL_GAME_STATE } from "./content/maps/chapter-01";
import { TERRAIN_DEFINITIONS } from "./content/terrain";
import { calculateReachableTiles } from "./domain/movement/calculate-reachable-tiles";
import type { GameStateSnapshot, Position } from "./domain/models/game";
import { isValidGameStateSnapshot } from "./domain/models/validate-game-state";
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

export default function App() {
  const [gameState, setGameState] = useState<GameStateSnapshot>(INITIAL_GAME_STATE);
  const [selectedUnitId, setSelectedUnitId] = useState<string | null>(null);
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
          setSaveStatus("ready");
          return;
        }

        if (!isValidGameStateSnapshot(stored, CHAPTER_01_MAP)) {
          setSaveStatus("invalid");
          setLoadBlocked(true);
          setMessage("保存データの形式またはマップが現在の版と一致しません。データ保全のため操作を停止しています。");
          return;
        }

        setGameState(stored);
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

  const reachableTiles = useMemo(() => {
    if (!selectedUnit || selectedUnit.hasMoved || selectedUnit.hasActed) return [];

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

  async function persist(nextState: GameStateSnapshot): Promise<void> {
    setSaveStatus("saving");

    try {
      await saveGameState(nextState);
      setSaveStatus("saved");
      setMessage("行動をIndexedDBに自動保存しました。");
    } catch {
      setSaveStatus("failed");
      setMessage("行動は画面に反映されましたが、セーブに失敗しました。ストレージ設定を確認してください。");
    }
  }

  async function handleTileClick(position: Position): Promise<void> {
    if (!interactive) return;

    const unitOnTile = gameState.units.find((unit) => samePosition(unit.position, position));
    if (unitOnTile) {
      if (unitOnTile.faction === "player" && !unitOnTile.hasActed) {
        setSelectedUnitId(unitOnTile.id);
        setMessage(unitOnTile.name + "を選択しました。青いマスが移動可能範囲です。");
      } else {
        setMessage("敵ユニットまたは行動済みユニットのマスには移動できません。");
      }
      return;
    }

    if (!selectedUnit || selectedUnit.hasMoved || selectedUnit.hasActed) {
      setMessage("先に行動可能な味方ユニットを選択してください。");
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
    setMessage(selectedUnit.name + "が" + positionLabel(position) + "へ移動しました。攻撃は次の開発段階で追加します。");
    await persist(nextState);
  }

  async function handleWait(): Promise<void> {
    if (!selectedUnit || !interactive) return;

    const nextState: GameStateSnapshot = {
      ...gameState,
      units: gameState.units.map((unit) =>
        unit.id === selectedUnit.id ? { ...unit, hasActed: true } : unit
      )
    };

    setGameState(nextState);
    setSelectedUnitId(null);
    setMessage(selectedUnit.name + "は待機しました。");
    await persist(nextState);
  }

  const selectedStatus = selectedUnit
    ? selectedUnit.hasActed
      ? "行動済み"
      : selectedUnit.hasMoved
        ? "移動済み"
        : "未行動"
    : null;

  return (
    <main className="app-shell">
      <header className="app-header">
        <div>
          <p className="eyebrow">TACTICAL SRPG · DEVELOPMENT BUILD</p>
          <h1>Grid Tactics</h1>
          <p className="subtitle">マップ表示・ユニット選択・移動範囲のプロトタイプ</p>
        </div>
        <div className="header-status">
          <span className="phase-badge">第{gameState.turn}ターン · 自軍フェイズ</span>
          <span className={"save-badge save-" + saveStatus}>{SAVE_STATUS_LABELS[saveStatus]}</span>
        </div>
      </header>

      <div className="prototype-notice">
        <strong>開発プロトタイプ</strong>
        <span>仮マップ・仮ユニットを使用しています。戦闘、敵AI、フェイズ進行はまだ実装していません。</span>
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
                const classes = [
                  "map-tile",
                  "terrain-" + terrain,
                  unit ? "has-unit" : "",
                  isSelected ? "is-selected" : "",
                  isReachable ? "is-reachable" : ""
                ].filter(Boolean).join(" ");
                const ariaLabel = positionLabel(position) + "、" + TERRAIN_DEFINITIONS[terrain].label +
                  (unit ? "、" + unit.name : "") +
                  (isSelected ? "、選択中" : "") +
                  (isReachable ? "、移動可能" : "");

                return (
                  <button
                    className={classes}
                    key={String(x) + "-" + String(y)}
                    type="button"
                    aria-label={ariaLabel}
                    aria-pressed={Boolean(isSelected)}
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
                </div>
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
                    onClick={() => setSelectedUnitId(null)}
                  >
                    選択解除
                  </button>
                </div>
                <p className="helper-text">
                  {selectedUnit.hasMoved
                    ? "移動済みです。攻撃などの行動は次の開発段階で実装します。"
                    : "青く表示されたマスをタップすると移動します。"}
                </p>
              </>
            ) : (
              <p className="empty-selection">マップ上の味方ユニットをタップして選択してください。</p>
            )}
          </section>

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
            <p className="helper-text">ユニットの移動確定と待機確定時にIndexedDBへ自動保存します。</p>
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
