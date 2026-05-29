/**
 * Client-safe detection of a shared-spreadsheet link's provider.
 *
 * Pure string logic — no Node `Buffer`/`fetch` — so it runs in the browser for
 * live feedback ("Detected: Google Sheets ✓") and link validation *before* the
 * URL is sent to the server. The server's `resolveDownloadUrl` reuses the same
 * rules, so the client and server always agree on what a link is.
 */

export type SheetProviderKind =
  | "google-sheets"
  | "onedrive"
  | "direct-file"
  | "google-doc" // a Google *Doc*, not a Sheet — has no tabular export
  | "unknown" // some other http(s) URL; might still be a public file
  | "invalid"; // not a usable URL

export interface SheetProviderInfo {
  kind: SheetProviderKind;
  /** Friendly provider name, e.g. "Google Sheets". Empty when not applicable. */
  label: string;
  /** True when the link looks importable; false blocks the fetch. */
  ok: boolean;
  /** Short guidance shown under the input (a hint when ok, an error when not). */
  hint: string;
}

const SHARE_HINT = "Make sure it’s shared as “Anyone with the link can view”.";

/** Classify a pasted share link without fetching it. */
export function detectSheetProvider(rawUrl: string): SheetProviderInfo {
  const trimmed = rawUrl.trim();
  if (!trimmed) return { kind: "invalid", label: "", ok: false, hint: "" };

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return {
      kind: "invalid",
      label: "",
      ok: false,
      hint: "That doesn’t look like a valid link.",
    };
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return {
      kind: "invalid",
      label: "",
      ok: false,
      hint: "Only http(s) links are supported.",
    };
  }

  const host = parsed.hostname.toLowerCase();
  const path = parsed.pathname.toLowerCase();

  if (host === "docs.google.com" && path.includes("/spreadsheets/")) {
    return { kind: "google-sheets", label: "Google Sheets", ok: true, hint: SHARE_HINT };
  }
  if (host === "docs.google.com" && path.includes("/document/")) {
    return {
      kind: "google-doc",
      label: "Google Docs",
      ok: false,
      hint: "That’s a Google Doc, not a Sheet. Open your data in Google Sheets and paste that link instead.",
    };
  }
  if (
    host === "1drv.ms" ||
    host === "onedrive.live.com" ||
    host.endsWith(".onedrive.com") ||
    host.endsWith(".sharepoint.com")
  ) {
    return { kind: "onedrive", label: "Microsoft OneDrive", ok: true, hint: SHARE_HINT };
  }
  if (/\.(csv|xlsx|xls)$/.test(path)) {
    return {
      kind: "direct-file",
      label: "Direct file",
      ok: true,
      hint: "A public link to a .csv or .xlsx file.",
    };
  }
  return {
    kind: "unknown",
    label: "Direct link",
    ok: true,
    hint: "We’ll try to fetch this as a public CSV/Excel file.",
  };
}
