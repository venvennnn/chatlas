import { test, expect } from "@playwright/test";
test("Demo evidence, keyboard composer, replacement ballots, closed results and read-only overlay", async ({
  page,
  browser,
}) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Live room" })).toBeVisible();
  await expect(
    page.getByText("Synthetic demo data", { exact: true }),
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
    page.getByRole("heading", { name: "Example messages" }),
  ).toBeVisible();
  await expect(
    page.getByText("Only visible to you", { exact: true }),
  ).toBeVisible();
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

test("snapshot server errors remain visible instead of falling back to Demo sign-in", async ({
  page,
}) => {
  let bootstrapCalls = 0;
  await page.route("**/api/snapshot", (route) =>
    route.fulfill({
      status: 409,
      json: { error: "Snapshot unavailable: regression fixture" },
    }),
  );
  await page.route("**/api/demo/bootstrap", (route) => {
    bootstrapCalls++;
    return route.fulfill({
      status: 403,
      json: { error: "Misleading authorization fallback" },
    });
  });
  await page.goto("/");
  await expect(page.getByRole("alert")).toContainText(
    "Snapshot unavailable: regression fixture",
  );
  expect(bootstrapCalls).toBe(0);
});

test("newly authorized owner sees Ready and can choose to start Live without auto-starting Demo", async ({
  page,
}) => {
  let starts = 0,
    bootstraps = 0;
  await page.route("**/api/snapshot", (route) =>
    route.fulfill({
      json: {
        schemaVersion: 1,
        revision: 1,
        session: null,
        connection: {
          state: "disconnected",
          channel: "test-owner",
          configured: true,
        },
        analysis: {
          provider: "Lexical test fixture",
          coverage: 1,
          queue: 0,
          windowSeconds: 120,
        },
        topics: [],
        decision: null,
        decisions: [],
        participants: 0,
        messageCount: 0,
        timeline: Array(24).fill(0),
        gaps: [],
        settings: { paused: false, showEvidence: false, area: "people" },
        playback: { paused: false, speed: 1, positionMs: null },
        sessions: [],
      },
    }),
  );
  await page.route("**/api/sessions/start", (route) => {
    starts++;
    return route.fulfill({ json: {} });
  });
  await page.route("**/api/demo/bootstrap", (route) => {
    bootstraps++;
    return route.fulfill({
      status: 403,
      json: { error: "Not a Demo installation" },
    });
  });
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "Start session", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("banner").getByText("READY", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("banner").getByText("@test-owner", { exact: true }),
  ).toBeVisible();
  expect(starts).toBe(0);
  expect(bootstraps).toBe(0);
  await expect(page.getByRole("alert")).toHaveCount(0);
});

test("Studio atlas exposes remaining topics through the list view", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator(".island").first()).toBeVisible();
  expect(await page.locator(".island").count()).toBeLessThanOrEqual(4);
  await page.getByRole("button", { name: /View all \d+ topics/ }).click();
  await expect(page.getByPlaceholder("Find a topic…")).toBeVisible();
  expect(await page.locator(".topic-row").count()).toBeGreaterThan(4);
  await expect(
    page
      .getByRole("banner")
      .getByRole("button", { name: "New decision", exact: true }),
  ).toBeVisible();
});

test("contributor testing toggle persists and shows a warning until disabled", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  const toggle = page.getByRole("checkbox", {
    name: /Each message is a unique contributor/,
  });
  if (await toggle.isChecked()) {
    await page
      .getByRole("button", { name: "Use real contributors", exact: true })
      .click();
    await expect(toggle).not.toBeChecked();
  }
  await toggle.check();
  await expect(
    page.getByText("TEST MODE — simulated contributors", { exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByText("TEST MODE — simulated contributors", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Use real contributors", exact: true })
    .click();
  await expect(
    page.getByText("TEST MODE — simulated contributors", { exact: true }),
  ).toHaveCount(0);
});

test("illustrated front page opens the workspace and dedicated overlay controls", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Big chat. Clear voices." }),
  ).toBeVisible();
  const illustration = await page.request.get("/images/streamer-room.png");
  expect(illustration.ok()).toBe(true);
  expect(illustration.headers()["content-type"]).toContain("image/png");
  await page
    .getByRole("link", { name: "Explore the demo", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Live room", exact: true }),
  ).toBeInViewport();
  await page.getByRole("button", { name: "Overlay", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Your community, on stream." }),
  ).toBeVisible();
  await expect(
    page.getByRole("combobox", { name: "Overlay layout" }),
  ).toBeVisible();
  await page
    .getByRole("combobox", { name: "Overlay layout" })
    .selectOption("voting");
  await expect(page.locator(".overlay-preview .broadcast-panel")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Twitch connection", exact: true }),
  ).toBeHidden();
});
