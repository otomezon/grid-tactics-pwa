import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { MapInteractionPoint } from "../application/perform-map-interaction";
import { MapInteractionPanel } from "./map-interaction-panel";

const interaction: MapInteractionPoint = {
  id: "prototype-investigation",
  label: "試作調査地点",
  description: "探索コマンドの動作確認用地点です。",
  position: { x: 9, y: 8 },
  unitId: null,
  recruitName: null
};

describe("MapInteractionPanel", () => {
  it("shows the active unit, label, description, and action cost", () => {
    const html = renderToStaticMarkup(createElement(MapInteractionPanel, {
      interaction,
      unitName: "味方04",
      onInteract: () => undefined
    }));
    expect(html).toContain("味方04");
    expect(html).toContain("試作調査地点");
    expect(html).toContain("探索コマンドの動作確認用地点です。");
    expect(html).toContain("このフェイズの行動を消費します");
    expect(html).toContain("調べる");
    expect(html).not.toContain("disabled=\"\"");
  });

  it("disables interaction while the battle is locked", () => {
    const html = renderToStaticMarkup(createElement(MapInteractionPanel, {
      interaction,
      unitName: "味方04",
      disabled: true,
      onInteract: () => undefined
    }));
    expect(html).toContain("disabled=\"\"");
  });

  it("explains a recruitment event and uses an explicit join action", () => {
    const html = renderToStaticMarkup(createElement(MapInteractionPanel, {
      interaction: { ...interaction, recruitName: "加入候補" },
      unitName: "味方04",
      onInteract: () => undefined
    }));
    expect(html).toContain("加入イベント");
    expect(html).toContain("加入候補");
    expect(html).toContain("控え名簿に加入します");
    expect(html).toContain("加入する");
    expect(html).not.toContain(">調べる</button>");
  });

});
