export type MobilePlatform = "ios" | "android" | "other";

export function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    ("standalone" in navigator &&
      (navigator as Navigator & { standalone?: boolean }).standalone === true)
  );
}

export function detectPlatform(): MobilePlatform {
  if (typeof navigator === "undefined") return "other";
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/i.test(ua)) return "ios";
  if (/Android/i.test(ua)) return "android";
  return "other";
}

/** QR・LINE等の内蔵ブラウザ（Safari/Chrome本体ではない） */
export function isInAppBrowser(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/i.test(ua)) {
    // iOS Safari には Version/ が付く。Chrome iOS は CriOS
    if (/CriOS|FxiOS|EdgiOS|Line|Instagram|FBAN|FBAV|Twitter/i.test(ua)) return true;
    if (/Safari/i.test(ua) && /Version\//i.test(ua)) return false;
    return !/Safari/i.test(ua);
  }
  if (/Android/i.test(ua)) {
    return /Line|Instagram|FBAN|FBAV|Twitter|wv\)/i.test(ua);
  }
  return false;
}

export const INSTALL_DISMISS_KEY = "waiter-install-dismissed";

export function dismissInstallPrompt() {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(INSTALL_DISMISS_KEY, "1");
}

export function isInstallDismissed(): boolean {
  if (typeof localStorage === "undefined") return false;
  return localStorage.getItem(INSTALL_DISMISS_KEY) === "1";
}
