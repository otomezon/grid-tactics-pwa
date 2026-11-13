import { expect, test } from "@playwright/test";

test("opens deployment details with iPhone-sized WebKit touch input without horizontal overflow", async ({ page }) => {
  await page.goto("/");

  const title = page.getByTestId("campaign-title-screen");
  await expect(title).toBeVisible();
  await title.getByRole("button", { name: "はじめから" }).tap();

  await expect(page.getByRole("heading", { name: "出撃準備" })).toBeVisible();
  const archerCandidate = page.locator(".deployment-unit").filter({ hasText: "味方02" });
  await archerCandidate.getByRole("button", { name: "詳細" }).tap();

  const detailPanel = page.locator("#deployment-detail-panel");
  await expect(detailPanel.getByRole("heading", { name: "味方02" })).toBeVisible();

  // Check the normal iPhone 13 CSS viewport and a narrower portrait viewport.
  for (const viewport of [
    { width: 390, height: 844 },
    { width: 320, height: 568 }
  ]) {
    await page.setViewportSize(viewport);
    const dimensions = await page.evaluate(() => {
      const panel = document.querySelector("#deployment-detail-panel");
      if (!(panel instanceof HTMLElement)) {
        throw new Error("The deployment detail panel is missing.");
      }
      const rect = panel.getBoundingClientRect();
      return {
        viewportWidth: window.innerWidth,
        documentWidth: document.documentElement.scrollWidth,
        panelLeft: rect.left,
        panelRight: rect.right,
        panelWidth: rect.width
      };
    });

    expect(dimensions.documentWidth).toBeLessThanOrEqual(dimensions.viewportWidth);
    expect(dimensions.panelWidth).toBeGreaterThan(0);
    expect(dimensions.panelLeft).toBeGreaterThanOrEqual(-1);
    expect(dimensions.panelRight).toBeLessThanOrEqual(dimensions.viewportWidth + 1);
    await expect(detailPanel.getByRole("heading", { name: "味方02" })).toBeVisible();
  }
});
