import { z } from "zod";

const bulkRowSchema = z.object({
  fullName: z.string().trim().min(2, "Full name must be at least 2 characters.").max(80),
  email: z.string().trim().email("Invalid email address."),
  role: z.enum(["student", "teacher"]).default("student"),
  phone: z.string().trim().max(25).optional(),
  departmentCode: z.string().trim().max(30).optional(),
  levelCode: z.string().trim().max(30).optional(),
});

export type BulkImportRow = z.infer<typeof bulkRowSchema>;

export interface BulkImportValidationIssue {
  rowNumber: number;
  rawEmail: string;
  message: string;
}

export interface BulkImportParseResult {
  validRows: BulkImportRow[];
  issues: BulkImportValidationIssue[];
}

function splitCsvLine(line: string, delimiter: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!;
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === delimiter && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}

/**
 * Parses and validates Excel-saved CSV / TSV / XML-table or tabular text files
 * for bulk student/teacher creation. Reports every row error before importing.
 */
export function parseAndValidateBulkUsers(rawContent: string): BulkImportParseResult {
  const normalized = rawContent.replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim();
  if (!normalized) {
    return {
      validRows: [],
      issues: [{ rowNumber: 1, rawEmail: "-", message: "The uploaded file is empty." }],
    };
  }

  const lines = normalized.split("\n").filter((l) => l.trim().length > 0);
  if (lines.length < 2) {
    return {
      validRows: [],
      issues: [
        {
          rowNumber: 1,
          rawEmail: "-",
          message:
            "File must include a header row (full_name,email,role,phone) and at least one data row.",
        },
      ],
    };
  }

  const headerLine = lines[0]!;
  const delimiter = headerLine.includes("\t")
    ? "\t"
    : headerLine.includes(";")
      ? ";"
      : ",";

  const headers = splitCsvLine(headerLine, delimiter).map((h) =>
    h.toLowerCase().replace(/[^a-z0-9_]/g, ""),
  );

  const nameIdx = headers.findIndex((h) =>
    ["fullname", "full_name", "name", "studentname"].includes(h),
  );
  const emailIdx = headers.findIndex((h) => ["email", "emailaddress"].includes(h));
  const roleIdx = headers.findIndex((h) => ["role", "accountrole"].includes(h));
  const phoneIdx = headers.findIndex((h) => ["phone", "phonenumber", "mobile"].includes(h));
  const deptIdx = headers.findIndex((h) =>
    ["department", "departmentcode", "department_code", "dept"].includes(h),
  );
  const levelIdx = headers.findIndex((h) =>
    ["level", "levelcode", "level_code", "educational_level"].includes(h),
  );

  if (nameIdx === -1 || emailIdx === -1) {
    return {
      validRows: [],
      issues: [
        {
          rowNumber: 1,
          rawEmail: "-",
          message:
            "Missing required header columns: 'full_name' and 'email' are required in the first row.",
        },
      ],
    };
  }

  const validRows: BulkImportRow[] = [];
  const issues: BulkImportValidationIssue[] = [];
  const seenEmails = new Set<string>();

  for (let i = 1; i < lines.length; i++) {
    const rowNumber = i + 1;
    const cols = splitCsvLine(lines[i]!, delimiter);

    const rawName = cols[nameIdx] ?? "";
    const rawEmail = (cols[emailIdx] ?? "").toLowerCase();
    const rawRole = (cols[roleIdx] ?? "student").toLowerCase() || "student";
    const rawPhone = phoneIdx !== -1 ? cols[phoneIdx] : undefined;
    const rawDept = deptIdx !== -1 ? cols[deptIdx] : undefined;
    const rawLevel = levelIdx !== -1 ? cols[levelIdx] : undefined;

    if (seenEmails.has(rawEmail)) {
      issues.push({
        rowNumber,
        rawEmail: rawEmail || "-",
        message: "Duplicate email address in uploaded file.",
      });
      continue;
    }

    if (rawRole !== "student" && rawRole !== "teacher") {
      issues.push({
        rowNumber,
        rawEmail: rawEmail || "-",
        message: `Invalid role '${rawRole}'. Bulk import allows 'student' or 'teacher' only (never 'admin').`,
      });
      continue;
    }

    const parsed = bulkRowSchema.safeParse({
      fullName: rawName,
      email: rawEmail,
      role: rawRole,
      phone: rawPhone || undefined,
      departmentCode: rawDept || undefined,
      levelCode: rawLevel || undefined,
    });

    if (!parsed.success) {
      issues.push({
        rowNumber,
        rawEmail: rawEmail || "-",
        message: parsed.error.issues.map((iss) => iss.message).join(" "),
      });
      continue;
    }

    seenEmails.add(rawEmail);
    validRows.push(parsed.data);
  }

  return { validRows, issues };
}

/**
 * Generates an Excel-compatible UTF-8 BOM CSV/Spreadsheet download in the browser.
 */
export function downloadExcelCsv(
  fileName: string,
  headers: readonly string[],
  rows: ReadonlyArray<ReadonlyArray<string | number | boolean | null | undefined>>,
) {
  const escapeCell = (val: string | number | boolean | null | undefined): string => {
    if (val === null || val === undefined) return "";
    const str = String(val);
    if (str.includes(",") || str.includes('"') || str.includes("\n")) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const lines = [
    headers.map(escapeCell).join(","),
    ...rows.map((row) => row.map(escapeCell).join(",")),
  ];

  // UTF-8 BOM ensures Microsoft Excel opens Arabic, German, Italian, and French characters cleanly
  const csvContent = "\uFEFF" + lines.join("\r\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = fileName.endsWith(".csv") ? fileName : `${fileName}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Opens a structured, print-styled report window for instant native PDF export.
 */
export function exportPrintablePdfReport(params: {
  title: string;
  subtitle: string;
  headers: readonly string[];
  rows: ReadonlyArray<ReadonlyArray<string | number | null | undefined>>;
}) {
  const printWin = window.open("", "_blank", "width=1024,height=768");
  if (!printWin) return;

  const escapeHtml = (input: string | number | null | undefined) =>
    String(input ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");

  const headCells = params.headers.map((h) => `<th>${escapeHtml(h)}</th>`).join("");
  const bodyRows = params.rows
    .map(
      (r) => `<tr>${r.map((c) => `<td>${escapeHtml(c)}</td>`).join("")}</tr>`,
    )
    .join("");

  printWin.document.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(params.title)} — Learnix</title>
  <style>
    body { font-family: system-ui, -apple-system, sans-serif; color: #202124; padding: 32px; }
    .brand { font-size: 12px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: #806127; }
    h1 { font-size: 22px; margin: 6px 0 4px; }
    p { font-size: 13px; color: #737373; margin: 0 0 20px; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; }
    th, td { border: 1px solid #e5e3df; padding: 8px 10px; text-align: start; }
    th { background: #f6f0e0; color: #202124; font-weight: 600; text-transform: uppercase; font-size: 11px; }
    tr:nth-child(even) td { background: #f8f8f7; }
  </style>
</head>
<body>
  <div class="brand">Learnix · Official Platform Report</div>
  <h1>${escapeHtml(params.title)}</h1>
  <p>${escapeHtml(params.subtitle)}</p>
  <table>
    <thead><tr>${headCells}</tr></thead>
    <tbody>${bodyRows}</tbody>
  </table>
  <script>window.onload = function() { window.print(); };</script>
</body>
</html>`);
  printWin.document.close();
}
