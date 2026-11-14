import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { MapEventMessage } from "../application/resolve-map-events";
import { MapEventDialog } from "./map-event-dialog";

describe("MapEventDialog", () => {
  it("renders authored dialogue choices instead of an acknowledgement button", () => {
    const onAcknowledge = vi.fn();
    const onChooseChoice = vi.fn();
    const event: MapEventMessage = {
      id: "dialogue",
      speaker: "案内人",
      text: "どちらへ進みますか？",
      choices: [
        { id: "left", label: "左へ進む" },
        { id: "right", label: "右へ進む" }
      ],
      selectedChoiceLabel: null
    };
    const html = renderToStaticMarkup(createElement(MapEventDialog, {
      event,
      remainingCount: 1,
      onAcknowledge,
      onChooseChoice
    }));
    expect(html).toContain("案内人");
    expect(html).toContain("どちらへ進みますか？");
    expect(html).toContain("左へ進む");
    expect(html).toContain("右へ進む");
    expect(html).toContain('role="dialog"');
    expect(html).toContain('aria-modal="true"');
    expect(html).toContain('aria-labelledby="map-event-dialog-title"');
    expect(html).toContain('aria-describedby="map-event-dialog-message"');
    expect(html).toContain('role="group"');
    expect(html).toContain('aria-label="会話の選択肢"');
    expect(html).toContain('data-testid="map-event-choice"');
    expect(html).not.toContain("確認して続ける");
  });

  it("keeps the ordinary acknowledgement flow for message-only events", () => {
    const html = renderToStaticMarkup(createElement(MapEventDialog, {
      event: { id: "message", speaker: null, text: "続けてください。" },
      remainingCount: 1,
      onAcknowledge: vi.fn(),
      onChooseChoice: vi.fn()
    }));
    expect(html).toContain("確認して続ける");
    expect(html).not.toContain('aria-label="会話の選択肢"');
  });
});
