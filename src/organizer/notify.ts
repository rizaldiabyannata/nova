import { isPermissionGranted, requestPermission, sendNotification } from '@tauri-apps/plugin-notification';
import { isTauri } from '../config/storage';

/** A desktop notification; failing to show one is logged, never thrown. */
export async function notify(title: string, body: string): Promise<void> {
  try {
    if (isTauri) {
      if (!(await isPermissionGranted()) && (await requestPermission()) !== 'granted') return;
      sendNotification({ title, body });
    } else if ('Notification' in window) {
      if (Notification.permission !== 'granted' && (await Notification.requestPermission()) !== 'granted') return;
      new Notification(title, { body });
    }
  } catch (err) {
    console.warn('[nova] notification failed:', err);
  }
}
