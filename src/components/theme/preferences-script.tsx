import { preferencesBootScript } from "@/lib/preferences";

/**
 * Inline, render-blocking script that applies persisted theme + sidebar state
 * before first paint (prevents flash of the wrong theme / layout shift).
 * Must be rendered inside <head> of the root layout (Server Component).
 */
export function PreferencesScript() {
  return <script dangerouslySetInnerHTML={{ __html: preferencesBootScript }} />;
}
