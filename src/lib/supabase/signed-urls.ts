"use server";

import { inflateRawSync } from "node:zlib";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireRole } from "@/services/db/utils";
import type { ServiceResult } from "@/types";

/**
 * Generates time-limited signed view & download URLs for a private Supabase Storage object.
 * Enforces role-based access at the RLS/bucket policy level and never exposes service-role keys.
 */
export async function getFileSignedUrl(params: {
  bucketId: string;
  storagePath: string;
  fileName?: string;
  expiresIn?: number;
}): Promise<
  ServiceResult<{
    signedUrl: string;
    downloadUrl: string;
    fileName: string;
  }>
> {
  const auth = await requireRole(["admin", "teacher", "student"]);
  if (!auth.ok) return auth;

  const supabase = await createSupabaseServerClient();
  const ttl = params.expiresIn ?? 3600;
  const segments = params.storagePath.split("/");
  const resolvedName =
    params.fileName?.trim() || segments[segments.length - 1] || "file";

  const [viewRes, downloadRes] = await Promise.all([
    supabase.storage.from(params.bucketId).createSignedUrl(params.storagePath, ttl),
    supabase.storage
      .from(params.bucketId)
      .createSignedUrl(params.storagePath, ttl, { download: resolvedName }),
  ]);

  if (viewRes.error || !viewRes.data?.signedUrl) {
    return {
      ok: false,
      error: viewRes.error?.message ?? "Failed to create secure file preview link.",
    };
  }

  return {
    ok: true,
    data: {
      signedUrl: viewRes.data.signedUrl,
      downloadUrl: downloadRes.data?.signedUrl ?? viewRes.data.signedUrl,
      fileName: resolvedName,
    },
  };
}

export interface ExtractedDocumentPreview {
  kind: "document" | "slides" | "spreadsheet" | "text";
  sections: Array<{
    heading: string;
    lines: string[];
    rows?: string[][];
  }>;
}

function decodeXmlEntities(input: string): string {
  return input
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)));
}

function readZipEntries(buf: Buffer): Map<string, string> {
  const entries = new Map<string, string>();
  let offset = 0;

  while (offset + 30 <= buf.length) {
    const sig = buf.readUInt32LE(offset);
    if (sig !== 0x04034b50) break;

    const bitFlag = buf.readUInt16LE(offset + 6);
    const method = buf.readUInt16LE(offset + 8);
    const compressedSize = buf.readUInt32LE(offset + 18);
    const nameLen = buf.readUInt16LE(offset + 26);
    const extraLen = buf.readUInt16LE(offset + 28);
    const nameStart = offset + 30;
    const dataStart = nameStart + nameLen + extraLen;

    if ((bitFlag & 0x08) !== 0 || dataStart + compressedSize > buf.length) {
      break;
    }

    const entryName = buf.subarray(nameStart, nameStart + nameLen).toString("utf8");
    const rawCompressed = buf.subarray(dataStart, dataStart + compressedSize);

    if (
      entryName.endsWith(".xml") &&
      (entryName.startsWith("word/") ||
        entryName.startsWith("ppt/slides/") ||
        entryName.startsWith("xl/"))
    ) {
      try {
        const contentBuf =
          method === 0
            ? rawCompressed
            : method === 8
              ? inflateRawSync(rawCompressed)
              : null;
        if (contentBuf) {
          entries.set(entryName, contentBuf.toString("utf8"));
        }
      } catch {
        // Ignore unreadable XML entry
      }
    }

    offset = dataStart + compressedSize;
  }

  return entries;
}

/**
 * Extracts structured readable content from DOCX, PPTX, XLSX, CSV, TXT, and MD files
 * stored in Supabase Storage without modifying the original uploaded file.
 */
export async function extractDocumentPreviewAction(params: {
  bucketId: string;
  storagePath: string;
  fileName: string;
}): Promise<ServiceResult<ExtractedDocumentPreview>> {
  const auth = await requireRole(["admin", "teacher", "student"]);
  if (!auth.ok) return auth;

  const supabase = await createSupabaseServerClient();
  const { data: blob, error } = await supabase.storage
    .from(params.bucketId)
    .download(params.storagePath);

  if (error || !blob) {
    return {
      ok: false,
      error: error?.message ?? "Unable to read document for preview.",
    };
  }

  const buf = Buffer.from(await blob.arrayBuffer());
  const lower = params.fileName.toLowerCase();

  if (lower.endsWith(".csv")) {
    const text = buf.toString("utf8").slice(0, 100_000);
    const rows = text
      .split(/\r?\n/)
      .filter((line) => line.trim().length > 0)
      .slice(0, 120)
      .map((line) => line.split(",").map((cell) => cell.trim().replace(/^"|"$/g, "")));
    return {
      ok: true,
      data: {
        kind: "spreadsheet",
        sections: [{ heading: params.fileName, lines: [], rows }],
      },
    };
  }

  if (lower.endsWith(".txt") || lower.endsWith(".md")) {
    const text = buf.toString("utf8").slice(0, 80_000);
    return {
      ok: true,
      data: {
        kind: "text",
        sections: [
          {
            heading: params.fileName,
            lines: text.split(/\r?\n/).slice(0, 400),
          },
        ],
      },
    };
  }

  const zipXml = readZipEntries(buf);

  if (lower.endsWith(".docx")) {
    const docXml = zipXml.get("word/document.xml") ?? "";
    const paragraphs = Array.from(docXml.matchAll(/<w:p\b[^>]*>([\s\S]*?)<\/w:p>/g))
      .map((m) => {
        const texts = Array.from(
          (m[1] ?? "").matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g),
        ).map((t) => decodeXmlEntities(t[1] ?? ""));
        return texts.join("").trim();
      })
      .filter((line) => line.length > 0);

    return {
      ok: true,
      data: {
        kind: "document",
        sections: [
          {
            heading: "Document Content",
            lines:
              paragraphs.length > 0
                ? paragraphs.slice(0, 300)
                : ["Use the Office Viewer tab or Download button to inspect embedded graphics."],
          },
        ],
      },
    };
  }

  if (lower.endsWith(".pptx")) {
    const slideKeys = Array.from(zipXml.keys())
      .filter((k) => /^ppt\/slides\/slide\d+\.xml$/.test(k))
      .sort((a, b) => {
        const na = Number(a.match(/slide(\d+)\.xml/)?.[1] ?? 0);
        const nb = Number(b.match(/slide(\d+)\.xml/)?.[1] ?? 0);
        return na - nb;
      });

    const sections = slideKeys.map((key, idx) => {
      const xml = zipXml.get(key) ?? "";
      const runs = Array.from(xml.matchAll(/<a:t>([\s\S]*?)<\/a:t>/g))
        .map((t) => decodeXmlEntities(t[1] ?? "").trim())
        .filter(Boolean);
      return {
        heading: `Slide ${idx + 1}`,
        lines: runs.length > 0 ? runs : ["(Visual / graphic slide)"],
      };
    });

    return {
      ok: true,
      data: {
        kind: "slides",
        sections:
          sections.length > 0
            ? sections
            : [{ heading: "Presentation", lines: ["Open Office Viewer tab or download slides."] }],
      },
    };
  }

  if (lower.endsWith(".xlsx")) {
    const sharedXml = zipXml.get("xl/sharedStrings.xml") ?? "";
    const sharedStrings = Array.from(sharedXml.matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>/g)).map(
      (si) =>
        Array.from((si[1] ?? "").matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g))
          .map((t) => decodeXmlEntities(t[1] ?? ""))
          .join(""),
    );

    const sheetKeys = Array.from(zipXml.keys())
      .filter((k) => /^xl\/worksheets\/sheet\d+\.xml$/.test(k))
      .sort();

    const sections = sheetKeys.slice(0, 5).map((key, idx) => {
      const xml = zipXml.get(key) ?? "";
      const rows = Array.from(xml.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g))
        .slice(0, 100)
        .map((rowMatch) => {
          const cells = Array.from(
            (rowMatch[1] ?? "").matchAll(/<c\b([^>]*)>([\s\S]*?)<\/c>/g),
          ).map((cellMatch) => {
            const attrs = cellMatch[1] ?? "";
            const inner = cellMatch[2] ?? "";
            const isShared = /\bt="s"/.test(attrs);
            const inlineStr = inner.match(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/)?.[1];
            if (inlineStr !== undefined) return decodeXmlEntities(inlineStr);
            const val = inner.match(/<v>([\s\S]*?)<\/v>/)?.[1] ?? "";
            if (isShared) {
              const sIdx = Number(val);
              return sharedStrings[sIdx] ?? val;
            }
            return decodeXmlEntities(val);
          });
          return cells;
        })
        .filter((r) => r.some((c) => c.trim().length > 0));

      return {
        heading: `Sheet ${idx + 1}`,
        lines: [],
        rows,
      };
    });

    return {
      ok: true,
      data: {
        kind: "spreadsheet",
        sections:
          sections.length > 0
            ? sections
            : [{ heading: "Workbook", lines: ["Open Office Viewer tab or download workbook."] }],
      },
    };
  }

  return {
    ok: true,
    data: {
      kind: "document",
      sections: [
        {
          heading: params.fileName,
          lines: ["Use the Office Viewer tab or Download button to view this file."],
        },
      ],
    },
  };
}
