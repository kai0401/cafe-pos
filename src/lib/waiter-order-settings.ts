export type WaiterOrderSettings = {
  confirmBeforeSend: boolean;
  confirmBeforeCancel: boolean;
};

const STORAGE_KEY = "waiter-order-settings";

const DEFAULTS: WaiterOrderSettings = {
  confirmBeforeSend: true,
  confirmBeforeCancel: true,
};

export function loadWaiterOrderSettings(): WaiterOrderSettings {
  if (typeof window === "undefined") return DEFAULTS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULTS;
    const parsed = JSON.parse(raw) as Partial<WaiterOrderSettings>;
    return {
      confirmBeforeSend: parsed.confirmBeforeSend ?? DEFAULTS.confirmBeforeSend,
      confirmBeforeCancel: parsed.confirmBeforeCancel ?? DEFAULTS.confirmBeforeCancel,
    };
  } catch {
    return DEFAULTS;
  }
}

export function saveWaiterOrderSettings(settings: WaiterOrderSettings) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}
