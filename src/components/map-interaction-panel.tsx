import type { MapInteractionPoint } from "../application/perform-map-interaction";

export interface MapInteractionPanelProps {
  interaction: MapInteractionPoint;
  unitName: string;
  disabled?: boolean;
  onInteract: () => void;
}

export function MapInteractionPanel({
  interaction,
  unitName,
  disabled = false,
  onInteract
}: MapInteractionPanelProps) {
  const headings = {
    village: "村",
    "treasure-chest": "宝箱",
    door: "扉",
    location: "地点を調べる"
  } as const;
  const actions = {
    village: "村を訪問する",
    "treasure-chest": "宝箱を開ける",
    door: "扉を調べる",
    location: "調べる"
  } as const;
  return (
    <section
      className="info-card map-interaction-panel"
      aria-labelledby="map-interaction-heading"
      data-testid="map-interaction-panel"
    >
      <p className="eyebrow">EXPLORATION</p>
      <h2 id="map-interaction-heading">{interaction.recruitName ? "加入イベント" : headings[interaction.kind]}</h2>
      <p className="map-interaction-label">{interaction.label}</p>
      {interaction.description && (
        <p className="map-interaction-description">{interaction.description}</p>
      )}
      {interaction.recruitName ? (
        <p className="map-interaction-description">
          「{interaction.recruitName}」が控え名簿に加入します。今の戦闘には参加しません。
        </p>
      ) : interaction.kind === "door" ? (
        <p className="map-interaction-description">
          この操作はイベントを実行します。通行可否はマップの地形定義で管理します。
        </p>
      ) : null}
      <p className="helper-text">
        {interaction.recruitName
          ? `${unitName}が話しかけます。実行するとこのフェイズの行動を消費します。移動後でも実行できます。`
          : `${unitName}${interaction.kind === "village" ? "が村を訪問します"
            : interaction.kind === "treasure-chest" ? "が宝箱を開けます"
              : interaction.kind === "door" ? "が扉を調べます" : "が地点を調べます"}。実行するとこのフェイズの行動を消費します。移動後でも実行できます。`}
      </p>
      <button
        className="secondary-button block-button map-interaction-action"
        type="button"
        disabled={disabled}
        onClick={onInteract}
      >
        {interaction.recruitName ? "加入する" : actions[interaction.kind]}
      </button>
    </section>
  );
}
