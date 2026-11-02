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

test("top-four analytics rank independently of the inspector and update from the live feed", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator(".island").first()).toBeVisible();
  const baseline = await (await page.request.get("/api/snapshot")).json();
  const fixture = {
    ...baseline,
    revision: baseline.revision + 10000,
    participants: 50,
    topics: [30, 20, 10, 5, 2].map((contributors, index) => ({
      ...baseline.topics[0],
      id: `analytics-${index}`,
      label: `Category ${String.fromCharCode(65 + index)}`,
      contributors,
      messages: [40, 90, 15, 8, 4][index],
      pinned: index === 4,
      hidden: false,
      trend: index - 2,
      spark: Array.from({ length: 12 }, (_, bin) => (bin + index) % 7),
    })),
  };
  let sendSnapshot = (_snapshot: typeof fixture) => {};
  await page.routeWebSocket("**/ws", (socket) => {
    sendSnapshot = (snapshot) =>
      socket.send(JSON.stringify({ type: "snapshot", ...snapshot }));
    sendSnapshot(fixture);
  });
  await page.route("**/api/snapshot", (route) =>
    route.fulfill({ json: fixture }),
  );
  await page.reload();
  const analytics = page.getByRole("region", {
    name: "Four topics. The whole pulse.",
  });
  const headings = analytics.locator(".topic-chart-heading h3");
  await expect(headings).toHaveText([
    "Category A",
    "Category B",
    "Category C",
    "Category D",
  ]);
  await expect(analytics.locator(".analytics-feed")).toContainText(
    "Updating every second",
  );
  await expect(
    analytics.getByText("Shared y-axis · people / 10s"),
  ).toBeVisible();
  const charts = analytics.locator(".topic-chart-card > svg[viewBox]");
  await expect(charts).toHaveCount(4);
  for (const chart of await charts.all())
    await expect(chart).toHaveAttribute("aria-label", /shared scale 0 to 8/);
  await analytics
    .getByRole("combobox", { name: "Rank top topics by" })
    .selectOption("messages");
  await expect(headings).toHaveText([
    "Category B",
    "Category A",
    "Category C",
    "Category D",
  ]);
  await analytics
    .getByRole("combobox", { name: "Rank top topics by" })
    .selectOption("contributors");
  fixture.revision++;
  fixture.topics[4].contributors = 40;
  fixture.topics[4].messages = 65;
  fixture.topics[4].spark[11] = 14;
  sendSnapshot(fixture);
  await expect(headings).toHaveText([
    "Category E",
    "Category A",
    "Category B",
    "Category C",
  ]);
  await expect(
    analytics
      .locator(".topic-chart-card")
      .first()
      .locator(".topic-chart-metrics > div")
      .first(),
  ).toContainText("40");
  await expect(charts.first()).toHaveAttribute(
    "aria-label",
    /shared scale 0 to 16/,
  );
  await analytics
    .getByRole("img", {
      name: "10–0s ago: 14 distinct contributors",
      exact: true,
    })
    .focus();
  await expect(analytics.locator(".topic-chart-caption").first()).toContainText(
    "10–0s ago · 14 people",
  );
  await analytics.getByText("View exact chart data", { exact: true }).click();
  await expect(analytics.getByRole("table").getByRole("row")).toHaveCount(13);
  await expect(
    analytics
      .getByRole("table")
      .getByRole("row")
      .last()
      .getByRole("cell")
      .first(),
  ).toHaveText("14");
});

test("overlay renders ranked clusters and per-topic mentions without private quotes", async ({
  page,
  browser,
}) => {
  await page.goto("/");
  await expect(page.locator(".island").first()).toBeVisible();
  await page.getByRole("button", { name: "Overlay", exact: true }).click();
  await page.getByRole("button", { name: "Create link", exact: true }).click();
  const link = await page.locator(".overlay-link code").textContent();
  const context = await browser.newContext();
  const overlay = await context.newPage();
  const snapshot = await (await page.request.get("/api/snapshot")).json();
  const fixture = {
    ...snapshot,
    topics: [7, 18, 12, 4, 20].map((contributors, i) => ({
      ...snapshot.topics[0],
      id: `cluster-${i}`,
      label: `Topic ${i}`,
      contributors,
      messages: contributors * 2,
      approved: i !== 4,
      hidden: false,
      highlights: [
        { label: "Survival", contributors: contributors - 1 },
        { label: "Building", contributors: 2 },
      ],
      evidence: [{ text: "Private test message", name: "Private author" }],
    })),
    settings: { ...snapshot.settings, showEvidence: false, paused: false },
  };
  await overlay.route("**/api/overlay/snapshot", (route) =>
    route.fulfill({ json: fixture }),
  );
  await overlay.routeWebSocket("**/ws/overlay", (socket) =>
    socket.send(JSON.stringify({ type: "snapshot", ...fixture })),
  );
  await overlay.goto(link!);
  await expect(overlay.locator(".broadcast-topic-cluster")).toHaveCount(3);
  await expect(overlay.locator(".broadcast-cluster-pill strong")).toHaveText([
    "Topic 1",
    "Topic 2",
    "Topic 0",
  ]);
  for (const cluster of await overlay.locator(".broadcast-topic-cluster").all())
    await expect(cluster.locator(".broadcast-highlights li")).toHaveCount(2);
  await expect(overlay.getByText("Private test message")).toHaveCount(0);
  await overlay.goto(overlay.url().replace("layout=compact", "layout=atlas"));
  await expect(overlay.locator(".broadcast-topic-cluster")).toHaveCount(4);
  await expect(
    overlay
      .locator(".broadcast-topic-cluster")
      .first()
      .locator(".broadcast-highlights li")
      .first(),
  ).toHaveText("Survival17");
  expect(
    await overlay.evaluate(
      () => getComputedStyle(document.documentElement).backgroundColor,
    ),
  ).toBe("rgba(0, 0, 0, 0)");
  await context.close();
});
