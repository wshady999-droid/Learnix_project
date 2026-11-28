import type { ServiceResult } from "@/types";

/**
 * Returns today's date in the local calendar timezone as YYYY-MM-DD.
 * Safe for both browser UI `min` attributes and server-side checks.
 */
export function getTodayDateString(now: Date = new Date()): string {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Returns current local datetime formatted as YYYY-MM-DDTHH:mm for
 * `<input type="datetime-local" min={...} />`.
 */
export function getNowDateTimeLocalString(now: Date = new Date()): string {
  const datePart = getTodayDateString(now);
  const hours = String(now.getHours()).padStart(2, "0");
  const minutes = String(now.getMinutes()).padStart(2, "0");
  return `${datePart}T${hours}:${minutes}`;
}

/**
 * Converts an ISO timestamp into a local `YYYY-MM-DDTHH:mm` string for
 * `<input type="datetime-local" />` so timezones never shift on edit.
 */
export function isoToDateTimeLocalString(iso: string | null | undefined): string {
  if (!iso) return "";
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return "";
  return getNowDateTimeLocalString(parsed);
}

/**
 * Validates that a date string (YYYY-MM-DD or ISO) is not in the past.
 * Supports `allowExistingValue` so editing historical records without changing
 * their existing past date remains valid.
 */
export function validateNotPastDate(params: {
  date: string | null | undefined;
  fieldName?: string;
  allowExistingValue?: string | null;
}): ServiceResult<{ date: string | null; isToday: boolean }> {
  const field = params.fieldName ?? "Date";

  if (params.date === null || params.date === undefined || params.date.trim() === "") {
    return { ok: true, data: { date: null, isToday: false } };
  }

  let normalized = String(params.date).trim();
  if (normalized.includes("T")) {
    normalized = normalized.slice(0, 10);
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    return {
      ok: false,
      error: `Invalid ${field} format. Expected YYYY-MM-DD.`,
    };
  }

  if (params.allowExistingValue) {
    const prevNorm = params.allowExistingValue.slice(0, 10);
    if (prevNorm === normalized) {
      return { ok: true, data: { date: normalized, isToday: false } };
    }
  }

  // Account for UTC-12 earliest calendar day when running on a UTC server
  const earliestValidToday = getTodayDateString(
    new Date(Date.now() - 12 * 60 * 60 * 1000),
  );
  const localToday = getTodayDateString();
  const minAllowed = earliestValidToday < localToday ? earliestValidToday : localToday;

  if (normalized < minAllowed) {
    return {
      ok: false,
      error: `${field} cannot be in the past. Please choose today or a future date.`,
    };
  }

  return {
    ok: true,
    data: { date: normalized, isToday: normalized === localToday },
  };
}

/**
 * Validates that an ISO or datetime-local string is not in the past.
 * Preserves historical records when `allowExistingValue` matches the same instant.
 */
export function validateNotPastDateTime(params: {
  dateTime: string | null | undefined;
  fieldName?: string;
  allowExistingValue?: string | null;
}): ServiceResult<{ dateTime: string | null }> {
  const field = params.fieldName ?? "Date and time";

  if (
    params.dateTime === null ||
    params.dateTime === undefined ||
    params.dateTime.trim() === ""
  ) {
    return { ok: true, data: { dateTime: null } };
  }

  const parsed = new Date(params.dateTime);
  if (Number.isNaN(parsed.getTime())) {
    return {
      ok: false,
      error: `Invalid ${field} value.`,
    };
  }

  if (params.allowExistingValue) {
    const prev = new Date(params.allowExistingValue);
    if (
      !Number.isNaN(prev.getTime()) &&
      Math.abs(prev.getTime() - parsed.getTime()) < 60_000
    ) {
      return { ok: true, data: { dateTime: parsed.toISOString() } };
    }
  }

  // 2-minute clock-skew grace window
  if (parsed.getTime() < Date.now() - 2 * 60 * 1000) {
    return {
      ok: false,
      error: `${field} cannot be in the past. Please select a current or future date and time.`,
    };
  }

  return { ok: true, data: { dateTime: parsed.toISOString() } };
}
