import { useEffect, useRef } from "react";
import type { MapEventMessage } from "../application/resolve-map-events";

export interface MapEventDialogProps {
  event: MapEventMessage;
  remainingCount: number;
  disabled?: boolean;
  onAcknowledge: (eventId: string) => void;
  onChooseChoice: (eventId: string, choiceId: string) => void;
}

export function MapEventDialog({
  event,
  remainingCount,
  disabled = false,
  onAcknowledge,
  onChooseChoice
}: MapEventDialogProps) {
  const dialogRef = useRef<HTMLElement>(null);
  const continueButtonRef = useRef<HTMLButtonElement>(null);
  const choiceButtonRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const hasChoices = (event.choices?.length ?? 0) > 0;

  useEffect(() => {
    // Actions are disabled while the event acknowledgement is being persisted.
    // Focus only after saving completes, then defer past the opening click's default action.
    if (disabled) return;
    const frame = window.requestAnimationFrame(() => {
      focusFirstAvailableAction();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [event.id, hasChoices, disabled]);

  function focusableActions(): HTMLButtonElement[] {
    if (hasChoices) {
      return choiceButtonRefs.current
        .slice(0, event.choices?.length ?? 0)
        .filter((button): button is HTMLButtonElement => button !== null && !button.disabled);
    }
    return continueButtonRef.current && !continueButtonRef.current.disabled
      ? [continueButtonRef.current]
      : [];
  }

  function focusFirstAvailableAction(): void {
    const firstAction = focusableActions()[0];
    if (firstAction) firstAction.focus();
    else dialogRef.current?.focus();
  }

  return (
    <div
      className="map-event-dialog-backdrop"
      data-testid="map-event-dialog-backdrop"
      onClick={(clickEvent) => {
        if (clickEvent.target === clickEvent.currentTarget) {
          focusFirstAvailableAction();
        }
      }}
    >
      <section
        ref={dialogRef}
        tabIndex={-1}
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
            const actions = focusableActions();
            keyboardEvent.preventDefault();
            if (actions.length === 0) {
              dialogRef.current?.focus();
              return;
            }
            const activeIndex = actions.indexOf(document.activeElement as HTMLButtonElement);
            const lastIndex = actions.length - 1;
            const nextIndex = keyboardEvent.shiftKey
              ? activeIndex <= 0 ? lastIndex : activeIndex - 1
              : activeIndex < 0 || activeIndex === lastIndex ? 0 : activeIndex + 1;
            actions[nextIndex]?.focus();
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
        {hasChoices ? (
          <div className="map-event-choice-list" role="group" aria-label="会話の選択肢">
            {event.choices!.map((choice, index) => (
              <button
                key={choice.id}
                ref={(button) => { choiceButtonRefs.current[index] = button; }}
                className="secondary-button block-button map-event-choice-button"
                type="button"
                data-testid="map-event-choice"
                disabled={disabled}
                onClick={() => onChooseChoice(event.id, choice.id)}
              >
                {choice.label}
              </button>
            ))}
          </div>
        ) : (
          <button
            ref={continueButtonRef}
            className="primary-button block-button map-event-dialog-continue"
            type="button"
            disabled={disabled}
            onClick={() => onAcknowledge(event.id)}
          >
            {remainingCount > 1 ? "次のイベントへ" : "確認して続ける"}
          </button>
        )}
      </section>
    </div>
  );
}
