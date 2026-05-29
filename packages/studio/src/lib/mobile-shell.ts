export function isNativeMobileShell(): boolean {
  if (typeof window === "undefined") return false;
  const maybeCapacitor = (window as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
  if (maybeCapacitor?.isNativePlatform?.()) return true;
  return window.location.protocol === "capacitor:";
}
