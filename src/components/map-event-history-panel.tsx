import type { MapEventMessage } from "../application/resolve-map-events";

export interface MapEventHistoryPanelProps {
  events: MapEventMessage[];
  onClose: () => void;
}

export function MapEventHistoryPanel({ events, onClose }: MapEventHistoryPanelProps) {
  return (
    <section
      id="map-event-history-panel"
      className="map-event-history-panel"
      role="region"
      aria-labelledby="map-event-history-title"
      data-testid="map-event-history"
      onKeyDown={(keyboardEvent) => {
        if (keyboardEvent.key === "Escape") {
          keyboardEvent.preventDefault();
          onClose();
        }
      }}
    >
      <header className="map-event-history-header">
        <div>
          <p className="eyebrow">MAP EVENT LOG</p>
          <h2 id="map-event-history-title">イベント履歴</h2>
          <p className="map-event-history-note">{events.length}件 · 発生順</p>
        </div>
        <button
          className="secondary-button map-event-history-close"
          type="button"
          onClick={onClose}
        >
          閉じる
        </button>
      </header>
      <ol className="map-event-history-list" aria-label="イベント発生順">
        {events.map((event, index) => (
          <li key={event.id}>
            <article
              className="map-event-history-entry"
              data-testid="map-event-history-entry"
              data-event-id={event.id}
            >
              <p className="map-event-history-sequence">イベント {index + 1}</p>
              <h3>{event.speaker ?? "イベント"}</h3>
              <p className="map-event-history-message">{event.text}</p>
              {event.choices?.length ? (
                <p className="map-event-history-choice">
                  選択: {event.selectedChoiceLabel ?? "未選択"}
                </p>
              ) : null}
            </article>
          </li>
        ))}
      </ol>
    </section>
  );
}
