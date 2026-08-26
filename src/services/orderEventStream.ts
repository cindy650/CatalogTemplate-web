import type { OrderSavedEvent, SseNotificationEvent } from '@shared/events';
import { apiBaseUrl } from '../api/httpClient';

const orderSavedEventType = 'order.saved';

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object';
}

function isSseNotificationEvent(value: unknown): value is SseNotificationEvent {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === 'string' &&
    typeof value.type === 'string' &&
    value.type.trim().length > 0 &&
    typeof value.created_at === 'string' &&
    typeof value.msg === 'string' &&
    (value.data === undefined || isRecord(value.data))
  );
}

function isOrderSavedEvent(value: SseNotificationEvent): value is OrderSavedEvent {
  return value.type === orderSavedEventType
    && isRecord(value.data)
    && isRecord(value.data.order);
}

function getOrderEventsUrl(): string | undefined {
  return apiBaseUrl ? `${apiBaseUrl}/events` : undefined;
}

type OrderEventStreamOptions = {
  onOrderSaved(event: OrderSavedEvent): void;
  onNotification?(event: SseNotificationEvent): void;
};

export function connectOrderEventStream({ onOrderSaved, onNotification }: OrderEventStreamOptions): () => void {
  const eventsUrl = getOrderEventsUrl();
  if (!eventsUrl) return () => undefined;

  const events = new EventSource(eventsUrl);
  const handleEvent = (rawEvent: Event) => {
    const event = rawEvent as MessageEvent<string>;
    try {
      const payload: unknown = JSON.parse(event.data);
      if (!isSseNotificationEvent(payload)) {
        console.warn('[SSE] 忽略格式不符合约定的通知事件。');
        return;
      }
      if (isOrderSavedEvent(payload)) onOrderSaved(payload);
      else onNotification?.(payload);
    } catch (error) {
      console.warn('[SSE] 无法解析通知事件。', error);
    }
  };

  events.addEventListener(orderSavedEventType, handleEvent);
  events.onmessage = handleEvent;

  return () => {
    events.removeEventListener(orderSavedEventType, handleEvent);
    events.onmessage = null;
    events.close();
  };
}
