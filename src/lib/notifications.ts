/**
 * Maher Platform Notification System
 */

export async function requestNotificationPermission() {
  if (!("Notification" in window)) {
    console.warn("This browser does not support desktop notification");
    return false;
  }

  if (Notification.permission === "granted") {
    return true;
  }

  if (Notification.permission !== "denied") {
    const permission = await Notification.requestPermission();
    return permission === "granted";
  }

  return false;
}

export function sendNotification(title: string, options?: NotificationOptions) {
  if (!("Notification" in window) || Notification.permission !== "granted") {
    return;
  }

  // Only show if the document is hidden
  if (document.visibilityState === 'hidden') {
    return new Notification(title, {
      icon: '/AppIcon~ios-marketing.png',
      ...options
    });
  }
}

/**
 * Specifically for admin broadcast notifications
 */
export function sendAdminNotification(title: string, body: string) {
    if (!("Notification" in window) || Notification.permission !== "granted") {
      return;
    }
  
    return new Notification(title, {
      body,
      icon: '/AppIcon~ios-marketing.png',
      tag: 'admin-broadcast',
      requireInteraction: true
    });
}
