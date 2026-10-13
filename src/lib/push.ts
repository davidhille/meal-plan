// Push im Browser: Unterstützung prüfen, Gerät an- und abmelden

/** Kann dieser Browser Push überhaupt? (iPhone/iPad: nur als installierte App vom Home-Bildschirm) */
export function pushSupport(): 'ok' | 'ios-install' | 'unsupported' {
  const hasPush = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  if (hasPush) return 'ok';
  const ios = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const standalone = window.matchMedia?.('(display-mode: standalone)').matches;
  return ios && !standalone ? 'ios-install' : 'unsupported';
}

function keyBytes(base64url: string): ArrayBuffer {
  const b64 = base64url.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((base64url.length + 3) % 4);
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)).buffer as ArrayBuffer;
}

/** Aktuelle Anmeldung dieses Geräts (oder null) */
export async function currentSubscription(): Promise<PushSubscription | null> {
  if (pushSupport() !== 'ok') return null;
  const reg = await navigator.serviceWorker.ready;
  return reg.pushManager.getSubscription();
}

/** Erlaubnis holen und Gerät beim Push-Dienst anmelden. Wirft mit verständlicher Meldung. */
export async function subscribeThisDevice(publicKey: string): Promise<PushSubscription> {
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    throw new Error('Benachrichtigungen sind für diese Seite nicht erlaubt. Bitte in den Browser-Einstellungen zulassen.');
  }
  const reg = await navigator.serviceWorker.ready;
  const existing = await reg.pushManager.getSubscription();
  // Alte Anmeldung mit anderem Schlüssel (z. B. nach Neuerzeugung) ersetzen
  if (existing) {
    const key = existing.options?.applicationServerKey;
    const same = key && new Uint8Array(key).join() === new Uint8Array(keyBytes(publicKey)).join();
    if (same) return existing;
    await existing.unsubscribe().catch(() => {});
  }
  return reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(publicKey) });
}

/** Kurzer Gerätename für die Liste, z. B. „iPhone“ oder „Chrome auf Windows“ */
export function deviceLabel(): string {
  const ua = navigator.userAgent;
  if (/iPhone/.test(ua)) return 'iPhone';
  if (/iPad/.test(ua)) return 'iPad';
  if (/Android/.test(ua)) return 'Android';
  const browser = /Edg\//.test(ua) ? 'Edge' : /Firefox\//.test(ua) ? 'Firefox' : /Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : 'Browser';
  const os = /Windows/.test(ua) ? 'Windows' : /Mac OS X/.test(ua) ? 'Mac' : /Linux/.test(ua) ? 'Linux' : '';
  return os ? `${browser} auf ${os}` : browser;
}
