/**
 * Turn a shared spreadsheet link (Google Sheets, OneDrive/SharePoint Excel, or
 * any public CSV/XLSX URL) into a downloadable file buffer, so the same parsing
 * pipeline used for uploads can be reused.
 *
 * The linked document must be shared as "anyone with the link can view".
 */

import { detectSheetProvider } from "./sheet-providers";

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB
const FETCH_TIMEOUT_MS = 20_000;

export class RemoteSheetError extends Error {}

/** Basic SSRF guard: block non-public hosts for arbitrary user-supplied URLs. */
function assertPublicHost(hostname: string): void {
  const host = hostname.toLowerCase();
  if (
    host === "localhost" ||
    host === "::1" ||
    host.endsWith(".local") ||
    host.endsWith(".internal") ||
    /^127\./.test(host) ||
    /^10\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^169\.254\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host) ||
    /^0\./.test(host)
  ) {
    throw new RemoteSheetError("That host is not allowed.");
  }
}

function base64Url(input: string): string {
  return Buffer.from(input, "utf8")
    .toString("base64")
    .replace(/=+$/, "")
    .replace(/\//g, "_")
    .replace(/\+/g, "-");
}

/**
 * Map a share URL to a direct-download URL.
 * Returns the (possibly unchanged) URL plus a friendly provider label.
 */
export function resolveDownloadUrl(rawUrl: string): { url: string; provider: string } {
  // Classify with the same rules the browser uses, so client and server agree
  // and unusable links (bad URL, a Google Doc rather than a Sheet) fail fast
  // with a friendly message.
  const info = detectSheetProvider(rawUrl);
  if (!info.ok) {
    throw new RemoteSheetError(info.hint || "That doesn't look like a valid URL.");
  }

  const parsed = new URL(rawUrl.trim());
  const host = parsed.hostname.toLowerCase();

  // --- Google Sheets ---
  if (host === "docs.google.com" && parsed.pathname.includes("/spreadsheets/")) {
    // Already an export/gviz endpoint? Leave it alone.
    if (parsed.pathname.includes("/export") || parsed.pathname.includes("/gviz/")) {
      return { url: parsed.toString(), provider: "Google Sheets" };
    }
    const idMatch = /\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/.exec(parsed.pathname);
    if (!idMatch) {
      throw new RemoteSheetError("Could not read the Google Sheets ID from that link.");
    }
    const id = idMatch[1];
    const gid =
      parsed.searchParams.get("gid") ??
      /[#&]gid=(\d+)/.exec(parsed.hash + parsed.search)?.[1] ??
      null;
    const exportUrl = new URL(
      `https://docs.google.com/spreadsheets/d/${id}/export`
    );
    exportUrl.searchParams.set("format", "csv");
    if (gid) exportUrl.searchParams.set("gid", gid);
    return { url: exportUrl.toString(), provider: "Google Sheets" };
  }

  // --- Microsoft OneDrive / SharePoint ---
  // The anonymous Shares API resolves "anyone with link" shares to file content
  // for both personal OneDrive and SharePoint/business links.
  if (
    host === "1drv.ms" ||
    host === "onedrive.live.com" ||
    host.endsWith(".onedrive.com") ||
    host.endsWith(".sharepoint.com")
  ) {
    const encoded = base64Url(parsed.toString());
    return {
      url: `https://api.onedrive.com/v1.0/shares/u!${encoded}/root/content`,
      provider: "Microsoft OneDrive",
    };
  }

  // --- Any other public URL: fetch as-is ---
  assertPublicHost(host);
  return { url: parsed.toString(), provider: "Direct link" };
}

/** Fetch a shared spreadsheet and return its bytes. */
export async function fetchRemoteSheet(
  rawUrl: string
): Promise<{ buffer: Buffer; provider: string }> {
  const { url, provider } = resolveDownloadUrl(rawUrl);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(url, {
      redirect: "follow",
      signal: controller.signal,
      headers: { "User-Agent": "PayrollPortal/1.0", Accept: "*/*" },
    });
  } catch (e) {
    throw new RemoteSheetError(
      e instanceof Error && e.name === "AbortError"
        ? "The link took too long to respond."
        : "Could not reach that link."
    );
  } finally {
    clearTimeout(timeout);
  }

  if (!res.ok) {
    throw new RemoteSheetError(
      `The link returned ${res.status}. Make sure it is shared as "anyone with the link can view".`
    );
  }

  const contentType = res.headers.get("content-type") ?? "";
  const buffer = Buffer.from(await res.arrayBuffer());

  if (buffer.byteLength === 0) {
    throw new RemoteSheetError("The link returned an empty file.");
  }
  if (buffer.byteLength > MAX_BYTES) {
    throw new RemoteSheetError("That file is too large (max 10 MB).");
  }

  // A sign-in / error page instead of the file usually comes back as HTML.
  const head = buffer.subarray(0, 200).toString("latin1").trimStart().toLowerCase();
  if (
    contentType.includes("text/html") ||
    head.startsWith("<!doctype html") ||
    head.startsWith("<html")
  ) {
    throw new RemoteSheetError(
      'The link is not publicly accessible. Set sharing to "anyone with the link can view" and try again.'
    );
  }

  return { buffer, provider };
}
