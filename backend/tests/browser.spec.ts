import { test, expect, type Page } from "@playwright/test";
test.setTimeout(20000);
test.beforeEach(async ({ page }) => {
  await page.addLocatorHandler(
    page.getByRole("button", { name: "Close, remind me later", exact: true }),
    async () => {
      await page.evaluate(() =>
        document
          .querySelector<HTMLButtonElement>(
            'button[aria-label="Close, remind me later"]',
          )
          ?.click(),
      );
    },
  );
});
test("dashboard changes with known events and day-one Health does not invent a baseline", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "Before hydration event" }).click();
  await expect(
    page.getByRole("heading", { name: "Review your daily observations" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Hydration pattern", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Kidney stone risk pattern: Act" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Radiation event", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Solar storm exposure pattern: Act" }),
  ).toBeVisible();
  await page.getByLabel("Demo day", { exact: true }).fill("1");
  await page.getByRole("button", { name: "Health", exact: true }).click();
  await expect(
    page
      .getByText("Unknown", {
        exact: false,
      })
      .first(),
  ).toBeVisible();
  expect(errors).toEqual([]);
});
test("assistant escalation and report queue never claim transmission", async ({
  page,
}) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "Assistant", exact: true }).click();
  await page.getByLabel("Describe how you feel").fill("I have chest pain");
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await expect(
    page.getByText("Contact the crew medical officer immediately", {
      exact: false,
    }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Mission", exact: true }).click();
  await page.locator("#backend-tools > summary").click();
  await page
    .getByLabel("I reviewed and approve queuing this demo snapshot")
    .check();
  await page
    .getByRole("button", { name: "Draft and queue demo report" })
    .click();
  await expect(
    page.getByText("Nothing transmitted.", { exact: false }),
  ).toBeVisible();
});
test("daily logging persists and evidence is readable on a phone viewport", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "Daily Log", exact: true }).click();
  await page.getByRole("button", { name: "+250 ml", exact: true }).click();
  await page
    .getByRole("button", { name: "Save check-in", exact: true })
    .click();
  await expect(
    page.getByText("Saved locally and in the demo backend.", { exact: false }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Evidence", exact: true }).click();
  await page
    .getByText("Source registry and evidence limitations", { exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "The Human Body in Space" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});

test("production app reloads offline with cached data and shared rules", async ({
  page,
  context,
}) => {
  await page.goto("http://127.0.0.1:4173", { waitUntil: "domcontentloaded" });
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.waitForFunction(() => !!navigator.serviceWorker.controller);
  await context.setOffline(true);
  await page.reload({ waitUntil: "domcontentloaded" });
  await page
    .getByRole("button", { name: "Hydration pattern", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Kidney stone risk pattern: Act" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Assistant", exact: true }).click();
  await page.getByLabel("Describe how you feel").fill("I have chest pain");
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await expect(
    page.getByText("Contact the crew medical officer immediately", {
      exact: false,
    }),
  ).toBeVisible();
  await context.setOffline(false);
});

test("assistant generates a question-specific answer, links sources and carries follow-up context", async ({
  page,
}) => {
  await page.route("**/api/assistant/status", (route) =>
    route.fulfill({
      json: {
        configured: true,
        status: "configured_not_verified",
        model: "test-model",
        providerVerified: false,
        evidenceSources: 7,
        message: "Server configured. Model access not yet verified.",
      },
    }),
  );
  const requests: any[] = [];
  await page.route("**/api/assistant", async (route) => {
    const body = route.request().postDataJSON();
    requests.push(body);
    await route.fulfill({
      json: {
        mode: "grounded_ai",
        modelStatus: "available",
        providerDataSent: true,
        explanation:
          requests.length === 1
            ? "Sleep research documents sleep deficiency in the observed astronaut cohorts."
            : "This observational evidence does not establish your individual readiness.",
        paragraphs: [
          {
            text:
              requests.length === 1
                ? "Sleep research documents sleep deficiency in the observed astronaut cohorts."
                : "This observational evidence does not establish your individual readiness.",
            evidenceIds: ["sleep_2014:claim:1"],
            signalKeys: [],
          },
        ],
        citations: [
          {
            id: "sleep_2014",
            title: "Astronaut sleep study",
            source_url: "https://doi.org/10.1016/S1474-4422(14)70122-X",
            review_status: "domain_review_pending",
          },
        ],
        retrieval: {
          passages: [
            {
              id: "sleep_2014:claim:1",
              sourceId: "sleep_2014",
              text: "Documents sleep deficiency.",
            },
          ],
        },
        triage: { urgent: false },
        uncertainties: [],
        followUp: [],
        escalation: "Crew medical review",
        limitations: "Generated prototype answer; check sources.",
      },
    });
  });
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "Assistant", exact: true }).click();
  await page.getByLabel("Use hosted AI for this session").check();
  await page
    .getByLabel("Describe how you feel")
    .fill("What does research say about sleep in space?");
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await expect(
    page.getByText("AI-generated answer · check the cited sources", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Astronaut sleep study" }),
  ).toHaveAttribute("href", "https://doi.org/10.1016/S1474-4422(14)70122-X");
  await page
    .getByLabel("Describe how you feel")
    .fill("What does that mean for my readiness?");
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await expect(
    page.getByText(
      "This observational evidence does not establish your individual readiness.",
      { exact: true },
    ),
  ).toBeVisible();
  expect(requests[0].allowAI).toBe(true);
  expect(requests[1].history).toHaveLength(2);
  expect(requests[1].history[0].content).toContain("sleep in space");
  await page.getByRole("button", { name: "Aiko", exact: true }).click();
  await expect(
    page.getByText(
      "This observational evidence does not establish your individual readiness.",
      { exact: true },
    ),
  ).not.toBeVisible();
});

test("assistant clearly identifies an unavailable API instead of claiming AI answered", async ({
  page,
}) => {
  await page.route("**/api/assistant/status", (route) =>
    route.fulfill({ status: 404, json: { error: "not deployed" } }),
  );
  await page.route("**/api/assistant", (route) =>
    route.fulfill({ status: 405, json: { error: "not deployed" } }),
  );
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "Assistant", exact: true }).click();
  await expect(
    page.getByText(
      "AI backend unavailable. Offline safety and demonstration readouts remain available.",
      { exact: true },
    ),
  ).toBeVisible();
  await page
    .getByLabel("Describe how you feel")
    .fill("Why do astronauts sleep poorly?");
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await expect(
    page.getByText("Backend unavailable · offline fallback", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText(
      "The AI backend is unavailable, so I cannot generate an answer to this question.",
      { exact: false },
    ),
  ).toBeVisible();
});

test("an answer arriving after an astronaut switch is discarded", async ({
  page,
}) => {
  await page.route("**/api/assistant", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 500));
    await route.fulfill({
      json: {
        mode: "grounded_ai",
        modelStatus: "available",
        explanation: "Late answer for the previous astronaut",
        citations: [],
        triage: { urgent: false },
        followUp: [],
        escalation: "Review",
        limitations: "Test provider response",
      },
    });
  });
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "Assistant", exact: true }).click();
  await page.getByLabel("Describe how you feel").fill("Explain my readings");
  const sent = page.waitForRequest(
    (r) => r.url().endsWith("/api/assistant") && r.method() === "POST",
  );
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await sent;
  await page.getByRole("button", { name: "Aiko", exact: true }).click();
  await page.waitForTimeout(700);
  await expect(
    page.getByText("Late answer for the previous astronaut", { exact: true }),
  ).not.toBeVisible();
  await expect(
    page.getByRole("button", { name: "Ask about my readings", exact: false }),
  ).toBeVisible();
});
