/**
 * Learnix Desktop Runtime Abstraction (Electron-Ready Architecture)
 *
 * Keeps the Next.js web application decoupled from desktop APIs so a future
 * Windows Electron wrapper can expose a typed `window.learnixDesktop` preload
 * bridge without changing UI components or weakening web security.
 */

export interface LearnixDesktopBridge {
  readonly platform: "win32" | "darwin" | "linux";
  readonly appVersion: string;
  readonly isKioskModeSupported: boolean;
  openExternalUrl(url: string): Promise<void>;
  notifyNative(title: string, body: string): Promise<void>;
}

declare global {
  interface Window {
    learnixDesktop?: LearnixDesktopBridge;
  }
}

export function isDesktopAppRuntime(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.learnixDesktop !== "undefined"
  );
}

export function getDesktopBridge(): LearnixDesktopBridge | null {
  if (!isDesktopAppRuntime()) return null;
  return window.learnixDesktop ?? null;
}

export async function openSafeExternalLink(url: string): Promise<void> {
  const bridge = getDesktopBridge();
  if (bridge) {
    await bridge.openExternalUrl(url);
    return;
  }
  if (typeof window !== "undefined") {
    window.open(url, "_blank", "noopener,noreferrer");
  }
}
