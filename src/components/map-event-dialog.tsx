import { useEffect, useRef } from "react";
import type { MapEventMessage } from "../application/resolve-map-events";

export interface MapEventDialogProps {
  event: MapEventMessage;
  currentIndex: number;
  total: number;
  disabled?: boolean;
  onAcknowledge: (eventId: string) => void;
}

export function MapEventDialog({
  event,
  currentIndex,
  total,
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
      >
        <div className="map-event-dialog-heading">
          <p className="eyebrow">MAP EVENT</p>
          <span>{currentIndex} / {total}</span>
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
          {currentIndex < total ? "次のイベントへ" : "確認して続ける"}
        </button>
      </section>
    </div>
  );
}
