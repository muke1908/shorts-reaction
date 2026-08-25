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
    records: [],
    metadata: {
      startedAt: "2026-08-25T00:00:00.000Z",
      completedAt: "2026-08-25T00:00:02.000Z",
      keywordSeeds: ["indian politics"],
      scanQuery: "indian politics",
      sourceStrategy: "hybrid",
      usedFallback: false,
      itemCount: 0,
      outputFiles: [],
      workflowFiles: []
    }
  };

  const firstCategoryDumpPayload = {
    generatedAt: "2026-08-25T00:00:00.000Z",
    requestedDay: null,
    categorySlug: "direct-imports",
    categoryName: "Direct imports",
    searchQuery: "indian politics",
    records: [
      {
        id: "short-001",
        title: "Sample direct import",
        url: "https://www.youtube.com/shorts/short-001",
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
        keywordSeed: "indian politics",
        matchedKeywords: [],
        llmReview: {
          keep: true,
          relevant: true,
          spam: false,
          viralityScore: 47,
          confidence: 0.86,
          reason: "Legacy review without sentiment should still render.",
          evidenceSummary: "Back-compat pipeline payload."
        },
        score: 42,
        scoreBreakdown: {
          reach: 10,
          viewVelocity: 8,
          engagement: 9,
          conversation: 5,
          freshness: 10,
          sourceCompletenessPenalty: 0,
          total: 42,
          reasons: []
        },
        source: "youtube-web"
      }
    ],
    metadata: {
      startedAt: "2026-08-25T00:00:00.000Z",
      completedAt: "2026-08-25T00:00:02.000Z",
      keywordSeeds: ["indian politics"],
      scanQuery: "indian politics",
      parentCategorySlug: null,
      parentCategoryName: null,
      sourceStrategy: "hybrid",
      usedFallback: false,
      itemCount: 1,
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
        parentCategorySlug: null,
        parentCategoryName: null,
        latestQuery: "indian politics",
        latestScanAt: "2026-08-25T00:00:02.000Z",
        recordCount: 0,
        scanCount: 1,
        queries: ["indian politics"],
        dominantSentiment: null,
        sentimentTotals: {
          positive: 0,
          negative: 0,
          neutral: 0,
          mixed: 0
        }
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

  void page.route("**/api/dump**", async (route) => {
    const payload = route.request().url().includes("category=direct-imports")
      ? firstCategoryDumpPayload
      : dumpPayload;
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(payload) });
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

test("landing page quick reaction entry opens the pipeline surface", async () => {
  const page = await browser.newPage();

  try {
    mockPipelineApis(page);

    await page.goto(TEST_BASE_URL);

    await page.getByRole("heading", { name: "What do you want to create?" }).waitFor();
    await page.getByRole("button", { name: "Get started" }).waitFor();

    await page.getByRole("button", { name: "Get started" }).click();

    await page.waitForURL(`${TEST_BASE_URL}/pipeline`);
    await page.getByRole("heading", { name: "Reaction studio" }).waitFor();
    await page.getByRole("button", { name: "Submit" }).waitFor();
    await page.getByText("Sample direct import").waitFor();
    await page.getByText("Copilot reason: Legacy review without sentiment should still render.").waitFor();
  } finally {
    await page.close();
  }
});

test("pipeline direct URL flow opens advanced recorder for user-media providers", async () => {
  const page = await browser.newPage();

  try {
    mockPipelineApis(page);
    await page.route("**/api/user-reaction/preview?**", async (route) => {
      await new Promise((resolvePromise) => {
        setTimeout(resolvePromise, 250);
      });
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

    await page.goto(`${TEST_BASE_URL}/pipeline`);
    await page.getByRole("button", { name: "Submit" }).waitFor();

    const processButton = page.locator(".direct-url-panel .process-button");
    assert.equal(await processButton.textContent(), "Submit");

    await page.getByLabel("Pipeline").selectOption("user-media-sunglasses");
    assert.equal(await processButton.textContent(), "Submit");

    await page.getByLabel("YouTube URL").fill("https://example.com/watch?v=abc123DEF45");
    await processButton.click();
    await page.getByText("Paste a valid YouTube URL before you submit.").waitFor();

    await page.getByLabel("YouTube URL").fill("https://youtu.be/abc123DEF45");
    assert.equal(await processButton.textContent(), "Submit");
    assert.equal(await processButton.isDisabled(), false);

    await processButton.click();

    await page.waitForURL(/\/advanced\/user-reaction\?/);
    await page.getByRole("status").getByText("Loading source video...").waitFor();
    assert.match(page.url(), /provider=user-media-sunglasses/);
    assert.match(page.url(), /sourceUrl=https%3A%2F%2Fyoutu\.be%2Fabc123DEF45/);
    assert.equal(await page.getByRole("button", { name: "Close advanced user reaction" }).isVisible(), true);

    await page.getByRole("button", { name: "Close advanced user reaction" }).click();
    await page.waitForURL(`${TEST_BASE_URL}/pipeline`);
  } finally {
    await page.close();
  }
});
