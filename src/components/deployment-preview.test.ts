import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { CHAPTER_01_MAP } from "../content/maps/chapter-01";
import { DeploymentPreview } from "./deployment-preview";

const candidates = [
  { id: "unit_001", name: "味方01", classId: "swordsman", level: 1 },
  { id: "unit_002", name: "味方02", classId: "archer", level: 1 },
  { id: "unit_003", name: "味方03", classId: "soldier", level: 1 },
  { id: "unit_004", name: "味方04", classId: "cavalry", level: 1 }
];
const assignments = {
  unit_001: "1,8",
  unit_002: "3,8",
  unit_003: "5,8",
  unit_004: "8,8"
};

function renderPreview(
  selectedUnitIds: string[] = candidates.map((unit) => unit.id),
  positions: Record<string, string> = assignments
) {
  return renderToStaticMarkup(createElement(DeploymentPreview, {
    map: CHAPTER_01_MAP,
    candidates,
    selectedUnitIds,
    assignments: positions,
    detailUnitId: null,
    disabled: false,
    onSelectUnit: vi.fn()
  }));
}

describe("DeploymentPreview", () => {
  it("shows the current selected party on its assigned map positions", () => {
    const html = renderPreview();
    expect(html).toContain("4 / 4か所");
    expect(html).toContain('aria-label="味方01、2列・9行に配置済み。詳細を表示"');
    expect(html).toContain('aria-label="味方04、9列・9行に配置済み。詳細を表示"');
    expect(html).toContain('data-position="1,8"');
    expect(html).toContain('data-position="8,8"');
    expect(html).toContain('aria-label="10列10行の出撃配置プレビュー"');
  });

  it("reflects a swapped assignment immediately", () => {
    const html = renderPreview(candidates.map((unit) => unit.id), {
      ...assignments,
      unit_001: "5,8",
      unit_003: "1,8"
    });
    expect(html).toContain('aria-label="味方01、6列・9行に配置済み。詳細を表示"');
    expect(html).toContain('aria-label="味方03、2列・9行に配置済み。詳細を表示"');
  });

  it("marks vacated slots when a candidate is kept in reserve", () => {
    const html = renderPreview(["unit_001", "unit_002", "unit_003"]);
    expect(html).toContain("3 / 4か所");
    expect(html).toContain('aria-label="空き出撃位置 4、9列・9行"');
    expect(html).not.toContain("味方04、9列・9行に配置済み");
  });
});
