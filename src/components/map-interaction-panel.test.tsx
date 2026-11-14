import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { MapInteractionPoint } from "../application/perform-map-interaction";
import { MapInteractionPanel } from "./map-interaction-panel";

const interaction: MapInteractionPoint = {
  id: "prototype-investigation",
  kind: "location",
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

  it("uses explicit labels for villages, treasure chests, and doors", () => {
    const cases = [
      { kind: "village" as const, heading: "村", action: "村を訪問する" },
      { kind: "treasure-chest" as const, heading: "宝箱", action: "宝箱を開ける" },
      { kind: "door" as const, heading: "扉", action: "扉を調べる" }
    ];
    for (const item of cases) {
      const html = renderToStaticMarkup(createElement(MapInteractionPanel, {
        interaction: { ...interaction, kind: item.kind },
        unitName: "味方04",
        onInteract: () => undefined
      }));
      expect(html).toContain(item.heading);
      expect(html).toContain(item.action);
    }
  });

  it("explains that door interactions do not silently change terrain passability", () => {
    const html = renderToStaticMarkup(createElement(MapInteractionPanel, {
      interaction: { ...interaction, kind: "door" },
      unitName: "味方04",
      onInteract: () => undefined
    }));
    expect(html).toContain("通行可否はマップの地形定義で管理");
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
