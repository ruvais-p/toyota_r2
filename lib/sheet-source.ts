import { fetchRemoteSheet, RemoteSheetError } from "./remote-sheet";

/**
 * Resolve an uploaded spreadsheet from a preview request's FormData. The form
 * may carry either an uploaded `file` or a `url` (Google Sheets / OneDrive /
 * direct link). Returns the file bytes or a user-facing error + HTTP status.
 */
export async function readSheetFromForm(
  form: FormData
): Promise<{ buffer: Buffer; provider: string } | { error: string; status: number }> {
  const file = form.get("file");
  if (file instanceof File && file.size > 0) {
    return { buffer: Buffer.from(await file.arrayBuffer()), provider: "Upload" };
  }

  const url = form.get("url");
  if (typeof url === "string" && url.trim()) {
    try {
      return await fetchRemoteSheet(url);
    } catch (e) {
      if (e instanceof RemoteSheetError) {
        return { error: e.message, status: 400 };
      }
      return { error: "Could not import from that link.", status: 400 };
    }
  }

  return { error: "Provide a file or a link to import.", status: 400 };
}
