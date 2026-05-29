"use client";

import { useMemo, useState } from "react";
import { AlertCircle, CheckCircle2, Link2, Loader2, Upload } from "lucide-react";
import { FileDrop } from "@/components/file-drop";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { detectSheetProvider } from "@/lib/sheet-providers";

interface SheetSourceProps {
  onFile: (file: File) => void;
  onUrl: (url: string) => void;
  disabled?: boolean;
  busy?: boolean;
  selectedName?: string | null;
}

/**
 * Lets the admin provide a spreadsheet either by uploading a file or by pasting
 * a share link (Google Sheets / OneDrive / any public CSV-XLSX URL). Both paths
 * feed the same preview pipeline.
 */
export function SheetSource({
  onFile,
  onUrl,
  disabled,
  busy,
  selectedName,
}: SheetSourceProps) {
  const [url, setUrl] = useState("");

  // Live classification of whatever's currently typed — drives the provider
  // badge, the inline hint/error, and whether the fetch is allowed.
  const trimmed = url.trim();
  const info = useMemo(() => detectSheetProvider(trimmed), [trimmed]);
  const canFetch = trimmed.length > 0 && info.ok && !disabled;

  return (
    <Tabs defaultValue="file" className="w-full">
      <TabsList className="w-full">
        <TabsTrigger value="file">
          <Upload className="size-4" /> Upload file
        </TabsTrigger>
        <TabsTrigger value="link">
          <Link2 className="size-4" /> Import from link
        </TabsTrigger>
      </TabsList>

      <TabsContent value="file" className="mt-4">
        <FileDrop onFile={onFile} disabled={disabled} selectedName={selectedName} />
      </TabsContent>

      <TabsContent value="link" className="mt-4 space-y-3">
        <form
          className="flex flex-col gap-2 sm:flex-row"
          onSubmit={(e) => {
            e.preventDefault();
            if (canFetch) onUrl(trimmed);
          }}
        >
          <Input
            type="url"
            inputMode="url"
            placeholder="https://docs.google.com/spreadsheets/d/…  or  OneDrive / file link"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            disabled={disabled}
            aria-invalid={trimmed.length > 0 && !info.ok}
          />
          <Button type="submit" disabled={!canFetch} className="shrink-0">
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Link2 className="size-4" />}
            Fetch &amp; preview
          </Button>
        </form>

        {trimmed.length > 0 && info.hint && (
          <p
            className={
              info.ok
                ? "flex items-center gap-1.5 text-xs font-medium text-green-600"
                : "text-destructive flex items-center gap-1.5 text-xs font-medium"
            }
            role={info.ok ? undefined : "alert"}
          >
            {info.ok ? (
              <CheckCircle2 className="size-3.5 shrink-0" />
            ) : (
              <AlertCircle className="size-3.5 shrink-0" />
            )}
            {info.ok ? (
              <span>
                Detected: {info.label} — {info.hint}
              </span>
            ) : (
              <span>{info.hint}</span>
            )}
          </p>
        )}

        <div className="text-muted-foreground space-y-1 text-xs">
          <p className="text-foreground font-medium">
            The sheet must be shared as “anyone with the link can view”.
          </p>
          <ul className="list-inside list-disc space-y-0.5">
            <li>
              <strong>Google Sheets:</strong> Share → General access → “Anyone with
              the link”, then paste the normal sheet URL.
            </li>
            <li>
              <strong>Excel / OneDrive:</strong> Share → “Anyone with the link”,
              Copy link, then paste it here.
            </li>
            <li>
              <strong>Any URL:</strong> a direct link to a public .csv or .xlsx file
              also works.
            </li>
          </ul>
        </div>
      </TabsContent>
    </Tabs>
  );
}
