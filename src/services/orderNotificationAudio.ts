const orderNotificationAudioPath = '/pyk-toon-n-n.mp3';

let orderNotificationAudio: HTMLAudioElement | undefined;

/** Plays the bundled notification sound and ignores browser autoplay failures. */
export function playOrderNotificationSound(): void {
  if (typeof window === 'undefined' || typeof window.Audio !== 'function') return;

  orderNotificationAudio ??= new window.Audio(orderNotificationAudioPath);
  orderNotificationAudio.currentTime = 0;
  void orderNotificationAudio.play().catch(() => undefined);
}
