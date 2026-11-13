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
  return (
    <section
      className="info-card map-interaction-panel"
      aria-labelledby="map-interaction-heading"
      data-testid="map-interaction-panel"
    >
      <p className="eyebrow">EXPLORATION</p>
      <h2 id="map-interaction-heading">{interaction.recruitName ? "加入イベント" : "地点を調べる"}</h2>
      <p className="map-interaction-label">{interaction.label}</p>
      {interaction.description && (
        <p className="map-interaction-description">{interaction.description}</p>
      )}
      {interaction.recruitName ? (
        <p className="map-interaction-description">
          「{interaction.recruitName}」が控え名簿に加入します。今の戦闘には参加しません。
        </p>
      ) : null}
      <p className="helper-text">
        {interaction.recruitName
          ? `${unitName}が話しかけます。実行するとこのフェイズの行動を消費します。移動後でも実行できます。`
          : `${unitName}が調べます。実行するとこのフェイズの行動を消費します。移動後でも調べられます。`}
      </p>
      <button
        className="secondary-button block-button map-interaction-action"
        type="button"
        disabled={disabled}
        onClick={onInteract}
      >
        {interaction.recruitName ? "加入する" : "調べる"}
      </button>
    </section>
  );
}
