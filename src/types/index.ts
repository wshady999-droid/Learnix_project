export * from "@/types/database";
export * from "@/types/navigation";

/** Standard discriminated result wrapper for database and AI service calls. */
export type ServiceResult<T, E = string> =
  | { ok: true; data: T }
  | { ok: false; error: E };
