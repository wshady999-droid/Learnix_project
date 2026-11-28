"use client";

import { useEffect, useState } from "react";
import {
  Download,
  EyeOff,
  FileSpreadsheet,
  FileText,
  Image as ImageIcon,
  Presentation,
  RefreshCw,
  Video,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import {
  extractDocumentPreviewAction,
  getFileSignedUrl,
  type ExtractedDocumentPreview,
} from "@/lib/supabase/signed-urls";
import { cn } from "@/lib/utils";

export type LearnixFileCategory =
  | "pdf"
  | "word"
  | "powerpoint"
  | "excel"
  | "video"
  | "image"
  | "text"
  | "archive"
  | "unsupported";

export interface LearnixFilePreviewProps {
  bucketId: string;
  storagePath: string;
  fileName: string;
  mimeType?: string | null;
  fileSizeBytes?: number | null;
  className?: string;
}

export function categorizeLearnixFile(
  mimeType?: string | null,
  fileName?: string,
): LearnixFileCategory {
  const mime = (mimeType ?? "").toLowerCase();
  const name = (fileName ?? "").toLowerCase();

  if (mime.startsWith("video/") || /\.(mp4|webm|mov|avi|mkv)$/.test(name)) {
    return "video";
  }
  if (
    mime.startsWith("image/") ||
    /\.(jpg|jpeg|png|webp|avif|gif|svg)$/.test(name)
  ) {
    return "image";
  }
  if (mime === "application/pdf" || name.endsWith(".pdf")) {
    return "pdf";
  }
  if (
    mime.includes("word") ||
    mime.includes("msword") ||
    mime.includes("wordprocessingml") ||
    name.endsWith(".doc") ||
    name.endsWith(".docx")
  ) {
    return "word";
  }
  if (
    mime.includes("powerpoint") ||
    mime.includes("presentationml") ||
    name.endsWith(".ppt") ||
    name.endsWith(".pptx")
  ) {
    return "powerpoint";
  }
  if (
    mime.includes("excel") ||
    mime.includes("spreadsheetml") ||
    name.endsWith(".xls") ||
    name.endsWith(".xlsx") ||
    name.endsWith(".csv")
  ) {
    return "excel";
  }
  if (
    mime.startsWith("text/") ||
    name.endsWith(".txt") ||
    name.endsWith(".md")
  ) {
    return "text";
  }
  if (name.endsWith(".zip") || name.endsWith(".rar") || name.endsWith(".7z")) {
    return "archive";
  }
  return "unsupported";
}

function formatFileSize(bytes?: number | null): string {
  if (!bytes) return "";
  const units = ["B", "KB", "MB", "GB"];
  let size = bytes;
  let unitIdx = 0;
  while (size >= 1024 && unitIdx < units.length - 1) {
    size /= 1024;
    unitIdx++;
  }
  return `${size.toFixed(1)} ${units[unitIdx]}`;
}

export function LearnixFilePreview({
  bucketId,
  storagePath,
  fileName,
  mimeType,
  fileSizeBytes,
  className,
}: LearnixFilePreviewProps) {
  const category = categorizeLearnixFile(mimeType, fileName);
  const isOffice =
    category === "word" || category === "powerpoint" || category === "excel";
  const isExtractable =
    isOffice || category === "text" || fileName.toLowerCase().endsWith(".csv");

  const [retryTick, setRetryTick] = useState(0);
  const previewKey = `${bucketId}:${storagePath}:${fileName}:${retryTick}`;
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [extracted, setExtracted] = useState<ExtractedDocumentPreview | null>(
    null,
  );
  const [officeMode, setOfficeMode] = useState<"embed" | "reader">(
    fileName.toLowerCase().endsWith(".csv") ? "reader" : "embed",
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    getFileSignedUrl({
      bucketId,
      storagePath,
      fileName,
    })
      .then(async (res) => {
        if (cancelled) return;
        if (!res.ok) {
          setError(res.error ?? "Unable to load secure file preview.");
          return;
        }
        setError(null);
        setSignedUrl(res.data.signedUrl);
        setDownloadUrl(res.data.downloadUrl);

        if (isExtractable) {
          const extRes = await extractDocumentPreviewAction({
            bucketId,
            storagePath,
            fileName,
          });
          if (!cancelled && extRes.ok) {
            setExtracted(extRes.data);
          }
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError("Unable to load file preview.");
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoadedKey(previewKey);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [bucketId, storagePath, fileName, isExtractable, previewKey]);

  const loading = loadedKey !== previewKey;

  function handleRetryPreview() {
    setError(null);
    setRetryTick((prev) => prev + 1);
  }

  const officeEmbedUrl = signedUrl
    ? `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(signedUrl)}`
    : null;

  return (
    <Card className={cn("border-border/80 bg-card/60", className)}>
      <CardHeader className="flex flex-wrap items-center justify-between gap-2 pb-3">
        <div className="flex min-w-0 items-center gap-2">
          {category === "pdf" && (
            <FileText className="size-4 shrink-0 text-emerald-500" />
          )}
          {category === "word" && (
            <FileText className="size-4 shrink-0 text-blue-500" />
          )}
          {category === "powerpoint" && (
            <Presentation className="size-4 shrink-0 text-orange-500" />
          )}
          {category === "excel" && (
            <FileSpreadsheet className="size-4 shrink-0 text-green-500" />
          )}
          {category === "video" && (
            <Video className="size-4 shrink-0 text-red-500" />
          )}
          {category === "image" && (
            <ImageIcon className="size-4 shrink-0 text-purple-500" />
          )}
          {!["pdf", "word", "powerpoint", "excel", "video", "image"].includes(
            category,
          ) && <FileText className="size-4 shrink-0 text-muted-foreground" />}
          <span className="max-w-[260px] truncate text-sm font-semibold text-foreground">
            {fileName}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          {isOffice && !fileName.toLowerCase().endsWith(".csv") && (
            <div className="inline-flex rounded-lg border border-border/70 bg-background/60 p-0.5 text-[11px]">
              <button
                type="button"
                onClick={() => setOfficeMode("embed")}
                className={cn(
                  "rounded-md px-2 py-0.5 font-medium transition-colors",
                  officeMode === "embed"
                    ? "bg-emerald-600 text-white"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                Office Viewer
              </button>
              <button
                type="button"
                onClick={() => setOfficeMode("reader")}
                className={cn(
                  "rounded-md px-2 py-0.5 font-medium transition-colors",
                  officeMode === "reader"
                    ? "bg-emerald-600 text-white"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                Quick Reader
              </button>
            </div>
          )}
          <Badge variant="outline" className="text-[10px] uppercase">
            {category}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="flex min-h-[320px] flex-col items-center justify-center gap-3">
        {loading && (
          <div className="flex flex-col items-center gap-2">
            <Spinner />
            <p className="text-xs text-muted-foreground">
              Preparing secure preview…
            </p>
          </div>
        )}

        {!loading && error && (
          <div className="flex flex-col items-center gap-2 p-4 text-center">
            <EyeOff className="size-6 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">{error}</p>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRetryPreview}
            >
              <RefreshCw className="mr-1 size-3.5" />
              Retry
            </Button>
          </div>
        )}

        {!loading && !error && signedUrl && (
          <>
            {category === "pdf" && (
              <div className="h-[480px] w-full overflow-hidden rounded-lg border border-border/60 bg-background">
                <iframe
                  src={signedUrl}
                  className="h-full w-full"
                  title={fileName}
                />
              </div>
            )}

            {category === "video" && (
              <div className="aspect-video w-full overflow-hidden rounded-lg border border-border/60 bg-black">
                <video src={signedUrl} controls className="h-full w-full">
                  Your browser does not support video playback.
                </video>
              </div>
            )}

            {category === "image" && (
              <div className="w-full overflow-hidden rounded-lg border border-border/60 bg-background/50 p-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={signedUrl}
                  alt={fileName}
                  className="mx-auto h-auto max-h-[520px] w-full object-contain"
                />
              </div>
            )}

            {isOffice && officeMode === "embed" && officeEmbedUrl && (
              <div className="h-[480px] w-full overflow-hidden rounded-lg border border-border/60 bg-background">
                <iframe
                  src={officeEmbedUrl}
                  className="h-full w-full"
                  title={fileName}
                />
              </div>
            )}

            {((isOffice && officeMode === "reader") || category === "text") && (
              <div className="max-h-[460px] w-full space-y-4 overflow-y-auto rounded-lg border border-border/60 bg-background/80 p-4 text-xs">
                {!extracted || extracted.sections.length === 0 ? (
                  <p className="text-muted-foreground">
                    No inline text extracted. Switch to Office Viewer or click
                    Download to inspect the original file.
                  </p>
                ) : (
                  extracted.sections.map((sec, idx) => (
                    <div key={idx} className="space-y-2">
                      <h4 className="font-semibold text-foreground">
                        {sec.heading}
                      </h4>
                      {sec.rows && sec.rows.length > 0 ? (
                        <div className="overflow-x-auto rounded border border-border/60">
                          <table className="w-full border-collapse text-left text-[11px]">
                            <tbody>
                              {sec.rows.map((row, rIdx) => (
                                <tr
                                  key={rIdx}
                                  className="border-b border-border/40 odd:bg-muted/25"
                                >
                                  {row.map((cell, cIdx) => (
                                    <td
                                      key={cIdx}
                                      className="border-r border-border/30 px-2.5 py-1.5 text-foreground"
                                    >
                                      {cell}
                                    </td>
                                  ))}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <div className="space-y-1.5 leading-relaxed text-muted-foreground">
                          {sec.lines.map((line, lIdx) => (
                            <p key={lIdx}>{line}</p>
                          ))}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}

            {(category === "archive" || category === "unsupported") && (
              <div className="flex flex-col items-center gap-3 p-6 text-center">
                <EyeOff className="size-8 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  Archive or binary format — click Download below to open locally.
                </p>
              </div>
            )}
          </>
        )}
      </CardContent>

      <CardFooter className="flex items-center justify-between gap-2 border-t border-border/60 pt-3">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>{category.toUpperCase()}</span>
          {fileSizeBytes ? (
            <>
              <span>•</span>
              <span>{formatFileSize(fileSizeBytes)}</span>
            </>
          ) : null}
        </div>
        {downloadUrl && (
          <Button asChild variant="outline" size="sm">
            <a href={downloadUrl} download={fileName}>
              <Download className="mr-1 size-3.5" />
              <span>Download Original</span>
            </a>
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}
