import type {
  CampaignPlayerActionKind,
  GameStateSnapshot
} from "../domain/models/game";

export type BattleGuideOutcome = "playing" | "victory" | "defeat";

export interface BattleGuideStep {
  id: "move" | "act" | "turn";
  label: string;
  complete: boolean;
}

export interface BattleGuideDetails {
  headline: string;
  description: string;
  steps: BattleGuideStep[];
  completedCount: number;
  totalCount: number;
}

export interface BattleGuideInput {
  state: GameStateSnapshot;
  selectedUnitId: string | null;
  deploymentPending: boolean;
  pendingMapEventCount: number;
  battleOutcome: BattleGuideOutcome;
}

const ACTIONS_THAT_FINISH_A_UNIT: ReadonlySet<CampaignPlayerActionKind> = new Set([
  "item-use",
  "class-change",
  "map-interaction",
  "wait"
]);

/**
 * Builds a read-only, current-situation guide from the saved battle state and
 * the selected unit. It never mutates or writes campaign data.
 */
export function getBattleGuideDetails({
  state,
  selectedUnitId,
  deploymentPending,
  pendingMapEventCount,
  battleOutcome
}: BattleGuideInput): BattleGuideDetails {
  const chapterEntries = state.campaignBattleLog.filter(
    (entry) => entry.chapterId === state.chapterId
  );
  const moved = chapterEntries.some(
    (entry) => entry.kind === "player-action" && entry.action === "movement"
  ) || state.units.some(
    (unit) => unit.faction === "player" && unit.currentHp > 0 && unit.hasMoved
  );
  const acted = chapterEntries.some((entry) =>
    entry.kind === "player-attack" ||
    (entry.kind === "player-action" && ACTIONS_THAT_FINISH_A_UNIT.has(entry.action))
  ) || state.units.some(
    (unit) => unit.faction === "player" && unit.currentHp > 0 && unit.hasActed
  );
  const enemyPhaseCompleted = chapterEntries.some((entry) => entry.kind === "enemy-action") ||
    state.turn > 1 ||
    battleOutcome !== "playing";

  const steps: BattleGuideStep[] = [
    { id: "move", label: "味方ユニットを移動する", complete: moved },
    { id: "act", label: "攻撃・アイテム・待機などを確定する", complete: acted },
    { id: "turn", label: "自軍フェイズを終えて敵の行動を見る", complete: enemyPhaseCompleted }
  ];
  const completedCount = steps.filter((step) => step.complete).length;

  let headline: string;
  let description: string;

  if (deploymentPending) {
    headline = "出撃メンバーと配置を確定しましょう";
    description = "出撃する味方と配置を確認し、「出撃メンバーと配置を確定して戦闘開始」を押します。選ばなかった生存者は控えに残ります。";
  } else if (pendingMapEventCount > 0) {
    headline = "マップイベントを確認しましょう";
    description = "会話の確認や選択肢の決定が終わるまで、戦闘操作は一時停止します。内容を読んで明示的に確認・選択してください。";
  } else if (battleOutcome === "victory") {
    headline = "勝利です。リザルトを確認しましょう";
    description = "経験値・能力上昇・報酬・戦闘記録を確認できます。次章がある場合は、引き継ぐ編成と控えを選んで進みます。";
  } else if (battleOutcome === "defeat") {
    headline = "戦闘終了です。敗北結果を確認しましょう";
    description = "敗北理由と戦闘記録を確認できます。タイトルへ戻っても自動セーブは消えず、続きから同じ結果を開けます。";
  } else if (state.phase === "enemy") {
    headline = "敵軍フェイズを確認しましょう";
    description = "敵の行動予測と実際の行動履歴を見比べられます。敵軍フェイズが終わると、戦闘が続いている場合は次の自軍フェイズへ進みます。";
  } else {
    const selectedUnit = state.units.find((unit) => unit.id === selectedUnitId) ?? null;
    const livingUnactedPlayers = state.units.filter(
      (unit) => unit.faction === "player" && unit.currentHp > 0 && !unit.hasActed
    );

    if (selectedUnit?.faction === "enemy") {
      headline = "敵の情報を確認中です";
      description = "敵の能力・装備・現在位置を確認できます。行動するには、まだ行動していない味方ユニットを選んでください。";
    } else if (selectedUnit?.faction === "player" && selectedUnit.currentHp <= 0) {
      headline = "行動可能な味方を選びましょう";
      description = "選択中の味方は戦闘不能です。生存していて未行動の味方を選ぶと、移動や行動を続けられます。";
    } else if (selectedUnit?.faction === "player" && selectedUnit.hasActed) {
      headline = livingUnactedPlayers.length > 0
        ? "次に行動する味方を選びましょう"
        : "自軍フェイズを終了できます";
      description = livingUnactedPlayers.length > 0
        ? "このユニットは行動済みです。未行動の味方を選ぶか、全員の行動を終えたら自軍フェイズを終了します。"
        : "未行動の味方はいません。「自軍フェイズ終了」から敵軍の行動予測を確認して進めます。";
    } else if (selectedUnit?.faction === "player" && selectedUnit.hasMoved) {
      headline = "この味方の行動を選びましょう";
      description = "移動後も行動できます。敵を選んで戦闘予測を確認してから攻撃するか、アイテム使用・待機を選んでください。";
    } else if (selectedUnit?.faction === "player") {
      headline = "青いマスから移動先を選びましょう";
      description = "移動可能範囲と累計コストを確認します。スマートフォンでは移動先を1回タップして経路を見て、同じマスをもう1回タップすると移動します。";
    } else if (livingUnactedPlayers.length > 0) {
      headline = "行動可能な味方を選びましょう";
      description = "味方を選ぶと移動可能範囲が表示されます。移動せずに攻撃・アイテム使用・待機を選ぶこともできます。";
    } else {
      headline = "自軍フェイズを終了しましょう";
      description = "行動可能な味方がいません。「自軍フェイズ終了」から敵軍フェイズへ進みます。";
    }
  }

  return { headline, description, steps, completedCount, totalCount: steps.length };
}
