import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { MapEventMessage } from "../application/resolve-map-events";
import { MapEventHistoryPanel } from "./map-event-history-panel";

describe("MapEventHistoryPanel", () => {
  it("replays the selected option for a dialogue event", () => {
    const events: MapEventMessage[] = [{
      id: "dialogue",
      speaker: "案内人",
      text: "どちらへ進みますか？",
      choices: [{ id: "left", label: "左へ進む" }, { id: "right", label: "右へ進む" }],
      selectedChoiceLabel: "左へ進む"
    }];
    const html = renderToStaticMarkup(createElement(MapEventHistoryPanel, {
      events,
      onClose: vi.fn()
    }));
    expect(html).toContain("どちらへ進みますか？");
    expect(html).toContain("選択:");
    expect(html).toContain("左へ進む");
  });
});
