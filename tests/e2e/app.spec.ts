import { test, expect } from "@playwright/test";
test("Demo evidence, keyboard composer, replacement ballots, closed results and read-only overlay", async ({
  page,
  browser,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Your chat. A little clearer." }),
  ).toBeVisible();
  await expect(
    page.getByText("Synthetic conversation", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page.getByRole("button", { name: "Reset Demo", exact: true }).click();
  await page.getByRole("button", { name: "Live room", exact: true }).click();
  await page.getByRole("button", { name: "Pause demo", exact: true }).click();
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Resume demo", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Resume demo", exact: true }).click();
  const island = page.getByRole("button", {
    name: /Minecraft discussion, \d+ people/,
  });
  await expect(island).toBeVisible();
  await island.click();
  await expect(
    page.getByRole("heading", { name: "What people are saying" }),
  ).toBeVisible();
  await expect(page.getByText("PRIVATE", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "New decision", exact: true }).focus();
  await page.keyboard.press("Enter");
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(
    dialog.getByRole("textbox", { name: "Your question" }),
  ).toBeFocused();
  await dialog.getByRole("button", { name: "Publish vote" }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByText("OPEN", { exact: true })).toBeVisible();
  const input = page.getByRole("textbox", { name: "Demo chat message" });
  await input.fill("!vote 1 3");
  await page.getByRole("button", { name: "Send demo message" }).click();
  await expect(
    page.getByText("1 valid voters · percentages may total more than 100%"),
  ).toBeVisible();
  await input.fill("!vote 2");
  await page.getByRole("button", { name: "Send demo message" }).click();
  await expect(
    page.getByText("1 valid voters · percentages may total more than 100%"),
  ).toBeVisible();
  await page.getByRole("button", { name: "Close & show results" }).click();
  await expect(page.getByText("CLOSED", { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText("CLOSED", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page.getByRole("button", { name: "Create link", exact: true }).click();
  const link = await page.locator(".overlay-link code").textContent();
  expect(link).toContain("#");
  const context = await browser.newContext();
  const overlay = await context.newPage();
  await overlay.goto(link!);
  await expect(
    overlay.getByRole("heading", { name: "What's chat talking about?" }),
  ).toBeVisible();
  await expect(overlay.getByText("DEMO", { exact: true })).toBeVisible();
  expect(overlay.url()).not.toContain("#");
  expect(
    await overlay.evaluate(
      () => getComputedStyle(document.documentElement).backgroundColor,
    ),
  ).toBe("rgba(0, 0, 0, 0)");
  const status = await overlay.evaluate(async () => {
    const r = await fetch("/api/decisions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Chatlas-Client": "dashboard",
      },
      body: "{}",
    });
    return r.status;
  });
  expect(status).toBe(401);
  await context.close();
});
test("responsive list view and reduced motion remain usable", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await page.getByRole("button", { name: "List view", exact: true }).click();
  await expect(page.getByPlaceholder("Find a topic…")).toBeVisible();
  await expect(page.locator("body")).not.toHaveJSProperty("scrollWidth", 0);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
