import { useEffect, useMemo, useState } from "react";
import { getChapterById, getNextChapter, INITIAL_CHAPTER } from "./content/chapters";
import { TERRAIN_DEFINITIONS } from "./content/terrain";
import { WEAPONS_BY_ID } from "./content/weapons";
import { INVENTORY_ITEMS_BY_ID, PROMOTION_ITEM_ID } from "./content/items";
import { getClassDisplayName, getClassPromotionDefinition } from "./content/classes";
import { performClassChange } from "./application/perform-class-change";
import { applyChapterRewards } from "./application/apply-chapter-rewards";
import { prepareNextChapter } from "./application/prepare-next-chapter";
import { performAttack, createAttackPlan } from "./application/perform-attack";
import { beginEnemyPhase, runEnemyPhase } from "./application/resolve-enemy-phase";
import { evaluateBattleOutcome } from "./domain/rules/evaluate-battle-outcome";
import type { FortRecoveryRecord } from "./domain/rules/apply-fort-recovery";
import { calculateReachableTiles } from "./domain/movement/calculate-reachable-tiles";
import { isWithinWeaponRange, canUnitUseWeapon } from "./domain/combat/combat";
import { calculateManhattanDistance } from "./domain/combat/grid-distance";
import type { GameStateSnapshot, Position, UnitStats } from "./domain/models/game";
import type { AttackPlan } from "./application/perform-attack";
import type { LevelUpRecord } from "./domain/progression/level-up";
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

function formatFortRecoverySummary(recoveries: FortRecoveryRecord[]): string {
  if (recoveries.length === 0) return "";
  return "砦の効果で" + recoveries
    .map((recovery) => recovery.unitName + "が" + recovery.recoveredHp + "HP回復")
    .join("、");
}

function formatEnemyPhaseSummary(execution: ReturnType<typeof runEnemyPhase>): string {
  const actions = execution.actions.map((action) => action.message).join("。");
  const details = [actions, formatFortRecoverySummary(execution.phaseStartRecoveries)]
    .filter(Boolean)
    .join("。");
  if (execution.outcome === "victory") {
    return (details ? details + "。" : "") + "勝利条件を達成しました。";
  }
  if (execution.outcome === "defeat") {
    return (details ? details + "。" : "") + "味方ユニットが全滅しました。";
  }
  return (details ? details + "。" : "敵軍は行動できませんでした。") +
    "敵軍フェイズ終了。第" + execution.nextState.turn + "ターン・自軍フェイズです。";
}

function formatLevelUps(levelUps: LevelUpRecord[]): string {
  const statLabels: Record<keyof LevelUpRecord["gains"], string> = {
    hp: "HP",
    strength: "力",
    magic: "魔力",
    skill: "技",
    speed: "速さ",
    luck: "幸運",
    defense: "守備",
    resistance: "魔防"
  };
  return levelUps.map((levelUp) => {
    const gains = Object.entries(levelUp.gains)
      .map(([stat, value]) => statLabels[stat as keyof LevelUpRecord["gains"]] + "+" + String(value))
      .join("・");
    return "Lv." + levelUp.newLevel + "へレベルアップ" +
      (gains ? "（" + gains + "）" : "（能力上昇なし）");
  }).join(" / ");
}

function formatPromotionBonuses(bonuses: Partial<UnitStats>): string {
  const statLabels: Record<keyof UnitStats, string> = {
    hp: "HP",
    strength: "力",
    magic: "魔力",
    skill: "技",
    speed: "速さ",
    luck: "幸運",
    defense: "守備",
    resistance: "魔防"
  };
  const entries = Object.entries(bonuses).filter(([, value]) => Number(value) > 0);
  return entries.length > 0
    ? entries.map(([stat, value]) => statLabels[stat as keyof UnitStats] + "+" + String(value)).join("・")
    : "能力上昇なし（昇格先上限に到達）";
}

export default function App() {
  const [activeChapter, setActiveChapter] = useState(INITIAL_CHAPTER);
  const [gameState, setGameState] = useState<GameStateSnapshot>(INITIAL_CHAPTER.initialState);
  const currentMap = activeChapter.map;
  const nextChapter = getNextChapter(activeChapter.id);
  const [selectedUnitId, setSelectedUnitId] = useState<string | null>(null);
  const [combatTargetId, setCombatTargetId] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("loading");
  const [message, setMessage] = useState("味方ユニットを選択してください。");
  const [loadBlocked, setLoadBlocked] = useState(false);
  const [promotionConfirmUnitId, setPromotionConfirmUnitId] = useState<string | null>(null);
  const [isStartingNextChapter, setIsStartingNextChapter] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function restoreSave(): Promise<void> {
      try {
        const stored = await loadGameState();
        if (cancelled) return;

        if (stored === null) {
          setGameState({
            ...INITIAL_CHAPTER.initialState,
            rngState: createRandomSeed()
          });
          setSaveStatus("ready");
          return;
        }

        const savedChapterId = typeof stored === "object" && stored !== null &&
          "chapterId" in stored && typeof stored.chapterId === "string"
          ? stored.chapterId
          : null;
        const restoredChapter = savedChapterId ? getChapterById(savedChapterId) : undefined;
        if (!restoredChapter) {
          setSaveStatus("invalid");
          setLoadBlocked(true);
          setMessage("保存データの章IDが現在のコンテンツに存在しません。データ保全のため操作を停止しています。");
          return;
        }

        const migration = migrateGameStateSnapshot(stored, restoredChapter.map);
        if (!migration) {
          setSaveStatus("invalid");
          setLoadBlocked(true);
          setMessage("保存データの形式またはマップが現在の版と一致しません。データ保全のため操作を停止しています。");
          return;
        }

        let restoredState = migration.snapshot;
        setActiveChapter(restoredChapter);
        setGameState(restoredState);
        if (migration.migrated) {
          setSaveStatus("saving");
          try {
            await saveGameState(restoredState);
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
        }

        if (restoredState.phase === "enemy") {
          const enemyPhase = runEnemyPhase(restoredState, restoredChapter.map);
          restoredState = enemyPhase.nextState;
          setGameState(restoredState);
          try {
            await saveGameState(restoredState);
            if (!cancelled) {
              setSaveStatus("saved");
              setMessage(formatEnemyPhaseSummary(enemyPhase));
            }
          } catch {
            if (!cancelled) {
              setSaveStatus("failed");
              setMessage("敵軍フェイズを解決しましたが、セーブに失敗しました。");
            }
          }
          return;
        }

        setSaveStatus((current) => current === "failed" ? "failed" : "saved");
        const restoredOutcome = evaluateBattleOutcome(restoredState, restoredChapter.map);
        setMessage(restoredOutcome === "victory"
          ? "勝利条件を達成しています。"
          : restoredOutcome === "defeat"
            ? "味方ユニットが全滅しています。"
            : migration.migrated
              ? "以前のセーブデータを新しい形式へ移行しました。"
              : "前回の自動保存データを復元しました。");
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
      terrain: currentMap.terrain,
      start: selectedUnit.position,
      movementPoints: selectedUnit.move,
      movementType: selectedUnit.movementType,
      occupiedPositions: gameState.units
        .filter((unit) => unit.id !== selectedUnit.id)
        .map((unit) => unit.position)
    });
  }, [gameState.units, selectedUnit, currentMap]);

  const battleOutcome = evaluateBattleOutcome(gameState, currentMap);
  const interactive = saveStatus !== "loading" && saveStatus !== "saving" && !loadBlocked &&
    gameState.phase === "player" && battleOutcome === "playing";
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
        plan: createAttackPlan(gameState, currentMap, selectedUnit.id, combatTargetId),
        error: null as string | null
      };
    } catch (error) {
      return {
        plan: null as AttackPlan | null,
        error: getErrorMessage(error)
      };
    }
  }, [gameState, selectedUnit, combatTargetId, currentMap]);

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
    setPromotionConfirmUnitId(null);

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
        createAttackPlan(gameState, currentMap, selectedUnit.id, unitOnTile.id);
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

  async function handleClassChange(): Promise<void> {
    if (!selectedUnit || !interactive || selectedUnit.faction !== "player") return;

    const definition = getClassPromotionDefinition(selectedUnit.classId);
    if (!definition) {
      setPromotionConfirmUnitId(null);
      setMessage("このクラスには昇格先が設定されていません。");
      return;
    }

    try {
      const execution = performClassChange(gameState, selectedUnit.id, definition);
      const targetName = getClassDisplayName(definition.toClassId);
      const bonusText = formatPromotionBonuses(execution.appliedBonuses);
      setGameState(execution.nextState);
      setCombatTargetId(null);
      setPromotionConfirmUnitId(null);
      await persist(
        execution.nextState,
        selectedUnit.name + "は" + targetName + "へクラスチェンジしました。能力ボーナス：" + bonusText +
          "。クラスチェンジの証を1個消費しました。"
      );
    } catch (error) {
      setPromotionConfirmUnitId(null);
      setMessage(getErrorMessage(error));
    }
  }

  async function handleAttack(): Promise<void> {
    if (!selectedUnit || !combatTargetId || !interactive || !combatPlan?.plan) return;

    try {
      const execution = performAttack(
        gameState,
        currentMap,
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
      const experienceText = execution.experienceAwarded > 0
        ? " +" + execution.experienceAwarded + " EXP。"
        : "";
      const levelUpText = execution.levelUps.length > 0
        ? " " + formatLevelUps(execution.levelUps) + "。"
        : "";
      const successMessage =
        log +
        (defeated ? "。" + targetName + "を撃破しました。" : "。") +
        experienceText +
        levelUpText;
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

  async function handleEndPlayerPhase(): Promise<void> {
    if (!interactive || gameState.phase !== "player" || battleOutcome !== "playing") return;

    try {
      const phaseStart = beginEnemyPhase(gameState, currentMap);
      const enemyPhaseState = phaseStart.nextState;
      setGameState(enemyPhaseState);
      setSelectedUnitId(null);
      setCombatTargetId(null);
      setPromotionConfirmUnitId(null);
      const recoverySummary = formatFortRecoverySummary(phaseStart.fortRecoveries);
      await persist(
        enemyPhaseState,
        recoverySummary
          ? "敵軍フェイズを開始します。" + recoverySummary + "。"
          : "敵軍フェイズを開始します。"
      );

      const execution = runEnemyPhase(enemyPhaseState, currentMap);
      setGameState(execution.nextState);
      await persist(execution.nextState, formatEnemyPhaseSummary(execution));
    } catch (error) {
      setMessage(getErrorMessage(error));
    }
  }

  async function handleStartNextChapter(): Promise<void> {
    const targetChapter = getNextChapter(activeChapter.id);
    if (
      !targetChapter ||
      battleOutcome !== "victory" ||
      saveStatus === "saving" ||
      saveStatus === "loading" ||
      loadBlocked ||
      isStartingNextChapter
    ) return;

    setIsStartingNextChapter(true);
    try {
      const rewardExecution = applyChapterRewards(
        gameState,
        currentMap,
        activeChapter.clearRewards
      );
      const nextState = prepareNextChapter({
        previousState: rewardExecution.nextState,
        previousMap: currentMap,
        nextChapterInitialState: {
          ...targetChapter.initialState,
          rngState: gameState.rngState
        },
        nextMap: targetChapter.map,
        // Inter-chapter HP handling is not defined in the game design yet.
        currentHpPolicy: "preserve"
      });

      setActiveChapter(targetChapter);
      setGameState(nextState);
      setSelectedUnitId(null);
      setCombatTargetId(null);
      setPromotionConfirmUnitId(null);

      const rewardText = rewardExecution.rewardsApplied.length > 0
        ? " 報酬：" + rewardExecution.rewardsApplied
            .map((reward) => reward.recipientName + "に" + reward.itemName + "×" + reward.quantity)
            .join("、") + "。"
        : " この章に設定された追加アイテム報酬はありません。";
      await persist(
        nextState,
        activeChapter.title + "をクリアしました。" + targetChapter.title +
          "を開始します。" + rewardText + "章間HPは現在値を維持しました（暫定）。"
      );
    } catch (error) {
      setMessage(getErrorMessage(error));
    } finally {
      setIsStartingNextChapter(false);
    }
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
  const selectedInventoryItems = selectedUnit
    ? selectedUnit.inventory
        .filter((itemId) => !WEAPONS_BY_ID[itemId])
        .map((itemId) => ({
          id: itemId,
          definition: INVENTORY_ITEMS_BY_ID[itemId]
        }))
    : [];
  const promotionDefinition = selectedUnit?.faction === "player"
    ? getClassPromotionDefinition(selectedUnit.classId)
    : undefined;
  const promotionItemCount = selectedUnit?.inventory.filter(
    (itemId) => itemId === PROMOTION_ITEM_ID
  ).length ?? 0;
  const canStartClassChange = Boolean(
    selectedUnit &&
    selectedUnit.faction === "player" &&
    interactive &&
    promotionDefinition &&
    selectedUnit.level >= 10 &&
    promotionItemCount > 0
  );

  return (
    <main className="app-shell">
      <header className="app-header">
        <div>
          <p className="eyebrow">TACTICAL SRPG · DEVELOPMENT BUILD</p>
          <h1>Grid Tactics</h1>
          <p className="subtitle">マップ・移動・戦闘予測・攻撃のプロトタイプ</p>
        </div>
        <div className="header-status">
          <span className="phase-badge">{battleOutcome === "victory" ? "勝利" : battleOutcome === "defeat" ? "敗北" : "第" + gameState.turn + "ターン · " + (gameState.phase === "player" ? "自軍フェイズ" : "敵軍フェイズ")}</span>
          <span className={"save-badge save-" + saveStatus}>{SAVE_STATUS_LABELS[saveStatus]}</span>
          {battleOutcome === "playing" && gameState.phase === "player" && (
            <button className="secondary-button phase-end-button" type="button" disabled={!interactive} onClick={() => void handleEndPlayerPhase()}>
              自軍フェイズ終了
            </button>
          )}
        </div>
      </header>

      <div className="prototype-notice">
        <strong>開発プロトタイプ</strong>
        <span>仮マップ・仮ユニット・仮武器を使用しています。基本的な敵AI・フェイズ進行・勝敗判定を実装した開発版です。</span>
      </div>

      {battleOutcome !== "playing" && (
        <section className={"battle-outcome " + (battleOutcome === "victory" ? "outcome-victory" : "outcome-defeat")} role="status">
          <div className="result-heading">
            <strong>{battleOutcome === "victory" ? "ステージクリア" : "敗北"}</strong>
            <span>{battleOutcome === "victory" ? "勝利条件を達成しました。" : "味方ユニットが全滅しました。"}</span>
          </div>
          <div className="result-summary">
            <div><span>撃破数</span><strong>{Math.max(0, currentMap.enemyDeployment.length - gameState.units.filter((unit) => unit.faction === "enemy").length)}</strong></div>
            <div><span>生存味方</span><strong>{gameState.units.filter((unit) => unit.faction === "player").length}</strong></div>
            <div><span>経過ターン</span><strong>{gameState.turn}</strong></div>
          </div>
          {battleOutcome === "victory" && (
            <>
              <div className="result-units chapter-rewards">
                <h2>章クリア報酬</h2>
                {activeChapter.clearRewards.length > 0 ? (
                  activeChapter.clearRewards.map((reward) => {
                    const recipient = gameState.units.find((unit) => unit.id === reward.recipientUnitId);
                    const itemName = INVENTORY_ITEMS_BY_ID[reward.itemId]?.name ?? reward.itemId;
                    return (
                      <div className="result-unit" key={reward.recipientUnitId + "-" + reward.itemId}>
                        <strong>{recipient?.name ?? reward.recipientUnitId}</strong>
                        <span>{itemName}</span>
                        <span>×{reward.quantity}</span>
                      </div>
                    );
                  })
                ) : (
                  <p className="helper-text">この章には追加アイテム報酬が設定されていません。経験値・レベルアップは戦闘中に反映済みです。</p>
                )}
              </div>
              {nextChapter ? (
                <div className="next-chapter-panel">
                  <h2>次の章</h2>
                  <strong>{nextChapter.title}</strong>
                  <p>{nextChapter.summary}</p>
                  <p className="helper-text">味方のレベル・EXP・能力・所持品を引き継ぎます。撃破済みの味方は復帰しません。現在HPは維持します（暫定）。</p>
                  {nextChapter.isPrototype && <p className="helper-text">次章マップは章遷移の動作確認用データです。正式なマップ・敵配置ではありません。</p>}
                  <button
                    className="primary-button block-button"
                    type="button"
                    disabled={saveStatus === "saving" || saveStatus === "loading" || loadBlocked || isStartingNextChapter}
                    onClick={() => void handleStartNextChapter()}
                  >
                    {isStartingNextChapter ? "次章を準備中…" : nextChapter.title + "を開始"}
                  </button>
                </div>
              ) : (
                <p className="helper-text">登録済みの全章をクリアしました。キャンペーンの試作範囲はここまでです。</p>
              )}
            </>
          )}
          <div className="result-units">
            <h2>味方ユニットの成長状況</h2>
            {gameState.units.filter((unit) => unit.faction === "player").length > 0 ? (
              gameState.units
                .filter((unit) => unit.faction === "player")
                .sort((left, right) => left.id.localeCompare(right.id))
                .map((unit) => (
                  <div className="result-unit" key={unit.id}>
                    <strong>{unit.name}</strong>
                    <span>Lv.{unit.level}</span>
                    <span>EXP {unit.experience}/100</span>
                    <span>HP {unit.currentHp}/{unit.stats.hp}</span>
                  </div>
                ))
            ) : (
              <p className="helper-text">生存している味方ユニットはいません。</p>
            )}
          </div>
          <p className="helper-text">この画面は現在のステージ結果を表示します。経験値・能力値・撃破状態は自動保存済みのゲームデータに反映されています。</p>
        </section>
      )}

      <div className="battle-layout">
        <section className="map-card" aria-labelledby="map-heading">
          <div className="section-heading">
            <div>
              <p className="eyebrow">CHAPTER {String(activeChapter.number).padStart(2, "0")} · {activeChapter.isPrototype ? "PROTOTYPE MAP" : "CAMPAIGN MAP"}</p>
              <h2 id="map-heading">{activeChapter.title}</h2>
            </div>
            <span className="map-size">{currentMap.width} × {currentMap.height}</span>
          </div>

          <div
            className="map-grid"
            style={{ gridTemplateColumns: "repeat(" + currentMap.width + ", minmax(0, 1fr))" }}
            aria-label={currentMap.width + "列" + currentMap.height + "行の戦闘マップ"}
          >
            {Array.from({ length: currentMap.height }, (_, y) =>
              Array.from({ length: currentMap.width }, (_, x) => {
                const position = { x, y };
                const terrain = currentMap.terrain[y]?.[x] ?? "plain";
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
                    <p>Lv.{selectedUnit.level} · {getClassDisplayName(selectedUnit.classId)}</p>
                  </div>
                </div>
                <div className="unit-details">
                  <div><span>HP</span><strong>{selectedUnit.currentHp} / {selectedUnit.stats.hp}</strong></div>
                  {selectedUnit.faction === "player" && (
                    <div><span>経験値</span><strong>EXP {selectedUnit.experience} / 100</strong></div>
                  )}
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
                {selectedUnit.faction === "player" && (
                  <>
                    <div className="inventory-items">
                      <h3>所持アイテム</h3>
                      {selectedInventoryItems.length > 0 ? (
                        <ul>
                          {selectedInventoryItems.map((item) => (
                            <li key={item.id}>
                              <strong>{item.definition?.name ?? item.id}</strong>
                              {item.definition && <span>{item.definition.description}</span>}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="helper-text">武器以外のアイテムはありません。</p>
                      )}
                    </div>
                    <section className="promotion-panel" aria-labelledby="promotion-heading">
                      <h3 id="promotion-heading">クラスチェンジ</h3>
                      {promotionDefinition ? (
                        <>
                          <p className="promotion-target">昇格先：<strong>{getClassDisplayName(promotionDefinition.toClassId)}</strong></p>
                          <p className="promotion-item-count">クラスチェンジの証：<strong>{promotionItemCount}個</strong></p>
                          {selectedUnit.level < 10 && (
                            <p className="helper-text">基本職Lv.10以上でクラスチェンジできます（現在Lv.{selectedUnit.level}）。</p>
                          )}
                          {promotionItemCount === 0 && (
                            <p className="helper-text">クラスチェンジの証を所持していません。</p>
                          )}
                          <button
                            className="secondary-button block-button"
                            type="button"
                            disabled={!canStartClassChange}
                            onClick={() => setPromotionConfirmUnitId(selectedUnit.id)}
                          >
                            クラスチェンジを確認
                          </button>
                          {promotionConfirmUnitId === selectedUnit.id && (
                            <div className="promotion-confirmation" role="group" aria-label="クラスチェンジ確認">
                              <strong>{getClassDisplayName(promotionDefinition.toClassId)}へ昇格しますか？</strong>
                              <p>能力ボーナス（暫定）：{formatPromotionBonuses(promotionDefinition.statBonuses)}</p>
                              <p>レベルは1に戻り、現在EXPは保持します。証を1個消費します。</p>
                              <div className="command-actions">
                                <button
                                  className="primary-button"
                                  type="button"
                                  disabled={!interactive}
                                  onClick={() => void handleClassChange()}
                                >
                                  昇格を確定
                                </button>
                                <button
                                  className="secondary-button"
                                  type="button"
                                  disabled={saveStatus === "saving"}
                                  onClick={() => setPromotionConfirmUnitId(null)}
                                >
                                  キャンセル
                                </button>
                              </div>
                            </div>
                          )}
                        </>
                      ) : (
                        <p className="helper-text">このクラスに昇格先は設定されていません。</p>
                      )}
                    </section>
                  </>
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
                      setPromotionConfirmUnitId(null);
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
