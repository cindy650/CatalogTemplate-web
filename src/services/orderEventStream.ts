import type { OrderSavedEvent, SseNotificationEvent } from '@shared/events';
import { apiBaseUrl } from '../api/httpClient';

const orderSavedEventType = 'order.saved';

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object';
}

function isOrderSavedEvent(value: SseNotificationEvent): value is OrderSavedEvent {
  return value.type === orderSavedEventType
    && isRecord(value.data)
    && isRecord(value.data.order);
}

function normalizeEventPayload(raw: unknown, eventName: string, eventId: string): SseNotificationEvent | undefined {
  const source = isRecord(raw) ? raw : { msg: typeof raw === 'string' ? raw : '' };
  const msg = typeof source.msg === 'string'
    ? source.msg
    : typeof source.message === 'string'
      ? source.message
      : isRecord(source.data) && typeof source.data.message === 'string' ? source.data.message : '';
  if (!msg.trim()) return undefined;
  const type = typeof source.type === 'string' && source.type.trim()
    ? source.type.trim()
    : eventName || 'message';
  const id = typeof source.id === 'string' && source.id.trim()
    ? source.id
    : eventId || `${type}:${Date.now()}`;
  const createdAt = typeof source.created_at === 'string' && source.created_at.trim()
    ? source.created_at
    : new Date().toISOString();
  return {
    id,
    type,
    created_at: createdAt,
    msg,
    ...(isRecord(source.data) ? { data: source.data } : {}),
  };
}

type OrderEventStreamOptions = {
  onOrderSaved(event: OrderSavedEvent): void;
  onNotification?(event: SseNotificationEvent): void;
};

export function connectOrderEventStream({ onOrderSaved, onNotification }: OrderEventStreamOptions): () => void {
  const eventsUrl = apiBaseUrl ? `${apiBaseUrl}/events` : undefined;
  if (!eventsUrl || typeof window === 'undefined' || typeof window.EventSource !== 'function') return () => undefined;

  const source = new window.EventSource(eventsUrl, { withCredentials: true });
  const dispatchEvent = (rawEvent: Event) => {
    const event = rawEvent as MessageEvent<string>;
    try {
      const payload = normalizeEventPayload(JSON.parse(event.data), event.type, event.lastEventId);
      if (!payload) return;
      if (isOrderSavedEvent(payload)) onOrderSaved(payload);
      else onNotification?.(payload);
    } catch (error) {
      console.warn('[SSE] 无法解析通知事件。', error);
    }
  };

  source.addEventListener('message', dispatchEvent);
  source.addEventListener(orderSavedEventType, dispatchEvent);
  source.onerror = () => {
    // EventSource reconnects automatically; closing here would disable that behavior.
    if (source.readyState === window.EventSource.CLOSED) {
      console.warn('[SSE] 连接已关闭。');
    }
  };

  return () => {
    source.removeEventListener('message', dispatchEvent);
    source.removeEventListener(orderSavedEventType, dispatchEvent);
    source.onerror = null;
    source.close();
  };
}
