import type { CampaignChoiceHistoryEntry } from "../application/get-campaign-choice-history";

export interface CampaignChoiceHistoryPanelProps {
  entries: readonly CampaignChoiceHistoryEntry[];
  onClose: () => void;
}

export function CampaignChoiceHistoryPanel({ entries, onClose }: CampaignChoiceHistoryPanelProps) {
  return (
    <section
      id="campaign-choice-history-panel"
      className="campaign-choice-history-panel"
      role="region"
      aria-labelledby="campaign-choice-history-title"
      data-testid="campaign-choice-history"
      onKeyDown={(keyboardEvent) => {
        if (keyboardEvent.key === "Escape") {
          keyboardEvent.preventDefault();
          onClose();
        }
      }}
    >
      <header className="campaign-choice-history-header">
        <div>
          <p className="eyebrow">CAMPAIGN DECISIONS</p>
          <h2 id="campaign-choice-history-title">キャンペーン選択履歴</h2>
          <p className="campaign-choice-history-note">{entries.length}件 · 選択した順</p>
        </div>
        <button
          className="secondary-button campaign-choice-history-close"
          type="button"
          onClick={onClose}
        >
          閉じる
        </button>
      </header>
      <ol className="campaign-choice-history-list" aria-label="キャンペーン選択順">
        {entries.map((entry, index) => (
          <li key={entry.key}>
            <article
              className="campaign-choice-history-entry"
              data-testid="campaign-choice-history-entry"
              data-choice-key={entry.key}
            >
              <p className="campaign-choice-history-sequence">選択 {index + 1}</p>
              <p className="campaign-choice-history-source">
                {entry.chapterNumber === null
                  ? entry.chapterTitle
                  : `第${entry.chapterNumber}章 · ${entry.chapterTitle}`}
              </p>
              <h3>{entry.speaker ?? "会話"}</h3>
              {entry.prompt !== null && (
                <p className="campaign-choice-history-prompt">{entry.prompt}</p>
              )}
              <p className="campaign-choice-history-selected">
                選択: {entry.selectedLabel ?? `選択肢ID ${entry.choiceId}（現在の章データからラベルを参照できません）`}
              </p>
              {entry.prompt === null && (
                <p className="campaign-choice-history-fallback">
                  元イベントID: {entry.sourceEventId}
                </p>
              )}
            </article>
          </li>
        ))}
      </ol>
    </section>
  );
}
