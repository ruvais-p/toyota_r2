"use client";

import { useRef, useState } from "react";
import { UploadCloud, FileSpreadsheet } from "lucide-react";
import { cn } from "@/lib/utils";

interface FileDropProps {
  onFile: (file: File) => void;
  disabled?: boolean;
  selectedName?: string | null;
}

export function FileDrop({ onFile, disabled, selectedName }: FileDropProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  function handleFiles(files: FileList | null) {
    if (files && files[0]) onFile(files[0]);
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => !disabled && inputRef.current?.click()}
      onKeyDown={(e) => {
        if ((e.key === "Enter" || e.key === " ") && !disabled)
          inputRef.current?.click();
      }}
      onDragOver={(e) => {
        e.preventDefault();
        if (!disabled) setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        if (!disabled) handleFiles(e.dataTransfer.files);
      }}
      className={cn(
        "flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-6 py-10 text-center transition-colors",
        dragging
          ? "border-primary bg-primary/5"
          : "border-muted-foreground/25 hover:border-muted-foreground/50",
        disabled && "pointer-events-none opacity-60"
      )}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".csv,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />
      {selectedName ? (
        <>
          <FileSpreadsheet className="text-primary size-8" />
          <p className="text-sm font-medium">{selectedName}</p>
          <p className="text-muted-foreground text-xs">
            Click or drop another file to replace
          </p>
        </>
      ) : (
        <>
          <UploadCloud className="text-muted-foreground size-8" />
          <p className="text-sm font-medium">
            Click to upload or drag &amp; drop
          </p>
          <p className="text-muted-foreground text-xs">CSV or Excel (.xlsx, .xls)</p>
        </>
      )}
    </div>
  );
}
