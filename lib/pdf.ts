import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import puppeteer, { type Browser } from "puppeteer-core";
import { env } from "./env";
import { renderSlipHtml, type SlipTemplateData } from "./slip-template";

/**
 * muhammara is a native (node-pre-gyp) module. Turbopack crashes trying to
 * parse its package.json (missing `napi_versions`), so we load it through a
 * bundler-ignored dynamic import at runtime. Because the tracer can't see this
 * import, muhammara + its deps are force-included in the deployed bundle via
 * `outputFileTracingIncludes` in next.config (and copied explicitly in the
 * Dockerfile). It also stays in `serverExternalPackages`.
 */
type Muhammara = typeof import("muhammara");
let muhammaraPromise: Promise<Muhammara> | null = null;
async function getMuhammara(): Promise<Muhammara> {
  if (!muhammaraPromise) {
    muhammaraPromise = import(/* turbopackIgnore: true */ "muhammara").then(
      (mod) => ((mod as { default?: Muhammara }).default ?? mod) as Muhammara
    );
  }
  return muhammaraPromise;
}

/** Common system Chrome/Chromium locations (local dev, Docker image). */
const CHROME_CANDIDATES = [
  "/usr/bin/google-chrome-stable",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
  "/snap/bin/chromium",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
];

/** A usable system Chrome path, or null if none is present (e.g. serverless). */
function resolveLocalChrome(): string | null {
  if (env.puppeteerExecutablePath && fs.existsSync(env.puppeteerExecutablePath)) {
    return env.puppeteerExecutablePath;
  }
  return CHROME_CANDIDATES.find((p) => fs.existsSync(p)) ?? null;
}

const globalForBrowser = globalThis as unknown as { __pdfBrowser?: Browser };

/** Launch (once) and reuse a headless browser instance. */
async function getBrowser(): Promise<Browser> {
  const existing = globalForBrowser.__pdfBrowser;
  if (existing && existing.connected) return existing;
  const browser = await launchBrowser();
  globalForBrowser.__pdfBrowser = browser;
  return browser;
}

/**
 * Launch Chromium. Prefer a system binary (local dev / the Docker image). On
 * serverless platforms with no system Chrome (Vercel, AWS Lambda), fall back to
 * @sparticuz/chromium, a Chromium build packaged for those runtimes.
 */
async function launchBrowser(): Promise<Browser> {
  const localPath = resolveLocalChrome();
  if (localPath) {
    return puppeteer.launch({
      executablePath: localPath,
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
    });
  }
  const chromium = (await import("@sparticuz/chromium")).default;
  // HTML-to-PDF needs no GPU; skip the graphics stack for a faster, lighter cold start.
  chromium.setGraphicsMode = false;
  return puppeteer.launch({
    args: chromium.args,
    executablePath: await chromium.executablePath(),
    headless: true,
  });
}

export async function closeBrowser(): Promise<void> {
  if (globalForBrowser.__pdfBrowser) {
    await globalForBrowser.__pdfBrowser.close();
    globalForBrowser.__pdfBrowser = undefined;
  }
}

/** Render the salary-slip HTML to an A4 PDF buffer. */
export async function renderSlipPdf(data: SlipTemplateData): Promise<Buffer> {
  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    // The slip HTML is fully self-contained (inline CSS, no remote assets),
    // so "load" is sufficient and avoids waiting on idle network.
    await page.setContent(renderSlipHtml(data), { waitUntil: "load" });
    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "0", bottom: "0", left: "0", right: "0" },
    });
    return Buffer.from(pdf);
  } finally {
    await page.close();
  }
}

/**
 * Password-protect a PDF buffer with AES encryption via muhammara (qpdf-free).
 * muhammara operates on files, so we round-trip through the OS temp dir.
 */
export async function encryptPdf(input: Buffer, password: string): Promise<Buffer> {
  const muhammara = await getMuhammara();
  const dir = os.tmpdir();
  const token = crypto.randomBytes(8).toString("hex");
  const inPath = path.join(dir, `slip-${token}-in.pdf`);
  const outPath = path.join(dir, `slip-${token}-out.pdf`);
  try {
    fs.writeFileSync(inPath, input);
    muhammara.recrypt(inPath, outPath, {
      password: password, // owner password
      userPassword: password, // required to open the document
      ownerPassword: password,
      userProtectionFlag: 4, // allow printing
    });
    return fs.readFileSync(outPath);
  } finally {
    for (const p of [inPath, outPath]) {
      try {
        fs.unlinkSync(p);
      } catch {
        /* ignore cleanup errors */
      }
    }
  }
}

/** Render + encrypt in one step. */
export async function renderEncryptedSlipPdf(
  data: SlipTemplateData,
  password: string
): Promise<Buffer> {
  const pdf = await renderSlipPdf(data);
  return await encryptPdf(pdf, password);
}
