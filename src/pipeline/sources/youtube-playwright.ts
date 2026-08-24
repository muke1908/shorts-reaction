import type { Browser, BrowserContext, Page } from "playwright";
import type { PipelineConfig, SourceItem } from "../../shared/types";
import { isEligibleShortCandidate, toShortsUrl } from "./shorts-eligibility";

const SHORTS_RESULTS_FILTER = "EgIYAQ%253D%253D";

interface ScrapedVideoDetails {
  title: string | null;
  description: string;
  channel: string | null;
  channelId: string | null;
  publishedAt: string | null;
  views: number | null;
  likes: number | null;
  comments: number | null;
  commentsEnabled: boolean;
  durationSeconds: number | null;
}

function decodeHtml(value: string): string {
  return value
    .replaceAll("&amp;", "&")
    .replaceAll("&quot;", "\"")
    .replaceAll("&#39;", "'")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">");
}

function extractPattern(html: string, pattern: RegExp): string | null {
  const match = html.match(pattern);
  return match ? decodeHtml(match[1]) : null;
}

function parseCompactNumber(value: string | null | undefined): number | null {
  if (!value) {
    return null;
  }

  const normalized = value.replace(/,/g, "").trim().toUpperCase();
  const match = normalized.match(/(\d+(?:\.\d+)?)([KMB])?/);
  if (!match) {
    return null;
  }

  const number = Number(match[1]);
  if (!Number.isFinite(number)) {
    return null;
  }

  switch (match[2]) {
    case "K":
      return Math.round(number * 1_000);
    case "M":
      return Math.round(number * 1_000_000);
    case "B":
      return Math.round(number * 1_000_000_000);
    default:
      return Math.round(number);
  }
}

function parseIntegerLike(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const normalized = value.replace(/,/g, "").trim();
    if (/^\d+$/.test(normalized)) {
      return Number(normalized);
    }
  }

  return null;
}

async function importPlaywright(): Promise<typeof import("playwright")> {
  return import("playwright");
}

async function launchBrowser(config: PipelineConfig): Promise<Browser> {
  const playwright = await importPlaywright();
  const launcher =
    config.playwrightBrowser === "firefox"
      ? playwright.firefox
      : config.playwrightBrowser === "webkit"
        ? playwright.webkit
        : playwright.chromium;

  try {
    return await launcher.launch({ headless: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/Executable doesn't exist|browserType\.launch/.test(message)) {
      throw new Error(
        `Playwright ${config.playwrightBrowser} is not installed. Run "npx playwright install ${config.playwrightBrowser}" before using browser-based Shorts scraping.`
      );
    }

    throw error;
  }
}

async function createContext(browser: Browser): Promise<BrowserContext> {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1200 },
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36",
    locale: "en-IN"
  });

  await context.route("**/*", async (route) => {
    const resourceType = route.request().resourceType();
    if (resourceType === "image" || resourceType === "font" || resourceType === "media" || resourceType === "stylesheet") {
      await route.abort();
      return;
    }

    await route.continue();
  });

  return context;
}

async function withPlaywrightContext<T>(
  config: PipelineConfig,
  work: (context: BrowserContext) => Promise<T>
): Promise<T> {
  const browser = await launchBrowser(config);
  const context = await createContext(browser);

  try {
    return await work(context);
  } finally {
    await context.close();
    await browser.close();
  }
}

async function collectShortIds(page: Page, keywordSeed: string, config: PipelineConfig): Promise<string[]> {
  const searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(keywordSeed)}&sp=${SHORTS_RESULTS_FILTER}`;
  await page.goto(searchUrl, {
    timeout: config.requestTimeoutMs,
    waitUntil: "domcontentloaded"
  });
  await page.waitForTimeout(700);

  const anchors = await page.locator('a[href^="/shorts/"]').all();
  const uniqueIds = new Set<string>();
  for (const anchor of anchors) {
    const href = await anchor.getAttribute("href");
    const match = href?.match(/\/shorts\/([A-Za-z0-9_-]{11})/);
    if (match) {
      uniqueIds.add(match[1]);
    }

    if (uniqueIds.size >= config.maxResultsPerQuery * 2) {
      break;
    }
  }

  return [...uniqueIds].slice(0, config.maxResultsPerQuery);
}

async function scrapeShortPage(page: Page, shortId: string, keywordSeed: string, config: PipelineConfig): Promise<SourceItem | null> {
  await page.goto(`https://www.youtube.com/watch?v=${shortId}`, {
    timeout: config.requestTimeoutMs,
    waitUntil: "domcontentloaded"
  });
  await page.waitForTimeout(900);
  await page.mouse.wheel(0, 1600);
  await page.waitForTimeout(900);

  const html = await page.content();
  const meta = async (selector: string): Promise<string | null> =>
    (await page.locator(selector).first().getAttribute("content").catch(() => null))?.trim() ?? null;
  const textBlocks = (await page.locator("button, yt-button-shape button, span, h2, yt-formatted-string").allTextContents())
    .map((value) => value.replace(/\s+/g, " ").trim())
    .filter(Boolean);

  const findLabeledCount = (texts: string[], label: "comment" | "like"): number | null => {
    const lowerLabel = `${label}s?`;
    for (const text of texts) {
      if (/turned off/i.test(text) && label === "comment") {
        return null;
      }

      const match = text.match(new RegExp(`(\\d[\\d,.]*\\s*[KMB]?)\\s*${lowerLabel}`, "i"));
      if (match) {
        return parseCompactNumber(match[1]);
      }
    }

    return null;
  };

  const commentsEnabled =
    textBlocks.some((text) => /^comments$/i.test(text) || /\d[\d,.]*\s*[KMB]?\s*comments?/i.test(text)) &&
    !textBlocks.some((text) => /comments? turned off/i.test(text));

  const details: ScrapedVideoDetails = {
    title:
      (await meta('meta[property="og:title"]')) ??
      extractPattern(html, /"title":"([^"]+)"/),
    description:
      (await meta('meta[name="description"]')) ??
      extractPattern(html, /"shortDescription":"([^"]*)"/) ??
      "",
    channel:
      extractPattern(html, /"author":"([^"]+)"/) ??
      extractPattern(html, /"ownerChannelName":"([^"]+)"/),
    channelId: extractPattern(html, /"channelId":"([^"]+)"/),
    publishedAt:
      (await meta('meta[itemprop="datePublished"]')) ??
      extractPattern(html, /"publishDate":"([^"]+)"/) ??
      extractPattern(html, /"uploadDate":"([^"]+)"/),
    views: parseIntegerLike(
      extractPattern(html, /"viewCount":"(\d+)"/) ??
      (await meta('meta[itemprop="interactionCount"]'))
    ),
    likes:
      parseIntegerLike(extractPattern(html, /"likeCount":"(\d+)"/)) ??
      findLabeledCount(textBlocks, "like"),
    comments:
      parseIntegerLike(extractPattern(html, /"commentCount":"(\d+)"/)) ??
      findLabeledCount(textBlocks, "comment"),
    commentsEnabled,
    durationSeconds: parseIntegerLike(extractPattern(html, /"lengthSeconds":"(\d+)"/))
  };

  if (!details.title || !details.channel || !details.publishedAt) {
    return null;
  }

  if (!isEligibleShortCandidate({ durationSeconds: details.durationSeconds, commentsEnabled: details.commentsEnabled })) {
    return null;
  }

  return {
    id: shortId,
    title: details.title,
    url: toShortsUrl(shortId),
    channel: details.channel,
    channelId: details.channelId,
    description: details.description,
    publishedAt: details.publishedAt,
    captureTimestamp: new Date().toISOString(),
    views: details.views,
    likes: details.likes,
    comments: details.comments,
    commentsEnabled: details.commentsEnabled,
    durationSeconds: details.durationSeconds,
    keywordSeed,
    source: "youtube-web"
  };
}

export async function searchWithYoutubePlaywright(config: PipelineConfig, keywordSeed: string): Promise<SourceItem[]> {
  return withPlaywrightContext(config, async (context) => {
    const searchPage = await context.newPage();

    try {
      const shortIds = await collectShortIds(searchPage, keywordSeed, config);
      const items: SourceItem[] = [];

      for (const shortId of shortIds) {
        const page = await context.newPage();
        try {
          const item = await scrapeShortPage(page, shortId, keywordSeed, config);
          if (item) {
            items.push(item);
          }
        } finally {
          await page.close();
        }

        if (items.length >= config.maxResultsPerQuery) {
          break;
        }
      }

      return items;
    } finally {
      await searchPage.close();
    }
  });
}

export async function searchManyWithYoutubePlaywright(config: PipelineConfig, keywordSeeds: string[]): Promise<SourceItem[]> {
  return withPlaywrightContext(config, async (context) => {
    const items: SourceItem[] = [];

    for (const keywordSeed of keywordSeeds) {
      const searchPage = await context.newPage();

      try {
        const shortIds = await collectShortIds(searchPage, keywordSeed, config);

        for (const shortId of shortIds) {
          const page = await context.newPage();
          try {
            const item = await scrapeShortPage(page, shortId, keywordSeed, config);
            if (item) {
              items.push(item);
            }
          } finally {
            await page.close();
          }

          if (items.filter((candidate) => candidate.keywordSeed === keywordSeed).length >= config.maxResultsPerQuery) {
            break;
          }
        }
      } finally {
        await searchPage.close();
      }
    }

    return items;
  });
}
