import { useState } from "react";

interface OperationGuideStep {
  title: string;
  summary: string;
  points: string[];
  tip: string;
}

const GUIDE_STEPS: readonly OperationGuideStep[] = [
  {
    title: "出撃準備を整える",
    summary: "戦闘を始める前に、今回のマップへ出撃する味方と配置を決めます。",
    points: [
      "チェックボックスで出撃メンバーを選びます。選ばなかった生存者は控えとしてキャンペーンに残ります。",
      "各ユニットの出撃位置は、章マップに用意された候補から選びます。位置を入れ替えると、同じマスへの重複配置は起きません。",
      "配置プレビューの味方や空き出撃マスを選ぶと、地形の移動コスト・守備／回避補正と、その味方が地形へ進入できるかを確認できます。",
      "「詳細」ではクラス、能力、移動力、武器適性、所持武器を確認できます。"
    ],
    tip: "準備ができたら「出撃メンバーと配置を確定して戦闘開始」を押します。確定前なら編成を何度でも見直せます。"
  },
  {
    title: "味方を選んで移動する",
    summary: "味方ユニットを選ぶと、現在の地形・移動力・他ユニットの位置から移動可能なマスが表示されます。",
    points: [
      "青く表示されたマスが移動可能範囲です。マス上の数字は、そこへ進むための累計移動コストです。",
      "PCではマスにマウスを重ねるかキーボードでフォーカスすると、最小コスト経路を確認できます。",
      "タッチ操作では移動先を1回タップすると経路をプレビューし、同じマスをもう1回タップすると移動を確定します。別のマスをタップするとプレビュー先を切り替えます。"
    ],
    tip: "移動だけでは行動は終了しません。移動後も、そのユニットで攻撃・アイテム使用・待機を選べます。"
  },
  {
    title: "攻撃予測を見てから戦う",
    summary: "攻撃したい味方を選び、赤く表示された攻撃可能な敵を選ぶと戦闘予測が開きます。",
    points: [
      "予測パネルでは攻撃順、攻撃回数、予測ダメージ、命中率、必殺率を確認できます。",
      "武器の射程外にいる敵や、装備中の武器で攻撃できない相手は選べません。",
      "内容を確認してから「攻撃を確定」を押します。実際の命中・ダメージ・経験値は戦闘履歴に表示されます。"
    ],
    tip: "武器は行動前に変更できます。相手との距離や武器の射程を見てから攻撃対象を決めましょう。"
  },
  {
    title: "アイテムとユニット行動",
    summary: "攻撃以外にも、装備変更・回復アイテム・クラスチェンジ・待機を選べます。",
    points: [
      "HPが減っている味方は、所持アイテムの「使用」から回復薬を使えます。アイテム使用はそのユニットの行動を消費します。",
      "クラスチェンジは基本職Lv.10以上、証を所持、自軍フェイズ、未移動・未行動の条件を満たす場合に確認できます。実行すると行動済みになります。",
      "クラスチェンジの能力ボーナスと上限、回復薬の回復量は現時点では試作値です。正式なバランス値ではありません。"
    ],
    tip: "このフェイズでこれ以上行動しないユニットは「待機」を選ぶと、行動済みになります。"
  },
  {
    title: "地形と敵の攻撃範囲を読む",
    summary: "マップの情報を確認すると、移動や配置の判断材料を増やせます。",
    points: [
      "マスをタップするかキーボードでフォーカスすると、歩兵・騎馬の移動コスト、守備・回避補正、配置ユニットなどを確認できます。",
      "勝利条件・敗北条件に名前付きの目標ユニットがある場合は、目標パネルの確認ボタンからマップ上の位置へ移動できます。敵全滅の目標では、残りの敵一覧へ移動できます。",
      "「敵の攻撃範囲を表示」を使うと、敵の現在位置と移動可能範囲、武器射程から予測した危険マスを確認できます。",
      "敵の攻撃範囲は判断を助ける予測です。敵AIが実際に選ぶ移動先や攻撃対象を確定する表示ではありません。"
    ],
    tip: "森や砦などの地形効果も確認し、攻撃を受けるユニットの立ち位置を考えましょう。"
  },
  {
    title: "ターンを進めてセーブを管理する",
    summary: "自軍フェイズを終えると敵軍フェイズが進み、戦闘が続いていれば次の自軍フェイズへ移ります。",
    points: [
      "「自軍フェイズ終了」を押すと、未行動の味方がいる場合は一覧と敵軍フェイズの予測を確認できます。戦闘へ戻るか、未行動の味方を残して敵軍フェイズへ進むか選べます。全員が行動済みならそのまま敵軍フェイズへ進みます。",
      "移動・攻撃・アイテム使用などの確定した行動はIndexedDBへ自動保存されます。画面上部の表示で保存状態を確認できます。",
      "「セーブを書き出す」でJSONを別の場所へ保管できます。バックアップ欄では最大3世代のローカルバックアップを作成・復元できます。",
      "PWAとして追加したアプリは、必要なアプリデータがキャッシュされた後、通信がない環境でも起動できます。"
    ],
    tip: "端末の故障やブラウザデータ消去に備え、JSON書き出しやバックアップを別途保管しておくと安心です。"
  }
];

interface OperationGuideProps {
  onClose: () => void;
}

export function OperationGuide({ onClose }: OperationGuideProps) {
  const [stepIndex, setStepIndex] = useState(0);
  const step = GUIDE_STEPS[stepIndex] ?? GUIDE_STEPS[0]!;
  const isLastStep = stepIndex === GUIDE_STEPS.length - 1;

  return (
    <section
      id="operation-guide-panel"
      className="operation-guide"
      aria-labelledby="operation-guide-heading"
      aria-label="操作ガイド"
      role="region"
      data-testid="operation-guide"
    >
      <div className="operation-guide-header">
        <div>
          <p className="eyebrow">HOW TO PLAY</p>
          <h2 id="operation-guide-heading">操作ガイド</h2>
        </div>
        <button className="secondary-button operation-guide-close" type="button" onClick={onClose}>
          閉じる
        </button>
      </div>

      <div
        className="operation-guide-progress"
        role="progressbar"
        aria-label="操作ガイドの進行状況"
        aria-valuemin={1}
        aria-valuemax={GUIDE_STEPS.length}
        aria-valuenow={stepIndex + 1}
      >
        <span style={{ width: ((stepIndex + 1) / GUIDE_STEPS.length * 100) + "%" }} />
      </div>

      <div className="operation-guide-content" aria-live="polite" aria-atomic="true">
        <p className="operation-guide-step-number">STEP {String(stepIndex + 1).padStart(2, "0")} / {String(GUIDE_STEPS.length).padStart(2, "0")}</p>
        <h3>{step.title}</h3>
        <p className="operation-guide-summary">{step.summary}</p>
        <ul className="operation-guide-points">
          {step.points.map((point) => <li key={point}>{point}</li>)}
        </ul>
        <p className="operation-guide-tip"><strong>ポイント</strong>{step.tip}</p>
      </div>

      <div className="operation-guide-footer">
        <button
          className="secondary-button"
          type="button"
          disabled={stepIndex === 0}
          onClick={() => setStepIndex((current) => Math.max(0, current - 1))}
        >
          前へ
        </button>
        <span>{stepIndex + 1} / {GUIDE_STEPS.length}</span>
        <button
          className="primary-button"
          type="button"
          onClick={() => setStepIndex((current) => isLastStep ? 0 : Math.min(GUIDE_STEPS.length - 1, current + 1))}
        >
          {isLastStep ? "最初から" : "次へ"}
        </button>
      </div>

      <p className="operation-guide-note">このガイドは説明専用です。ゲーム状態やセーブデータは変更しません。</p>
    </section>
  );
}
