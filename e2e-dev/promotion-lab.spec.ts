import { expect, test } from "@playwright/test";

test("opens the isolated development-only promotion lab with 21 deterministic scenarios", async ({ page }) => {
  await page.goto("/?promotion-lab=1");

  const lab = page.getByTestId("promotion-lab");
  await expect(lab).toBeVisible();
  await expect(lab.getByRole("heading", { name: "昇格バランス試験室" })).toBeVisible();
  await expect(page.locator(".phase-badge")).toHaveCount(0);
  await expect(lab).toContainText("21ケース");
  await expect(lab.getByTestId("promotion-lab-profile-summary")).toContainText("seed: 735");

  const databases = await page.evaluate(async () => {
    if (typeof indexedDB.databases !== "function") return [];
    return (await indexedDB.databases())
      .map((database) => database.name)
      .filter((name): name is string => Boolean(name));
  });
  expect(databases).toEqual([]);

  await lab.getByLabel("昇格経路").selectOption("fighter");
  await lab.getByLabel("合成成長profile").selectOption("high");
  await expect(lab.getByTestId("promotion-lab-profile-summary")).toContainText("seed: 973");

  const strength = lab.getByTestId("promotion-lab-stat-strength").locator("td");
  await expect(strength).toHaveCount(5);
  await expect(strength.nth(0)).toHaveText("9");
  await expect(strength.nth(1)).toHaveText("11");
  await expect(strength.nth(2)).toHaveText("+2");
  await expect(strength.nth(3)).toHaveText("+2");
  await expect(strength.nth(4)).toHaveText("30");
});

test("the lab route does not mount the campaign UI", async ({ page }) => {
  await page.goto("/?promotion-lab=1");
  await expect(page.getByTestId("promotion-lab")).toBeVisible();
  await expect(page.locator(".app-shell")).toHaveCount(0);
});
