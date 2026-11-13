import { useEffect, useRef } from "react";
import type { MapEventMessage } from "../application/resolve-map-events";

export interface MapEventDialogProps {
  event: MapEventMessage;
  remainingCount: number;
  disabled?: boolean;
  onAcknowledge: (eventId: string) => void;
}

export function MapEventDialog({
  event,
  remainingCount,
  disabled = false,
  onAcknowledge
}: MapEventDialogProps) {
  const continueButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    continueButtonRef.current?.focus();
  }, [event.id]);

  return (
    <div className="map-event-dialog-backdrop" data-testid="map-event-dialog-backdrop">
      <section
        className="map-event-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="map-event-dialog-title"
        aria-describedby="map-event-dialog-message"
        data-testid="map-event-dialog"
        data-event-id={event.id}
        onKeyDown={(keyboardEvent) => {
          if (keyboardEvent.key === "Escape") {
            keyboardEvent.preventDefault();
          } else if (keyboardEvent.key === "Tab") {
            keyboardEvent.preventDefault();
            continueButtonRef.current?.focus();
          }
        }}
      >
        <div className="map-event-dialog-heading">
          <p className="eyebrow">MAP EVENT</p>
          <span>未確認イベント {remainingCount}件</span>
        </div>
        <h2 id="map-event-dialog-title">{event.speaker ?? "イベント"}</h2>
        <p id="map-event-dialog-message" className="map-event-dialog-message">
          {event.text}
        </p>
        <button
          ref={continueButtonRef}
          className="primary-button block-button map-event-dialog-continue"
          type="button"
          disabled={disabled}
          onClick={() => onAcknowledge(event.id)}
        >
          {remainingCount > 1 ? "次のイベントへ" : "確認して続ける"}
        </button>
      </section>
    </div>
  );
}
