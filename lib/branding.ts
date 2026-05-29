import fs from "node:fs";
import path from "node:path";

/**
 * Server-side helpers for embedding the company logo into generated artifacts
 * (PDF slips and emails). The PNG lives in /public; we read it once and cache.
 */
const LOGO_PATH = path.join(process.cwd(), "public", "logo.png");

let cachedBuffer: Buffer | null | undefined;
let cachedDataUri: string | null | undefined;

/** Raw logo bytes, or null if the file is missing. Used for email CID attachments. */
export function getLogoBuffer(): Buffer | null {
  if (cachedBuffer === undefined) {
    try {
      cachedBuffer = fs.readFileSync(LOGO_PATH);
    } catch {
      cachedBuffer = null;
    }
  }
  return cachedBuffer;
}

/** Base64 data URI for inline <img> use (headless-Chrome PDF rendering). */
export function getLogoDataUri(): string | null {
  if (cachedDataUri === undefined) {
    const buf = getLogoBuffer();
    cachedDataUri = buf ? `data:image/png;base64,${buf.toString("base64")}` : null;
  }
  return cachedDataUri;
}

/** Content-ID referenced from email HTML as <img src="cid:..."> . */
export const LOGO_CID = "company-logo";
