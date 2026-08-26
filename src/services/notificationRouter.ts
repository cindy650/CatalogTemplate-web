type NotificationRouterOptions = {
  title: string;
  body: string;
  inApp: () => void;
  tag?: string;
};

let notificationPermissionRequest: Promise<NotificationPermission> | undefined;

export function requestSystemNotificationPermission(): Promise<NotificationPermission | undefined> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return Promise.resolve(undefined);
  }

  if (window.Notification.permission !== 'default') {
    return Promise.resolve(window.Notification.permission);
  }

  notificationPermissionRequest ??= window.Notification.requestPermission().catch(() => 'default');
  return notificationPermissionRequest;
}

function isCurrentAppTab(): boolean {
  return typeof document !== 'undefined'
    && document.visibilityState === 'visible'
    && document.hasFocus();
}

/** Uses an in-app notice only while this project tab is both visible and focused. */
export async function notifyByVisibility({ title, body, inApp, tag }: NotificationRouterOptions): Promise<void> {
  if (isCurrentAppTab()) {
    inApp();
    return;
  }

  if (typeof window === 'undefined' || !('Notification' in window)) return;

  const permission = await requestSystemNotificationPermission();
  if (permission !== 'granted') return;

  try {
    const systemNotification = new window.Notification(title, {
      body,
      ...(tag ? { tag } : {})
    });
    systemNotification.onclick = () => {
      window.focus();
      systemNotification.close();
    };
  } catch {
    // Notification construction can still fail in restricted browser contexts.
  }
}
