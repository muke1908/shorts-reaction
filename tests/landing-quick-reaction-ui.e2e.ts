import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import type { Browser, Page } from "playwright";
import { chromium } from "playwright";

const TEST_PORT = 4317;
const TEST_BASE_URL = `http://127.0.0.1:${TEST_PORT}`;
const UI_DIST_INDEX = resolve(process.cwd(), "ui-dist/index.html");

let browser: Browser;
let serverProcess: ReturnType<typeof spawn> | null = null;

async function runCommand(command: string, args: string[], env: NodeJS.ProcessEnv = process.env): Promise<void> {
  await new Promise<void>((resolvePromise, rejectPromise) => {
    const child = spawn(command, args, {
      cwd: process.cwd(),
      env,
      stdio: "inherit"
    });

    child.once("error", rejectPromise);
    child.once("exit", (code) => {
      if (code === 0) {
        resolvePromise();
        return;
      }

      rejectPromise(new Error(`${command} ${args.join(" ")} exited with code ${code ?? "unknown"}.`));
    });
  });
}

async function ensureUiBuild(): Promise<void> {
  if (existsSync(UI_DIST_INDEX)) {
    return;
  }

  await runCommand("npm", ["run", "build"]);
}

async function waitForHealth(): Promise<void> {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const response = await fetch(`${TEST_BASE_URL}/api/health`);
      if (response.ok) {
        return;
      }
    } catch {
      // Keep polling until the server is ready.
    }

    await new Promise((resolvePromise) => {
      setTimeout(resolvePromise, 500);
    });
  }

  throw new Error("Timed out waiting for the UI server to become healthy.");
}

async function startTestServer(): Promise<void> {
  serverProcess = spawn("npm", ["run", "serve"], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      PIPELINE_PORT: String(TEST_PORT)
    },
    stdio: "pipe"
  });

  let output = "";
  serverProcess.stdout?.on("data", (chunk: Buffer | string) => {
    output += chunk.toString();
  });
  serverProcess.stderr?.on("data", (chunk: Buffer | string) => {
    output += chunk.toString();
  });

  serverProcess.once("exit", (code) => {
    if (code && code !== 0) {
      console.error(output);
    }
  });

  await waitForHealth();
}

async function stopTestServer(): Promise<void> {
  if (!serverProcess) {
    return;
  }

  const currentProcess = serverProcess;
  serverProcess = null;
  currentProcess.kill("SIGTERM");

  await Promise.race([
    once(currentProcess, "exit").then(() => undefined),
    new Promise<void>((resolvePromise) => {
      setTimeout(() => {
        currentProcess.kill("SIGKILL");
        resolvePromise();
      }, 3000);
    })
  ]);
}

function mockPipelineApis(page: Page): void {
  const dumpPayload = {
    generatedAt: "2026-08-25T00:00:00.000Z",
    requestedDay: null,
    categorySlug: "direct-imports",
    categoryName: "Direct imports",
    searchQuery: "indian politics",
    records: [],
    metadata: {
      startedAt: "2026-08-25T00:00:00.000Z",
      completedAt: "2026-08-25T00:00:02.000Z",
      keywordSeeds: ["indian politics"],
      scanQuery: "indian politics",
      parentCategorySlug: "direct-imports",
      parentCategoryName: "Direct imports",
      sourceStrategy: "hybrid",
      usedFallback: false,
      itemCount: 0,
      outputFiles: [],
      workflowFiles: []
    }
  };

  const categoryPayload = {
    generatedAt: "2026-08-25T00:00:00.000Z",
    categories: [
      {
        slug: "direct-imports",
        name: "Direct imports",
        latestQuery: "indian politics",
        latestScanAt: "2026-08-25T00:00:02.000Z",
        recordCount: 0,
        scanCount: 1,
        queries: ["indian politics"]
      }
    ]
  };

  const copilotPayload = {
    active: false,
    phase: "idle",
    pid: null,
    binary: null,
    model: "default",
    startedAt: null,
    finishedAt: null,
    lastUpdatedAt: "2026-08-25T00:00:00.000Z",
    completedInvocations: 0,
    totals: {
      premiumRequests: 0,
      nanoAiu: 0,
      apiDurationMs: 0,
      inputTokens: 0,
      outputTokens: 0,
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
      reasoningTokens: 0,
      lastCallInputTokens: 0,
      lastCallOutputTokens: 0
    },
    lastInvocation: null,
    error: null
  };

  const serverStatusPayload = {
    pid: 1,
    sampledAt: "2026-08-25T00:00:00.000Z",
    uptimeSeconds: 1,
    cpuPercent: 0,
    cpuCoreCount: 8,
    rssBytes: 10,
    heapUsedBytes: 10,
    heapTotalBytes: 10,
    externalBytes: 0,
    arrayBuffersBytes: 0,
    loadAverage: [0, 0, 0],
    nodeVersion: process.version,
    platform: process.platform
  };

  void page.route("**/api/dump", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(dumpPayload) });
  });
  void page.route("**/api/categories", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(categoryPayload) });
  });
  void page.route("**/api/copilot/status", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(copilotPayload) });
  });
  void page.route("**/api/server/status", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(serverStatusPayload) });
  });
}

test.before(async () => {
  await ensureUiBuild();
  await startTestServer();
  browser = await chromium.launch();
});

test.after(async () => {
  await browser.close();
  await stopTestServer();
});

test("landing page clearly routes customers into the right surface", async () => {
  const page = await browser.newPage();

  try {
    mockPipelineApis(page);

    await page.goto(TEST_BASE_URL);

    assert.equal(
      await page.getByRole("heading", { name: "What do you want to create?" }).isVisible(),
      true
    );
    assert.equal(await page.getByRole("button", { name: "Record a quick reaction" }).isVisible(), true);
    assert.equal(await page.getByRole("button", { name: "Open pipeline" }).isVisible(), true);

    await page.getByRole("button", { name: "Open pipeline" }).click();

    await page.waitForURL(`${TEST_BASE_URL}/pipeline`);
    await page.getByRole("heading", { name: "Discover, rank, and process Shorts from one control surface." }).waitFor();
    await page.getByRole("button", { name: "Process URL" }).waitFor();
  } finally {
    await page.close();
  }
});

test("quick reaction workflow validates input and preserves the selected mode into the recorder", async () => {
  const page = await browser.newPage();

  try {
    await page.route("**/api/user-reaction/preview?**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          requestedDay: null,
          categorySlug: null,
          previewVideoUrl: "/generated/mock-preview.mp4",
          record: {
            id: "abc123DEF45",
            title: "Sample Short",
            url: "https://www.youtube.com/shorts/abc123DEF45",
            channel: "Sample Channel",
            channelId: null,
            description: "",
            publishedAt: "2026-08-25T00:00:00.000Z",
            captureTimestamp: "2026-08-25T00:00:00.000Z",
            views: 1000,
            likes: 100,
            comments: 10,
            commentsEnabled: true,
            durationSeconds: 20,
            keywordSeed: "direct-url",
            matchedKeywords: [],
            llmReview: null,
            score: 0,
            scoreBreakdown: {
              reach: 0,
              viewVelocity: 0,
              engagement: 0,
              conversation: 0,
              freshness: 0,
              sourceCompletenessPenalty: 0,
              total: 0,
              reasons: []
            },
            source: "youtube-web"
          }
        })
      });
    });
    await page.route("**/generated/mock-preview.mp4", async (route) => {
      await route.fulfill({ status: 200, contentType: "video/mp4", body: "" });
    });

    await page.goto(`${TEST_BASE_URL}/quick-reaction`);

    assert.equal(
      await page.getByRole("heading", { name: "Set up your reaction take." }).isVisible(),
      true
    );

    const openRecorderButton = page.getByRole("button", { name: "Open recorder" });
    assert.equal(await openRecorderButton.isDisabled(), true);

    await page.getByLabel("YouTube URL").fill("https://example.com/watch?v=abc123DEF45");
    await page.locator(".quick-reaction-start__support--error").waitFor();
    assert.match(
      (await page.locator(".quick-reaction-start__support").textContent()) ?? "",
      /Enter a valid YouTube URL/
    );
    assert.equal(await openRecorderButton.isDisabled(), true);

    await page.getByLabel("YouTube URL").fill("https://youtu.be/abc123DEF45");
    await page.getByLabel("Reaction mode").selectOption("user-media-sunglasses");

    await page.locator(".quick-reaction-start__support--valid").waitFor();
    assert.match(
      (await page.locator(".quick-reaction-start__support").textContent()) ?? "",
      /https:\/\/www\.youtube\.com\/shorts\/abc123DEF45/
    );
    assert.match(
      (await page.locator(".quick-reaction-start__mode-copy").textContent()) ?? "",
      /face-following sunglasses mask/
    );
    assert.equal(await openRecorderButton.isDisabled(), false);

    await openRecorderButton.click();

    await page.waitForURL(/\/quick-reaction\/advanced\?/);
    assert.match(page.url(), /provider=user-media-sunglasses/);
    assert.match(page.url(), /sourceUrl=https%3A%2F%2Fwww\.youtube\.com%2Fshorts%2Fabc123DEF45/);
    assert.equal(await page.getByRole("button", { name: "Close advanced user reaction" }).isVisible(), true);

    await page.getByRole("button", { name: "Close advanced user reaction" }).click();
    await page.waitForURL(`${TEST_BASE_URL}/quick-reaction`);
  } finally {
    await page.close();
  }
});
